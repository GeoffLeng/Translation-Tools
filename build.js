import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runBuild() {
  console.log('开始编译 Translate FY 扩展...');

  // 1. 编译页面 (popup, options, pdf_viewer)
  console.log('1. 编译用户界面页面...');
  await build({
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: path.resolve(__dirname, 'popup.html'),
          options: path.resolve(__dirname, 'options.html'),
          pdf_viewer: path.resolve(__dirname, 'pdf_viewer.html'),
        }
      }
    }
  });

  // 2. 编译 Background Service Worker (独立单文件)
  console.log('2. 编译后台服务脚本 (background.js)...');
  await build({
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: path.resolve(__dirname, 'src/background.js'),
        name: 'background',
        formats: ['iife'],
        fileName: () => 'background.js',
      },
      rollupOptions: {
        output: {
          extend: true
        }
      }
    }
  });

  // 3. 编译 Content Script (独立单文件)
  console.log('3. 编译页面内容注入脚本 (content.js)...');
  await build({
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: path.resolve(__dirname, 'src/content.js'),
        name: 'content',
        formats: ['iife'],
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          extend: true
        }
      }
    }
  });

  // 4. 拷贝静态资源 (manifest.json, icons)
  console.log('4. 复制清单与图标资源...');
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
  }
  fs.copyFileSync('manifest.json', 'dist/manifest.json');

  if (!fs.existsSync('dist/icons')) {
    fs.mkdirSync('dist/icons', { recursive: true });
  }
  const iconFiles = fs.readdirSync('icons');
  for (const file of iconFiles) {
    fs.copyFileSync(path.join('icons', file), path.join('dist/icons', file));
  }

  console.log('5. 部署 PDF.js Worker...');
  // 拷贝 pdf.worker.mjs 或者是 pdf.worker.min.mjs 使得 PDF 渲染器能离线运行
  // pdfjs-dist 库的 worker 在 node_modules/pdfjs-dist/build/pdf.worker.mjs 路径下
  const workerSrc = path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.mjs');
  const workerDest = path.resolve(__dirname, 'dist/pdf.worker.js');
  if (fs.existsSync(workerSrc)) {
    fs.copyFileSync(workerSrc, workerDest);
    console.log('PDF.js Worker 部署完成');
  } else {
    // 降级，看是否有 pdf.worker.js (某些旧版本)
    const legacyWorkerSrc = path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.js');
    if (fs.existsSync(legacyWorkerSrc)) {
      fs.copyFileSync(legacyWorkerSrc, workerDest);
      console.log('PDF.js Worker 部署完成 (旧版本)');
    } else {
      console.warn('警告: 未找到本地 pdfjs-dist worker，PDF 查词时将使用 CDN。');
    }
  }

  console.log('编译完成！输出目录：/dist');
}

runBuild().catch(err => {
  console.error('编译出错：', err);
  process.exit(1);
});
