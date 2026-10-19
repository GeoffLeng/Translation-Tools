// Script for Options page (options.js v2.0)

document.addEventListener('DOMContentLoaded', () => {
  // 1. 侧边栏 Tab 切换逻辑
  const menuItems = document.querySelectorAll('.menu-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      menuItems.forEach(i => i.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));

      item.classList.add('active');
      const tabId = item.getAttribute('data-tab') + '-tab';
      const targetPane = document.getElementById(tabId);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });

  // 2. 绑定通用设置与官方服务 DOM 元素
  const enableSelectionTranslate = document.getElementById('enable-selection-translate');
  const autoShowPanel = document.getElementById('auto-show-panel');
  const triggerMode = document.getElementById('trigger-mode');
  const defaultTargetLang = document.getElementById('default-target-lang');
  const defaultEngine = document.getElementById('default-engine');
  
  // 核心 AI 引擎 (智谱 GLM 永久免费、Google Gemini 终身免费额度、DeepSeek 高性价比)
  const glmApiKey = document.getElementById('glm-api-key');
  const glmModel = document.getElementById('glm-model');
  const geminiApiKey = document.getElementById('gemini-api-key');
  const geminiModel = document.getElementById('gemini-model');
  const deepseekApiKey = document.getElementById('deepseek-api-key');
  const deepseekModel = document.getElementById('deepseek-model');

  // DeepL 与 有道词典
  const deeplApiKey = document.getElementById('deepl-api-key');
  const deeplEndpoint = document.getElementById('deepl-endpoint');
  const youdaoAppKey = document.getElementById('youdao-app-key');
  const youdaoAppSecret = document.getElementById('youdao-app-secret');

  const pdfAction = document.getElementById('pdf-action');
  const pdfContextMenu = document.getElementById('pdf-context-menu');

  // 自定义模型管理 DOM 元素
  const customModelsList = document.getElementById('custom-models-list');
  const addCustomBtn = document.getElementById('add-custom-btn');
  const customModelModal = document.getElementById('custom-model-modal');
  const closeCustomModalBtn = document.getElementById('close-custom-modal-btn');
  const customModalOverlay = document.getElementById('custom-modal-overlay');
  
  const modalProvider = document.getElementById('modal-provider');
  const modalEndpoint = document.getElementById('modal-endpoint');
  const modalApiKey = document.getElementById('modal-api-key');
  const modalToggleKey = document.getElementById('modal-toggle-key');
  const modalFetchModelsBtn = document.getElementById('modal-fetch-models-btn');
  const modalFetchStatus = document.getElementById('modal-fetch-status');
  const modalModelName = document.getElementById('modal-model-name');
  const modalModelDropdown = document.getElementById('modal-model-dropdown');
  const modalCustomAlias = document.getElementById('modal-custom-alias');
  const modalSaveBtn = document.getElementById('modal-save-btn');

  let customModels = [];
  let modalFetchedModels = []; // 暂存从第三方服务商拉取的模型列表 [{ id, name }]

  // 常用服务商模板预设
  const PROVIDER_TEMPLATES = {
    openrouter: {
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      aliasPrefix: 'OpenRouter'
    },
    opencode: {
      endpoint: 'https://api.opencode.ai/v1/chat/completions',
      aliasPrefix: 'OpenCode'
    },
    openai: {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      aliasPrefix: 'OpenAI'
    },
    siliconflow: {
      endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
      aliasPrefix: 'SiliconFlow'
    },
    groq: {
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      aliasPrefix: 'Groq'
    },
    custom: {
      endpoint: '',
      aliasPrefix: 'Custom'
    }
  };

  // 官方预置 AI 模型的默认备选字典
  const DEFAULT_MODELS = {
    glm: ['glm-4-flash', 'glm-4.5-flash', 'glm-4.7-flash', 'glm-4-flashx']
  };

  // 本地缓存的可用全部模型与已启用勾选模型
  const providerState = {
    glm: { all: [...DEFAULT_MODELS.glm], enabled: [...DEFAULT_MODELS.glm] }
  };

  // 3. 加载已有配置
  function loadSettings() {
    chrome.storage.local.get({
      enableSelectionTranslate: true,
      autoShowPanel: false,
      triggerMode: 'direct',
      defaultTargetLang: 'zh-CN',
      defaultEngine: 'google',
      glmApiKey: '',
      glmActiveModel: 'glm-4-flash',
      glmModels: DEFAULT_MODELS.glm,
      deeplApiKey: '',
      deeplEndpoint: '',
      youdaoAppKey: '',
      youdaoAppSecret: '',
      pdfAction: 'extension',
      pdfContextMenu: true,
      customModels: []
    }, (settings) => {
      if (enableSelectionTranslate) enableSelectionTranslate.checked = settings.enableSelectionTranslate;
      if (autoShowPanel) autoShowPanel.checked = settings.autoShowPanel;
      if (triggerMode) triggerMode.value = settings.triggerMode || 'direct';
      if (defaultTargetLang) defaultTargetLang.value = settings.defaultTargetLang;
      
      if (glmApiKey) glmApiKey.value = settings.glmApiKey || '';
      if (deeplApiKey) deeplApiKey.value = settings.deeplApiKey || '';
      if (deeplEndpoint) deeplEndpoint.value = settings.deeplEndpoint || '';
      if (youdaoAppKey) youdaoAppKey.value = settings.youdaoAppKey || '';
      if (youdaoAppSecret) youdaoAppSecret.value = settings.youdaoAppSecret || '';

      if (pdfAction) pdfAction.value = settings.pdfAction || 'extension';
      if (pdfContextMenu) pdfContextMenu.checked = settings.pdfContextMenu;
      customModels = settings.customModels || [];

      checkFileSchemeAccess();

      // 初始化智谱 GLM 模型状态
      ['glm'].forEach(p => {
        const storedModels = settings[`${p}Models`];
        const activeM = settings[`${p}ActiveModel`];
        if (Array.isArray(storedModels) && storedModels.length > 0) {
          providerState[p].enabled = [...storedModels];
          storedModels.forEach(m => {
            if (!providerState[p].all.includes(m)) providerState[p].all.push(m);
          });
        }
        renderProviderModelUI(p, activeM);
      });

      // 渲染自定义模型列表并同步默认翻译引擎下拉菜单
      renderCustomModels();
      renderDefaultEngineOptions(settings.defaultEngine);
    });
  }

  // 渲染某服务商的模型选择 UI（下拉框 + 勾选列表）
  function renderProviderModelUI(provider, preferredActiveModel) {
    const selectEl = document.getElementById(`${provider}-model`);
    const listEl = document.getElementById(`${provider}-checkbox-list`);
    if (!selectEl || !listEl) return;

    const state = providerState[provider];
    const enabledSet = new Set(state.enabled);
    const currentActive = preferredActiveModel || selectEl.value || state.enabled[0] || state.all[0];

    // 1. 刷新下拉选项 (展示已勾选启用的模型)
    selectEl.innerHTML = '';
    const displayOptions = state.enabled.length > 0 ? state.enabled : state.all;
    displayOptions.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      const isFree = (provider === 'glm') && m.toLowerCase().includes('flash');
      opt.textContent = isFree ? `${m} (免费)` : m;
      selectEl.appendChild(opt);
    });

    if (displayOptions.includes(currentActive)) {
      selectEl.value = currentActive;
    } else if (displayOptions.length > 0) {
      selectEl.value = displayOptions[0];
      chrome.storage.local.set({ [`${provider}ActiveModel`]: displayOptions[0] });
    }

    // 2. 刷新复选框勾选列表
    listEl.innerHTML = '';
    state.all.forEach(m => {
      const row = document.createElement('label');
      row.className = 'model-item-row';
      const isChecked = enabledSet.has(m);
      const isDefault = (m === selectEl.value);
      const isFree = (provider === 'glm') && m.toLowerCase().includes('flash');

      row.innerHTML = `
        <input type="checkbox" value="${m}" ${isChecked ? 'checked' : ''}>
        <span class="model-item-name" title="${m}">${m}</span>
        ${isFree ? '<span class="model-item-free-tag">免费</span>' : ''}
        ${isDefault ? '<span class="model-item-tag">默认</span>' : ''}
      `;

      const checkbox = row.querySelector('input');
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          if (!state.enabled.includes(m)) state.enabled.push(m);
        } else {
          state.enabled = state.enabled.filter(x => x !== m);
        }
        // 如果全部取消，至少保留一个
        if (state.enabled.length === 0) {
          state.enabled = [m];
          checkbox.checked = true;
        }
        // 保存并重绘下拉框
        const updateData = {};
        updateData[`${provider}Models`] = state.enabled;
        chrome.storage.local.set(updateData, () => {
          renderProviderModelUI(provider, selectEl.value);
          renderDefaultEngineOptions();
        });
      });

      listEl.appendChild(row);
    });
  }

  // 发起获取服务商模型列表
  function fetchModelsForProvider(provider) {
    const apiKeyInput = document.getElementById(`${provider}-api-key`);
    const statusText = document.getElementById(`${provider}-status`);
    const panel = document.getElementById(`${provider}-models-panel`);
    const btn = document.querySelector(`.fetch-models-btn[data-provider="${provider}"]`);
    
    const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
    if (!apiKey) {
      if (statusText) {
        statusText.textContent = '请先输入 API Key';
        statusText.className = 'model-status-text error';
      }
      if (panel) panel.classList.remove('hidden');
      return;
    }

    if (btn) btn.disabled = true;
    if (statusText) {
      statusText.textContent = '正在获取模型列表...';
      statusText.className = 'model-status-text loading';
    }
    if (panel) panel.classList.remove('hidden');

    chrome.runtime.sendMessage({
      action: 'fetchModels',
      provider,
      apiKey,
      endpoint: ''
    }, (response) => {
      if (btn) btn.disabled = false;
      if (chrome.runtime.lastError || !response || !response.success) {
        const errMsg = response?.error || chrome.runtime.lastError?.message || '获取失败';
        if (statusText) {
          statusText.textContent = `获取失败: ${errMsg}`;
          statusText.className = 'model-status-text error';
        }
        return;
      }

      const fetchedModels = response.models || [];
      if (fetchedModels.length === 0) {
        if (statusText) {
          statusText.textContent = '未找到可用模型';
          statusText.className = 'model-status-text error';
        }
        return;
      }

      const state = providerState[provider];
      fetchedModels.forEach(m => {
        const id = typeof m === 'string' ? m : m.id;
        if (!state.all.includes(id)) state.all.push(id);
        if (!state.enabled.includes(id)) state.enabled.push(id);
      });

      if (statusText) {
        statusText.textContent = `获取成功，共 ${fetchedModels.length} 个模型（已更新）`;
        statusText.className = 'model-status-text success';
        setTimeout(() => {
          if (statusText.textContent.includes('获取成功')) statusText.textContent = '';
        }, 5000);
      }

      const saveObj = {};
      saveObj[`${provider}Models`] = state.enabled;
      chrome.storage.local.set(saveObj, () => {
        const selectEl = document.getElementById(`${provider}-model`);
        renderProviderModelUI(provider, selectEl ? selectEl.value : null);
        renderDefaultEngineOptions();
      });
    });
  }

  // 绑定“获取模型列表”按钮
  document.querySelectorAll('.fetch-models-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const provider = btn.getAttribute('data-provider');
      if (provider) fetchModelsForProvider(provider);
    });
  });

  // 绑定“勾选可用模型”展开/收起
  document.querySelectorAll('.toggle-models-list-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const panel = document.getElementById(targetId);
      if (panel) {
        panel.classList.toggle('hidden');
      }
    });
  });

  // 绑定模型搜索过滤
  document.querySelectorAll('.models-search-input').forEach(input => {
    input.addEventListener('input', () => {
      const listId = input.getAttribute('data-list');
      const listEl = document.getElementById(listId);
      if (!listEl) return;
      const kw = input.value.trim().toLowerCase();
      const rows = listEl.querySelectorAll('.model-item-row');
      rows.forEach(row => {
        const name = row.querySelector('.model-item-name')?.textContent?.toLowerCase() || '';
        row.style.display = name.includes(kw) ? 'flex' : 'none';
      });
    });
  });

  // 绑定手动添加模型 ID
  document.querySelectorAll('.add-model-id-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const provider = btn.getAttribute('data-provider');
      const input = document.getElementById(`${provider}-custom-model-input`);
      if (!provider || !input) return;
      const val = input.value.trim();
      if (!val) return;
      
      const state = providerState[provider];
      if (!state.all.includes(val)) state.all.unshift(val);
      if (!state.enabled.includes(val)) state.enabled.unshift(val);

      input.value = '';
      const saveObj = {};
      saveObj[`${provider}Models`] = state.enabled;
      saveObj[`${provider}ActiveModel`] = val;
      chrome.storage.local.set(saveObj, () => {
        renderProviderModelUI(provider, val);
        renderDefaultEngineOptions();
      });
    });
  });

  // 4. 配置自动保存逻辑
  function saveSettings() {
    chrome.storage.local.set({
      enableSelectionTranslate: enableSelectionTranslate.checked,
      autoShowPanel: autoShowPanel.checked,
      triggerMode: triggerMode ? triggerMode.value : 'direct',
      defaultTargetLang: defaultTargetLang.value,
      defaultEngine: defaultEngine.value,
      glmApiKey: glmApiKey ? glmApiKey.value.trim() : '',
      glmActiveModel: glmModel ? glmModel.value : 'glm-4-flash',
      deeplApiKey: deeplApiKey ? deeplApiKey.value.trim() : '',
      deeplEndpoint: deeplEndpoint ? deeplEndpoint.value.trim() : '',
      youdaoAppKey: youdaoAppKey ? youdaoAppKey.value.trim() : '',
      youdaoAppSecret: youdaoAppSecret ? youdaoAppSecret.value.trim() : '',
      pdfAction: pdfAction ? pdfAction.value : 'ask',
      pdfContextMenu: pdfContextMenu ? pdfContextMenu.checked : true
    });
  }

  // 动态渲染默认翻译引擎选项
  function renderDefaultEngineOptions(preferredEngine) {
    const targetEngine = preferredEngine !== undefined ? preferredEngine : defaultEngine.value;
    defaultEngine.innerHTML = '';

    // 免 Key 免费翻译引擎组
    const available = [
      { value: 'google', label: 'Google 翻译 (免 Key)' },
      { value: 'bing', label: 'Bing 翻译 (免 Key·微软)' }
    ];

    // DeepL 翻译 (仅在配置了 Auth Key 或 自定义 Endpoint 时显示)
    if ((deeplApiKey && deeplApiKey.value.trim()) || (deeplEndpoint && deeplEndpoint.value.trim())) {
      available.push({ value: 'deepl', label: 'DeepL 翻译 (精准自然)' });
    }

    // 智谱 GLM（4/4.5/4.7 flash 免费）
    if (glmApiKey && glmApiKey.value.trim()) {
      const model = glmModel ? glmModel.value : 'glm-4-flash';
      available.push({ value: 'glm', label: `智谱 GLM (${model})` });
    }

    // 官方词典 API
    if (youdaoAppKey && youdaoAppSecret && youdaoAppKey.value.trim() && youdaoAppSecret.value.trim()) {
      available.push({ value: 'youdao', label: '有道智云 (官方词典 API)' });
    }

    // 自定义模型 (仅在已配置 API Key 或 Endpoint 时显示)
    customModels.forEach(m => {
      if ((m.apiKey && m.apiKey.trim()) || (m.endpoint && m.endpoint.trim())) {
        available.push({ value: `custom_${m.id}`, label: `${m.name} (${m.modelName})` });
      }
    });

    available.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.value;
      opt.textContent = item.label;
      defaultEngine.appendChild(opt);
    });

    const availableValues = available.map(a => a.value);
    if (availableValues.includes(targetEngine)) {
      defaultEngine.value = targetEngine;
    } else {
      defaultEngine.value = 'google';
      chrome.storage.local.set({ defaultEngine: 'google' });
    }
  }

  // 渲染自定义模型列表
  function renderCustomModels() {
    customModelsList.innerHTML = '';

    if (customModels.length === 0) {
      customModelsList.innerHTML = `<span style="font-size: 13px; color: #8e8e93;">暂无自定义模型。点击上方“+ 添加自定义模型”可接入 OpenRouter、OpenCode、OpenAI 或任意兼容服务。</span>`;
      return;
    }

    customModels.forEach(m => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.background = 'rgba(0,0,0,0.02)';
      item.style.padding = '10px 14px';
      item.style.borderRadius = '10px';
      item.style.fontSize = '13.5px';
      item.style.border = '1px solid rgba(0,0,0,0.03)';
      
      item.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:2px;">
          <span style="font-weight:600; color:#1c1c1e;">${m.name} <span style="font-size:10.5px; font-weight:normal; background:rgba(0,122,255,0.1); color:#007AFF; padding:1px 6px; border-radius:4px; margin-left:4px;">${m.modelName}</span></span>
          <span style="font-size:11.5px; color:#8e8e93; font-family:monospace; max-width: 320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${m.endpoint}</span>
        </div>
        <button class="ios-button" style="background:rgba(255,59,48,0.1); color:#FF3B30; padding:6px 12px; font-size:12.5px;" data-id="${m.id}">删除</button>
      `;

      item.querySelector('button').addEventListener('click', () => {
        deleteCustomModel(m.id);
      });

      customModelsList.appendChild(item);
    });
  }

  // 删除自定义模型
  function deleteCustomModel(id) {
    customModels = customModels.filter(m => m.id !== id);
    chrome.storage.local.set({ customModels }, () => {
      renderCustomModels();
      renderDefaultEngineOptions();
    });
  }

  // 监听输入并实时保存及动态刷新默认引擎列表
  const inputsToWatch = [
    enableSelectionTranslate, autoShowPanel, triggerMode, defaultTargetLang, defaultEngine,
    glmApiKey, glmModel, geminiApiKey, geminiModel, deepseekApiKey, deepseekModel,
    deeplApiKey, deeplEndpoint, youdaoAppKey, youdaoAppSecret, pdfAction
  ].filter(Boolean);

  inputsToWatch.forEach(input => {
    const eventType = (input.type === 'checkbox' || input.tagName === 'SELECT') ? 'change' : 'input';
    input.addEventListener(eventType, () => {
      saveSettings();
      if (input !== defaultEngine) {
        renderDefaultEngineOptions();
      }
    });
  });

  // 右键菜单单独处理同步
  if (pdfContextMenu) {
    pdfContextMenu.addEventListener('change', () => {
      saveSettings();
      if (pdfContextMenu.checked) {
        chrome.contextMenus.create({
          id: 'openPdfInExtension',
          title: '在阅读器中打开此 PDF',
          contexts: ['link']
        }, () => {
          if (chrome.runtime.lastError) {
            console.log('右键菜单已经存在');
          }
        });
      } else {
        chrome.contextMenus.remove('openPdfInExtension');
      }
    });
  }

  // --- 本地文件权限与阅读器一键启动 ---
  const openExtensionManageBtn = document.getElementById('open-extension-manage-btn');
  const openStandaloneViewerBtn = document.getElementById('open-standalone-viewer-btn');
  const fileSchemeStatusDesc = document.getElementById('file-scheme-status-desc');

  function checkFileSchemeAccess() {
    if (chrome.extension && chrome.extension.isAllowedFileSchemeAccess && fileSchemeStatusDesc) {
      chrome.extension.isAllowedFileSchemeAccess((isAllowed) => {
        if (isAllowed) {
          fileSchemeStatusDesc.textContent = '已授权：Chrome 访问本地 PDF (file://) 时可自动无缝接管';
          fileSchemeStatusDesc.style.color = '#34c759';
        } else {
          fileSchemeStatusDesc.textContent = '未授权：无法自动拦截本地文件，需在扩展管理页开启“允许访问文件网址”';
          fileSchemeStatusDesc.style.color = '#ff9500';
        }
      });
    }
  }

  if (openExtensionManageBtn) {
    openExtensionManageBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
    });
  }

  if (openStandaloneViewerBtn) {
    openStandaloneViewerBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('pdf_viewer.html') });
    });
  }

  // --- 自定义模型弹窗逻辑 ---
  function openCustomModal() {
    customModelModal.classList.remove('hidden');
    // 默认选用 OpenRouter 模板
    if (modalProvider) {
      modalProvider.value = 'openrouter';
      applyProviderTemplate('openrouter');
    }
  }

  function applyProviderTemplate(providerKey) {
    const tmpl = PROVIDER_TEMPLATES[providerKey] || PROVIDER_TEMPLATES.custom;
    modalEndpoint.value = tmpl.endpoint;
    modalFetchStatus.textContent = '';
    modalFetchStatus.className = 'model-status-text';
    modalModelDropdown.classList.add('hidden');
    modalModelDropdown.innerHTML = '';
    modalFetchedModels = [];
  }

  if (modalProvider) {
    modalProvider.addEventListener('change', () => {
      applyProviderTemplate(modalProvider.value);
    });
  }

  addCustomBtn.addEventListener('click', openCustomModal);

  function closeCustomModal() {
    customModelModal.classList.add('hidden');
    modalEndpoint.value = '';
    modalApiKey.value = '';
    modalModelName.value = '';
    modalCustomAlias.value = '';
    modalFetchStatus.textContent = '';
    modalFetchStatus.className = 'model-status-text';
    modalModelDropdown.classList.add('hidden');
    modalModelDropdown.innerHTML = '';
    modalFetchedModels = [];
  }

  closeCustomModalBtn.addEventListener('click', closeCustomModal);
  customModalOverlay.addEventListener('click', closeCustomModal);
  customModelModal.addEventListener('click', (e) => {
    if (e.target === customModelModal) {
      closeCustomModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !customModelModal.classList.contains('hidden')) {
      closeCustomModal();
    }
  });

  // 切换 API Key 密文显隐
  modalToggleKey.addEventListener('click', (e) => {
    e.preventDefault();
    if (modalApiKey.type === 'password') {
      modalApiKey.type = 'text';
      modalToggleKey.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    } else {
      modalApiKey.type = 'password';
      modalToggleKey.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    }
  });

  // 弹窗中点击“获取受支持模型”
  modalFetchModelsBtn.addEventListener('click', () => {
    const provider = modalProvider.value;
    const apiKey = modalApiKey.value.trim();
    const endpoint = modalEndpoint.value.trim();

    if (!apiKey) {
      modalFetchStatus.textContent = '请先输入 API Key 再获取模型';
      modalFetchStatus.className = 'model-status-text error';
      return;
    }

    if (!endpoint && provider === 'custom') {
      modalFetchStatus.textContent = '自定义服务商请先输入接口地址';
      modalFetchStatus.className = 'model-status-text error';
      return;
    }

    modalFetchModelsBtn.disabled = true;
    modalFetchStatus.textContent = '正在获取模型列表...';
    modalFetchStatus.className = 'model-status-text loading';

    chrome.runtime.sendMessage({
      action: 'fetchModels',
      provider,
      apiKey,
      endpoint
    }, (response) => {
      modalFetchModelsBtn.disabled = false;
      if (chrome.runtime.lastError || !response || !response.success) {
        const errMsg = response?.error || chrome.runtime.lastError?.message || '获取失败';
        modalFetchStatus.textContent = `获取失败: ${errMsg}`;
        modalFetchStatus.className = 'model-status-text error';
        return;
      }

      const list = response.models || [];
      modalFetchedModels = list.map(m => typeof m === 'string' ? { id: m, name: m } : { id: m.id, name: m.name || m.id });

      if (modalFetchedModels.length === 0) {
        modalFetchStatus.textContent = '未检索到可用模型，请手动输入模型名称';
        modalFetchStatus.className = 'model-status-text error';
        return;
      }

      modalFetchStatus.textContent = `成功获取 ${modalFetchedModels.length} 个模型，可在下方模糊搜索选择`;
      modalFetchStatus.className = 'model-status-text success';

      renderFuzzyDropdown(modalModelName.value.trim());
    });
  });

  // 渲染模糊搜索下拉框
  function renderFuzzyDropdown(query) {
    if (!modalFetchedModels || modalFetchedModels.length === 0) {
      modalModelDropdown.classList.add('hidden');
      return;
    }

    const q = (query || '').toLowerCase().trim();
    const filtered = q
      ? modalFetchedModels.filter(m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
      : modalFetchedModels;

    modalModelDropdown.innerHTML = '';

    if (filtered.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'model-dropdown-empty';
      emptyDiv.textContent = '无精确匹配模型（可直接手动输入任意模型 ID）';
      modalModelDropdown.appendChild(emptyDiv);
      modalModelDropdown.classList.remove('hidden');
      return;
    }

    const toRender = filtered.slice(0, 40);
    toRender.forEach(item => {
      const row = document.createElement('div');
      row.className = 'model-dropdown-item';
      row.innerHTML = `
        <span class="model-dropdown-item-id">${item.id}</span>
        ${item.name && item.name !== item.id ? `<span class="model-dropdown-item-desc">${item.name}</span>` : ''}
      `;
      row.addEventListener('click', () => {
        modalModelName.value = item.id;
        if (!modalCustomAlias.value.trim()) {
          const providerKey = modalProvider ? modalProvider.value : 'custom';
          const prefix = PROVIDER_TEMPLATES[providerKey]?.aliasPrefix || '';
          modalCustomAlias.value = prefix ? `${prefix} - ${item.name || item.id}` : (item.name || item.id);
        }
        modalModelDropdown.classList.add('hidden');
      });
      modalModelDropdown.appendChild(row);
    });

    modalModelDropdown.classList.remove('hidden');
  }

  modalModelName.addEventListener('input', () => {
    renderFuzzyDropdown(modalModelName.value.trim());
  });

  modalModelName.addEventListener('focus', () => {
    if (modalFetchedModels.length > 0) {
      renderFuzzyDropdown(modalModelName.value.trim());
    }
  });

  document.addEventListener('click', (e) => {
    if (!modalModelDropdown.contains(e.target) && e.target !== modalModelName) {
      modalModelDropdown.classList.add('hidden');
    }
  });

  // 保存自定义模型
  modalSaveBtn.addEventListener('click', () => {
    const endpoint = modalEndpoint.value.trim();
    const apiKey = modalApiKey.value.trim();
    const modelName = modalModelName.value.trim();
    const customAlias = modalCustomAlias.value.trim();

    if (!endpoint || !modelName) {
      alert('请填写完整的接口地址和模型名称！');
      return;
    }

    const providerKey = modalProvider ? modalProvider.value : 'custom';
    const prefix = PROVIDER_TEMPLATES[providerKey]?.aliasPrefix || '自定义';
    const displayName = customAlias || `${prefix} - ${modelName}`;

    const newModel = {
      id: Date.now().toString(),
      name: displayName,
      endpoint,
      apiKey,
      modelName
    };

    customModels.push(newModel);
    chrome.storage.local.set({ customModels }, () => {
      renderCustomModels();
      renderDefaultEngineOptions();
      closeCustomModal();
    });
  });

  // 初始化加载
  loadSettings();
});
