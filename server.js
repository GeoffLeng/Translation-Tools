// server.js - 本地独立 Web 与 PDF 翻译后端服务 (零外部依赖，极速纯 Node.js 实现)
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

// 极简 Google 免费翻译通道
async function translateWithGoogle(text, targetLang = 'zh-CN') {
  const encText = encodeURIComponent(text);
  const reqUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encText}`;
  return new Promise((resolve, reject) => {
    https.get(reqUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
            const translated = parsed[0].map(item => item[0]).filter(Boolean).join('');
            resolve(translated);
          } else {
            resolve(text);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. API: 批量翻译代理接口
  if (pathname === '/api/translate-batch' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { items, targetLang = 'zh-CN' } = payload;
        if (!Array.isArray(items)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'items 必须为数组' }));
          return;
        }

        const translations = [];
        // 并发批处理
        const batchPromises = items.map(async (item) => {
          try {
            const trans = await translateWithGoogle(item.text, targetLang);
            return { id: item.id, text: trans };
          } catch (e) {
            return { id: item.id, text: item.text };
          }
        });

        const results = await Promise.all(batchPromises);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, translations: results }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 2. API: PDF 防盗链与跨域抓取代理
  if (pathname === '/api/proxy-pdf' && req.method === 'GET') {
    const pdfUrl = parsedUrl.query.url;
    if (!pdfUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('缺少 url 参数');
      return;
    }

    try {
      const client = pdfUrl.startsWith('https') ? https : http;
      client.get(pdfUrl, (pdfRes) => {
        res.writeHead(pdfRes.statusCode, {
          'Content-Type': 'application/pdf',
          'Access-Control-Allow-Origin': '*'
        });
        pdfRes.pipe(res);
      }).on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`下载远程 PDF 失败: ${err.message}`);
      });
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`代理异常: ${err.message}`);
    }
    return;
  }

  // 3. 静态资源托管 (优先使用 dist 编译产物，不存在则回退至源码根目录)
  let relativePath = pathname === '/' ? '/pdf_viewer.html' : pathname;
  let filePath = path.join(__dirname, 'dist', relativePath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, relativePath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Lite Translate 本地独立 PDF 翻译服务端已启动！`);
  console.log(`📡 本地访问地址: http://localhost:${PORT}/pdf_viewer.html`);
  console.log(`⚡ 支持无插件独立运行、PDF防盗链代理与批量翻译接口`);
  console.log(`======================================================\n`);
});
