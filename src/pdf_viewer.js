// PDF Viewer Script (pdf_viewer.js v2.0)
import * as pdfjsLib from 'pdfjs-dist';

// 1. 设置 Worker
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.js');
} else {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.370/pdf.worker.min.mjs';
}

document.addEventListener('DOMContentLoaded', () => {
  // DOM 元素
  const fileInput = document.getElementById('file-input');
  const pdfTitle = document.getElementById('pdf-title');
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  const pageNumInput = document.getElementById('page-num');
  const pageCountSpan = document.getElementById('page-count');
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');
  const zoomValueSpan = document.getElementById('zoom-value');
  const welcomeScreen = document.getElementById('welcome-screen');
  const viewerContainer = document.getElementById('pdf-viewer-container');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingStatus = document.getElementById('loading-status');
  const viewerMain = document.getElementById('viewer-main');

  let currentPdf = null;
  let currentScale = 1.2;
  let currentPage = 1;
  let pdfDataBuffer = null;
  let pdfFileName = '';
  let currentRenderId = 0;

  // --- Translation Widget Logic (复制自 content.js，确保在 PDF 阅读器内即开即用) ---
  const widgetContainer = document.createElement('div');
  widgetContainer.id = 'pdf-translate-widget-container';
  document.body.appendChild(widgetContainer);
  
  // 注入悬浮翻译浮窗 DOM
  widgetContainer.innerHTML = `
    <button id="pdf-float-icon" class="pdf-float-icon hidden" title="翻译">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><path d="M4 7h16M12 7v13M9 20h6"/></svg>
    </button>
    <div id="pdf-translate-panel" class="pdf-panel hidden">
      <div class="panel-header" id="pdf-panel-drag-handle">
        <div class="panel-logo">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 7h16M12 7v13M9 20h6"/></svg>
          <span>翻译</span>
        </div>
        <div class="panel-actions">
          <select id="pdf-panel-engine-select" class="panel-select">
            <option value="google">Google</option>
          </select>
          <select id="pdf-panel-model-select" class="panel-select hidden"></select>
          <button id="pdf-panel-pin-btn" class="panel-icon-btn" title="固定浮窗">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-2l-2-2V5a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v8l-2 2v2z"></path></svg>
          </button>
          <button id="pdf-panel-close-btn" class="panel-close" title="关闭">✕</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="panel-toolbar-row">
          <span style="font-size:11.5px; color:#8e8e93; font-weight:500;">原文</span>
          <button id="pdf-speak-src-btn" class="panel-icon-btn" title="朗读原文">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
        </div>
        <div class="panel-source-text" id="pdf-panel-source-text">...</div>
        <div class="panel-divider"></div>
        <div class="panel-toolbar-row">
          <span style="font-size:11.5px; color:#8e8e93; font-weight:500;">译文</span>
          <div class="panel-btn-group">
            <button id="pdf-speak-res-btn" class="panel-icon-btn" title="朗读译文">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            </button>
            <button id="pdf-copy-res-btn" class="panel-icon-btn" title="复制译文">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
        </div>
        <div class="panel-result-wrapper">
          <div id="pdf-panel-result-text" class="panel-result">...</div>
          <div id="pdf-panel-loader" class="panel-loader hidden"></div>
        </div>
      </div>
    </div>
  `;

  const floatIcon = document.getElementById('pdf-float-icon');
  const translatePanel = document.getElementById('pdf-translate-panel');
  const panelEngineSelect = document.getElementById('pdf-panel-engine-select');
  const panelModelSelect = document.getElementById('pdf-panel-model-select');
  const panelSourceText = document.getElementById('pdf-panel-source-text');
  const panelResultText = document.getElementById('pdf-panel-result-text');
  const panelLoader = document.getElementById('pdf-panel-loader');
  const panelCloseBtn = document.getElementById('pdf-panel-close-btn');
  const panelPinBtn = document.getElementById('pdf-panel-pin-btn');
  const speakSrcBtn = document.getElementById('pdf-speak-src-btn');
  const speakResBtn = document.getElementById('pdf-speak-res-btn');
  const copyResBtn = document.getElementById('pdf-copy-res-btn');
  const dragHandle = document.getElementById('pdf-panel-drag-handle');

  let currentSelectedText = '';
  let isDragging = false;
  let isPinned = false;
  let dragOffset = { x: 0, y: 0 };

  // AI 模型内置列表 (首位均为高性价比推荐模型，节省调用成本)
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

  // 动态加载可用引擎列表 (仅已配置 API Key 的 AI 引擎才显示)
  function loadAvailableEngines(callback) {
    chrome.storage.local.get({
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
      const currentVal = panelEngineSelect.value;
      panelEngineSelect.innerHTML = '';

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
        panelEngineSelect.appendChild(opt);
      });

      if (result.doubaoModel) {
        AI_MODELS.doubao = [result.doubaoModel];
      }

      const availableValues = available.map(a => a.value);
      if (availableValues.includes(currentVal)) {
        panelEngineSelect.value = currentVal;
      } else {
        panelEngineSelect.value = 'google';
      }

      if (callback) callback();
    });
  }

  loadAvailableEngines();

  // 监听 storage 变更，及时更新可用引擎
  chrome.storage.onChanged.addListener(() => {
    loadAvailableEngines();
  });

  function getSettings(callback) {
    chrome.storage.local.get({
      enableSelectionTranslate: true,
      autoShowPanel: false,
      defaultTargetLang: 'zh-CN',
      defaultEngine: 'google'
    }, callback);
  }

  // 监听 PDF 容器中的划词
  viewerContainer.addEventListener('mouseup', (e) => {
    if (e.target.closest('#pdf-translate-panel') || e.target.closest('#pdf-float-icon')) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();

      if (!text || text.length < 1 || text.length > 2000) {
        if (!translatePanel.classList.contains('show')) {
          hideIcon();
        }
        return;
      }

      currentSelectedText = text;

      getSettings((settings) => {
        if (!settings.enableSelectionTranslate) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // 划词位置
        const posX = rect.right + window.scrollX + 4;
        const posY = rect.bottom + window.scrollY + 4;

        if (settings.autoShowPanel) {
          showPanel(posX, posY, text, settings.defaultEngine, settings.defaultTargetLang);
        } else {
          showIcon(posX, posY);
        }
      });
    }, 20);
  });

  // 点击空白关闭浮窗
  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('#pdf-translate-widget-container')) return;
    hideIcon();
    if (!isPinned && translatePanel.classList.contains('show')) {
      hidePanel();
    }
  });

  function showIcon(x, y) {
    const scrollX = window.scrollX || window.pageXOffset;
    const viewportRight = window.innerWidth + scrollX;
    const safeX = Math.max(scrollX + 5, Math.min(x, viewportRight - 40));
    const safeY = Math.max(10, y);

    floatIcon.style.left = `${safeX}px`;
    floatIcon.style.top = `${safeY}px`;
    floatIcon.classList.remove('hidden');
    floatIcon.getBoundingClientRect();
    floatIcon.classList.add('show');
  }

  function hideIcon() {
    floatIcon.classList.remove('show');
    setTimeout(() => {
      if (!floatIcon.classList.contains('show')) {
        floatIcon.classList.add('hidden');
      }
    }, 150);
  }

  function showPanel(x, y, text, engine, targetLang) {
    hideIcon();
    const panelWidth = 340;
    const scrollX = window.scrollX || window.pageXOffset;
    const viewportRight = window.innerWidth + scrollX;
    const safeX = Math.max(scrollX + 10, Math.min(x, viewportRight - panelWidth - 20));
    const safeY = Math.max(10, y);

    translatePanel.style.left = `${safeX}px`;
    translatePanel.style.top = `${safeY}px`;
    panelSourceText.textContent = text;

    loadAvailableEngines(() => {
      const availableValues = Array.from(panelEngineSelect.options).map(o => o.value);
      const chosenEngine = availableValues.includes(engine) ? engine : (availableValues[0] || 'google');
      panelEngineSelect.value = chosenEngine;
      
      updateModelSelect(chosenEngine, () => {
        const activeModel = panelModelSelect.value;
        translatePanel.classList.remove('hidden');
        translatePanel.getBoundingClientRect();
        translatePanel.classList.add('show');
        doTranslation(text, chosenEngine, targetLang, activeModel);
      });
    });
  }

  function hidePanel() {
    translatePanel.classList.remove('show');
    setTimeout(() => {
      if (!translatePanel.classList.contains('show')) {
        translatePanel.classList.add('hidden');
      }
    }, 250);
  }

  function updateModelSelect(engine, callback) {
    panelModelSelect.innerHTML = '';

    if (AI_MODELS[engine]) {
      const models = AI_MODELS[engine];
      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        panelModelSelect.appendChild(opt);
      });

      const storageKey = `${engine}ActiveModel`;
      chrome.storage.local.get([storageKey], (res) => {
        if (res[storageKey] && models.includes(res[storageKey])) {
          panelModelSelect.value = res[storageKey];
        } else if (models.length > 0) {
          panelModelSelect.value = models[0];
        }
        panelModelSelect.classList.remove('hidden');
        if (callback) callback();
      });
    } else {
      panelModelSelect.classList.add('hidden');
      if (callback) callback();
    }
  }

  function doTranslation(text, engine, targetLang, modelName) {
    panelLoader.classList.remove('hidden');
    panelResultText.classList.add('hidden');

    chrome.runtime.sendMessage({
      action: 'translate',
      text: text,
      engine: engine,
      targetLang: targetLang,
      model: modelName
    }, (response) => {
      panelLoader.classList.add('hidden');
      panelResultText.classList.remove('hidden');

      if (!response) {
        panelResultText.textContent = '翻译超时或服务未响应';
        panelResultText.classList.add('error');
        return;
      }

      if (response.success) {
        panelResultText.textContent = response.translation;
        panelResultText.classList.remove('error');
      } else {
        panelResultText.textContent = `出错: ${response.error}`;
        panelResultText.classList.add('error');
      }
    });
  }

  floatIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    const x = parseFloat(floatIcon.style.left);
    const y = parseFloat(floatIcon.style.top);
    getSettings((settings) => {
      showPanel(x, y, currentSelectedText, settings.defaultEngine, settings.defaultTargetLang);
    });
  });

  // 面板关闭按钮
  panelCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hidePanel();
  });

  // 浮窗固定按键
  panelPinBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isPinned = !isPinned;
    panelPinBtn.classList.toggle('active', isPinned);
    panelPinBtn.title = isPinned ? '取消固定' : '固定浮窗';
  });

  // Escape 键快捷关闭浮层
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (translatePanel.classList.contains('show')) {
        hidePanel();
      }
      if (!floatIcon.classList.contains('hidden')) {
        hideIcon();
      }
    }
  });

  // TTS 朗读功能
  function speakText(text) {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[一-龥]/.test(text) ? 'zh-CN' : 'en-US';
    window.speechSynthesis.speak(utterance);
  }

  speakSrcBtn.addEventListener('click', () => {
    speakText(panelSourceText.textContent);
  });

  speakResBtn.addEventListener('click', () => {
    speakText(panelResultText.textContent);
  });

  // 复制译文
  copyResBtn.addEventListener('click', () => {
    const text = panelResultText.textContent;
    if (text && !panelResultText.classList.contains('error')) {
      navigator.clipboard.writeText(text).then(() => {
        copyResBtn.style.color = '#34c759';
        setTimeout(() => {
          copyResBtn.style.color = '';
        }, 1500);
      });
    }
  });

  panelEngineSelect.addEventListener('change', () => {
    const engine = panelEngineSelect.value;
    updateModelSelect(engine, () => {
      getSettings((settings) => {
        doTranslation(currentSelectedText, engine, settings.defaultTargetLang, panelModelSelect.value);
      });
    });
  });

  panelModelSelect.addEventListener('change', () => {
    const engine = panelEngineSelect.value;
    const model = panelModelSelect.value;

    const storageKey = `${engine}ActiveModel`;
    chrome.storage.local.set({ [storageKey]: model });

    getSettings((settings) => {
      doTranslation(currentSelectedText, engine, settings.defaultTargetLang, model);
    });
  });

  // 弹窗面板拖拽
  dragHandle.addEventListener('mousedown', (e) => {
    if (e.target.closest('.panel-actions')) return;
    isDragging = true;
    const rect = translatePanel.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    document.body.style.cursor = 'move';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const posX = e.clientX - dragOffset.x + window.scrollX;
    const posY = e.clientY - dragOffset.y + window.scrollY;
    translatePanel.style.left = `${posX}px`;
    translatePanel.style.top = `${posY}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = '';
    }
  });

  // --- PDF.js 核心渲染逻辑 ---

  // 从 URL 获取并加载 PDF
  const urlParams = new URLSearchParams(window.location.search);
  const fileUrl = urlParams.get('file');
  if (fileUrl) {
    loadingOverlay.classList.remove('hidden');
    loadingStatus.textContent = '正在获取网络 PDF 文件...';
    
    fetch(fileUrl)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP 错误: ${res.status}`);
        return res.arrayBuffer();
      })
      .then(buffer => {
        pdfDataBuffer = new Uint8Array(buffer);
        pdfFileName = decodeURIComponent(fileUrl.substring(fileUrl.lastIndexOf('/') + 1));
        loadPdf(pdfDataBuffer, pdfFileName);
      })
      .catch(err => {
        console.error(err);
        loadingOverlay.classList.add('hidden');
        alert('读取 PDF 链接失败: ' + err.message);
      });
  }

  // 本地文件拖拽
  viewerMain.addEventListener('dragover', (e) => {
    e.preventDefault();
    viewerMain.style.background = 'rgba(0, 122, 255, 0.04)';
  });

  viewerMain.addEventListener('dragleave', () => {
    viewerMain.style.background = '';
  });

  viewerMain.addEventListener('drop', (e) => {
    e.preventDefault();
    viewerMain.style.background = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      readLocalFile(file);
    }
  });

  // 本地选择打开 PDF
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      readLocalFile(file);
    }
  });

  function readLocalFile(file) {
    loadingOverlay.classList.remove('hidden');
    loadingStatus.textContent = '正在解析本地 PDF 文件...';
    
    const fileReader = new FileReader();
    fileReader.onload = function() {
      pdfDataBuffer = new Uint8Array(this.result);
      pdfFileName = file.name;
      loadPdf(pdfDataBuffer, pdfFileName);
    };
    fileReader.readAsArrayBuffer(file);
  }

  // 加载 PDF 数据
  async function loadPdf(data, title) {
    pdfTitle.textContent = title;
    viewerContainer.innerHTML = '';
    viewerContainer.classList.remove('hidden');
    welcomeScreen.classList.add('hidden');
    loadingOverlay.classList.remove('hidden');
    loadingStatus.textContent = '正在渲染页面...';

    const renderId = ++currentRenderId;

    try {
      const loadingTask = pdfjsLib.getDocument({ data: data });
      currentPdf = await loadingTask.promise;
      if (renderId !== currentRenderId) return;
      
      currentPage = 1;
      pageNumInput.value = currentPage;
      pageCountSpan.textContent = currentPdf.numPages;

      prevPageBtn.disabled = false;
      nextPageBtn.disabled = false;

      // 依次渲染所有页面
      for (let i = 1; i <= currentPdf.numPages; i++) {
        if (renderId !== currentRenderId) return;
        await renderPage(i, renderId);
      }

      if (renderId === currentRenderId) {
        setupScrollSpy();
      }
    } catch (err) {
      if (renderId === currentRenderId) {
        console.error(err);
        alert('渲染 PDF 失败：' + err.message);
      }
    } finally {
      if (renderId === currentRenderId) {
        loadingOverlay.classList.add('hidden');
      }
    }
  }

  // --- PDF.js 核心虚拟化渲染架构 (IntersectionObserver 视口按需挂载) ---
  let pageObserver = null;
  const renderedPages = new Map(); // pageNum -> { isRendered, isRendering, canvas }

  // 加载 PDF 数据并初始化占位 DOM
  async function loadPdf(data, title) {
    pdfTitle.textContent = title;
    viewerContainer.innerHTML = '';
    viewerContainer.classList.remove('hidden');
    welcomeScreen.classList.add('hidden');
    loadingOverlay.classList.remove('hidden');
    loadingStatus.textContent = '正在解析文档结构...';

    if (pageObserver) {
      pageObserver.disconnect();
      pageObserver = null;
    }
    renderedPages.clear();

    const renderId = ++currentRenderId;

    try {
      const loadingTask = pdfjsLib.getDocument({ data: data });
      currentPdf = await loadingTask.promise;
      if (renderId !== currentRenderId) return;

      currentPage = 1;
      pageNumInput.value = currentPage;
      pageCountSpan.textContent = currentPdf.numPages;

      prevPageBtn.disabled = false;
      nextPageBtn.disabled = false;

      // 提取第 1 页基准比例，预计算所有页面的骨架占位
      const firstPage = await currentPdf.getPage(1);
      const firstViewport = firstPage.getViewport({ scale: currentScale });
      const defaultW = Math.round(firstViewport.width);
      const defaultH = Math.round(firstViewport.height);

      // 高效批量创建空容器占位（仅轻量 DOM 骨架，无 Canvas 纹理开销）
      const fragment = document.createDocumentFragment();
      for (let i = 1; i <= currentPdf.numPages; i++) {
        const pageContainer = document.createElement('div');
        pageContainer.className = 'page-container is-unloaded';
        pageContainer.dataset.pageNum = i;
        pageContainer.style.width = `${defaultW}px`;
        pageContainer.style.height = `${defaultH}px`;
        pageContainer.innerHTML = `<div class="page-skeleton"><span class="page-skeleton-badge">第 ${i} 页</span></div>`;
        fragment.appendChild(pageContainer);
      }
      viewerContainer.appendChild(fragment);

      // 创建视口按需加载 Observer (上下扩展 400px 缓冲带)
      setupVirtualObserver(renderId);
      setupScrollSpy();
    } catch (err) {
      if (renderId === currentRenderId) {
        console.error(err);
        alert('解析 PDF 失败：' + err.message);
      }
    } finally {
      if (renderId === currentRenderId) {
        loadingOverlay.classList.add('hidden');
      }
    }
  }

  // 虚拟化视口监听器：进入视口挂载渲染，移出视口彻底销毁 Canvas 回收显存
  function setupVirtualObserver(renderId) {
    if (pageObserver) pageObserver.disconnect();

    pageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const pageNum = parseInt(entry.target.dataset.pageNum);
        if (entry.isIntersecting) {
          mountPage(pageNum, renderId);
        } else {
          unmountPage(pageNum);
        }
      });
    }, {
      root: viewerMain,
      rootMargin: '400px 0px', // 上下缓冲半页，平滑滚屏无白屏闪烁
      threshold: 0
    });

    const pages = viewerContainer.querySelectorAll('.page-container');
    pages.forEach(p => pageObserver.observe(p));
  }

  // 视口内挂载页面
  async function mountPage(pageNum, renderId) {
    if (renderId && renderId !== currentRenderId) return;
    const pageState = renderedPages.get(pageNum);
    if (pageState && (pageState.isRendered || pageState.isRendering)) return;

    renderedPages.set(pageNum, { isRendering: true, isRendered: false });
    const pageContainer = viewerContainer.querySelector(`.page-container[data-page-num="${pageNum}"]`);
    if (!pageContainer) return;

    try {
      const page = await currentPdf.getPage(pageNum);
      if (renderId && renderId !== currentRenderId) return;

      const viewport = page.getViewport({ scale: currentScale });
      pageContainer.style.width = `${Math.round(viewport.width)}px`;
      pageContainer.style.height = `${Math.round(viewport.height)}px`;

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext('2d');

      await page.render({ canvasContext: context, viewport: viewport }).promise;
      if (renderId && renderId !== currentRenderId) return;

      // 文本选择层构建
      const textContent = await page.getTextContent();
      if (renderId && renderId !== currentRenderId) return;

      const textLayerDiv = document.createElement('div');
      textLayerDiv.className = 'textLayer';
      textLayerDiv.style.width = `${Math.round(viewport.width)}px`;
      textLayerDiv.style.height = `${Math.round(viewport.height)}px`;
      textLayerDiv.style.setProperty('--scale-factor', viewport.scale);

      const textLayer = new pdfjsLib.TextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport: viewport
      });
      await textLayer.render();
      if (renderId && renderId !== currentRenderId) return;

      // 组装并移除骨架占位
      pageContainer.innerHTML = '';
      pageContainer.classList.remove('is-unloaded');
      pageContainer.appendChild(canvas);
      pageContainer.appendChild(textLayerDiv);

      renderedPages.set(pageNum, { isRendering: false, isRendered: true, canvas: canvas });
    } catch (e) {
      renderedPages.delete(pageNum);
    }
  }

  // 移出视口卸载回收内存
  function unmountPage(pageNum) {
    const pageState = renderedPages.get(pageNum);
    if (!pageState || !pageState.isRendered) return;

    const pageContainer = viewerContainer.querySelector(`.page-container[data-page-num="${pageNum}"]`);
    if (pageContainer) {
      if (pageState.canvas) {
        pageState.canvas.width = 0;
        pageState.canvas.height = 0;
      }
      pageContainer.innerHTML = `<div class="page-skeleton"><span class="page-skeleton-badge">第 ${pageNum} 页</span></div>`;
      pageContainer.classList.add('is-unloaded');
    }
    renderedPages.delete(pageNum);
  }

  // 缩放逻辑：秒级响应，仅调整占位骨架并在当前视口中重绘
  async function changeZoom(newScale) {
    if (!currentPdf) return;
    currentScale = Math.min(Math.max(newScale, 0.5), 3.0);
    zoomValueSpan.textContent = `${Math.round(currentScale * 100)}%`;

    const lastPage = currentPage;
    const renderId = ++currentRenderId;

    if (pageObserver) {
      pageObserver.disconnect();
    }
    renderedPages.clear();

    // 更新所有页面占位容器尺寸
    const firstPage = await currentPdf.getPage(1);
    const firstViewport = firstPage.getViewport({ scale: currentScale });
    const defaultW = Math.round(firstViewport.width);
    const defaultH = Math.round(firstViewport.height);

    const pages = viewerContainer.querySelectorAll('.page-container');
    pages.forEach(p => {
      p.style.width = `${defaultW}px`;
      p.style.height = `${defaultH}px`;
      p.innerHTML = `<div class="page-skeleton"><span class="page-skeleton-badge">第 ${p.dataset.pageNum} 页</span></div>`;
      p.classList.add('is-unloaded');
    });

    setupVirtualObserver(renderId);

    const targetPageElement = viewerContainer.querySelector(`.page-container[data-page-num="${lastPage}"]`);
    if (targetPageElement) {
      targetPageElement.scrollIntoView();
    }
  }

  zoomInBtn.addEventListener('click', () => changeZoom(currentScale + 0.1));
  zoomOutBtn.addEventListener('click', () => changeZoom(currentScale - 0.1));

  // 页码跳转
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      scrollToPage(currentPage);
    }
  });

  nextPageBtn.addEventListener('click', () => {
    if (currentPdf && currentPage < currentPdf.numPages) {
      currentPage++;
      scrollToPage(currentPage);
    }
  });

  pageNumInput.addEventListener('change', () => {
    let val = parseInt(pageNumInput.value);
    if (currentPdf && val >= 1 && val <= currentPdf.numPages) {
      currentPage = val;
      scrollToPage(currentPage);
    } else {
      pageNumInput.value = currentPage;
    }
  });

  function scrollToPage(pageNum) {
    const pageEl = viewerContainer.querySelector(`.page-container[data-page-num="${pageNum}"]`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // 监听滚动更新页码指示器 (IntersectionObserver)
  function setupScrollSpy() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const pageNum = parseInt(entry.target.dataset.pageNum);
          currentPage = pageNum;
          pageNumInput.value = pageNum;
        }
      });
    }, {
      root: viewerMain,
      threshold: 0.5
    });

    const pages = viewerContainer.querySelectorAll('.page-container');
    pages.forEach(page => observer.observe(page));
  }
});
