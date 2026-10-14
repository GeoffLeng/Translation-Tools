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
  const viewerContainerTrans = document.getElementById('pdf-viewer-container-trans');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingStatus = document.getElementById('loading-status');
  const viewerMain = document.getElementById('viewer-main');
  const pdfPane = document.getElementById('pdf-pane');

  // 对照翻译与工具栏 DOM 元素
  const pdfTranslateEngine = document.getElementById('pdf-translate-engine');
  const pdfTranslateModel = document.getElementById('pdf-translate-model');
  const skipFormulasCheckbox = document.getElementById('skip-formulas');
  const translatePageBtn = document.getElementById('translate-page-btn');
  const translateDocBtn = document.getElementById('translate-doc-btn');
  const toggleBilingualBtn = document.getElementById('toggle-bilingual-btn');
  const translationPane = document.getElementById('translation-pane');
  const transActiveBadge = document.getElementById('trans-active-badge');
  const transProgressCard = document.getElementById('trans-progress-card');
  const transProgressLabel = document.getElementById('trans-progress-label');
  const transProgressFill = document.getElementById('trans-progress-fill');
  const cancelTransBtn = document.getElementById('cancel-trans-btn');
  const copyAllTransBtn = document.getElementById('copy-all-trans-btn');
  const closeTransPaneBtn = document.getElementById('close-trans-pane-btn');
  const transFontDecBtn = document.getElementById('trans-font-dec-btn');
  const transFontScaleText = document.getElementById('trans-font-scale-text');
  const transFontIncBtn = document.getElementById('trans-font-inc-btn');
  const toggleTransOpacityBtn = document.getElementById('toggle-trans-opacity-btn');
  const toggleTransPeekBtn = document.getElementById('toggle-trans-peek-btn');
  const exportBilingualBtn = document.getElementById('export-bilingual-btn');
  const scannedPdfAlert = document.getElementById('scanned-pdf-alert');
  const dismissScannedAlert = document.getElementById('dismiss-scanned-alert');
  const viewerWorkspace = document.getElementById('viewer-workspace');

  let currentPdf = null;
  let currentScale = 1.2;
  let currentPage = 1;
  let pdfDataBuffer = null;
  let pdfFileName = '';
  let currentRenderId = 0;
  let activeTranslateController = null;
  let isTranslatingDoc = false;
  let isPeekingLocked = false;
  const pageTranslations = new Map(); // pageNum -> Array of { id, type, originalText, transText, box }

  let transFontScale = 1.0;
  let opacityModeIndex = 0;
  const opacityModes = ['', 'mode-semi', 'mode-clear'];
  const opacityTitles = [
    '切换译文底色: 纯白遮罩 (清晰阅读，可长按 Alt 键透视原图)',
    '切换译文底色: 半透明微磨砂 (兼顾原排版与原图)',
    '切换译文底色: 极简纯字 (透视底层公式与背景)'
  ];

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

  // 规范化 PDF 提取出的字符与标点符号 (解决连字、软连字符、特殊空白符等排版影响)
  function normalizePdfText(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/\uFB00/g, 'ff')
      .replace(/\uFB01/g, 'fi')
      .replace(/\uFB02/g, 'fl')
      .replace(/\uFB03/g, 'ffi')
      .replace(/\uFB04/g, 'ffl')
      .replace(/\u00AD/g, '')       // 软连字符
      .replace(/[\u200B\uFEFF]/g, '') // 零宽字符
      .replace(/\u00A0/g, ' ')      // 不换行空格
      .replace(/[\u2018\u2019]/g, "'") // 弯单引号
      .replace(/[\u201C\u201D]/g, '"') // 弯双引号
      .replace(/[ \t]+/g, ' ');     // 压缩多余连续水平空白
  }

  // PDF 文本语义段落重构与断行清洗函数
  function reconstructPdfParagraphs(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';

    // 1. 规范化字符集并统一换行符
    let text = normalizePdfText(rawText).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

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

        // 规则 B: 常见英文句尾缩写保护 (例如 "e.g.", "i.e.", "et al.", "Fig.", "Tab.", "Ref.")
        const endsWithAbbr = /(?:e\.g|i\.e|et al|Fig|Table|Tab|Ref|Dr|Mr|Mrs|vs|No|vol|pp)\.$/i.test(prevLine);

        // 规则 C: 判断 CJK 汉字行与西文字符行的智能连接
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
        { value: 'bing', label: 'Bing 翻译 (免Key·微软)' }
      ];

      if ((result.deeplApiKey && result.deeplApiKey.trim()) || (result.deeplEndpoint && result.deeplEndpoint.trim())) {
        available.push({ value: 'deepl', label: 'DeepL 翻译 (精准自然)' });
      }
      if (result.glmApiKey && result.glmApiKey.trim()) {
        available.push({ value: 'glm', label: '智谱 GLM (免费Flash)' });
      }
      if (result.youdaoAppKey && result.youdaoAppSecret && result.youdaoAppKey.trim() && result.youdaoAppSecret.trim()) {
        available.push({ value: 'youdao', label: '有道词典' });
      }

      result.customModels.forEach(m => {
        if ((m.apiKey && m.apiKey.trim()) || (m.endpoint && m.endpoint.trim())) {
          available.push({ value: `custom_${m.id}`, label: m.name });
        }
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
        updateToolbarModelSelect(pdfTranslateEngine.value);
      }

      if (callback) callback();
    });
  }

  // 更新顶部工具栏中的 AI 模型选择下拉框 (如 GLM 具体模型)
  function updateToolbarModelSelect(engine) {
    if (!pdfTranslateModel) return;
    pdfTranslateModel.innerHTML = '';

    if (engine === 'glm') {
      const models = AI_MODELS.glm || ['glm-4-flash', 'glm-4.5-flash', 'glm-4.7-flash', 'glm-4-flashx'];
      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        pdfTranslateModel.appendChild(opt);
      });
      chrome.storage.local.get(['glmActiveModel'], (res) => {
        const activeM = res.glmActiveModel;
        if (activeM && models.includes(activeM)) {
          pdfTranslateModel.value = activeM;
        } else if (models.length > 0) {
          pdfTranslateModel.value = models[0];
        }
        pdfTranslateModel.classList.remove('hidden');
      });
    } else {
      pdfTranslateModel.classList.add('hidden');
    }
  }

  if (pdfTranslateModel) {
    pdfTranslateModel.addEventListener('change', () => {
      if (pdfTranslateEngine && pdfTranslateEngine.value === 'glm') {
        chrome.storage.local.set({ glmActiveModel: pdfTranslateModel.value });
      }
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

      // 高效批量创建左右两侧空容器占位（仅轻量 DOM 骨架，无 Canvas 纹理开销）
      const fragment = document.createDocumentFragment();
      const fragmentTrans = document.createDocumentFragment();

      for (let i = 1; i <= currentPdf.numPages; i++) {
        const pageContainer = document.createElement('div');
        pageContainer.className = 'page-container is-unloaded';
        pageContainer.dataset.pageNum = i;
        pageContainer.style.width = `${defaultW}px`;
        pageContainer.style.height = `${defaultH}px`;
        pageContainer.innerHTML = `<div class="page-skeleton"><span class="page-skeleton-badge">第 ${i} 页 原文</span></div>`;
        fragment.appendChild(pageContainer);

        const pageContainerTrans = document.createElement('div');
        pageContainerTrans.className = 'page-container is-unloaded';
        pageContainerTrans.dataset.pageNum = i;
        pageContainerTrans.style.width = `${defaultW}px`;
        pageContainerTrans.style.height = `${defaultH}px`;
        pageContainerTrans.innerHTML = `<div class="page-skeleton"><span class="page-skeleton-badge">第 ${i} 页 译文</span></div>`;
        fragmentTrans.appendChild(pageContainerTrans);
      }
      viewerContainer.appendChild(fragment);
      if (viewerContainerTrans) {
        viewerContainerTrans.innerHTML = '';
        viewerContainerTrans.appendChild(fragmentTrans);
      }

      // 创建视口按需加载 Observer (上下扩展 400px 缓冲带)
      setupVirtualObserver(renderId);
      setupScrollSpy();
      setupTwinScrollSync();
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

  // 页面阅读位置追踪与页码同步
  function setupScrollSpy() {
    if (!pdfPane) return;
    pdfPane.addEventListener('scroll', () => {
      if (!currentPdf) return;
      const pages = viewerContainer.querySelectorAll('.page-container');
      const paneTop = pdfPane.getBoundingClientRect().top;
      let closestPage = 1;
      let minDistance = Infinity;

      pages.forEach(p => {
        const rect = p.getBoundingClientRect();
        const dist = Math.abs(rect.top - paneTop);
        if (dist < minDistance) {
          minDistance = dist;
          closestPage = parseInt(p.dataset.pageNum, 10);
        }
      });

      if (closestPage !== currentPage) {
        currentPage = closestPage;
        if (pageNumInput) pageNumInput.value = currentPage;
        updatePaginationButtons();
      }
    }, { passive: true });
  }

  function updatePaginationButtons() {
    if (!currentPdf) return;
    if (prevPageBtn) prevPageBtn.disabled = (currentPage <= 1);
    if (nextPageBtn) nextPageBtn.disabled = (currentPage >= currentPdf.numPages);
  }

  function scrollToPage(pageNum) {
    if (!currentPdf) return;
    const clamped = Math.max(1, Math.min(pageNum, currentPdf.numPages));
    currentPage = clamped;
    if (pageNumInput) pageNumInput.value = currentPage;
    updatePaginationButtons();

    const targetLeft = viewerContainer.querySelector(`.page-container[data-page-num="${currentPage}"]`);
    if (targetLeft) {
      targetLeft.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (viewerContainerTrans && !translationPane.classList.contains('hidden')) {
      ensurePageTransMounted(currentPage, currentRenderId).then(() => {
        syncTransPanePosition();
      });
    }
  }

  // 精准将右侧对照镜像容器滚动对齐到当前阅读页（单向同步，绝对不干扰左栏原文滚动）
  function syncTransPanePosition() {
    if (!translationPane || translationPane.classList.contains('hidden')) return;
    if (!viewerContainerTrans || !pdfPane) return;

    const targetOrig = viewerContainer.querySelector(`.page-container[data-page-num="${currentPage}"]`);
    const targetTrans = viewerContainerTrans.querySelector(`.page-container[data-page-num="${currentPage}"]`);

    if (targetOrig && targetTrans) {
      const origRect = targetOrig.getBoundingClientRect();
      const paneRect = pdfPane.getBoundingClientRect();
      const relativeTop = origRect.top - paneRect.top;

      const transRect = targetTrans.getBoundingClientRect();
      const transContainerRect = viewerContainerTrans.getBoundingClientRect();
      const currentRelativeTop = transRect.top - transContainerRect.top;

      const diff = currentRelativeTop - relativeTop;
      if (Math.abs(diff) > 0.5) {
        viewerContainerTrans.scrollTop += diff;
      }
    }
  }

  // 左右双栏统一滚动同步体系（单向数据流 Single Source of Truth，彻底杜绝跳页反向震荡）
  function setupTwinScrollSync() {
    if (!pdfPane || !viewerContainerTrans) return;

    // 1. 左栏为主滚动源：左栏滚动时，实时驱动右栏进行高精度视口对齐
    pdfPane.addEventListener('scroll', () => {
      syncTransPanePosition();
    }, { passive: true });

    // 2. 右栏滚轮穿透：在右侧对照栏内滚动滚轮时，直接驱动主视口（绝不计算不可靠比例，绝不反向拉扯）
    if (translationPane) {
      translationPane.addEventListener('wheel', (e) => {
        const block = e.target.closest ? e.target.closest('.trans-overlay-block') : null;
        if (block && block.scrollHeight > block.clientHeight) {
          return;
        }
        pdfPane.scrollTop += e.deltaY;
        e.preventDefault();
      }, { passive: false });
    }
  }

  // 专门确保右侧对照栏指定页面完整挂载底图 Canvas 与 trans-overlay-layer
  async function ensurePageTransMounted(pageNum, renderId) {
    if (!viewerContainerTrans || !currentPdf) return null;
    const pageContainerTrans = viewerContainerTrans.querySelector(`.page-container[data-page-num="${pageNum}"]`);
    if (!pageContainerTrans) return null;

    let canvasTrans = pageContainerTrans.querySelector('canvas');
    let transOverlay = pageContainerTrans.querySelector('.trans-overlay-layer');

    // 如果已经挂载且有有效的 canvas，直接复用
    if (canvasTrans && transOverlay && !pageContainerTrans.classList.contains('is-unloaded') && canvasTrans.width > 0) {
      return { pageContainerTrans, canvasTrans, transOverlay };
    }

    try {
      const page = await currentPdf.getPage(pageNum);
      if (renderId && renderId !== currentRenderId) return null;

      const viewport = page.getViewport({ scale: currentScale });
      const wPx = Math.round(viewport.width);
      const hPx = Math.round(viewport.height);

      pageContainerTrans.style.width = `${wPx}px`;
      pageContainerTrans.style.height = `${hPx}px`;

      if (!canvasTrans) {
        canvasTrans = document.createElement('canvas');
      }
      canvasTrans.width = wPx;
      canvasTrans.height = hPx;
      const ctxTrans = canvasTrans.getContext('2d');

      // 核心性能与稳定性突破：优先从左侧已渲染的 canvas 直接克隆画面，0延时、极速硬件级呈现且绝不与 PDF.js 冲突
      const pageContainerLeft = viewerContainer.querySelector(`.page-container[data-page-num="${pageNum}"]`);
      const leftCanvas = pageContainerLeft ? pageContainerLeft.querySelector('canvas') : null;
      if (leftCanvas && leftCanvas.width === wPx && leftCanvas.height === hPx) {
        ctxTrans.drawImage(leftCanvas, 0, 0);
      } else {
        await page.render({ canvasContext: ctxTrans, viewport: viewport }).promise;
      }
      if (renderId && renderId !== currentRenderId) return null;

      if (!transOverlay) {
        transOverlay = document.createElement('div');
        transOverlay.className = 'trans-overlay-layer';
      }

      pageContainerTrans.innerHTML = '';
      pageContainerTrans.classList.remove('is-unloaded');
      pageContainerTrans.appendChild(canvasTrans);
      pageContainerTrans.appendChild(transOverlay);

      // 如果已有翻译缓存，立即重绘原排版覆盖译文块
      if (pageTranslations.has(pageNum)) {
        const blocks = pageTranslations.get(pageNum);
        renderOverlayBlocksOnLayer(transOverlay, blocks, page.getViewport({ scale: 1.0 }).height, currentScale);
      }

      const existing = renderedPages.get(pageNum) || { isRendering: false, isRendered: true };
      existing.canvasTrans = canvasTrans;
      renderedPages.set(pageNum, existing);

      return { pageContainerTrans, canvasTrans, transOverlay };
    } catch (err) {
      console.error(`挂载第 ${pageNum} 页右侧镜像失败:`, err);
      return null;
    }
  }

  // 视口内挂载页面 (同步原排版渲染左侧原文与右侧译文镜像底图)
  async function mountPage(pageNum, renderId) {
    if (renderId && renderId !== currentRenderId) return;
    const pageState = renderedPages.get(pageNum);
    if (pageState && (pageState.isRendered || pageState.isRendering)) {
      if (viewerContainerTrans && translationPane && !translationPane.classList.contains('hidden')) {
        await ensurePageTransMounted(pageNum, renderId);
      }
      return;
    }

    renderedPages.set(pageNum, { isRendering: true, isRendered: false });
    const pageContainer = viewerContainer.querySelector(`.page-container[data-page-num="${pageNum}"]`);
    if (!pageContainer) return;

    try {
      const page = await currentPdf.getPage(pageNum);
      if (renderId && renderId !== currentRenderId) return;

      const viewport = page.getViewport({ scale: currentScale });
      const wPx = Math.round(viewport.width);
      const hPx = Math.round(viewport.height);

      pageContainer.style.width = `${wPx}px`;
      pageContainer.style.height = `${hPx}px`;

      const canvas = document.createElement('canvas');
      canvas.width = wPx;
      canvas.height = hPx;
      const context = canvas.getContext('2d');

      await page.render({ canvasContext: context, viewport: viewport }).promise;
      if (renderId && renderId !== currentRenderId) return;

      // 文本选择层构建
      const textContent = await page.getTextContent();
      if (renderId && renderId !== currentRenderId) return;

      const textLayerDiv = document.createElement('div');
      textLayerDiv.className = 'textLayer';
      textLayerDiv.style.width = `${wPx}px`;
      textLayerDiv.style.height = `${hPx}px`;
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

      // --- 同步挂载右侧对照镜像页面 (若右侧对照栏可见或已有翻译) ---
      let canvasTrans = null;
      if (viewerContainerTrans && (!translationPane.classList.contains('hidden') || pageTranslations.has(pageNum))) {
        const transResult = await ensurePageTransMounted(pageNum, renderId);
        if (transResult) canvasTrans = transResult.canvasTrans;
      }

      renderedPages.set(pageNum, { isRendering: false, isRendered: true, canvas: canvas, canvasTrans: canvasTrans });
    } catch (e) {
      console.error(e);
      renderedPages.delete(pageNum);
    }
  }

  // 移出视口卸载回收内存
  function unmountPage(pageNum) {
    // 关键安全防线：绝对严禁卸载当前正在阅读的页面、以及用户已耗费资源翻译好的页面！
    if (pageNum === currentPage || pageTranslations.has(pageNum)) {
      return;
    }

    const pageState = renderedPages.get(pageNum);
    if (!pageState || !pageState.isRendered) return;

    const pageContainer = viewerContainer.querySelector(`.page-container[data-page-num="${pageNum}"]`);
    if (pageContainer) {
      if (pageState.canvas) {
        pageState.canvas.width = 0;
        pageState.canvas.height = 0;
      }
      pageContainer.innerHTML = `<div class="page-skeleton"><span class="page-skeleton-badge">第 ${pageNum} 页 原文</span></div>`;
      pageContainer.classList.add('is-unloaded');
    }

    if (viewerContainerTrans) {
      const pageContainerTrans = viewerContainerTrans.querySelector(`.page-container[data-page-num="${pageNum}"]`);
      if (pageContainerTrans) {
        if (pageState.canvasTrans) {
          pageState.canvasTrans.width = 0;
          pageState.canvasTrans.height = 0;
        }
        pageContainerTrans.innerHTML = `<div class="page-skeleton"><span class="page-skeleton-badge">第 ${pageNum} 页 译文</span></div>`;
        pageContainerTrans.classList.add('is-unloaded');
      }
    }

    renderedPages.delete(pageNum);
  }

  // 绑定译文块交互：悬停联动、双击复制、点击对齐左侧原文并弹出光环
  function bindOverlayBlockInteractions(overlayBlock, block, pageNum, pageHeight, scale) {
    overlayBlock.addEventListener('mouseenter', () => {
      overlayBlock.classList.add('highlight-linked');
    });
    overlayBlock.addEventListener('mouseleave', () => {
      overlayBlock.classList.remove('highlight-linked');
    });
    overlayBlock.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(block.transText);
      const originalBg = overlayBlock.style.background;
      overlayBlock.style.background = '#d1fadf';
      setTimeout(() => { overlayBlock.style.background = originalBg; }, 1000);
    });
    overlayBlock.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.highlight-linked').forEach(el => el.classList.remove('highlight-linked'));
      overlayBlock.classList.add('highlight-linked');

      const pageContainerLeft = viewerContainer.querySelector(`.page-container[data-page-num="${pageNum}"]`);
      if (pageContainerLeft && pdfPane) {
        const targetTop = (pageHeight - block.box.y - block.box.h) * scale;
        const containerTop = pageContainerLeft.offsetTop;
        const targetScrollY = containerTop + targetTop - (pdfPane.clientHeight / 2) + 40;
        pdfPane.scrollTo({ top: Math.max(0, targetScrollY), behavior: 'smooth' });

        let focusBox = pageContainerLeft.querySelector(`.focus-linked-box[data-block-id="${block.id}"]`);
        if (!focusBox) {
          focusBox = document.createElement('div');
          focusBox.className = 'focus-linked-box';
          focusBox.dataset.blockId = block.id;
          focusBox.style.left = `${Math.round(block.box.x * scale)}px`;
          focusBox.style.top = `${Math.round(targetTop)}px`;
          focusBox.style.width = `${Math.max(Math.round(block.box.w * scale), 40)}px`;
          focusBox.style.height = `${Math.max(Math.round(block.box.h * scale), 16)}px`;
          pageContainerLeft.appendChild(focusBox);
        }
        focusBox.classList.remove('active');
        void focusBox.offsetWidth;
        focusBox.classList.add('active');
        setTimeout(() => focusBox.classList.remove('active'), 2500);
      }
    });
  }

  // 重新绘制并挂载缓存的排版覆盖译文块
  function renderOverlayBlocksOnLayer(overlayLayer, blocks, pageHeight, scale) {
    if (!overlayLayer || !blocks) return;
    overlayLayer.innerHTML = '';
    const pageNum = overlayLayer.parentElement ? parseInt(overlayLayer.parentElement.dataset.pageNum, 10) : 1;

    blocks.forEach(block => {
      if (block.type === 'formula') return;
      if (!block.transText) return;

      const overlayBlock = document.createElement('div');
      overlayBlock.className = 'trans-overlay-block';
      overlayBlock.dataset.blockId = block.id;

      const left = Math.round(block.box.x * scale);
      const top = Math.round((pageHeight - block.box.y - block.box.h) * scale);
      const width = Math.max(Math.round(block.box.w * scale), 40);
      const minHeight = Math.max(Math.round(block.box.h * scale), 16);

      overlayBlock.style.left = `${left}px`;
      overlayBlock.style.top = `${top}px`;
      overlayBlock.style.width = `${width}px`;
      overlayBlock.style.minHeight = `${minHeight}px`;
      overlayBlock.textContent = block.transText;
      overlayBlock.title = `原文: ${block.originalText}\n(双击复制译文，点击联动对齐原文)`;

      const textLen = block.transText.length;
      const approxLines = Math.max(1, Math.ceil((textLen * 13) / width));
      const targetLineH = Math.max(14, minHeight / approxLines);
      const targetFont = Math.max(11, Math.min(16, Math.floor(targetLineH * 0.8)));

      overlayBlock.style.setProperty('--base-font-size', `${targetFont}px`);
      overlayBlock.style.fontSize = `calc(var(--base-font-size, ${targetFont}px) * var(--trans-font-scale, 1))`;

      bindOverlayBlockInteractions(overlayBlock, block, pageNum, pageHeight, scale);

      overlayLayer.appendChild(overlayBlock);
    });
  }

  // 导出离线双语对照文档 (含独立可打印/存为PDF样式)
  function exportBilingualDocument() {
    if (pageTranslations.size === 0) {
      alert('暂无可导出的翻译内容，请先翻译当前页或全文');
      return;
    }

    const sortedPages = Array.from(pageTranslations.keys()).sort((a, b) => a - b);
    let rowsHtml = '';

    sortedPages.forEach(p => {
      const blocks = pageTranslations.get(p) || [];
      if (blocks.length === 0) return;

      rowsHtml += `<div class="bilingual-page-break"><span>第 ${p} 页</span></div>`;

      blocks.forEach(b => {
        if (!b.transText && !b.originalText) return;
        const isFormula = (b.type === 'formula');
        rowsHtml += `
          <div class="bilingual-row ${isFormula ? 'is-formula-row' : ''}">
            <div class="bilingual-col col-orig">
              ${isFormula ? '<span class="badge formula">公式</span>' : ''}
              <div class="col-text">${escapeHtml(b.originalText)}</div>
            </div>
            <div class="bilingual-col col-trans">
              ${isFormula ? '<span class="badge formula">公式 (原样保留)</span>' : '<span class="badge trans">译文</span>'}
              <div class="col-text">${escapeHtml(b.transText || b.originalText)}</div>
            </div>
          </div>
        `;
      });
    });

    const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(pdfFileName || 'PDF 文档')} - 双语对照阅读笔记</title>
  <style>
    :root {
      --primary: #007aff;
      --bg: #f9f9fb;
      --card-bg: #ffffff;
      --text: #1c1c1e;
      --text-sec: #636366;
      --border: rgba(0, 0, 0, 0.08);
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      margin: 0;
      padding: 30px 20px;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    .container {
      max-width: 1080px;
      margin: 0 auto;
    }
    .header {
      background: var(--card-bg);
      padding: 24px 30px;
      border-radius: 16px;
      border: 1px solid var(--border);
      box-shadow: 0 4px 20px rgba(0,0,0,0.03);
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 {
      margin: 0 0 6px 0;
      font-size: 20px;
      color: var(--text);
    }
    .header p {
      margin: 0;
      font-size: 13px;
      color: var(--text-sec);
    }
    .print-btn {
      background: var(--primary);
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    .bilingual-page-break {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 30px 0 16px 0;
    }
    .bilingual-page-break span {
      background: rgba(0, 122, 255, 0.1);
      color: var(--primary);
      font-size: 12px;
      font-weight: 700;
      padding: 4px 16px;
      border-radius: 20px;
      letter-spacing: 0.5px;
    }
    .bilingual-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      background: var(--card-bg);
      padding: 16px 20px;
      border-radius: 12px;
      border: 1px solid var(--border);
      margin-bottom: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.02);
      transition: all 0.15s ease;
    }
    .bilingual-row:hover {
      box-shadow: 0 4px 16px rgba(0,122,255,0.08);
      border-color: rgba(0,122,255,0.3);
    }
    .bilingual-col {
      font-size: 14.5px;
      word-break: break-word;
    }
    .col-orig {
      color: var(--text-sec);
      border-right: 1px solid var(--border);
      padding-right: 16px;
    }
    .col-trans {
      color: var(--text);
      font-weight: 500;
    }
    .badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 4px;
      margin-bottom: 6px;
    }
    .badge.formula {
      background: rgba(88, 86, 214, 0.12);
      color: #5856d6;
    }
    .badge.trans {
      background: rgba(52, 199, 89, 0.12);
      color: #34c759;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-btn { display: none; }
      .bilingual-row { page-break-inside: avoid; border: 1px solid #ccc; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>${escapeHtml(pdfFileName || 'PDF 文档')} · 双语对照阅读笔记</h1>
        <p>导出时间：${new Date().toLocaleString()} · 智能段落重组排版对照</p>
      </div>
      <button class="print-btn" onclick="window.print()">打印 / 另存为 PDF</button>
    </div>
    <div class="bilingual-content">
      ${rowsHtml}
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = (pdfFileName || 'document').replace(/\.[^/.]+$/, '');
    a.download = `${baseName}_双语对照笔记.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

    // 更新左右所有页面占位容器尺寸
    const firstPage = await currentPdf.getPage(1);
    const firstViewport = firstPage.getViewport({ scale: currentScale });
    const defaultW = Math.round(firstViewport.width);
    const defaultH = Math.round(firstViewport.height);

    const pages = viewerContainer.querySelectorAll('.page-container');
    pages.forEach(p => {
      p.style.width = `${defaultW}px`;
      p.style.height = `${defaultH}px`;
      p.innerHTML = `<div class="page-skeleton"><span class="page-skeleton-badge">第 ${p.dataset.pageNum} 页 原文</span></div>`;
      p.classList.add('is-unloaded');
    });

    if (viewerContainerTrans) {
      const pagesTrans = viewerContainerTrans.querySelectorAll('.page-container');
      pagesTrans.forEach(p => {
        p.style.width = `${defaultW}px`;
        p.style.height = `${defaultH}px`;
        p.innerHTML = `<div class="page-skeleton"><span class="page-skeleton-badge">第 ${p.dataset.pageNum} 页 译文</span></div>`;
        p.classList.add('is-unloaded');
      });
    }

    setupVirtualObserver(renderId);

    const targetPageElement = viewerContainer.querySelector(`.page-container[data-page-num="${lastPage}"]`);
    if (targetPageElement) {
      targetPageElement.scrollIntoView();
    }
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

  // 在右侧镜像页面上渲染覆盖排版块
  function renderOverlayBlocksOnLayer(layer, blocks, pageHeight, scale) {
    if (!layer || !blocks) return;
    layer.innerHTML = '';

    blocks.forEach(block => {
      if (!block.box) return;
      if (block.type === 'formula') return; // 公式保持底层原图，免遮盖
      if (!block.transText) return;

      const blockEl = document.createElement('div');
      blockEl.className = 'trans-overlay-block';
      blockEl.dataset.blockId = block.id;

      const left = Math.round(block.box.x * scale);
      const top = Math.round((pageHeight - block.box.y - block.box.h) * scale);
      const width = Math.max(Math.round(block.box.w * scale), 40);
      const minHeight = Math.max(Math.round(block.box.h * scale), 16);

      blockEl.style.left = `${left}px`;
      blockEl.style.top = `${top}px`;
      blockEl.style.width = `${width}px`;
      blockEl.style.minHeight = `${minHeight}px`;

      // 动态根据译文字数自适应字号与行高
      const textLen = block.transText.length;
      const approxLines = Math.max(1, Math.ceil((textLen * 13) / width));
      const targetLineH = Math.max(14, minHeight / approxLines);
      const targetFont = Math.max(11, Math.min(16, Math.floor(targetLineH * 0.8)));

      blockEl.style.fontSize = `${targetFont}px`;
      blockEl.textContent = block.transText;
      blockEl.title = `原文: ${block.originalText}\n(双击复制译文)`;

      blockEl.addEventListener('mouseenter', () => {
        blockEl.classList.add('highlight-linked');
      });
      blockEl.addEventListener('mouseleave', () => {
        blockEl.classList.remove('highlight-linked');
      });

      blockEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(block.transText);
        const originalBg = blockEl.style.background;
        blockEl.style.background = '#d1fadf';
        setTimeout(() => { blockEl.style.background = originalBg; }, 1000);
      });

      layer.appendChild(blockEl);
    });
  }

  // 5. 页面语义块解析算法 (精准识别行、段落、图表、公式，支持双栏学术排版与标点清洗)
  async function extractPageBlocks(page, skipFormulas) {
    const textContent = await page.getTextContent();
    const items = textContent.items;
    if (!items || items.length === 0) return [];

    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;
    const pageWidth = viewport.width;

    const validItems = items
      .filter(item => item.str && item.str.trim())
      .map(item => {
        const cleanStr = normalizePdfText(item.str);
        return {
          str: cleanStr,
          x: item.transform[4],
          y: item.transform[5],
          w: item.width,
          h: item.height || Math.abs(item.transform[3]) || 12
        };
      })
      .filter(item => item.str.trim().length > 0);

    if (validItems.length === 0) return [];

    // 检测学术论文/技术文档常见双栏排版布局 (Two-column layout detection)
    const bodyItems = validItems.filter(it => it.y > pageHeight * 0.15 && it.y < pageHeight * 0.85);
    const leftColItems = bodyItems.filter(it => it.x + it.w / 2 < pageWidth * 0.46);
    const rightColItems = bodyItems.filter(it => it.x + it.w / 2 > pageWidth * 0.54);
    const centerCrossItems = bodyItems.filter(it => it.x < pageWidth * 0.46 && (it.x + it.w) > pageWidth * 0.54);

    const isTwoColumn = (leftColItems.length >= 8 && rightColItems.length >= 8 && centerCrossItems.length < 5);

    // 聚合成物理行 (Y 容差 4pt)
    const rawLines = [];
    for (const item of validItems) {
      // 忽略页眉页脚（距离顶部或底部 32pt 以内的页码或轻量元信息）
      if (item.y > pageHeight - 32 || item.y < 32) {
        if (/^\d+$/.test(item.str.trim()) || /^Page\s*\d+/i.test(item.str.trim())) {
          continue;
        }
      }

      let line = rawLines.find(l => Math.abs(l.y - item.y) <= 4);
      if (line) {
        line.items.push(item);
      } else {
        rawLines.push({
          y: item.y,
          h: item.h,
          items: [item]
        });
      }
    }

    // 行内元素按 X 升序重组并计算包围盒
    const processedLines = rawLines.map(line => {
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
      const minX = line.items[0].x;
      const maxX = Math.max(...line.items.map(it => it.x + it.w));
      const minY = Math.min(...line.items.map(it => it.y));
      const maxY = Math.max(...line.items.map(it => it.y + it.h));
      return {
        text: text.trim(),
        y: line.y,
        h: line.h,
        x: minX,
        box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
      };
    }).filter(l => l.text.length > 0);

    // 双栏与单栏阅读流排序
    let orderedLines = [];
    if (isTwoColumn) {
      const topSpans = [];
      const col1Lines = [];
      const col2Lines = [];
      const bottomSpans = [];

      for (const line of processedLines) {
        const isWide = line.box.w > pageWidth * 0.65;
        if (isWide && line.y > pageHeight * 0.6) {
          topSpans.push(line);
        } else if (isWide && line.y < pageHeight * 0.25) {
          bottomSpans.push(line);
        } else if (line.x + line.box.w / 2 < pageWidth * 0.5) {
          col1Lines.push(line);
        } else {
          col2Lines.push(line);
        }
      }

      topSpans.sort((a, b) => b.y - a.y);
      col1Lines.sort((a, b) => b.y - a.y);
      col2Lines.sort((a, b) => b.y - a.y);
      bottomSpans.sort((a, b) => b.y - a.y);

      orderedLines = [...topSpans, ...col1Lines, ...col2Lines, ...bottomSpans];
    } else {
      orderedLines = processedLines.sort((a, b) => b.y - a.y);
    }

    // 按段落、行距、标题将行聚合成语义块，并保留精确包围盒
    const blocks = [];
    let currentParagraphLines = [];

    function flushParagraph() {
      if (currentParagraphLines.length === 0) return;
      const mergedText = reconstructPdfParagraphs(currentParagraphLines.map(l => l.text).join('\n'));
      if (mergedText && mergedText.trim()) {
        const minX = Math.min(...currentParagraphLines.map(l => l.box.x));
        const maxX = Math.max(...currentParagraphLines.map(l => l.box.x + l.box.w));
        const minY = Math.min(...currentParagraphLines.map(l => l.box.y));
        const maxY = Math.max(...currentParagraphLines.map(l => l.box.y + l.box.h));

        blocks.push({
          id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          type: 'paragraph',
          originalText: mergedText.trim(),
          box: {
            x: Math.max(0, minX - 2),
            y: minY,
            w: Math.min(pageWidth - minX, maxX - minX + 4),
            h: maxY - minY
          }
        });
      }
      currentParagraphLines = [];
    }

    for (let i = 0; i < orderedLines.length; i++) {
      const lineObj = orderedLines[i];
      const text = lineObj.text;

      // 1) 独立数学公式检测
      if (isFormulaText(text)) {
        flushParagraph();
        blocks.push({
          id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          type: 'formula',
          originalText: text,
          box: lineObj.box
        });
        continue;
      }

      // 2) 图表/表格说明检测
      if (isChartCaption(text)) {
        flushParagraph();
        blocks.push({
          id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          type: 'caption',
          originalText: text,
          box: lineObj.box
        });
        continue;
      }

      // 3) 段落分界检测：垂直行距判断
      if (currentParagraphLines.length > 0) {
        const prevLine = currentParagraphLines[currentParagraphLines.length - 1];
        const lineGap = prevLine.y - lineObj.y;
        const avgH = (prevLine.h + lineObj.h) / 2;

        if (lineGap > avgH * 1.55 || lineGap < 0) {
          flushParagraph();
        }
      }

      currentParagraphLines.push(lineObj);
    }

    flushParagraph();
    return blocks;
  }

  // 6. 异步调用后台翻译 API (支持指定具体模型如 GLM-4-Flash)
  function requestTranslation(text, engine, targetLang, model) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'translate',
        text: text,
        engine: engine,
        targetLang: targetLang,
        model: model
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

  // 7. 翻译单页核心方法 (原排版左右镜像对照翻译)
  async function translatePage(pageNum, isBatch = false) {
    if (!currentPdf) return;
    const targetPageNum = pageNum || currentPage;
    const page = await currentPdf.getPage(targetPageNum);
    const skipFormulas = skipFormulasCheckbox ? skipFormulasCheckbox.checked : true;

    // 1. 展开并显示右侧排版对照栏
    translationPane.classList.remove('hidden');
    toggleBilingualBtn.classList.add('active');
    transActiveBadge.textContent = isBatch ? '全文翻译中...' : `第 ${targetPageNum} 页`;

    // 2. 关键：确保右侧镜像页面底图Canvas和图层已挂载（瞬间呈现，绝不白屏/空灰屏）
    const transMount = await ensurePageTransMounted(targetPageNum, currentRenderId);
    if (!transMount) {
      console.error(`挂载第 ${targetPageNum} 页右侧镜像失败`);
      return;
    }

    // 3. 对齐视口位置（仅单向驱动右栏，绝不反向拉扯左栏导致跳页）
    syncTransPanePosition();

    const { pageContainerTrans, transOverlay } = transMount;
    let overlayLayer = transOverlay;

    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;

    // 3. 提取并结构化页面内容块与物理边界
    const blocks = await extractPageBlocks(page, skipFormulas);

    if (!blocks || blocks.length === 0) {
      if (scannedPdfAlert) {
        const alertText = scannedPdfAlert.querySelector('.scanned-alert-text');
        if (alertText) {
          alertText.textContent = `检测到第 ${pageNum} 页为扫描件/纯图片 PDF（无可选文本层），暂无法直接提取文字。建议使用 OCR 工具识别文本后再进行排版翻译。`;
        }
        scannedPdfAlert.classList.remove('hidden');
      }
      transActiveBadge.textContent = '无可选文本';
      return;
    } else {
      if (scannedPdfAlert) {
        scannedPdfAlert.classList.add('hidden');
      }
    }

    const engine = (pdfTranslateEngine && pdfTranslateEngine.value) ? pdfTranslateEngine.value : 'google';
    const selectedModel = (pdfTranslateModel && !pdfTranslateModel.classList.contains('hidden')) ? pdfTranslateModel.value : null;

    const settings = await new Promise(resolve => {
      chrome.storage.local.get({ defaultTargetLang: 'zh-CN' }, resolve);
    });
    const targetLang = settings.defaultTargetLang || 'zh-CN';

    // 4. 先为所有需翻译的块创建原位排版占位框（立即显示半透明磨砂气泡，感知0等待）
    const blocksToTranslate = [];
    for (const block of blocks) {
      if (block.type === 'formula' && skipFormulas) {
        block.transText = block.originalText;
        continue;
      }

      let overlayBlock = overlayLayer ? overlayLayer.querySelector(`.trans-overlay-block[data-block-id="${block.id}"]`) : null;
      if (overlayLayer && !overlayBlock) {
        overlayBlock = document.createElement('div');
        overlayBlock.className = 'trans-overlay-block is-translating';
        overlayBlock.dataset.blockId = block.id;

        const left = Math.round(block.box.x * currentScale);
        const top = Math.round((pageHeight - block.box.y - block.box.h) * currentScale);
        const width = Math.max(Math.round(block.box.w * currentScale), 40);
        const minHeight = Math.max(Math.round(block.box.h * currentScale), 16);

        overlayBlock.style.left = `${left}px`;
        overlayBlock.style.top = `${top}px`;
        overlayBlock.style.width = `${width}px`;
        overlayBlock.style.minHeight = `${minHeight}px`;
        overlayBlock.textContent = '翻译中...';

        overlayLayer.appendChild(overlayBlock);
      }

      blocksToTranslate.push({ block, overlayBlock });
    }

    // 5. 并发受限执行翻译（并发数 = 4，大幅提升单页翻译吞吐率，从30s压缩至3-5s）
    const CONCURRENCY = 4;
    let queueIndex = 0;

    async function processBlockTask(task) {
      if (activeTranslateController && activeTranslateController.aborted) return;
      const { block, overlayBlock } = task;

      let textToTranslate = block.originalText;
      let tokenMap = null;
      if (skipFormulas) {
        const protectedObj = protectInlineFormulas(textToTranslate);
        textToTranslate = protectedObj.text;
        tokenMap = protectedObj.tokenMap;
      }

      try {
        const transResult = await requestTranslation(textToTranslate, engine, targetLang, selectedModel);
        if (activeTranslateController && activeTranslateController.aborted) return;

        const finalText = tokenMap ? restoreInlineFormulas(transResult, tokenMap) : transResult;
        block.transText = finalText;

        if (overlayBlock) {
          overlayBlock.classList.remove('is-translating');
          overlayBlock.textContent = finalText;
          overlayBlock.title = `原文: ${block.originalText}\n(双击复制译文，点击联动对齐原文)`;

          const width = overlayBlock.offsetWidth || 100;
          const minHeight = overlayBlock.offsetHeight || 20;
          const textLen = finalText.length;
          const approxLines = Math.max(1, Math.ceil((textLen * 13) / width));
          const targetLineH = Math.max(14, minHeight / approxLines);
          const targetFont = Math.max(11, Math.min(16, Math.floor(targetLineH * 0.8)));

          overlayBlock.style.setProperty('--base-font-size', `${targetFont}px`);
          overlayBlock.style.fontSize = `calc(var(--base-font-size, ${targetFont}px) * var(--trans-font-scale, 1))`;

          bindOverlayBlockInteractions(overlayBlock, block, pageNum, pageHeight, currentScale);
        }
      } catch (err) {
        block.transText = `[翻译失败: ${err.message}]`;
        if (overlayBlock) {
          overlayBlock.classList.remove('is-translating');
          overlayBlock.classList.add('error');
          overlayBlock.textContent = `翻译失败: ${err.message}`;
        }
      }
    }

    async function worker() {
      while (queueIndex < blocksToTranslate.length) {
        if (activeTranslateController && activeTranslateController.aborted) break;
        const task = blocksToTranslate[queueIndex++];
        if (task) {
          await processBlockTask(task);
        }
      }
    }

    const workers = Array.from({ length: Math.min(CONCURRENCY, blocksToTranslate.length) }, () => worker());
    await Promise.all(workers);

    pageTranslations.set(pageNum, blocks);
  }

  // 8. 全文自动翻译核心方法
  async function translateFullDocument() {
    if (!currentPdf || isTranslatingDoc) return;
    isTranslatingDoc = true;
    activeTranslateController = { aborted: false };

    transProgressCard.classList.remove('hidden');
    transActiveBadge.textContent = '全文翻译中...';
    if (translateDocBtn) translateDocBtn.disabled = true;
    if (translatePageBtn) translatePageBtn.disabled = true;

    const totalPages = currentPdf.numPages;

    for (let p = 1; p <= totalPages; p++) {
      if (activeTranslateController.aborted) break;

      const percent = Math.round(((p - 1) / totalPages) * 100);
      transProgressFill.style.width = `${percent}%`;
      transProgressLabel.textContent = `正在翻译第 ${p} / ${totalPages} 页 (${percent}%)...`;

      // 智能断点续译：已翻译完成的页面直接跳过，避免重复消耗 API 额度与时间
      const cached = pageTranslations.get(p);
      const isAlreadyDone = cached && cached.length > 0 && cached.some(b => b.transText);
      if (isAlreadyDone) {
        continue;
      }

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
      const willBeVisible = translationPane.classList.contains('hidden');
      translationPane.classList.toggle('hidden', !willBeVisible);
      toggleBilingualBtn.classList.toggle('active', willBeVisible);
      if (willBeVisible) {
        ensurePageTransMounted(currentPage, currentRenderId).then(() => {
          syncTransPanePosition();
        });
      }
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
      if (pageTranslations.size === 0) return;
      const allTexts = [];
      const sortedPages = Array.from(pageTranslations.keys()).sort((a, b) => a - b);
      sortedPages.forEach(p => {
        const blocks = pageTranslations.get(p) || [];
        const transTexts = blocks.map(b => b.transText).filter(Boolean);
        if (transTexts.length > 0) {
          allTexts.push(`=== 第 ${p} 页 ===\n` + transTexts.join('\n\n'));
        }
      });
      if (allTexts.length === 0) return;
      navigator.clipboard.writeText(allTexts.join('\n\n')).then(() => {
        copyAllTransBtn.style.color = '#34c759';
        setTimeout(() => copyAllTransBtn.style.color = '', 1500);
      });
    });
  }

  if (pdfTranslateEngine) {
    pdfTranslateEngine.addEventListener('change', () => {
      chrome.storage.local.set({ pdfTranslateEngine: pdfTranslateEngine.value });
      updateToolbarModelSelect(pdfTranslateEngine.value);
    });
  }

  // 10. 底部翻页控制栏事件绑定 (上一页 / 下一页 / 页面输入跳转)
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) scrollToPage(currentPage - 1);
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      if (currentPdf && currentPage < currentPdf.numPages) scrollToPage(currentPage + 1);
    });
  }

  if (pageNumInput) {
    pageNumInput.addEventListener('change', () => {
      const val = parseInt(pageNumInput.value, 10);
      if (!isNaN(val)) scrollToPage(val);
    });
    pageNumInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = parseInt(pageNumInput.value, 10);
        if (!isNaN(val)) scrollToPage(val);
      }
    });
  }

  // 11. 顶部缩放控制按钮事件绑定
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      changeZoom(currentScale + 0.15);
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      changeZoom(currentScale - 0.15);
    });
  }

  // 12. 交互增强：字号微调控制 (A- / A+)
  if (transFontDecBtn) {
    transFontDecBtn.addEventListener('click', () => {
      transFontScale = Math.max(0.7, +(transFontScale - 0.1).toFixed(1));
      if (transFontScaleText) transFontScaleText.textContent = `${Math.round(transFontScale * 100)}%`;
      if (viewerWorkspace) viewerWorkspace.style.setProperty('--trans-font-scale', transFontScale);
    });
  }

  if (transFontIncBtn) {
    transFontIncBtn.addEventListener('click', () => {
      transFontScale = Math.min(1.5, +(transFontScale + 0.1).toFixed(1));
      if (transFontScaleText) transFontScaleText.textContent = `${Math.round(transFontScale * 100)}%`;
      if (viewerWorkspace) viewerWorkspace.style.setProperty('--trans-font-scale', transFontScale);
    });
  }

  // 13. 交互增强：底色遮罩透明度模式循环切换
  if (toggleTransOpacityBtn) {
    toggleTransOpacityBtn.addEventListener('click', () => {
      opacityModeIndex = (opacityModeIndex + 1) % opacityModes.length;
      if (viewerContainerTrans) {
        opacityModes.forEach(m => m && viewerContainerTrans.classList.remove(m));
        if (opacityModes[opacityModeIndex]) {
          viewerContainerTrans.classList.add(opacityModes[opacityModeIndex]);
        }
      }
      toggleTransOpacityBtn.title = opacityTitles[opacityModeIndex];
      toggleTransOpacityBtn.classList.toggle('is-active', opacityModeIndex > 0);
    });
  }

  // 14. 交互增强：常驻透视原图锁定切换
  if (toggleTransPeekBtn) {
    toggleTransPeekBtn.addEventListener('click', () => {
      isPeekingLocked = !isPeekingLocked;
      if (viewerContainerTrans) {
        viewerContainerTrans.classList.toggle('peek-original', isPeekingLocked);
      }
      toggleTransPeekBtn.classList.toggle('is-peeking', isPeekingLocked);
      toggleTransPeekBtn.title = isPeekingLocked ? '解除原图透视锁定' : '常驻透视原图 (点击锁定/解除，或长按 Alt 键)';
    });
  }

  // 15. 导出双语对照笔记网页
  if (exportBilingualBtn) {
    exportBilingualBtn.addEventListener('click', () => {
      exportBilingualDocument();
    });
  }

  // 16. 扫描件异常提示关闭
  if (dismissScannedAlert) {
    dismissScannedAlert.addEventListener('click', () => {
      if (scannedPdfAlert) scannedPdfAlert.classList.add('hidden');
    });
  }

  // 17. 长按 Alt 键全局原图瞬时透视 (无需改动任何设置，松手即恢复)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Alt' && viewerContainerTrans && !isPeekingLocked) {
      viewerContainerTrans.classList.add('peek-original');
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt' && viewerContainerTrans && !isPeekingLocked) {
      viewerContainerTrans.classList.remove('peek-original');
    }
  });

  window.addEventListener('blur', () => {
    if (viewerContainerTrans && !isPeekingLocked) {
      viewerContainerTrans.classList.remove('peek-original');
    }
  });
});
