// Script for Toolbar Popup (popup.js v2.0)

document.addEventListener('DOMContentLoaded', () => {
  const sourceText = document.getElementById('source-text');
  const resultText = document.getElementById('result-text');
  const clearBtn = document.getElementById('clear-btn');
  const srcLang = document.getElementById('src-lang');
  const tgtLang = document.getElementById('tgt-lang');
  const engineSelect = document.getElementById('engine-select');
  const modelSelect = document.getElementById('model-select');
  const modelSelectContainer = document.getElementById('model-select-container');
  const swapLangBtn = document.getElementById('swap-lang-btn');
  const copyBtn = document.getElementById('copy-btn');
  const speakSrcBtn = document.getElementById('speak-src-btn');
  const speakResBtn = document.getElementById('speak-res-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const loadingSpinner = document.getElementById('loading-spinner');
  const currentEngineBadge = document.getElementById('current-engine-badge');

  let debounceTimer;

  // AI 模型内置字典 (首位均为高性价比推荐模型，节省调用成本)
  const AI_MODELS = {
    gemini: [
      'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro'
    ],
    openai: [
      'gpt-4o-mini',
      'gpt-4o',
      'gpt-3.5-turbo'
    ],
    claude: [
      'claude-3-5-haiku-latest',
      'claude-3-5-sonnet-latest',
      'claude-3-haiku-20240307'
    ],
    deepseek: [
      'deepseek-chat',
      'deepseek-reasoner'
    ],
    kimi: [
      'moonshot-v1-8k',
      'moonshot-v1-32k',
      'moonshot-v1-128k'
    ],
    glm: [
      'glm-4-flash',
      'glm-4-air',
      'glm-4-plus'
    ],
    doubao: [
      'doubao-lite-4k',
      'doubao-pro-4k',
      'doubao-lite-128k'
    ],
    nvidia: [
      'meta/llama-3.1-8b-instruct',
      'meta/llama-3.3-70b-instruct',
      'deepseek-ai/deepseek-r1'
    ]
  };

  // 1. 检测当前活动 Tab 是否为 PDF，如果是，展示原生 PDF 阅读引导
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      const tab = tabs[0];
      const url = tab.url || '';
      if (url.includes('pdf_viewer.html')) return;
      const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
      const isPdf = cleanUrl.endsWith('.pdf') || 
                    url.toLowerCase().includes('.pdf?') || 
                    url.toLowerCase().includes('/pdf/');
      
      if (isPdf) {
        document.getElementById('pdf-warning-card').classList.remove('hidden');
        document.getElementById('workspace-main').classList.add('hidden');

        document.getElementById('open-pdf-btn').onclick = () => {
          const viewerUrl = chrome.runtime.getURL('pdf_viewer.html') + '?file=' + encodeURIComponent(url);
          chrome.tabs.update(tab.id, { url: viewerUrl });
          window.close();
        };
      }
    }
  });

  // 2. 加载可用引擎列表，并初始化配置
  function initializePopup() {
    chrome.storage.local.get({
      defaultTargetLang: 'zh-CN',
      defaultEngine: 'google',
      geminiApiKey: '',
      openaiApiKey: '',
      claudeApiKey: '',
      deepseekApiKey: '',
      kimiApiKey: '',
      glmApiKey: '',
      doubaoApiKey: '',
      doubaoModel: '',
      nvidiaApiKey: '',
      youdaoAppKey: '',
      youdaoAppSecret: '',
      customModels: []
    }, (result) => {
      // 填充目标语言
      tgtLang.value = result.defaultTargetLang;

      // 动态构建可选引擎列表 (仅已配置 API Key 的 AI 引擎才显示)
      engineSelect.innerHTML = '';
      const available = [
        { value: 'google', label: 'Google' }
      ];

      if (result.youdaoAppKey && result.youdaoAppSecret) {
        available.push({ value: 'youdao', label: '有道' });
      }
      if (result.geminiApiKey) {
        available.push({ value: 'gemini', label: 'Gemini' });
      }
      if (result.openaiApiKey) {
        available.push({ value: 'openai', label: 'OpenAI' });
      }
      if (result.claudeApiKey) {
        available.push({ value: 'claude', label: 'Claude' });
      }
      if (result.deepseekApiKey) {
        available.push({ value: 'deepseek', label: 'DeepSeek' });
      }
      if (result.kimiApiKey) {
        available.push({ value: 'kimi', label: 'Kimi' });
      }
      if (result.glmApiKey) {
        available.push({ value: 'glm', label: '智谱GLM' });
      }
      if (result.doubaoApiKey) {
        available.push({ value: 'doubao', label: '豆包' });
      }
      if (result.nvidiaApiKey) {
        available.push({ value: 'nvidia', label: 'NVIDIA NIM' });
      }

      result.customModels.forEach(m => {
        available.push({ value: `custom_${m.id}`, label: m.name });
      });

      available.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.value;
        opt.textContent = item.label;
        engineSelect.appendChild(opt);
      });

      // 初始化豆包模型列表
      if (result.doubaoModel) {
        AI_MODELS.doubao = [result.doubaoModel];
      }

      // 设置默认选中的翻译引擎 (若不可用则回退为 google)
      const availableValues = available.map(a => a.value);
      if (availableValues.includes(result.defaultEngine)) {
        engineSelect.value = result.defaultEngine;
      } else {
        engineSelect.value = 'google';
      }
      updateEngineBadge();

      // 根据选中的引擎渲染并加载活跃模型
      updateModelSelect(() => {
        // 如果有选中的文本，自动填入并翻译
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0] && tabs[0].id) {
            if (chrome.scripting && chrome.scripting.executeScript) {
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: () => window.getSelection().toString().trim()
              }, (results) => {
                if (results && results[0]?.result) {
                  sourceText.value = results[0].result;
                  clearBtn.classList.remove('hidden');
                  performTranslation();
                }
              }).catch(() => {
                // 宿主网页安全策略限制等情况下忽略
              });
            }
          }
        });
      });
    });
  }

  // 3. 更新模型二级选择器状态
  function updateModelSelect(callback) {
    const engine = engineSelect.value;
    modelSelect.innerHTML = '';

    if (AI_MODELS[engine]) {
      const models = AI_MODELS[engine];
      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        modelSelect.appendChild(opt);
      });

      // 获取当前引擎存储的活跃模型版本
      const storageKey = `${engine}ActiveModel`;
      chrome.storage.local.get([storageKey], (res) => {
        if (res[storageKey] && models.includes(res[storageKey])) {
          modelSelect.value = res[storageKey];
        } else if (models.length > 0) {
          modelSelect.value = models[0];
        }
        modelSelectContainer.classList.remove('hidden');
        if (callback) callback();
      });
    } else {
      modelSelectContainer.classList.add('hidden');
      if (callback) callback();
    }
  }

  // 4. 更新引擎徽章
  function updateEngineBadge() {
    const selectedText = engineSelect.options[engineSelect.selectedIndex].text;
    currentEngineBadge.textContent = selectedText;
  }

  // 5. 执行翻译请求
  function performTranslation() {
    const text = sourceText.value.trim();
    if (!text) {
      resultText.textContent = '翻译结果将在此显示...';
      resultText.classList.add('result-placeholder');
      loadingSpinner.classList.add('hidden');
      return;
    }

    resultText.classList.remove('result-placeholder');
    loadingSpinner.classList.remove('hidden');
    resultText.textContent = '';

    const engine = engineSelect.value;
    const target = tgtLang.value;
    const model = modelSelect.value;

    chrome.runtime.sendMessage({
      action: 'translate',
      text: text,
      engine: engine,
      targetLang: target,
      model: model
    }, (response) => {
      loadingSpinner.classList.add('hidden');

      if (!response) {
        resultText.textContent = '翻译出错：未收到后台响应';
        resultText.style.color = '#ff3b30';
        return;
      }

      if (response.success) {
        resultText.textContent = response.translation;
        resultText.style.color = '';
      } else {
        resultText.textContent = `翻译出错：${response.error}`;
        resultText.style.color = '#ff3b30';
      }
    });
  }

  // 6. 事件监听器

  // 输入框监听（防抖）
  sourceText.addEventListener('input', () => {
    if (sourceText.value.length > 0) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      performTranslation();
    }, 500);
  });

  // Shift + Enter 换行，Enter 直接翻译
  sourceText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      clearTimeout(debounceTimer);
      performTranslation();
    }
  });

  // 清除输入内容
  clearBtn.addEventListener('click', () => {
    sourceText.value = '';
    clearBtn.classList.add('hidden');
    resultText.textContent = '翻译结果将在此显示...';
    resultText.classList.add('result-placeholder');
    resultText.style.color = '';
    sourceText.focus();
  });

  // 引擎切换
  engineSelect.addEventListener('change', () => {
    updateEngineBadge();
    updateModelSelect(() => {
      performTranslation();
    });
  });

  // 模型切换
  modelSelect.addEventListener('change', () => {
    const engine = engineSelect.value;
    const model = modelSelect.value;
    
    // 保存活跃模型
    const storageKey = `${engine}ActiveModel`;
    chrome.storage.local.set({ [storageKey]: model }, () => {
      performTranslation();
    });
  });

  srcLang.addEventListener('change', performTranslation);
  tgtLang.addEventListener('change', performTranslation);

  // 语言交换
  swapLangBtn.addEventListener('click', () => {
    const srcVal = srcLang.value;
    const tgtVal = tgtLang.value;

    if (srcVal === 'auto') {
      srcLang.value = tgtVal;
      tgtLang.value = tgtVal === 'zh-CN' ? 'en' : 'zh-CN';
    } else {
      srcLang.value = tgtVal;
      tgtLang.value = srcVal;
    }
    performTranslation();
  });

  // 复制译文
  copyBtn.addEventListener('click', () => {
    const text = resultText.textContent;
    if (text && !resultText.classList.contains('result-placeholder')) {
      navigator.clipboard.writeText(text).then(() => {
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="#34c759" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        setTimeout(() => {
          copyBtn.innerHTML = originalHTML;
        }, 1500);
      });
    }
  });

  // TTS 语音朗读
  function speakText(text) {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[一-龥]/.test(text) ? 'zh-CN' : 'en-US';
    window.speechSynthesis.speak(utterance);
  }

  speakSrcBtn.addEventListener('click', () => {
    speakText(sourceText.value.trim());
  });

  speakResBtn.addEventListener('click', () => {
    if (!resultText.classList.contains('result-placeholder')) {
      speakText(resultText.textContent.trim());
    }
  });

  // 点击打开选项设置页面
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 初始化入口
  initializePopup();
});
