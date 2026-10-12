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
  const pdfPane = document.getElementById('pdf-pane');

  // 对照翻译与工具栏 DOM 元素
  const pdfTranslateEngine = document.getElementById('pdf-translate-engine');
  const skipFormulasCheckbox = document.getElementById('skip-formulas');
  const translatePageBtn = document.getElementById('translate-page-btn');
  const translateDocBtn = document.getElementById('translate-doc-btn');
  const toggleBilingualBtn = document.getElementById('toggle-bilingual-btn');
  const translationPane = document.getElementById('translation-pane');
  const transPaneContent = document.getElementById('trans-pane-content');
  const transActiveBadge = document.getElementById('trans-active-badge');
  const transProgressCard = document.getElementById('trans-progress-card');
  const transProgressLabel = document.getElementById('trans-progress-label');
  const transProgressFill = document.getElementById('trans-progress-fill');
  const cancelTransBtn = document.getElementById('cancel-trans-btn');
  const copyAllTransBtn = document.getElementById('copy-all-trans-btn');
  const closeTransPaneBtn = document.getElementById('close-trans-pane-btn');

  let currentPdf = null;
  let currentScale = 1.2;
  let currentPage = 1;
  let pdfDataBuffer = null;
  let pdfFileName = '';
  let currentRenderId = 0;
  let activeTranslateController = null;
  let isTranslatingDoc = false;

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
      <!-- 左右拉伸调整手柄 -->
      <div class="panel-resize-handle resize-handle-left" title="左右拖动调整宽度"></div>
      <div class="panel-resize-handle resize-handle-right" title="左右拖动调整宽度"></div>
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

  // AI 模型内置列表 (智谱 GLM 4/4.5/4.7 Flash 官方模型永久免费)
  const AI_MODELS = {
    glm: [
      'glm-4-flash',
      'glm-4.5-flash',
      'glm-4.7-flash',
      'glm-4-flashx'
    ]
  };

  // PDF 文本语义段落重构与断行清洗函数
  function reconstructPdfParagraphs(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';

    // 1. 统一换行符
    let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 2. 按两个及以上连续换行（段落物理分界）切分为段落块
    const rawParagraphs = text.split(/\n\s*\n+/);

    const cleanParagraphs = rawParagraphs.map(paragraph => {
      const rawLines = paragraph.split('\n').map(l => l.trim()).filter(Boolean);
      if (rawLines.length === 0) return '';
      if (rawLines.length === 1) return rawLines[0];

      let merged = rawLines[0];

      for (let i = 1; i < rawLines.length; i++) {
        const prevLine = rawLines[i - 1];
        const currLine = rawLines[i];

        // 保留明显的列表项、序号标记行
        const isListItem = /^([-*•·]|(?:\d+|[a-zA-Z])[\.)])\s+/.test(currLine);
        if (isListItem) {
          merged += '\n' + currLine;
          continue;
        }

        // 规则 A: 连字符拆词连接 (例如 "infor-\nmation" -> "information")
        if (/([a-zA-Z]+)-$/.test(prevLine) && /^[a-zA-Z]/.test(currLine)) {
          merged = merged.slice(0, -1) + currLine;
          continue;
        }

        // 规则 B: 判断 CJK 汉字行与西文字符行的智能连接
        const prevEndsCJK = /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]$/.test(merged);
        const currStartsCJK = /^[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(currLine);

        if (prevEndsCJK && currStartsCJK) {
          // 中文行间直接拼接无空格
          merged += currLine;
        } else {
          // 西文、数字或混排以单个空格顺畅连接
          merged += ' ' + currLine;
        }
      }

      return merged;
    });

    return cleanParagraphs.filter(Boolean).join('\n\n');
  }

  // 浮窗左右拉伸逻辑
  const handleLeft = translatePanel.querySelector('.resize-handle-left');
  const handleRight = translatePanel.querySelector('.resize-handle-right');

  // 从 storage 读取并恢复用户偏好的浮窗宽度
  chrome.storage.local.get({ pdfPanelWidth: 360 }, (res) => {
    if (res.pdfPanelWidth && res.pdfPanelWidth >= 280) {
      translatePanel.style.width = `${res.pdfPanelWidth}px`;
    }
  });

  function initResize(e, direction) {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = translatePanel.offsetWidth;
    const startLeft = translatePanel.offsetLeft;

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    if (direction === 'left' && handleLeft) handleLeft.classList.add('active');
    if (direction === 'right' && handleRight) handleRight.classList.add('active');

    function onMouseMove(moveEvent) {
      const deltaX = moveEvent.clientX - startX;

      if (direction === 'right') {
        const maxW = Math.max(280, window.innerWidth - startLeft - 20);
        const newWidth = Math.max(280, Math.min(maxW, startWidth + deltaX));
        translatePanel.style.width = `${newWidth}px`;
      } else if (direction === 'left') {
        const newWidth = Math.max(280, startWidth - deltaX);
        const newLeft = startLeft + (startWidth - newWidth);
        if (newLeft >= 10) {
          translatePanel.style.width = `${newWidth}px`;
          translatePanel.style.left = `${newLeft}px`;
        }
      }
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (handleLeft) handleLeft.classList.remove('active');
      if (handleRight) handleRight.classList.remove('active');

      const finalWidth = translatePanel.offsetWidth;
      chrome.storage.local.set({ pdfPanelWidth: finalWidth });
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  if (handleLeft) handleLeft.addEventListener('mousedown', (e) => initResize(e, 'left'));
  if (handleRight) handleRight.addEventListener('mousedown', (e) => initResize(e, 'right'));

  // 动态加载可用引擎列表
  function loadAvailableEngines(callback) {
    chrome.storage.local.get({
      glmApiKey: '',
      glmModels: null,
      deeplApiKey: '',
      youdaoAppKey: '',
      youdaoAppSecret: '',
      pdfTranslateEngine: 'google',
      customModels: []
    }, (result) => {
      // 动态载入用户在设置中启用的模型列表
      if (Array.isArray(result.glmModels) && result.glmModels.length > 0) AI_MODELS.glm = result.glmModels;

      const currentPanelVal = panelEngineSelect.value;
      const currentToolbarVal = pdfTranslateEngine ? (pdfTranslateEngine.value || result.pdfTranslateEngine || 'google') : 'google';

      panelEngineSelect.innerHTML = '';
      if (pdfTranslateEngine) pdfTranslateEngine.innerHTML = '';

      const available = [
        { value: 'google', label: 'Google 翻译 (免Key)' },
        { value: 'bing', label: 'Bing 翻译 (免Key·微软)' },
        { value: 'deepl', label: 'DeepL 翻译 (精准自然·100万额度)' }
      ];

      if (result.glmApiKey) {
        available.push({ value: 'glm', label: '智谱 GLM (免费Flash)' });
      }
      if (result.youdaoAppKey && result.youdaoAppSecret) {
        available.push({ value: 'youdao', label: '有道词典' });
      }

      result.customModels.forEach(m => {
        available.push({ value: `custom_${m.id}`, label: m.name });
      });

      available.forEach(item => {
        const optPanel = document.createElement('option');
        optPanel.value = item.value;
        optPanel.textContent = item.label;
        panelEngineSelect.appendChild(optPanel);

        if (pdfTranslateEngine) {
          const optToolbar = document.createElement('option');
          optToolbar.value = item.value;
          optToolbar.textContent = item.label;
          pdfTranslateEngine.appendChild(optToolbar);
        }
      });

      const availableValues = available.map(a => a.value);
      if (availableValues.includes(currentPanelVal)) {
        panelEngineSelect.value = currentPanelVal;
      } else {
        panelEngineSelect.value = 'google';
      }

      if (pdfTranslateEngine) {
        if (availableValues.includes(currentToolbarVal)) {
          pdfTranslateEngine.value = currentToolbarVal;
        } else {
          pdfTranslateEngine.value = 'google';
        }
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
      const rawText = selection.toString().trim();

      if (!rawText || rawText.length < 1 || rawText.length > 3000) {
        if (!translatePanel.classList.contains('show')) {
          hideIcon();
        }
        return;
      }

      // 语义重构段落，消除 PDF 硬换行和断字
      const text = reconstructPdfParagraphs(rawText);
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
    const panelWidth = translatePanel.offsetWidth || 360;
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
      let models = AI_MODELS[engine];
      // 划词翻译下拉框中：GLM 仅显示免费模型 (flash 免费系列)
      if (engine === 'glm') {
        const freeModels = models.filter(m => m.toLowerCase().includes('flash'));
        models = freeModels.length > 0 ? freeModels : ['glm-4-flash', 'glm-4.5-flash', 'glm-4.7-flash', 'glm-4-flashx'];
      }

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
      if (translatePageBtn) translatePageBtn.disabled = false;
      if (translateDocBtn) translateDocBtn.disabled = false;

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
      root: pdfPane || viewerMain,
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
      root: pdfPane || viewerMain,
      threshold: 0.5
    });

    const pages = viewerContainer.querySelectorAll('.page-container');
    pages.forEach(page => observer.observe(page));
  }

  // --- 论文/学术 PDF 段落、图表及公式识别与保护算法 ---

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 1. 公式特征识别
  function isFormulaText(str) {
    if (!str || typeof str !== 'string') return false;
    const trimmed = str.trim();
    if (trimmed.length === 0) return false;

    // 独立公式编号结尾，例如 "(1)", "(2.3)", "(A.1)"
    if (/\(\s*(\d+(\.\d+)?|[a-zA-Z](\.\d+)?)\s*\)$/.test(trimmed)) {
      if (/[=><\+\-\*\/\^_\\]/.test(trimmed)) return true;
    }

    // 常见数学特殊符号字符集 (Unicode 数学符号区、希腊字母区)
    const mathSymbolsRegex = /[\u2200-\u22FF\u2A00-\u2AFF\u27C0-\u27EF\u2980-\u29FF\u2100-\u214F\u0370-\u03FF]/;
    const hasMathSymbols = mathSymbolsRegex.test(trimmed);

    // LaTeX 命令特征或算符特征
    const hasLatexCmd = /\\[a-zA-Z]+|\b\w+\s*=\s*|\b\w+_[0-9a-zA-Z]|\b\w+\^[0-9a-zA-Z]/.test(trimmed);

    // 统计标准英文单词数量（4个字母以上）
    const words = trimmed.match(/[a-zA-Z]{4,}/g) || [];
    
    // 如果数学符号密集且正常自然语言单词很少，判定为独立公式
    if ((hasMathSymbols || hasLatexCmd) && words.length <= 4) {
      return true;
    }

    // 包含明显的方程结构：变量 = 表达式，并且无连续自然语言句子
    if (/^[A-Za-z0-9_\\\^]+\s*=\s*[^,\.\?!]+$/.test(trimmed) && words.length <= 3) {
      return true;
    }

    return false;
  }

  // 2. 图表、表格标题识别
  function isChartCaption(str) {
    if (!str || typeof str !== 'string') return false;
    const trimmed = str.trim();
    return /^(Figure|Fig\.|Table|Tab\.|Chart|Diagram|图|表)\s*(\d+|[A-Z]|\d+\.\d+)/i.test(trimmed);
  }

  // 3. 行内数学公式占位保护
  function protectInlineFormulas(text) {
    const tokenMap = new Map();
    let counter = 0;

    // 保护 $...$ 或 \(...\) 或 $$...$$
    let protectedText = text.replace(/(\$\$[\s\S]+?\$\$|\$[^\$]+?\$|\\\(.+?\\\)|\\\[[\s\S]+?\\\])/g, (match) => {
      const token = `__FORMULA_TOKEN_${counter++}__`;
      tokenMap.set(token, match);
      return token;
    });

    // 保护单独的显式方程式表达式 (例如 "x_t = \alpha x_{t-1} + \epsilon_t")
    protectedText = protectedText.replace(/(\b[a-zA-Z]_[0-9a-zA-Z]+\s*=\s*[a-zA-Z0-9_\+\-\*\/\^\\\(\)\s]+)/g, (match) => {
      if (match.length > 5 && match.length < 100 && !/\b(the|and|for|that|with)\b/i.test(match)) {
        const token = `__FORMULA_TOKEN_${counter++}__`;
        tokenMap.set(token, match);
        return token;
      }
      return match;
    });

    return { text: protectedText, tokenMap };
  }

  // 4. 还原被保护的行内数学公式
  function restoreInlineFormulas(text, tokenMap) {
    if (!text || !tokenMap || tokenMap.size === 0) return text;
    let restored = text;
    tokenMap.forEach((origFormula, token) => {
      // 兼容某些翻译引擎在下划线周围插入多余空格的情况 (例如 "__ FORMULA_TOKEN_0 __")
      const safeTokenPattern = token.replace(/_/g, '_?\\s*');
      const reg = new RegExp(safeTokenPattern, 'gi');
      restored = restored.replace(reg, origFormula);
    });
    return restored;
  }

  // 5. 页面语义块解析算法 (精准识别行、段落、图表、公式)
  async function extractPageBlocks(page, skipFormulas) {
    const textContent = await page.getTextContent();
    const items = textContent.items;
    if (!items || items.length === 0) return [];

    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;

    const validItems = items
      .filter(item => item.str && item.str.trim())
      .map(item => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        w: item.width,
        h: item.height || Math.abs(item.transform[3]) || 12
      }));

    if (validItems.length === 0) return [];

    // 按 Y 轴降序聚合成行 (PDF 坐标系中 Y 越大在越上方)
    const lines = [];
    validItems.sort((a, b) => b.y - a.y);

    for (const item of validItems) {
      // 忽略页眉页脚（距离顶部或底部 32pt 以内的页码或轻量元信息）
      if (item.y > pageHeight - 32 || item.y < 32) {
        if (/^\d+$/.test(item.str.trim()) || /^Page\s*\d+/i.test(item.str.trim())) {
          continue;
        }
      }

      let line = lines.find(l => Math.abs(l.y - item.y) <= 4);
      if (line) {
        line.items.push(item);
      } else {
        lines.push({
          y: item.y,
          h: item.h,
          items: [item]
        });
      }
    }

    lines.sort((a, b) => b.y - a.y);
    const lineTexts = lines.map(line => {
      line.items.sort((a, b) => a.x - b.x);
      let text = line.items[0].str;
      for (let i = 1; i < line.items.length; i++) {
        const prev = line.items[i - 1];
        const curr = line.items[i];
        if (curr.x - (prev.x + prev.w) > 2 && !text.endsWith(' ') && !curr.str.startsWith(' ')) {
          text += ' ' + curr.str;
        } else {
          text += curr.str;
        }
      }
      return {
        text: text.trim(),
        y: line.y,
        h: line.h,
        x: line.items[0].x
      };
    }).filter(l => l.text.length > 0);

    const blocks = [];
    let currentParagraphLines = [];

    function flushParagraph() {
      if (currentParagraphLines.length === 0) return;
      const mergedText = reconstructPdfParagraphs(currentParagraphLines.map(l => l.text).join('\n'));
      if (mergedText && mergedText.trim()) {
        blocks.push({
          id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          type: 'paragraph',
          originalText: mergedText.trim()
        });
      }
      currentParagraphLines = [];
    }

    for (let i = 0; i < lineTexts.length; i++) {
      const lineObj = lineTexts[i];
      const text = lineObj.text;

      // 1) 检测独立公式行
      if (isFormulaText(text)) {
        flushParagraph();
        blocks.push({
          id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          type: 'formula',
          originalText: text
        });
        continue;
      }

      // 2) 检测图表或表格说明行
      if (isChartCaption(text)) {
        flushParagraph();
        blocks.push({
          id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          type: 'caption',
          originalText: text
        });
        continue;
      }

      // 3) 检查是否开启新段落 (基于垂直行距)
      if (currentParagraphLines.length > 0) {
        const prevLine = currentParagraphLines[currentParagraphLines.length - 1];
        const lineGap = prevLine.y - lineObj.y;
        const avgH = (prevLine.h + lineObj.h) / 2;

        if (lineGap > avgH * 1.65) {
          flushParagraph();
        }
      }

      currentParagraphLines.push(lineObj);
    }

    flushParagraph();
    return blocks;
  }

  // 6. 异步调用后台翻译 API
  function requestTranslation(text, engine, targetLang) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'translate',
        text: text,
        engine: engine,
        targetLang: targetLang
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!response) {
          reject(new Error('翻译超时或服务未响应'));
        } else if (response.success) {
          resolve(response.translation);
        } else {
          reject(new Error(response.error || '翻译失败'));
        }
      });
    });
  }

  // 7. 翻译单页核心方法 (支持独立翻译与批量全文调用)
  async function translatePage(pageNum, isBatch = false) {
    if (!currentPdf) return;
    const page = await currentPdf.getPage(pageNum);
    const skipFormulas = skipFormulasCheckbox ? skipFormulasCheckbox.checked : true;

    // 展开并显示右侧对照栏
    translationPane.classList.remove('hidden');
    toggleBilingualBtn.classList.add('active');

    if (!isBatch) {
      transPaneContent.innerHTML = '';
      transActiveBadge.textContent = `第 ${pageNum} 页`;
    }

    // 检查页面容器是否已存在
    let sectionEl = transPaneContent.querySelector(`.trans-page-section[data-page-num="${pageNum}"]`);
    if (!sectionEl) {
      sectionEl = document.createElement('div');
      sectionEl.className = 'trans-page-section';
      sectionEl.dataset.pageNum = pageNum;
      sectionEl.innerHTML = `
        <div class="trans-page-section-header">
          <span class="page-tag">第 ${pageNum} 页</span>
          <span style="font-size: 11px; color: #8e8e93;">解析中...</span>
        </div>
        <div class="trans-cards-container"></div>
      `;
      transPaneContent.appendChild(sectionEl);
    }

    const cardsContainer = sectionEl.querySelector('.trans-cards-container');
    const headerEl = sectionEl.querySelector('.trans-page-section-header');

    // 提取并结构化页面内容块
    const blocks = await extractPageBlocks(page, skipFormulas);
    if (headerEl) {
      headerEl.innerHTML = `
        <span class="page-tag">第 ${pageNum} 页</span>
        <span style="font-size: 11px; color: #8e8e93;">共 ${blocks.length} 个结构块</span>
      `;
    }

    const engine = (pdfTranslateEngine && pdfTranslateEngine.value) ? pdfTranslateEngine.value : 'google';
    const settings = await new Promise(resolve => {
      chrome.storage.local.get({ defaultTargetLang: 'zh-CN' }, resolve);
    });
    const targetLang = settings.defaultTargetLang || 'zh-CN';

    // 逐个块构建对照卡片并请求翻译
    for (const block of blocks) {
      if (activeTranslateController && activeTranslateController.aborted) break;

      const card = document.createElement('div');
      card.className = 'bilingual-card';
      card.dataset.blockId = block.id;

      let tagHtml = '';
      if (block.type === 'caption') tagHtml = '<span class="bilingual-tag caption">图表说明</span>';
      if (block.type === 'formula') tagHtml = '<span class="bilingual-tag formula">数学公式</span>';

      card.innerHTML = `
        <div class="bilingual-orig">
          <div class="bilingual-orig-header">
            <span style="font-size: 11px; color: #8e8e93; font-weight: 500;">原文</span>
            ${tagHtml}
          </div>
          <div>${escapeHtml(block.originalText)}</div>
        </div>
        <div class="bilingual-trans ${block.type === 'formula' && skipFormulas ? 'preserved-formula' : 'loading'}">
          ${block.type === 'formula' && skipFormulas ? escapeHtml(block.originalText) : '正在翻译...'}
        </div>
        <div class="bilingual-footer">
          <button class="bilingual-action-btn speak-btn" title="朗读">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            朗读
          </button>
          <button class="bilingual-action-btn copy-btn" title="复制译文">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            复制
          </button>
        </div>
      `;

      cardsContainer.appendChild(card);

      const transEl = card.querySelector('.bilingual-trans');
      const copyBtn = card.querySelector('.copy-btn');
      const speakBtn = card.querySelector('.speak-btn');

      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(transEl.textContent);
        copyBtn.style.color = '#34c759';
        setTimeout(() => copyBtn.style.color = '', 1500);
      });

      speakBtn.addEventListener('click', () => {
        speakText(transEl.textContent);
      });

      // 如果是公式且开启了公式不翻译，直接保留，免调 API
      if (block.type === 'formula' && skipFormulas) {
        continue;
      }

      // 普通段落或图表说明：行内公式保护
      let textToTranslate = block.originalText;
      let tokenMap = null;
      if (skipFormulas) {
        const protectedObj = protectInlineFormulas(textToTranslate);
        textToTranslate = protectedObj.text;
        tokenMap = protectedObj.tokenMap;
      }

      try {
        const transResult = await requestTranslation(textToTranslate, engine, targetLang);
        if (activeTranslateController && activeTranslateController.aborted) break;

        const finalText = tokenMap ? restoreInlineFormulas(transResult, tokenMap) : transResult;
        transEl.classList.remove('loading');
        transEl.textContent = finalText;
      } catch (err) {
        transEl.classList.remove('loading');
        transEl.classList.add('error');
        transEl.textContent = `翻译失败: ${err.message}`;
      }
    }
  }

  // 8. 全文自动翻译核心方法
  async function translateFullDocument() {
    if (!currentPdf || isTranslatingDoc) return;
    isTranslatingDoc = true;
    activeTranslateController = { aborted: false };

    transProgressCard.classList.remove('hidden');
    transPaneContent.innerHTML = '';
    transActiveBadge.textContent = '全文翻译中...';
    if (translateDocBtn) translateDocBtn.disabled = true;
    if (translatePageBtn) translatePageBtn.disabled = true;

    const totalPages = currentPdf.numPages;

    for (let p = 1; p <= totalPages; p++) {
      if (activeTranslateController.aborted) break;

      const percent = Math.round(((p - 1) / totalPages) * 100);
      transProgressFill.style.width = `${percent}%`;
      transProgressLabel.textContent = `正在翻译第 ${p} / ${totalPages} 页 (${percent}%)...`;

      await translatePage(p, true);
    }

    if (activeTranslateController.aborted) {
      transProgressLabel.textContent = '翻译已停止';
      transActiveBadge.textContent = '已停止';
    } else {
      transProgressFill.style.width = '100%';
      transProgressLabel.textContent = '全文翻译完成！';
      transActiveBadge.textContent = '已完成';
    }

    setTimeout(() => {
      transProgressCard.classList.add('hidden');
    }, 2500);

    isTranslatingDoc = false;
    if (translateDocBtn) translateDocBtn.disabled = false;
    if (translatePageBtn) translatePageBtn.disabled = false;
  }

  // 9. 绑定对照翻译相关交互事件
  if (translatePageBtn) {
    translatePageBtn.addEventListener('click', () => {
      if (!currentPdf) return;
      activeTranslateController = { aborted: false };
      translatePage(currentPage, false);
    });
  }

  if (translateDocBtn) {
    translateDocBtn.addEventListener('click', () => {
      translateFullDocument();
    });
  }

  if (cancelTransBtn) {
    cancelTransBtn.addEventListener('click', () => {
      if (activeTranslateController) {
        activeTranslateController.aborted = true;
      }
    });
  }

  if (toggleBilingualBtn) {
    toggleBilingualBtn.addEventListener('click', () => {
      translationPane.classList.toggle('hidden');
      toggleBilingualBtn.classList.toggle('active', !translationPane.classList.contains('hidden'));
    });
  }

  if (closeTransPaneBtn) {
    closeTransPaneBtn.addEventListener('click', () => {
      translationPane.classList.add('hidden');
      toggleBilingualBtn.classList.remove('active');
    });
  }

  if (copyAllTransBtn) {
    copyAllTransBtn.addEventListener('click', () => {
      const cards = transPaneContent.querySelectorAll('.bilingual-card');
      if (cards.length === 0) return;
      const allTexts = [];
      let currentP = '';
      cards.forEach(card => {
        const section = card.closest('.trans-page-section');
        const pageNum = section ? section.dataset.pageNum : '';
        if (pageNum && pageNum !== currentP) {
          currentP = pageNum;
          allTexts.push(`\n=== 第 ${pageNum} 页 ===\n`);
        }
        const transText = card.querySelector('.bilingual-trans')?.textContent?.trim();
        if (transText && !transText.startsWith('正在翻译')) {
          allTexts.push(transText);
        }
      });
      navigator.clipboard.writeText(allTexts.join('\n\n')).then(() => {
        copyAllTransBtn.style.color = '#34c759';
        setTimeout(() => copyAllTransBtn.style.color = '', 1500);
      });
    });
  }

  if (pdfTranslateEngine) {
    pdfTranslateEngine.addEventListener('change', () => {
      chrome.storage.local.set({ pdfTranslateEngine: pdfTranslateEngine.value });
    });
  }
});
