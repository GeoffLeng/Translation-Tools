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

  // 2. 绑定设置表单元素
  const enableSelectionTranslate = document.getElementById('enable-selection-translate');
  const autoShowPanel = document.getElementById('auto-show-panel');
  const triggerMode = document.getElementById('trigger-mode');
  const defaultTargetLang = document.getElementById('default-target-lang');
  const defaultEngine = document.getElementById('default-engine');
  
  // AI Keys & Models
  const geminiApiKey = document.getElementById('gemini-api-key');
  const geminiModel = document.getElementById('gemini-model');
  const openaiApiKey = document.getElementById('openai-api-key');
  const openaiModel = document.getElementById('openai-model');
  const openaiEndpoint = document.getElementById('openai-endpoint');
  const claudeApiKey = document.getElementById('claude-api-key');
  const claudeModel = document.getElementById('claude-model');
  const claudeEndpoint = document.getElementById('claude-endpoint');
  const deepseekApiKey = document.getElementById('deepseek-api-key');
  const deepseekModel = document.getElementById('deepseek-model');
  const kimiApiKey = document.getElementById('kimi-api-key');
  const kimiModel = document.getElementById('kimi-model');
  const glmApiKey = document.getElementById('glm-api-key');
  const glmModel = document.getElementById('glm-model');
  const doubaoApiKey = document.getElementById('doubao-api-key');
  const doubaoModel = document.getElementById('doubao-model');
  const doubaoEndpoint = document.getElementById('doubao-endpoint');
  const nvidiaApiKey = document.getElementById('nvidia-api-key');
  const nvidiaModel = document.getElementById('nvidia-model');
  const nvidiaEndpoint = document.getElementById('nvidia-endpoint');
  const youdaoAppKey = document.getElementById('youdao-app-key');
  const youdaoAppSecret = document.getElementById('youdao-app-secret');

  const pdfAction = document.getElementById('pdf-action');
  const pdfContextMenu = document.getElementById('pdf-context-menu');

  // 自定义模型 DOM 元素
  const customModelsList = document.getElementById('custom-models-list');
  const addCustomBtn = document.getElementById('add-custom-btn');
  const customModelModal = document.getElementById('custom-model-modal');
  const closeCustomModalBtn = document.getElementById('close-custom-modal-btn');
  const customModalOverlay = document.getElementById('custom-modal-overlay');
  
  const modalEndpoint = document.getElementById('modal-endpoint');
  const modalApiKey = document.getElementById('modal-api-key');
  const modalToggleKey = document.getElementById('modal-toggle-key');
  const modalModelName = document.getElementById('modal-model-name');
  const modalInputPrice = document.getElementById('modal-input-price');
  const modalOutputPrice = document.getElementById('modal-output-price');
  const modalSaveBtn = document.getElementById('modal-save-btn');

  let customModels = [];

  // 3. 加载已有配置
  function loadSettings() {
    chrome.storage.local.get({
      enableSelectionTranslate: true,
      autoShowPanel: false,
      triggerMode: 'direct',
      defaultTargetLang: 'zh-CN',
      defaultEngine: 'google',
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
      pdfAction: 'ask',
      pdfContextMenu: true,
      customModels: []
    }, (settings) => {
      enableSelectionTranslate.checked = settings.enableSelectionTranslate;
      autoShowPanel.checked = settings.autoShowPanel;
      if (triggerMode) triggerMode.value = settings.triggerMode || 'direct';
      defaultTargetLang.value = settings.defaultTargetLang;
      
      geminiApiKey.value = settings.geminiApiKey;
      if (geminiModel && settings.geminiActiveModel) geminiModel.value = settings.geminiActiveModel;
      
      openaiApiKey.value = settings.openaiApiKey;
      if (openaiModel && settings.openaiActiveModel) openaiModel.value = settings.openaiActiveModel;
      openaiEndpoint.value = settings.openaiEndpoint;
      
      claudeApiKey.value = settings.claudeApiKey;
      if (claudeModel && settings.claudeActiveModel) claudeModel.value = settings.claudeActiveModel;
      claudeEndpoint.value = settings.claudeEndpoint;
      
      deepseekApiKey.value = settings.deepseekApiKey;
      if (deepseekModel && settings.deepseekActiveModel) deepseekModel.value = settings.deepseekActiveModel;
      
      kimiApiKey.value = settings.kimiApiKey;
      if (kimiModel && settings.kimiActiveModel) kimiModel.value = settings.kimiActiveModel;
      
      glmApiKey.value = settings.glmApiKey;
      if (glmModel && settings.glmActiveModel) glmModel.value = settings.glmActiveModel;
      
      doubaoApiKey.value = settings.doubaoApiKey;
      doubaoModel.value = settings.doubaoModel;
      doubaoEndpoint.value = settings.doubaoEndpoint;
      
      nvidiaApiKey.value = settings.nvidiaApiKey;
      if (nvidiaModel && settings.nvidiaActiveModel) nvidiaModel.value = settings.nvidiaActiveModel;
      nvidiaEndpoint.value = settings.nvidiaEndpoint;
      
      if (youdaoAppKey) youdaoAppKey.value = settings.youdaoAppKey || '';
      if (youdaoAppSecret) youdaoAppSecret.value = settings.youdaoAppSecret || '';

      pdfAction.value = settings.pdfAction;
      pdfContextMenu.checked = settings.pdfContextMenu;
      customModels = settings.customModels;

      // 渲染自定义模型列表并动态同步默认引擎下拉菜单
      renderCustomModels();
      renderDefaultEngineOptions(settings.defaultEngine);
    });
  }

  // 4. 配置自动保存逻辑
  function saveSettings() {
    chrome.storage.local.set({
      enableSelectionTranslate: enableSelectionTranslate.checked,
      autoShowPanel: autoShowPanel.checked,
      triggerMode: triggerMode ? triggerMode.value : 'direct',
      defaultTargetLang: defaultTargetLang.value,
      defaultEngine: defaultEngine.value,
      geminiApiKey: geminiApiKey.value.trim(),
      geminiActiveModel: geminiModel ? geminiModel.value : 'gemini-1.5-flash',
      openaiApiKey: openaiApiKey.value.trim(),
      openaiActiveModel: openaiModel ? openaiModel.value : 'gpt-4o-mini',
      openaiEndpoint: openaiEndpoint.value.trim() || 'https://api.openai.com/v1/chat/completions',
      claudeApiKey: claudeApiKey.value.trim(),
      claudeActiveModel: claudeModel ? claudeModel.value : 'claude-3-5-haiku-latest',
      claudeEndpoint: claudeEndpoint.value.trim() || 'https://api.anthropic.com/v1/messages',
      deepseekApiKey: deepseekApiKey.value.trim(),
      deepseekActiveModel: deepseekModel ? deepseekModel.value : 'deepseek-chat',
      kimiApiKey: kimiApiKey.value.trim(),
      kimiActiveModel: kimiModel ? kimiModel.value : 'moonshot-v1-8k',
      glmApiKey: glmApiKey.value.trim(),
      glmActiveModel: glmModel ? glmModel.value : 'glm-4-flash',
      doubaoApiKey: doubaoApiKey.value.trim(),
      doubaoModel: doubaoModel.value.trim(),
      doubaoEndpoint: doubaoEndpoint.value.trim(),
      nvidiaApiKey: nvidiaApiKey.value.trim(),
      nvidiaActiveModel: nvidiaModel ? nvidiaModel.value : 'meta/llama-3.1-8b-instruct',
      nvidiaEndpoint: nvidiaEndpoint.value.trim() || 'https://integrate.api.nvidia.com/v1/chat/completions',
      youdaoAppKey: youdaoAppKey ? youdaoAppKey.value.trim() : '',
      youdaoAppSecret: youdaoAppSecret ? youdaoAppSecret.value.trim() : '',
      pdfAction: pdfAction.value,
      pdfContextMenu: pdfContextMenu.checked
    });
  }

  // 动态渲染默认翻译引擎选项 (仅已导入 API Key 的 AI 引擎才允许选择)
  function renderDefaultEngineOptions(preferredEngine) {
    const targetEngine = preferredEngine !== undefined ? preferredEngine : defaultEngine.value;
    defaultEngine.innerHTML = '';

    const available = [
      { value: 'google', label: 'Google 翻译 (免 Key)' }
    ];

    if (youdaoAppKey && youdaoAppSecret && youdaoAppKey.value.trim() && youdaoAppSecret.value.trim()) {
      available.push({ value: 'youdao', label: '有道智云 (官方 API)' });
    }
    if (geminiApiKey && geminiApiKey.value.trim()) {
      const model = geminiModel ? geminiModel.value : 'gemini-1.5-flash';
      available.push({ value: 'gemini', label: `Gemini AI (${model})` });
    }
    if (openaiApiKey && openaiApiKey.value.trim()) {
      const model = openaiModel ? openaiModel.value : 'gpt-4o-mini';
      available.push({ value: 'openai', label: `OpenAI (${model})` });
    }
    if (claudeApiKey && claudeApiKey.value.trim()) {
      const model = claudeModel ? claudeModel.value : 'claude-3-5-haiku-latest';
      available.push({ value: 'claude', label: `Claude (${model})` });
    }
    if (deepseekApiKey && deepseekApiKey.value.trim()) {
      const model = deepseekModel ? deepseekModel.value : 'deepseek-chat';
      available.push({ value: 'deepseek', label: `DeepSeek (${model})` });
    }
    if (kimiApiKey && kimiApiKey.value.trim()) {
      const model = kimiModel ? kimiModel.value : 'moonshot-v1-8k';
      available.push({ value: 'kimi', label: `Kimi (${model})` });
    }
    if (glmApiKey && glmApiKey.value.trim()) {
      const model = glmModel ? glmModel.value : 'glm-4-flash';
      available.push({ value: 'glm', label: `智谱 GLM (${model})` });
    }
    if (doubaoApiKey && doubaoApiKey.value.trim()) {
      const ep = doubaoModel ? doubaoModel.value.trim() : '';
      available.push({ value: 'doubao', label: `火山引擎豆包 ${ep ? '(' + ep + ')' : ''}`.trim() });
    }
    if (nvidiaApiKey && nvidiaApiKey.value.trim()) {
      const model = nvidiaModel ? nvidiaModel.value : 'meta/llama-3.1-8b-instruct';
      available.push({ value: 'nvidia', label: `NVIDIA NIM (${model})` });
    }

    customModels.forEach(m => {
      available.push({ value: `custom_${m.id}`, label: `${m.name} (${m.modelName})` });
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
      customModelsList.innerHTML = `<span style="font-size: 13px; color: #8e8e93;">暂无自定义模型。</span>`;
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
    geminiApiKey, geminiModel, openaiApiKey, openaiModel, openaiEndpoint,
    claudeApiKey, claudeModel, claudeEndpoint, deepseekApiKey, deepseekModel,
    kimiApiKey, kimiModel, glmApiKey, glmModel,
    doubaoApiKey, doubaoModel, doubaoEndpoint,
    nvidiaApiKey, nvidiaModel, nvidiaEndpoint,
    youdaoAppKey, youdaoAppSecret, pdfAction
  ].filter(Boolean);

  inputsToWatch.forEach(input => {
    const eventType = (input.type === 'checkbox' || input.tagName === 'SELECT') ? 'change' : 'input';
    input.addEventListener(eventType, () => {
      saveSettings();
      // 如果修改的是 API Key 字段，同步刷新默认引擎可选列表
      if (input !== defaultEngine) {
        renderDefaultEngineOptions();
      }
    });
  });

  // 右键菜单单独处理同步
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

  // --- 自定义模型弹窗逻辑 ---
  addCustomBtn.addEventListener('click', () => {
    customModelModal.classList.remove('hidden');
  });

  function closeCustomModal() {
    customModelModal.classList.add('hidden');
    modalEndpoint.value = '';
    modalApiKey.value = '';
    modalModelName.value = '';
    modalInputPrice.value = '';
    modalOutputPrice.value = '';
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

  // 切换 API Key 显示/隐藏
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

  // 保存自定义模型
  modalSaveBtn.addEventListener('click', () => {
    const endpoint = modalEndpoint.value.trim();
    const apiKey = modalApiKey.value.trim();
    const modelName = modalModelName.value.trim();
    const inputPrice = modalInputPrice.value.trim();
    const outputPrice = modalOutputPrice.value.trim();

    if (!endpoint || !modelName) {
      alert('请填写完整的接口地址和模型名称！');
      return;
    }

    const newModel = {
      id: Date.now().toString(),
      name: modelName || '自定义模型',
      endpoint,
      apiKey,
      modelName,
      inputPrice: inputPrice || '默认值',
      outputPrice: outputPrice || '默认值'
    };

    customModels.push(newModel);
    chrome.storage.local.set({ customModels }, () => {
      renderCustomModels();
      closeCustomModal();
    });
  });

  // 初始化加载
  loadSettings();
});
