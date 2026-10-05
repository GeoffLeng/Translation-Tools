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
    }).catch(err => {
      console.warn('无法向内容脚本发送消息：', err);
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

// 2. 传统翻译服务逻辑
async function translateGoogle(text, targetLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google API 错误: ${res.statusText}`);
  const data = await res.json();
  if (data && Array.isArray(data[0])) {
    return data[0].map(item => (item && item[0] ? item[0] : '')).join('');
  }
  throw new Error('Google 翻译没有返回有效内容');
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

  const res = await fetch('https://openapi.youdao.com/api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

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

// Gemini 翻译
async function translateGemini(text, targetLang, apiKey, modelName) {
  if (!apiKey) throw new Error('未配置 Gemini API Key，请在设置中配置');
  const model = modelName || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const langName = targetLang === 'zh-CN' ? '中文(简体)' : (targetLang === 'en' ? '英语' : (targetLang === 'ja' ? '日语' : '韩语'));
  
  const prompt = `你是一个专业的翻译官。请将以下文本翻译为${langName}。如果输入内容已经是${langName}，则将其翻译为另一种语言（如中英互译）。
请直接输出翻译结果，不要包含任何前导词、解释、注脚或标点说明。
待翻译文本如下：
${text}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

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

// OpenAI 兼容 API 翻译 (适用于 OpenAI, DeepSeek, Kimi, GLM, 豆包, 自定义等)
async function translateOpenAICompatible(text, targetLang, apiKey, endpoint, modelName) {
  if (!apiKey) throw new Error('该服务未配置 API Key，请在设置中配置');
  if (!endpoint) throw new Error('接口地址未配置');

  const langName = targetLang === 'zh-CN' ? '中文(简体)' : (targetLang === 'en' ? '英语' : (targetLang === 'ja' ? '日语' : '韩语'));
  
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
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
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API 错误: ${res.status}`);
  }

  const data = await res.json();
  if (data.choices && data.choices[0]?.message?.content) {
    return data.choices[0].message.content.trim();
  }
  throw new Error('API 没有返回有效的 Content 内容');
}

// Claude 官方接口翻译
async function translateClaude(text, targetLang, apiKey, modelName, customEndpoint) {
  if (!apiKey) throw new Error('未配置 Claude API Key，请在设置中配置');
  const url = customEndpoint || 'https://api.anthropic.com/v1/messages';
  const model = modelName || 'claude-3-5-haiku-latest';
  const langName = targetLang === 'zh-CN' ? '中文(简体)' : (targetLang === 'en' ? '英语' : (targetLang === 'ja' ? '日语' : '韩语'));
  
  const prompt = `你是一个专业的翻译官。请将以下文本翻译为${langName}。如果输入内容已经是${langName}，则将其翻译为另一种语言（如中英互译）。
请直接输出翻译结果，不要包含任何解释、前导词、说明或标点：\n\n${text}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Claude API 错误: ${res.status}`);
  }

  const data = await res.json();
  if (data.content && data.content[0]) {
    return data.content[0].text.trim();
  }
  throw new Error('Claude 没有返回有效内容');
}

// 4. 监听 runtime 消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    const { text, engine, targetLang, model } = request;

    // 读取所有 API 配置与偏好模型
    chrome.storage.local.get({
      geminiApiKey: '',
      geminiActiveModel: 'gemini-1.5-flash',
      openaiApiKey: '',
      openaiActiveModel: 'gpt-4o-mini',
      openaiEndpoint: 'https://api.openai.com/v1/chat/completions',
      claudeApiKey: '',
      claudeActiveModel: 'claude-3-5-haiku-latest',
      claudeEndpoint: 'https://api.anthropic.com/v1/messages',
      deepseekApiKey: '',
      deepseekActiveModel: 'deepseek-chat',
      kimiApiKey: '',
      kimiActiveModel: 'moonshot-v1-8k',
      glmApiKey: '',
      glmActiveModel: 'glm-4-flash',
      doubaoApiKey: '',
      doubaoModel: '',
      doubaoEndpoint: '',
      nvidiaApiKey: '',
      nvidiaActiveModel: 'meta/llama-3.1-8b-instruct',
      nvidiaEndpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
      youdaoAppKey: '',
      youdaoAppSecret: '',
      customModels: []
    }, (settings) => {
      let translationPromise;

      // 根据选中的引擎派发请求 (未传 model 时采用用户设定或低成本推荐模型)
      if (engine === 'google') {
        translationPromise = translateGoogle(text, targetLang);
      } else if (engine === 'youdao') {
        translationPromise = translateYoudao(text, targetLang, settings.youdaoAppKey, settings.youdaoAppSecret);
      } else if (engine === 'gemini') {
        translationPromise = translateGemini(text, targetLang, settings.geminiApiKey, model || settings.geminiActiveModel || 'gemini-1.5-flash');
      } else if (engine === 'openai') {
        translationPromise = translateOpenAICompatible(text, targetLang, settings.openaiApiKey, settings.openaiEndpoint, model || settings.openaiActiveModel || 'gpt-4o-mini');
      } else if (engine === 'claude') {
        translationPromise = translateClaude(text, targetLang, settings.claudeApiKey, model || settings.claudeActiveModel || 'claude-3-5-haiku-latest', settings.claudeEndpoint);
      } else if (engine === 'deepseek') {
        translationPromise = translateOpenAICompatible(text, targetLang, settings.deepseekApiKey, 'https://api.deepseek.com/chat/completions', model || settings.deepseekActiveModel || 'deepseek-chat');
      } else if (engine === 'kimi') {
        translationPromise = translateOpenAICompatible(text, targetLang, settings.kimiApiKey, 'https://api.moonshot.cn/v1/chat/completions', model || settings.kimiActiveModel || 'moonshot-v1-8k');
      } else if (engine === 'glm') {
        translationPromise = translateOpenAICompatible(text, targetLang, settings.glmApiKey, 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model || settings.glmActiveModel || 'glm-4-flash');
      } else if (engine === 'doubao') {
        const doubaoActiveModel = (model && model !== '未配置 Endpoint ID') ? model : (settings.doubaoModel || 'doubao-lite-4k');
        translationPromise = translateOpenAICompatible(text, targetLang, settings.doubaoApiKey, settings.doubaoEndpoint || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', doubaoActiveModel);
      } else if (engine === 'nvidia') {
        translationPromise = translateOpenAICompatible(text, targetLang, settings.nvidiaApiKey, settings.nvidiaEndpoint || 'https://integrate.api.nvidia.com/v1/chat/completions', model || settings.nvidiaActiveModel || 'meta/llama-3.1-8b-instruct');
      } else if (engine.startsWith('custom_')) {
        // 自定义模型查表
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

      translationPromise
        .then(translation => {
          sendResponse({ success: true, translation });
        })
        .catch(err => {
          sendResponse({ success: false, error: err.message });
        });
    });

    return true; // 异步支持
  }
});
