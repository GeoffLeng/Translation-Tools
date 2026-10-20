// Background Service Worker for Lite Translate (方案 A：内置 PDF.js 阅读器接管引擎)

const DNR_PDF_RULE_ID = 2001;

// 1. 判断是否为目标 PDF 地址 (避免重复接管及死循环)
function isPdfUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const extBase = chrome.runtime.getURL('');
  if (rawUrl.startsWith(extBase)) return false;
  if (rawUrl.startsWith('chrome://') || rawUrl.startsWith('chrome-extension://')) return false;

  const urlWithoutHash = rawUrl.split('#')[0];
  const urlWithoutQuery = urlWithoutHash.split('?')[0].toLowerCase();

  // 规则 1: 标准 .pdf 后缀
  if (urlWithoutQuery.endsWith('.pdf')) return true;

  // 规则 2: 学术库与开放获取 PDF 路由 (如 arXiv, Nature, ScienceDirect 等)
  if (urlWithoutHash.toLowerCase().includes('/pdf/') || urlWithoutHash.toLowerCase().includes('.pdf?')) return true;

  return false;
}

// 2. 动态更新 Declarative Net Request 拦截规则 (高效率毫秒级主框架零闪烁重定向)
async function syncPdfDnrRules() {
  if (!chrome.declarativeNetRequest) return;
  chrome.storage.local.get({ pdfAction: 'native' }, async (settings) => {
    const shouldIntercept = (settings.pdfAction === 'extension');
    try {
      if (shouldIntercept) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [DNR_PDF_RULE_ID],
          addRules: [
            {
              id: DNR_PDF_RULE_ID,
              priority: 1,
              action: {
                type: 'redirect',
                redirect: {
                  regexSubstitution: `${chrome.runtime.getURL('pdf_viewer.html')}?file=\\0`
                }
              },
              condition: {
                regexFilter: '^https?://[^?#]+\\.pdf($|[?#].*)',
                resourceTypes: ['main_frame'],
                excludedInitiatorDomains: [chrome.runtime.id]
              }
            }
          ]
        });
      } else {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [DNR_PDF_RULE_ID]
        });
      }
    } catch (err) {
      console.warn('更新 DeclarativeNetRequest 动态规则异常:', err);
    }
  });
}

// 3. WebNavigation 顶级框架路由补充拦截 (仅在用户显式开启 extension 接管时生效)
if (chrome.webNavigation && chrome.webNavigation.onBeforeNavigate) {
  chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId !== 0) return; // 仅接管主窗口

    const rawUrl = details.url;
    if (!isPdfUrl(rawUrl)) return;

    chrome.storage.local.get({ pdfAction: 'native' }, (settings) => {
      // 默认 'native' 模式下完全不拦截，保持 Chrome 原生正常打开
      if (settings.pdfAction !== 'extension') return;

      const viewerUrl = chrome.runtime.getURL('pdf_viewer.html') + '?file=' + encodeURIComponent(rawUrl);

      // 本地 file:// 协议处理
      if (rawUrl.startsWith('file://')) {
        chrome.extension.isAllowedFileSchemeAccess((isAllowed) => {
          if (isAllowed) {
            chrome.tabs.update(details.tabId, { url: viewerUrl });
          } else {
            // 未开启本地文件权限时，发出友好提示
            if (chrome.notifications) {
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon.svg',
                title: 'Lite Translate - 本地 PDF 阅读',
                message: '如需自动接管本地 PDF 文件，请在扩展管理页面开启“允许访问文件网址”。'
              });
            }
          }
        });
        return;
      }

      // 针对带路由参数的网络 PDF 进行重定向
      chrome.tabs.update(details.tabId, { url: viewerUrl });
    });
  });
}

// 初始化时创建上下文菜单及同步 DNR 规则
function registerContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'translateSelection',
      title: '翻译选中内容',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'openPdfInExtension',
      title: '在 Lite Translate 中打开此链接 PDF',
      contexts: ['link']
    });

    chrome.contextMenus.create({
      id: 'openCurrentPageInPdf',
      title: '在 Lite Translate 阅读器中打开当前页面/PDF',
      contexts: ['page', 'frame']
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  // 兼容老版本：如果用户未曾主动修改过 pdfAction，重置为默认的 native 模式并清除 DNR 规则
  chrome.storage.local.get(['pdfAction', 'pdfActionUserExplicit'], (res) => {
    if (!res.pdfAction || (res.pdfAction === 'extension' && !res.pdfActionUserExplicit)) {
      chrome.storage.local.set({ pdfAction: 'native' }, () => {
        syncPdfDnrRules();
      });
    } else {
      syncPdfDnrRules();
    }
  });

  registerContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  syncPdfDnrRules();
});

// 监听配置变更，动态启闭 PDF 拦截规则
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.pdfAction) {
    syncPdfDnrRules();
  }
});

// 右键菜单点击事件监听
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translateSelection' && tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'showSelectionTranslatePopup',
      text: info.selectionText
    }, () => {
      // 若处于原生 PDF 等沙箱页面导致无法注入内容脚本，弹出微型独立查词窗兜底
      if (chrome.runtime.lastError) {
        if (chrome.windows) {
          chrome.windows.create({
            url: chrome.runtime.getURL('popup.html') + '?text=' + encodeURIComponent(info.selectionText || ''),
            type: 'popup',
            width: 420,
            height: 480
          });
        }
      }
    });
  } else if (info.menuItemId === 'openPdfInExtension') {
    const linkUrl = info.linkUrl;
    if (linkUrl) {
      const viewerUrl = chrome.runtime.getURL('pdf_viewer.html') + '?file=' + encodeURIComponent(linkUrl);
      chrome.tabs.create({ url: viewerUrl });
    }
  } else if (info.menuItemId === 'openCurrentPageInPdf' && tab && tab.url) {
    const pageUrl = tab.url;
    const viewerUrl = chrome.runtime.getURL('pdf_viewer.html') + '?file=' + encodeURIComponent(pageUrl);
    chrome.tabs.create({ url: viewerUrl });
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
let bgGoogleCooldownUntil = 0;
const BG_GOOGLE_CLIENTS = ['gtx', 'dict-chrome-ex', 'webapp'];
let bgClientIndex = 0;

async function translateGoogle(text, targetLang) {
  if (!text || typeof text !== 'string') return '';
  const now = Date.now();
  if (now < bgGoogleCooldownUntil) {
    throw new Error('Google 通道处于冷却保护期 (429)');
  }

  for (let i = 0; i < BG_GOOGLE_CLIENTS.length; i++) {
    const client = BG_GOOGLE_CLIENTS[(bgClientIndex + i) % BG_GOOGLE_CLIENTS.length];
    const url = `https://translate.googleapis.com/translate_a/single?client=${client}&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    try {
      const res = await fetchWithTimeout(url, {}, 8000);
      if (res.status === 429) {
        bgGoogleCooldownUntil = Date.now() + 8000;
        bgClientIndex = (bgClientIndex + 1) % BG_GOOGLE_CLIENTS.length;
        continue;
      }
      if (!res.ok) throw new Error(`Google API 错误: ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data[0])) {
        return data[0].map(item => (item && item[0] ? item[0] : '')).join('');
      }
    } catch (e) {
      if (e.message && e.message.includes('429')) {
        bgGoogleCooldownUntil = Date.now() + 8000;
        continue;
      }
    }
  }
  throw new Error('Google 免Key接口限流或不可用');
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

// 2.9 高危数值与科学计数法硬遮罩保护引擎 (Deterministic Number Masker)
function maskNumericEntities(text) {
  if (!text || typeof text !== 'string') return { maskedText: text, tokenMap: new Map() };
  const tokenMap = new Map();
  let counter = 0;

  function replaceWithToken(matchStr) {
    const token = `__NUM_${counter++}__`;
    tokenMap.set(token, matchStr);
    return token;
  }

  let result = text;
  result = result.replace(/\b\d+(?:\.\d+)?\s*[×x*]\s*10[\^⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹\-+\d]+/g, (m) => replaceWithToken(m));
  result = result.replace(/\b10[\^⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹\-+\d]+/g, (m) => replaceWithToken(m));
  result = result.replace(/\b\d+(?:\.\d+)?[eE][-+]?\d+\b/g, (m) => replaceWithToken(m));
  result = result.replace(/[-−–]?\d+(?:\.\d+)?\s*(?:°C|℃|°F|K|mg\/[mμn]?L|[mμn]?M|%|rpm|kDa|bp|kb)?\s*(?:[-~–—]|to)\s*[-−–]?\d+(?:\.\d+)?\s*(?:°C|℃|°F|K|mg\/[mμn]?L|[mμn]?M|%|rpm|kDa|bp|kb)\b/gi, (m) => replaceWithToken(m));
  result = result.replace(/[-−–]\s*\d+(?:\.\d+)?\s*(?:°C|℃|°F|K)\b/gi, (m) => replaceWithToken(m));
  result = result.replace(/[±]\s*\d+(?:\.\d+)?(?:\s*(?:%|[a-zA-Z\/]+))?/g, (m) => replaceWithToken(m));
  result = result.replace(/[-−]\s*\d+(?:\.\d+)?%/g, (m) => replaceWithToken(m));

  return { maskedText: result, tokenMap };
}

function unmaskNumericEntities(translatedText, tokenMap) {
  if (!translatedText || !tokenMap || tokenMap.size === 0) return translatedText;
  let result = translatedText;
  tokenMap.forEach((originalValue, token) => {
    const fuzzyRegex = new RegExp(token.replace(/_/g, '[_\\s]?'), 'gi');
    result = result.replace(fuzzyRegex, originalValue);
  });
  return result;
}

// 3. AI 翻译服务逻辑

// Google Gemini 官方接口翻译 (终身免费额度)
async function translateGemini(text, targetLang, apiKey, modelName) {
  if (!apiKey) throw new Error('未配置 Gemini API Key，请在设置中配置');
  const cleanModel = (modelName || 'gemini-2.0-flash').replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;
  const langName = targetLang === 'zh-CN' ? '中文(简体)' : (targetLang === 'en' ? '英语' : (targetLang === 'ja' ? '日语' : '韩语'));
  
  const { maskedText, tokenMap } = maskNumericEntities(text);

  const prompt = `你是一个专业的学术与通用翻译官。请将以下文本翻译为${langName}。如果输入内容已经是${langName}，则将其翻译为另一种语言（如中英互译）。
请严格遵循以下规则：
1. 数字严禁汉化：所有阿拉伯数字、小数、百分比、科学计数法与范围（如 15, 2024, 0.05, 95%）必须 100% 保持原始阿拉伯数字形态与格式，严禁写成汉字数字。
2. 专用词汇首次出现标注原则 (First-Occurrence Rule)：专有名词、机构名称、学术专有名词、专属缩写，仅在首次出现时在中文定名后以半角括号附带原文或缩写（如“世界自然基金会 (World Wildlife Fund)”）；后续再次出现时直接采用中文定名，严禁重复附加英文括号，坚决防止排版溢出。
3. 多行标题与自然段落智能区分：遇到包含换行符 \\n 的独立多行标题或条目清单，必须严格保持相同行数与换行符位置，严禁跨行合并；若是普通连贯正文段落，保持自然流畅，切勿切碎。
4. 国际单位与占位符保护：mg, mL, μm, kDa, mol/L, rpm, °C 等 SI 国际单位必须保留英文符号，严禁汉化；形如 __NUM_0__ 的占位符严禁篡改或丢失。
请直接输出翻译结果，不要包含任何前导词、解释、注脚或标点说明。
待翻译文本如下：
${maskedText}`;

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
    const rawOut = data.candidates[0].content.parts[0].text.trim();
    return unmaskNumericEntities(rawOut, tokenMap);
  }
  throw new Error('Gemini 没有返回有效翻译内容');
}

// OpenAI 兼容 API 翻译 (适用于 智谱 GLM, DeepSeek, OpenRouter, OpenCode, 硅基流动, Groq, 自定义模型等)
async function translateOpenAICompatible(text, targetLang, apiKey, endpoint, modelName) {
  if (!apiKey) throw new Error('该服务未配置 API Key，请在设置中配置');
  if (!endpoint) throw new Error('接口地址未配置');

  const langName = targetLang === 'zh-CN' ? '中文(简体)' : (targetLang === 'en' ? '英语' : (targetLang === 'ja' ? '日语' : '韩语'));
  
  const { maskedText, tokenMap } = maskNumericEntities(text);

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
          content: `你是一个专业的学术与通用翻译官。请直接将用户输入的文本翻译为目标语言。
严格规则：
1. 数字严禁汉化：所有阿拉伯数字、小数、百分比、科学计数法与范围必须 100% 保持原始阿拉伯数字形态，绝对禁止转写为汉字。
2. 专用词汇首次出现标注原则 (First-Occurrence Rule)：专有名词、学术机构、组织及专属缩写，仅在当前段落首次出现时在中文译名后以半角括号附带原文或缩写（如“世界自然基金会 (World Wildlife Fund)”）；后续再次出现时直接采用中文定名，严禁重复附加英文括号，坚决防止排版溢出。
3. 多行标题与自然段落智能区分：遇到包含换行符 \\n 的独立多行标题或条目清单，必须严格保持相同行数与换行，严禁跨行合并；若是普通连贯正文段落，保持自然通顺，切勿机械切碎。
4. 国际单位与占位符保护：mg, mL, μm, kDa, mol/L, rpm, °C 等 SI 单位保留英文字符；形如 __NUM_0__ 的占位符必须原样保留在对应位置，严禁篡改或丢失。
请直接输出翻译结果，不要包含任何解释、前导词、注脚或说明。`
        },
        {
          role: 'user',
          content: `将以下文本翻译为 ${langName}：\n\n${maskedText}`
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
      return unmaskNumericEntities(content.trim(), tokenMap);
    }
    if (Array.isArray(content)) {
      const merged = content.map(part => (part && part.text) ? part.text : '').join('').trim();
      if (merged) return unmaskNumericEntities(merged, tokenMap);
    }
    if (choice.text && typeof choice.text === 'string' && choice.text.trim()) {
      return unmaskNumericEntities(choice.text.trim(), tokenMap);
    }
  }
  throw new Error('API 没有返回有效的翻译文本内容');
}

// 3.5 结构化批量翻译逻辑 (Batch Context Prompting + 滑动窗口跨页断句补齐)
async function translateBatchOpenAICompatible(items, targetLang, apiKey, endpoint, modelName, context = null, isBioChem = false) {
  if (!apiKey) throw new Error('该服务未配置 API Key，请在设置中配置');
  if (!endpoint) throw new Error('接口地址未配置');

  const langName = targetLang === 'zh-CN' ? '中文(简体)' : (targetLang === 'en' ? '英语' : (targetLang === 'ja' ? '日语' : '韩语'));
  
  const tokenMaps = new Map();
  const maskedItems = items.map(item => {
    const { maskedText, tokenMap } = maskNumericEntities(item.text);
    tokenMaps.set(item.id, tokenMap);
    return { id: item.id, text: maskedText };
  });

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://github.com/GeoffLeng/Translation-Tools',
    'X-Title': 'Lite Translate'
  };

  let systemPrompt = isBioChem
    ? `你是一名国际顶级期刊 (如 Nature Chemical Biology, JACS, Cell) 的资深学术评审专家兼资深生化与分子生物学文献翻译家。
请将待翻译的 JSON 数组中的每一个学术段落精准翻译为 ${langName}。
学术翻译强制要求：
1. 术语严格符合《中国化学会命名原则》与全国科学技术名词审定委员会《生物化学名词》标准。
2. 严禁字面硬翻实验标准方法 (如 Western blot 译为 免疫印迹法；RT-qPCR 译为 逆转录定量PCR；Apoptosis 译为 细胞凋亡)。
3. 数字严禁汉化：所有阿拉伯数字、小数、百分比、科学计数法与范围必须 100% 保持原始阿拉伯数字形态与格式，严禁转写为汉字。
4. 专用词汇首次出现标注原则 (First-Occurrence Rule)：专有名词、机构名称、国际组织、学术专属名词仅在当前页首次出现时紧跟半角括号备注原文，如“世界自然基金会 (World Wildlife Fund)”；后续重复出现时直接采用中文定名，严禁重复附加英文括号，坚决防止排版溢出。
5. 多行标题与自然段落智能区分：遇到包含换行符 \\n 的独立多行标题或条目清单，译文必须严格保持相同行数与换行；普通正文段落保持语义通顺连贯，切勿生硬切碎。
6. 国际单位与占位符保护：mg, mL, μm, kDa 等 SI 单位绝对保留英文；形如 __NUM_0__ 的占位符必须原样保留在对应位置，严禁篡改。
7. 保持每一个对象的 "id" 字段与输入严格一致，必须输出合法的纯 JSON 数组，严禁任何 markdown 标记或解释。`
    : `你是一个专业的高级学术与文档翻译专家。请将待翻译的 JSON 数组中的每一个段落翻译为 ${langName}。
严格遵循以下要求：
1. 保持每一个对象的 "id" 字段与原始输入严格一致。
2. 数字严禁汉化：所有阿拉伯数字、小数、百分比、科学计数法与范围必须 100% 保留阿拉伯数字形态，绝对禁止转写为汉字。
3. 专用词汇首次出现标注原则 (First-Occurrence Rule)：专有名词、学术机构、组织及专有缩写，仅在当前页首次出现时在中文定名后紧跟半角括号备注原文，如“世界自然基金会 (World Wildlife Fund)”；后续重复出现时直接采用中文定名，严禁重复附加英文括号，坚决防止排版溢出。
4. 多行标题与自然段落智能区分：包含换行符 \\n 的独立多行标题、清单或元数据必须严格保持相同行数与换行符位置；普通正文段落保持自然通顺，切勿切断成碎片。
5. 国际单位与占位符保护：mg, mL, μm, kDa, mol/L, rpm, °C 等 SI 单位保留英文字符；形如 __NUM_0__ 的占位符严禁篡改或丢失。
6. 必须输出且仅输出合法的纯 JSON 数组，格式为 [{"id": 0, "text": "译文"}...]。
7. 严禁包含任何 Markdown 代码块标记（如 \`\`\`json ），严禁附加任何解释、前导词或注脚。`;

  if (context && (context.prefix || context.suffix)) {
    systemPrompt += `\n\n【重要：跨页上下文语境参考 (用于消除跨页断句与代词歧义)】
${context.prefix ? `【前置页面末尾上下文 (仅作为理解上文代词、断句参考，绝对不要翻译此部分)】:\n${context.prefix}\n` : ''}
${context.suffix ? `【后置页面开头上下文 (仅作为理解下文句意、断句参考，绝对不要翻译此部分)】:\n${context.suffix}\n` : ''}
跨页约束：
- 待翻译的 JSON 数组是当前页面的正文。
- 如果当前页开头是上一页未结束的从句/短语，请结合【前置页面末尾上下文】将其译为通顺中文；
- 如果当前页末尾句子尚未结束，请结合【后置页面开头上下文】理解完整句意后，仅将当前页所含部分准确翻译，绝对严禁将后置上下文的内容输出在当前页的译文中！`;
  }

  const userPrompt = JSON.stringify(maskedItems.map(item => ({ id: item.id, text: item.text })));

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
      return parsed.map(p => {
        const tMap = tokenMaps.get(p.id);
        return {
          id: p.id,
          text: tMap ? unmaskNumericEntities(p.text, tMap) : p.text
        };
      });
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
    if (matched.length > 0) {
      return matched.map(p => {
        const tMap = tokenMaps.get(p.id);
        return {
          id: p.id,
          text: tMap ? unmaskNumericEntities(p.text, tMap) : p.text
        };
      });
    }
    throw new Error('批量翻译解析 JSON 失败: ' + parseErr.message);
  }
  throw new Error('批量翻译返回数据非数组格式');
}

async function translateBatchGemini(items, targetLang, apiKey, modelName, context = null) {
  if (!apiKey) throw new Error('未配置 Gemini API Key，请在设置中配置');
  const cleanModel = (modelName || 'gemini-2.0-flash').replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;
  const langName = targetLang === 'zh-CN' ? '中文(简体)' : (targetLang === 'en' ? '英语' : (targetLang === 'ja' ? '日语' : '韩语'));

  const tokenMaps = new Map();
  const maskedItems = items.map(item => {
    const { maskedText, tokenMap } = maskNumericEntities(item.text);
    tokenMaps.set(item.id, tokenMap);
    return { id: item.id, text: maskedText };
  });

  let prompt = `你是一个专业的高级学术与文档翻译专家。请将待翻译的 JSON 数组中的每一个段落翻译为 ${langName}。
严格遵循以下要求：
1. 保持每一个对象的 "id" 字段与原始输入严格一致。
2. 数字严禁汉化：所有阿拉伯数字、小数、百分比、科学计数法与范围必须 100% 保留阿拉伯数字形态，绝对禁止转写为汉字。
3. 专用词汇首次出现标注原则 (First-Occurrence Rule)：专有名词、学术机构、组织及专有缩写，仅在当前页首次出现时在中文定名后紧跟半角括号备注原文，如“世界自然基金会 (World Wildlife Fund)”；后续重复出现时直接采用中文定名，严禁重复附加英文括号，坚决防止排版溢出。
4. 多行标题与自然段落智能区分：包含换行符 \\n 的独立多行标题、清单或元数据必须严格保持相同行数与换行符位置；普通正文段落保持自然通顺，切勿切断成碎片。
5. 国际单位与占位符保护：mg, mL, μm, kDa, mol/L, rpm, °C 等 SI 单位保留英文字符；形如 __NUM_0__ 的占位符严禁篡改或丢失。
6. 必须输出且仅输出合法的纯 JSON 数组，格式为 [{"id": 0, "text": "译文"}...]。
7. 严禁包含任何 Markdown 标记（如 \`\`\`json ），严禁附加任何解释。`;

  if (context && (context.prefix || context.suffix)) {
    prompt += `\n\n【跨页上下文语境参考】
${context.prefix ? `【前置页面末尾参考 (仅供理解上文，严禁翻译输出)】:\n${context.prefix}\n` : ''}
${context.suffix ? `【后置页面开头参考 (仅供理解下文，严禁翻译输出)】:\n${context.suffix}\n` : ''}
跨页约束：仅翻译下方待翻译数据，结合前后参考消除断句与代词歧义，绝对严禁夹带输出前后参考内容！`;
  }

  prompt += `\n待翻译数据：
${JSON.stringify(maskedItems.map(i => ({ id: i.id, text: i.text })))}`;

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
      return parsed.map(p => {
        const tMap = tokenMaps.get(p.id);
        return {
          id: p.id,
          text: tMap ? unmaskNumericEntities(p.text, tMap) : p.text
        };
      });
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
    if (matched.length > 0) {
      return matched.map(p => {
        const tMap = tokenMaps.get(p.id);
        return {
          id: p.id,
          text: tMap ? unmaskNumericEntities(p.text, tMap) : p.text
        };
      });
    }
    throw new Error('Gemini 批量翻译解析 JSON 失败');
  }
  throw new Error('Gemini 批量翻译返回数据非数组格式');
}

async function translateBatchGoogle(items, targetLang) {
  const results = new Array(items.length);
  const CONCURRENCY = 2;
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      if (idx >= items.length) break;
      const item = items[idx];
      try {
        let trans = await translateGoogle(item.text, targetLang);
        results[idx] = { id: item.id, text: trans || item.text };
      } catch (err) {
        // Google 429 降级尝试 Bing
        try {
          let trans = await translateBing(item.text, targetLang);
          results[idx] = { id: item.id, text: trans || item.text };
        } catch (bingErr) {
          results[idx] = { id: item.id, text: item.text };
        }
      }
      await new Promise(r => setTimeout(r, 90));
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

  // 3) DeepSeek (官方预置与自定义端点)
  if (provider === 'deepseek') {
    const url = deriveModelsUrl(customEndpoint, 'https://api.deepseek.com/models');
    const res = await fetchWithTimeout(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    }, 12000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.error?.message || err.message || '';
      throw new Error(`DeepSeek 鉴权失败 (HTTP ${res.status}): ${msg || '请核对 DeepSeek API Key 是否正确'}`);
    }
    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) throw new Error('DeepSeek 未返回模型列表');
    return data.data.map(m => typeof m === 'string' ? { id: m, name: m } : { id: m.id, name: m.name || m.id });
  }

  // 4) OpenRouter
  if (provider === 'openrouter') {
    // 强制验证 API Key 的真实归属与有效性，防止将 DeepSeek 等其他服务商 Key 误当 OpenRouter Key 产生虚假成功
    const authRes = await fetchWithTimeout('https://openrouter.ai/api/v1/auth/key', {
      headers: defaultHeaders
    }, 10000);
    if (!authRes.ok) {
      const authErr = await authRes.json().catch(() => ({}));
      const msg = authErr.error?.message || authErr.message || `HTTP ${authRes.status}`;
      throw new Error(`OpenRouter 鉴权失败 (${msg}): 该密钥非有效 OpenRouter Key。若您使用的是 DeepSeek 密钥，请在上方“服务商预设”中选择 DeepSeek`);
    }

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

// 4.5 测试模型连接与密钥有效性 (极低 token 消耗: 发送 1 字符测试探针并限制 1 token 输出)
async function testModelConnection({ provider, endpoint, apiKey, modelName }) {
  if (!apiKey && provider !== 'ollama') {
    throw new Error('请先输入 API Key');
  }

  let targetEndpoint = (endpoint && endpoint.trim()) ? endpoint.trim() : '';
  if (!targetEndpoint) {
    if (provider === 'deepseek') targetEndpoint = 'https://api.deepseek.com/chat/completions';
    else if (provider === 'openrouter') targetEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
    else if (provider === 'openai') targetEndpoint = 'https://api.openai.com/v1/chat/completions';
    else if (provider === 'siliconflow') targetEndpoint = 'https://api.siliconflow.cn/v1/chat/completions';
    else if (provider === 'groq') targetEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
    else if (provider === 'opencode') targetEndpoint = 'https://api.opencode.ai/v1/chat/completions';
    else if (provider === 'ollama') targetEndpoint = 'http://localhost:11434/v1/chat/completions';
    else throw new Error('请填写接口地址 (Chat Endpoint)');
  }

  if (!targetEndpoint.startsWith('http://') && !targetEndpoint.startsWith('https://')) {
    targetEndpoint = 'https://' + targetEndpoint;
  }

  // 智能推测探活模型 ID
  let targetModel = (modelName && modelName.trim()) ? modelName.trim() : '';
  if (!targetModel) {
    if (provider === 'deepseek') targetModel = 'deepseek-chat';
    else if (provider === 'openrouter') targetModel = 'google/gemini-2.0-flash-001';
    else if (provider === 'openai') targetModel = 'gpt-4o-mini';
    else if (provider === 'siliconflow') targetModel = 'deepseek-ai/DeepSeek-V3';
    else if (provider === 'groq') targetModel = 'llama-3.3-70b-versatile';
    else if (provider === 'opencode') targetModel = 'claude-3-5-sonnet';
    else if (provider === 'ollama') targetModel = 'llama3';
    else targetModel = 'gpt-3.5-turbo';
  }

  const headers = {
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://github.com/GeoffLeng/Translation-Tools',
    'X-Title': 'Lite Translate'
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }

  // 极轻量探测包：仅 1 词输入 + 强制限制输出 1 token，将 Token 消耗压缩至理论极限 (<=2 tokens)
  const probePayload = {
    model: targetModel,
    messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 1,
    stream: false
  };

  const startTime = performance.now();
  let res;
  try {
    res = await fetchWithTimeout(targetEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(probePayload)
    }, 15000);
  } catch (netErr) {
    throw new Error(`连接失败 (${netErr.message})，请检查网络或代理设置`);
  }

  const durationMs = Math.round(performance.now() - startTime);

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const rawMsg = errBody.error?.message || errBody.message || '';
    if (res.status === 401) {
      throw new Error(`认证失败 (401 Unauthorized): API Key 无效或未与当前接口地址匹配。${rawMsg ? `[${rawMsg}]` : ''}`);
    } else if (res.status === 404) {
      throw new Error(`接口地址未找到 (404 Not Found): 请确认 Chat Endpoint 是否正确填写（通常需以 /chat/completions 结尾）`);
    } else if (res.status === 429) {
      throw new Error(`请求受限 (429 Too Many Requests): 账户额度不足 (Insufficient Quota) 或调用频次超限。${rawMsg ? `[${rawMsg}]` : ''}`);
    } else if (res.status === 400) {
      throw new Error(`参数异常 (400 Bad Request): ${rawMsg || '所选模型名称不存在或该接口不支持该参数'}`);
    } else {
      throw new Error(`接口响应错误 (HTTP ${res.status}): ${rawMsg || res.statusText}`);
    }
  }

  const data = await res.json();
  if (!data || (!data.choices && !data.id && !data.created)) {
    throw new Error('接口响应格式异常 (未包含标准 Chat Completion 数据结构)');
  }

  return {
    success: true,
    latency: durationMs,
    model: targetModel,
    message: `连接成功 (耗时: ${durationMs}ms, 模型: ${targetModel})`
  };
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

  if (request.action === 'testModelConnection') {
    const { provider, apiKey, endpoint, modelName } = request;
    testModelConnection({ provider, endpoint, apiKey, modelName })
      .then(result => {
        sendResponse(result);
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
    const { items, engine, targetLang, model, context, isBioChem } = request;
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
        batchPromise = translateBatchOpenAICompatible(items, targetLang, settings.glmApiKey, 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model || settings.glmActiveModel || 'glm-4-flash', context, isBioChem);
      } else if (engine === 'gemini') {
        batchPromise = translateBatchGemini(items, targetLang, settings.geminiApiKey, model || settings.geminiActiveModel || 'gemini-2.0-flash', context);
      } else if (engine === 'deepseek') {
        batchPromise = translateBatchOpenAICompatible(items, targetLang, settings.deepseekApiKey, 'https://api.deepseek.com/chat/completions', model || settings.deepseekActiveModel || 'deepseek-chat', context, isBioChem);
      } else if (engine && engine.startsWith('custom_')) {
        const customId = engine.substring(7);
        const customModel = settings.customModels.find(m => m.id === customId);
        if (customModel) {
          batchPromise = translateBatchOpenAICompatible(items, targetLang, customModel.apiKey, customModel.endpoint, customModel.modelName, context, isBioChem);
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



