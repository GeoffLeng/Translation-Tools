// Background Service Worker for Lite Translate
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'translateSelection',
    title: '翻译选中内容',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'openPdfInExtension',
    title: '在阅读器中打开此 PDF',
    contexts: ['link']
  });
});

// 右键菜单点击事件监听
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translateSelection' && tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'showSelectionTranslatePopup',
      text: info.selectionText
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn('无法向内容脚本发送消息：', chrome.runtime.lastError.message);
      }
    });
  } else if (info.menuItemId === 'openPdfInExtension' && tab.id) {
    const linkUrl = info.linkUrl;
    if (linkUrl) {
      const cleanUrl = linkUrl.split('?')[0].split('#')[0].toLowerCase();
      if (cleanUrl.endsWith('.pdf') || linkUrl.toLowerCase().includes('/pdf/')) {
        const viewerUrl = chrome.runtime.getURL('pdf_viewer.html') + '?file=' + encodeURIComponent(linkUrl);
        chrome.tabs.create({ url: viewerUrl });
      }
    }
  }
});

// 请求超时包装器 (防止网络挂起)
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return res;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`请求超时 (${timeoutMs / 1000}s)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// 2. 传统与免 Key 翻译服务逻辑
async function translateGoogle(text, targetLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetchWithTimeout(url, {}, 10000);
  if (!res.ok) throw new Error(`Google API 错误: ${res.statusText}`);
  const data = await res.json();
  if (data && Array.isArray(data[0])) {
    return data[0].map(item => (item && item[0] ? item[0] : '')).join('');
  }
  throw new Error('Google 翻译没有返回有效内容');
}

// Bing 翻译 (免 Key·微软全球高速通道)
let bingTokenCache = {
  ig: '',
  iid: '',
  key: '',
  token: '',
  expiresAt: 0
};

async function getBingToken() {
  const now = Date.now();
  if (bingTokenCache.token && now < bingTokenCache.expiresAt) {
    return bingTokenCache;
  }

  const res = await fetchWithTimeout('https://www.bing.com/translator', {}, 10000);
  if (!res.ok) throw new Error('无法连接到 Bing 翻译服务');
  const html = await res.text();

  const igMatch = html.match(/IG:"([A-F0-9]+)"/i);
  const iidMatch = html.match(/data-iid="([^"]+)"/i);
  const tokenMatch = html.match(/var\s+params_AbusePreventionHelper\s*=\s*\[([0-9]+),\"([^\"]+)\"/);

  if (!tokenMatch) throw new Error('解析 Bing 防刷令牌失败');

  bingTokenCache = {
    ig: igMatch ? igMatch[1] : '',
    iid: iidMatch ? iidMatch[1] : 'translator.5028',
    key: tokenMatch[1],
    token: tokenMatch[2],
    expiresAt: now + 15 * 60 * 1000 // 缓存 15 分钟
  };
  return bingTokenCache;
}

async function translateBing(text, targetLang) {
  const langMap = {
    'zh-CN': 'zh-Hans',
    'en': 'en',
    'ja': 'ja',
    'ko': 'ko'
  };
  const to = langMap[targetLang] || targetLang;

  let tokenInfo = await getBingToken();

  const doReq = async (info) => {
    const params = new URLSearchParams();
    params.append('fromLang', 'auto-detect');
    params.append('text', text);
    params.append('to', to);
    params.append('key', info.key);
    params.append('token', info.token);

    const url = `https://www.bing.com/ttranslatev3?isVertical=1&IG=${info.ig}&IID=${info.iid}`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    }, 10000);
    if (!res.ok) throw new Error(`Bing 请求失败: HTTP ${res.status}`);
    return await res.json();
  };

  let data = await doReq(tokenInfo);
  if (!data || !data[0] || !data[0].translations) {
    // 令牌失效则重置缓存重试
    bingTokenCache.expiresAt = 0;
    tokenInfo = await getBingToken();
    data = await doReq(tokenInfo);
  }

  if (data && data[0] && data[0].translations && data[0].translations[0]) {
    return data[0].translations[0].text;
  }
  throw new Error('Bing 翻译未能返回有效结果');
}

// DeepL 翻译 (支持免 Key 通道或官方 50万字符/月 免费 Key)
async function translateDeepL(text, targetLang, apiKey, customEndpoint) {
  const langMap = {
    'zh-CN': 'ZH',
    'en': 'EN-US',
    'ja': 'JA',
    'ko': 'KO'
  };
  const target = langMap[targetLang] || targetLang.toUpperCase();

  // 若用户配置了官方 API Key
  if (apiKey && apiKey.trim()) {
    const key = apiKey.trim();
    const isFree = key.endsWith(':fx');
    const defaultEndpoint = isFree ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';
    const endpoint = (customEndpoint && customEndpoint.trim()) ? customEndpoint.trim() : defaultEndpoint;

    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: [text],
        target_lang: target
      })
    }, 12000);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `DeepL API 错误: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.translations && data.translations[0]) {
      return data.translations[0].text;
    }
    throw new Error('DeepL 未返回有效翻译文本');
  }

  // 免 Key 快捷通道 (DeepLX 协议兼容接口)
  const endpoint = (customEndpoint && customEndpoint.trim()) ? customEndpoint.trim() : 'https://api.deeplx.org/translate';
  const res = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text,
      source_lang: 'auto',
      target_lang: target
    })
  }, 12000);
  if (!res.ok) {
    throw new Error(`DeepL 免 Key 通道响应异常: HTTP ${res.status}。建议在设置中填入 DeepL 官方免费 API Key (每月50万字符免费)`);
  }
  const data = await res.json();
  if (data.data) return data.data;
  if (data.translations && data.translations[0]) return data.translations[0].text;
  throw new Error('DeepL 接口返回数据格式异常');
}

// 计算 SHA256 签名 (用于有道智云 API v3 鉴权)
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function truncateForYoudao(q) {
  const len = q.length;
  if (len <= 20) return q;
  return q.substring(0, 10) + len + q.substring(len - 10);
}

async function translateYoudao(text, targetLang, appKey, appSecret) {
  if (!appKey || !appSecret) {
    throw new Error('未配置有道智云 AppKey 或 AppSecret，请在设置中配置');
  }

  let toLang = targetLang;
  if (targetLang === 'zh-CN') toLang = 'zh-CHS';

  const salt = Date.now().toString();
  const curtime = Math.round(Date.now() / 1000).toString();
  const signStr = appKey + truncateForYoudao(text) + salt + curtime + appSecret;
  const sign = await sha256(signStr);

  const params = new URLSearchParams({
    q: text,
    from: 'auto',
    to: toLang,
    appKey: appKey,
    salt: salt,
    curtime: curtime,
    signType: 'v3',
    sign: sign
  });

  const res = await fetchWithTimeout('https://openapi.youdao.com/api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  }, 10000);

  if (!res.ok) {
    throw new Error(`有道智云 HTTP 错误: ${res.status}`);
  }

  const data = await res.json();
  if (data.errorCode === '0' && Array.isArray(data.translation)) {
    return data.translation.join('\n');
  }

  const errorMessages = {
    '101': '缺少必填的参数',
    '102': '不支持的语言类型',
    '103': '翻译文本过长',
    '108': '应用 ID 无效，请检查 AppKey',
    '110': '无相关服务的访问权限',
    '111': '开发者账号无效',
    '113': 'q 不能为空',
    '202': '签名检验失败，请检查 AppSecret',
    '401': '账户欠费或无额度，请在有道智云充值或使用体验额度',
    '411': '访问频率受限'
  };

  throw new Error(errorMessages[data.errorCode] || `有道智云接口错误代码: ${data.errorCode}`);
}

// 3. AI 翻译服务逻辑

// Google Gemini 官方接口翻译 (终身免费额度)
async function translateGemini(text, targetLang, apiKey, modelName) {
  if (!apiKey) throw new Error('未配置 Gemini API Key，请在设置中配置');
  const cleanModel = (modelName || 'gemini-2.0-flash').replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;
  const langName = targetLang === 'zh-CN' ? '中文(简体)' : (targetLang === 'en' ? '英语' : (targetLang === 'ja' ? '日语' : '韩语'));
  
  const prompt = `你是一个专业的翻译官。请将以下文本翻译为${langName}。如果输入内容已经是${langName}，则将其翻译为另一种语言（如中英互译）。
请直接输出翻译结果，不要包含任何前导词、解释、注脚或标点说明。
待翻译文本如下：
${text}`;

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  }, 20000);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gemini API 错误: ${res.status}`);
  }

  const data = await res.json();
  if (data.candidates && data.candidates[0]?.content?.parts[0]) {
    return data.candidates[0].content.parts[0].text.trim();
  }
  throw new Error('Gemini 没有返回有效翻译内容');
}

// OpenAI 兼容 API 翻译 (适用于 智谱 GLM, DeepSeek, OpenRouter, OpenCode, 硅基流动, Groq, 自定义模型等)
async function translateOpenAICompatible(text, targetLang, apiKey, endpoint, modelName) {
  if (!apiKey) throw new Error('该服务未配置 API Key，请在设置中配置');
  if (!endpoint) throw new Error('接口地址未配置');

  const langName = targetLang === 'zh-CN' ? '中文(简体)' : (targetLang === 'en' ? '英语' : (targetLang === 'ja' ? '日语' : '韩语'));
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://github.com/GeoffLeng/Translation-Tools',
    'X-Title': 'Lite Translate'
  };

  const res = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: '你是一个专业的翻译官。请直接将用户输入的文本翻译为目标语言。请直接输出翻译结果，不要包含任何解释、前导词、注脚或说明。'
        },
        {
          role: 'user',
          content: `将以下文本翻译为 ${langName}：\n\n${text}`
        }
      ],
      temperature: 0.3
    })
  }, 25000);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API 错误: ${res.status}`);
  }

  const data = await res.json();
  const choice = data.choices && data.choices[0];
  if (choice) {
    const content = choice.message?.content;
    if (typeof content === 'string' && content.trim()) {
      return content.trim();
    }
    if (Array.isArray(content)) {
      const merged = content.map(part => (part && part.text) ? part.text : '').join('').trim();
      if (merged) return merged;
    }
    if (choice.text && typeof choice.text === 'string' && choice.text.trim()) {
      return choice.text.trim();
    }
  }
  throw new Error('API 没有返回有效的翻译文本内容');
}

// 3.5 结构化批量翻译逻辑 (Batch Context Prompting)
async function translateBatchOpenAICompatible(items, targetLang, apiKey, endpoint, modelName) {
  if (!apiKey) throw new Error('该服务未配置 API Key，请在设置中配置');
  if (!endpoint) throw new Error('接口地址未配置');

  const langName = targetLang === 'zh-CN' ? '中文(简体)' : (targetLang === 'en' ? '英语' : (targetLang === 'ja' ? '日语' : '韩语'));
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://github.com/GeoffLeng/Translation-Tools',
    'X-Title': 'Lite Translate'
  };

  const systemPrompt = `你是一个专业的高级学术与文档翻译专家。请将待翻译的 JSON 数组中的每一个段落翻译为 ${langName}。
严格遵循以下要求：
1. 保持每一个对象的 "id" 字段与原始输入严格一致。
2. 仅翻译 "text" 字段的内容，专业术语翻译需严谨规范。
3. 必须输出且仅输出合法的纯 JSON 数组，格式为 [{"id": 0, "text": "译文"}...]。
4. 严禁包含任何 Markdown 代码块标记（如 \`\`\`json ），严禁附加任何解释、前导词或注脚。`;

  const userPrompt = JSON.stringify(items.map(item => ({ id: item.id, text: item.text })));

  const res = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2
    })
  }, 40000);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API 错误: ${res.status}`);
  }

  const data = await res.json();
  const choice = data.choices && data.choices[0];
  let rawContent = '';
  if (choice) {
    const content = choice.message?.content;
    if (typeof content === 'string') rawContent = content.trim();
    else if (Array.isArray(content)) rawContent = content.map(p => (p && p.text) ? p.text : '').join('').trim();
    else if (choice.text) rawContent = choice.text.trim();
  }

  if (!rawContent) throw new Error('API 没有返回翻译内容');

  let cleanJson = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed)) {
      return parsed.map(p => ({ id: p.id, text: p.text }));
    }
  } catch (parseErr) {
    const matched = [];
    const objRegex = /\{"id"\s*:\s*([^,]+),\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\}/g;
    let match;
    while ((match = objRegex.exec(cleanJson)) !== null) {
      try {
        const idVal = JSON.parse(match[1]);
        const textVal = JSON.parse(`"${match[2]}"`);
        matched.push({ id: idVal, text: textVal });
      } catch (e) {}
    }
    if (matched.length > 0) return matched;
    throw new Error('批量翻译解析 JSON 失败: ' + parseErr.message);
  }
  throw new Error('批量翻译返回数据非数组格式');
}

async function translateBatchGemini(items, targetLang, apiKey, modelName) {
  if (!apiKey) throw new Error('未配置 Gemini API Key，请在设置中配置');
  const cleanModel = (modelName || 'gemini-2.0-flash').replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;
  const langName = targetLang === 'zh-CN' ? '中文(简体)' : (targetLang === 'en' ? '英语' : (targetLang === 'ja' ? '日语' : '韩语'));

  const prompt = `你是一个专业的高级学术与文档翻译专家。请将待翻译的 JSON 数组中的每一个段落翻译为 ${langName}。
严格遵循以下要求：
1. 保持每一个对象的 "id" 字段与原始输入严格一致。
2. 仅翻译 "text" 字段的内容。
3. 必须输出且仅输出合法的纯 JSON 数组，格式为 [{"id": 0, "text": "译文"}...]。
4. 严禁包含任何 Markdown 标记（如 \`\`\`json ），严禁附加任何解释。
待翻译数据：
${JSON.stringify(items.map(i => ({ id: i.id, text: i.text })))}`;

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  }, 40000);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gemini API 错误: ${res.status}`);
  }

  const data = await res.json();
  const rawContent = data.candidates && data.candidates[0]?.content?.parts[0]?.text?.trim();
  if (!rawContent) throw new Error('Gemini 没有返回翻译内容');

  let cleanJson = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed)) {
      return parsed.map(p => ({ id: p.id, text: p.text }));
    }
  } catch (e) {
    const matched = [];
    const objRegex = /\{"id"\s*:\s*([^,]+),\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\}/g;
    let match;
    while ((match = objRegex.exec(cleanJson)) !== null) {
      try {
        const idVal = JSON.parse(match[1]);
        const textVal = JSON.parse(`"${match[2]}"`);
        matched.push({ id: idVal, text: textVal });
      } catch (err) {}
    }
    if (matched.length > 0) return matched;
    throw new Error('Gemini 批量翻译解析 JSON 失败');
  }
  throw new Error('Gemini 批量翻译返回数据非数组格式');
}

async function translateBatchGoogle(items, targetLang) {
  // 并发请求翻译各个独立段落，彻底消除分隔符被误翻译（如_分割_标签）导致的串段与文字重叠
  const results = new Array(items.length);
  const CONCURRENCY = 6;
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      if (idx >= items.length) break;
      const item = items[idx];
      try {
        const trans = await translateGoogle(item.text, targetLang);
        results[idx] = { id: item.id, text: trans || item.text };
      } catch (err) {
        results[idx] = { id: item.id, text: item.text };
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function translateBatchDeepL(items, targetLang, apiKey, customEndpoint) {
  const langMap = { 'zh-CN': 'ZH', 'en': 'EN-US', 'ja': 'JA', 'ko': 'KO' };
  const target = langMap[targetLang] || targetLang.toUpperCase();

  if (apiKey && apiKey.trim()) {
    const key = apiKey.trim();
    const isFree = key.endsWith(':fx');
    const defaultEndpoint = isFree ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';
    const endpoint = (customEndpoint && customEndpoint.trim()) ? customEndpoint.trim() : defaultEndpoint;

    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: items.map(i => i.text),
        target_lang: target
      })
    }, 25000);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `DeepL API 错误: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.translations && Array.isArray(data.translations)) {
      return items.map((item, idx) => ({
        id: item.id,
        text: data.translations[idx]?.text || item.text
      }));
    }
    throw new Error('DeepL 未返回有效翻译文本');
  }

  // 免Key模式同样采用高并发独立通道，杜绝分隔符篡改
  const results = new Array(items.length);
  const CONCURRENCY = 4;
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      if (idx >= items.length) break;
      const item = items[idx];
      try {
        const trans = await translateDeepL(item.text, targetLang, '', customEndpoint);
        results[idx] = { id: item.id, text: trans || item.text };
      } catch (err) {
        results[idx] = { id: item.id, text: item.text };
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function translateBatchGeneric(items, engine, targetLang, settings) {
  const results = [];
  const CONCURRENCY = 5;
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const current = items[idx++];
      if (!current) break;
      try {
        let t = '';
        if (engine === 'bing') t = await translateBing(current.text, targetLang);
        else if (engine === 'youdao') t = await translateYoudao(current.text, targetLang, settings.youdaoAppKey, settings.youdaoAppSecret);
        else t = await translateGoogle(current.text, targetLang);
        results.push({ id: current.id, text: t });
      } catch (e) {
        results.push({ id: current.id, text: `[翻译失败: ${e.message}]` });
      }
    }
  }
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// 辅助：从 Chat Endpoint 推导 Models Endpoint
function deriveModelsUrl(endpoint, fallbackUrl) {
  let url = (endpoint && endpoint.trim()) ? endpoint.trim() : fallbackUrl;
  if (!url) return '';
  const [base, query] = url.split('?');
  let cleanBase = base.replace(/\/+$/, '');
  if (cleanBase.endsWith('/chat/completions')) {
    cleanBase = cleanBase.replace(/\/chat\/completions$/, '/models');
  } else if (cleanBase.endsWith('/completions')) {
    cleanBase = cleanBase.replace(/\/completions$/, '/models');
  } else if (cleanBase.endsWith('/messages')) {
    cleanBase = cleanBase.replace(/\/messages$/, '/models');
  } else if (!cleanBase.includes('/models')) {
    cleanBase = cleanBase + '/models';
  }
  return query ? `${cleanBase}?${query}` : cleanBase;
}

// 4. 服务商可用模型获取逻辑
async function fetchProviderModels(provider, apiKey, customEndpoint) {
  if (!apiKey) throw new Error('请先输入有效的 API Key');

  const defaultHeaders = {
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://github.com/GeoffLeng/Translation-Tools',
    'X-Title': 'Lite Translate'
  };

  // 1) 智谱 GLM（4/4.5/4.7 flash 免费）
  if (provider === 'glm') {
    const res = await fetchWithTimeout('https://open.bigmodel.cn/api/paas/v4/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    }, 12000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `智谱 GLM 请求失败: HTTP ${res.status}`);
    }
    const data = await res.json();
    const fetchedList = (data.data && Array.isArray(data.data)) ? data.data.map(m => m.id) : [];

    // 官方核心免费 Flash 模型集合（确保完整包含并优先置顶）
    const freeFlashModels = ['glm-4-flash', 'glm-4.5-flash', 'glm-4.7-flash', 'glm-4-flashx'];
    const mergedList = [...freeFlashModels];
    fetchedList.forEach(id => {
      if (!mergedList.includes(id)) mergedList.push(id);
    });

    return mergedList.map(id => {
      const isFree = freeFlashModels.includes(id) || id.toLowerCase().includes('flash');
      return {
        id: id,
        name: isFree ? `${id} (免费)` : id,
        isFree: isFree
      };
    });
  }

  // 2) Google Gemini (终身免费额度)
  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetchWithTimeout(url, {}, 12000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini 请求失败: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.models || !Array.isArray(data.models)) throw new Error('Gemini 未返回模型列表');
    return data.models
      .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace(/^models\//, ''))
      .filter(id => !id.includes('embedding') && !id.includes('aqa'));
  }

  // 3) DeepSeek (官方预置)
  if (provider === 'deepseek') {
    const res = await fetchWithTimeout('https://api.deepseek.com/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    }, 12000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `DeepSeek 请求失败: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) throw new Error('DeepSeek 未返回模型列表');
    return data.data.map(m => m.id);
  }

  // 4) OpenRouter
  if (provider === 'openrouter') {
    const res = await fetchWithTimeout('https://openrouter.ai/api/v1/models', {
      headers: defaultHeaders
    }, 15000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenRouter 请求失败: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) throw new Error('OpenRouter 未返回模型列表');
    return data.data.map(m => ({
      id: m.id,
      name: m.name || m.id
    }));
  }

  // 5) OpenCode
  if (provider === 'opencode') {
    const url = deriveModelsUrl(customEndpoint, 'https://api.opencode.ai/v1/models');
    const res = await fetchWithTimeout(url, { headers: defaultHeaders }, 15000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenCode 请求失败: HTTP ${res.status}`);
    }
    const data = await res.json();
    const list = data.data || data.models || [];
    if (!Array.isArray(list)) throw new Error('OpenCode 未返回模型列表');
    return list.map(m => typeof m === 'string' ? { id: m, name: m } : { id: m.id, name: m.name || m.id });
  }

  // 6) OpenAI
  if (provider === 'openai') {
    const url = deriveModelsUrl(customEndpoint, 'https://api.openai.com/v1/models');
    const res = await fetchWithTimeout(url, { headers: { 'Authorization': `Bearer ${apiKey}` } }, 15000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI 请求失败: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) throw new Error('OpenAI 未返回模型列表');
    const filtered = data.data.filter(m => {
      const lower = m.id.toLowerCase();
      return !lower.includes('embedding') && !lower.includes('whisper') && !lower.includes('tts') && !lower.includes('dall-e');
    });
    return filtered.map(m => ({ id: m.id, name: m.name || m.id }));
  }

  // 7) 硅基流动 SiliconFlow
  if (provider === 'siliconflow') {
    const url = deriveModelsUrl(customEndpoint, 'https://api.siliconflow.cn/v1/models');
    const res = await fetchWithTimeout(url, { headers: { 'Authorization': `Bearer ${apiKey}` } }, 15000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `SiliconFlow 请求失败: HTTP ${res.status}`);
    }
    const data = await res.json();
    const list = data.data || data.models || [];
    if (!Array.isArray(list)) throw new Error('SiliconFlow 未返回模型列表');
    return list.map(m => typeof m === 'string' ? { id: m, name: m } : { id: m.id, name: m.name || m.id });
  }

  // 8) Groq
  if (provider === 'groq') {
    const url = deriveModelsUrl(customEndpoint, 'https://api.groq.com/openai/v1/models');
    const res = await fetchWithTimeout(url, { headers: { 'Authorization': `Bearer ${apiKey}` } }, 15000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Groq 请求失败: HTTP ${res.status}`);
    }
    const data = await res.json();
    const list = data.data || data.models || [];
    if (!Array.isArray(list)) throw new Error('Groq 未返回模型列表');
    return list.map(m => typeof m === 'string' ? { id: m, name: m } : { id: m.id, name: m.name || m.id });
  }

  // 9) 通用自定义 OpenAI 兼容接口 / 本地 Ollama
  if (provider === 'custom') {
    const url = deriveModelsUrl(customEndpoint, '');
    if (!url) throw new Error('请先填写接口地址以获取受支持模型');
    const res = await fetchWithTimeout(url, { headers: defaultHeaders }, 15000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `自定义端点请求失败: HTTP ${res.status}`);
    }
    const data = await res.json();
    const list = data.data || data.models || (Array.isArray(data) ? data : []);
    if (!Array.isArray(list) || list.length === 0) throw new Error('未在端点检测到有效模型列表');
    return list.map(m => typeof m === 'string' ? { id: m, name: m } : { id: m.id, name: m.name || m.id });
  }

  throw new Error('不支持的服务商: ' + provider);
}

// 5. 监听 runtime 消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchModels') {
    const { provider, apiKey, endpoint } = request;
    fetchProviderModels(provider, apiKey, endpoint)
      .then(models => {
        sendResponse({ success: true, models });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (request.action === 'translate') {
    const { text, engine, targetLang, model } = request;

    // 读取 API 配置与偏好模型
    chrome.storage.local.get({
      glmApiKey: '',
      glmActiveModel: 'glm-4-flash',
      geminiApiKey: '',
      geminiActiveModel: 'gemini-2.0-flash',
      deepseekApiKey: '',
      deepseekActiveModel: 'deepseek-chat',
      deeplApiKey: '',
      deeplEndpoint: '',
      youdaoAppKey: '',
      youdaoAppSecret: '',
      customModels: []
    }, (settings) => {
      let translationPromise;

      if (engine === 'google') {
        translationPromise = translateGoogle(text, targetLang);
      } else if (engine === 'bing') {
        translationPromise = translateBing(text, targetLang);
      } else if (engine === 'deepl') {
        translationPromise = translateDeepL(text, targetLang, settings.deeplApiKey, settings.deeplEndpoint);
      } else if (engine === 'glm') {
        translationPromise = translateOpenAICompatible(text, targetLang, settings.glmApiKey, 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model || settings.glmActiveModel || 'glm-4-flash');
      } else if (engine === 'gemini') {
        translationPromise = translateGemini(text, targetLang, settings.geminiApiKey, model || settings.geminiActiveModel || 'gemini-2.0-flash');
      } else if (engine === 'deepseek') {
        translationPromise = translateOpenAICompatible(text, targetLang, settings.deepseekApiKey, 'https://api.deepseek.com/chat/completions', model || settings.deepseekActiveModel || 'deepseek-chat');
      } else if (engine === 'youdao') {
        translationPromise = translateYoudao(text, targetLang, settings.youdaoAppKey, settings.youdaoAppSecret);
      } else if (engine && engine.startsWith('custom_')) {
        const customId = engine.substring(7); // "custom_" 长度为 7
        const customModel = settings.customModels.find(m => m.id === customId);
        if (customModel) {
          translationPromise = translateOpenAICompatible(text, targetLang, customModel.apiKey, customModel.endpoint, customModel.modelName);
        } else {
          translationPromise = Promise.reject(new Error('未找到该自定义模型的配置信息'));
        }
      } else {
        translationPromise = Promise.reject(new Error('未支持的引擎：' + engine));
      }

      Promise.resolve(translationPromise)
        .then(translation => {
          sendResponse({ success: true, translation });
        })
        .catch(err => {
          sendResponse({ success: false, error: err.message });
        });
    });

    return true; // 异步支持
  }

  if (request.action === 'translateBatch') {
    const { items, engine, targetLang, model } = request;
    if (!items || !Array.isArray(items) || items.length === 0) {
      sendResponse({ success: true, translations: [] });
      return false;
    }

    chrome.storage.local.get({
      glmApiKey: '',
      glmActiveModel: 'glm-4-flash',
      geminiApiKey: '',
      geminiActiveModel: 'gemini-2.0-flash',
      deepseekApiKey: '',
      deepseekActiveModel: 'deepseek-chat',
      deeplApiKey: '',
      deeplEndpoint: '',
      youdaoAppKey: '',
      youdaoAppSecret: '',
      customModels: []
    }, (settings) => {
      let batchPromise;

      if (engine === 'google') {
        batchPromise = translateBatchGoogle(items, targetLang);
      } else if (engine === 'deepl') {
        batchPromise = translateBatchDeepL(items, targetLang, settings.deeplApiKey, settings.deeplEndpoint);
      } else if (engine === 'glm') {
        batchPromise = translateBatchOpenAICompatible(items, targetLang, settings.glmApiKey, 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model || settings.glmActiveModel || 'glm-4-flash');
      } else if (engine === 'gemini') {
        batchPromise = translateBatchGemini(items, targetLang, settings.geminiApiKey, model || settings.geminiActiveModel || 'gemini-2.0-flash');
      } else if (engine === 'deepseek') {
        batchPromise = translateBatchOpenAICompatible(items, targetLang, settings.deepseekApiKey, 'https://api.deepseek.com/chat/completions', model || settings.deepseekActiveModel || 'deepseek-chat');
      } else if (engine && engine.startsWith('custom_')) {
        const customId = engine.substring(7);
        const customModel = settings.customModels.find(m => m.id === customId);
        if (customModel) {
          batchPromise = translateBatchOpenAICompatible(items, targetLang, customModel.apiKey, customModel.endpoint, customModel.modelName);
        } else {
          batchPromise = Promise.reject(new Error('未找到该自定义模型的配置信息'));
        }
      } else {
        batchPromise = translateBatchGeneric(items, engine, targetLang, settings);
      }

      Promise.resolve(batchPromise)
        .then(translations => {
          sendResponse({ success: true, translations });
        })
        .catch(err => {
          sendResponse({ success: false, error: err.message });
        });
    });

    return true; // 异步支持
  }
});



