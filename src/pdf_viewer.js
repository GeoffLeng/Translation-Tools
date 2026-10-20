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
  const personaSelect = document.getElementById('persona-select');
  const advPersonaSelect = document.getElementById('adv-persona-select');
  const topBackBtn = document.getElementById('top-back-btn');
  let currentPersona = 'biochem'; // 默认角色: 生化学术专家
  const translatePageBtn = document.getElementById('translate-page-btn');
  const translateDocBtn = document.getElementById('translate-doc-btn');
  const toggleBilingualBtn = document.getElementById('toggle-bilingual-btn');
  const translationPane = document.getElementById('translation-pane');
  const transToolbarActions = document.getElementById('trans-toolbar-actions');
  const transActiveBadge = document.getElementById('trans-active-badge');
  const transProgressCard = document.getElementById('trans-progress-card');
  const transProgressLabel = document.getElementById('trans-progress-label');
  const transProgressFill = document.getElementById('trans-progress-fill');
  const cancelTransBtn = document.getElementById('cancel-trans-btn');
  const copyAllTransBtn = document.getElementById('copy-all-trans-btn');
  const toggleTransPeekBtn = document.getElementById('toggle-trans-peek-btn');
  const exportBilingualBtn = document.getElementById('export-bilingual-btn');
  const scannedPdfAlert = document.getElementById('scanned-pdf-alert');
  const dismissScannedAlert = document.getElementById('dismiss-scanned-alert');
  const viewerWorkspace = document.getElementById('viewer-workspace');

  // 还原【沉浸式翻译】两层工具栏与缩略图抽屉控件
  const targetLanguageSelect = document.getElementById('target-language-select');
  const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
  const viewerSidebar = document.getElementById('viewer-sidebar');
  const sidebarThumbnailsList = document.getElementById('sidebar-thumbnails-list');
  const sidebarPageCount = document.getElementById('sidebar-page-count');
  const controlStyleSelect = document.getElementById('control-style-select');
  const zoomPresetSelect = document.getElementById('zoom-preset-select');
  const searchToolBtn = document.getElementById('search-tool-btn');
  const textToolBtn = document.getElementById('text-tool-btn');
  const drawToolBtn = document.getElementById('draw-tool-btn');
  const helpBtn = document.getElementById('help-btn');
  const setupBtn = document.getElementById('setup-btn');
  const hideTopBtn = document.getElementById('hide-top-btn');
  const showTopFloatingBtn = document.getElementById('show-top-floating-btn');
  const viewerHeaderTop = document.getElementById('viewer-header-top');
  const viewerHeaderSub = document.getElementById('viewer-header-sub');
  const welcomeFileInput = document.getElementById('welcome-file-input');
  const advancedTransBtn = document.getElementById('advanced-trans-btn');
  const advancedModal = document.getElementById('advanced-modal');
  const closeAdvancedModalBtn = document.getElementById('close-advanced-modal-btn');
  const advOpacityModeSelect = document.getElementById('adv-opacity-mode-select');
  const advTogglePeekBtn = document.getElementById('adv-toggle-peek-btn');
  const advExportBilingualBtn = document.getElementById('adv-export-bilingual-btn');
  const searchModal = document.getElementById('search-modal');
  const searchInput = document.getElementById('search-input');
  const searchPrevBtn = document.getElementById('search-prev-btn');
  const searchNextBtn = document.getElementById('search-next-btn');
  const searchMatches = document.getElementById('search-matches');
  const closeSearchBtn = document.getElementById('close-search-btn');

  // 沉浸式选页翻译专属 DOM 控件
  const translateRangeBtn = document.getElementById('translate-range-btn');
  const rangeModal = document.getElementById('range-modal');
  const closeRangeModalBtn = document.getElementById('close-range-modal-btn');
  const cancelRangeBtn = document.getElementById('cancel-range-btn');
  const startRangeBtn = document.getElementById('start-range-btn');
  const rangePagesInput = document.getElementById('range-pages-input');
  const rangeCalcStatus = document.getElementById('range-calc-status');

  let toastTimer = null;
  function showToast(msg) {
    const toast = document.getElementById('pdf-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2200);
  }

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

  // 监听全工作区划词（原文、译文、双语对照均可无缝划词查词）
  const selectionArea = viewerWorkspace || viewerContainer;
  selectionArea.addEventListener('mouseup', (e) => {
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
      if (translateRangeBtn) translateRangeBtn.disabled = false;

      // 提取第 1 页基准比例，预计算所有页面的骨架占位
      const firstPage = await currentPdf.getPage(1);
      const firstViewport = firstPage.getViewport({ scale: currentScale });
      const defaultW = Math.round(firstViewport.width);
      const defaultH = Math.round(firstViewport.height);

      // 高效批量创建左侧原文与右侧译文对称占位（双栏 1:1 同步滚动与绝对排版对齐）
      const fragment = document.createDocumentFragment();
      const fragmentTrans = document.createDocumentFragment();

      for (let i = 1; i <= currentPdf.numPages; i++) {
        // 左侧原文容器
        const pageContainer = document.createElement('div');
        pageContainer.id = `page-container-${i}`;
        pageContainer.className = 'page-container pdf-page-container is-unloaded';
        pageContainer.dataset.pageNum = i;
        pageContainer.style.width = `${defaultW}px`;
        pageContainer.style.height = `${defaultH}px`;
        pageContainer.innerHTML = `<div class="page-skeleton"><span class="page-skeleton-badge">第 ${i} 页 原文</span></div>`;
        fragment.appendChild(pageContainer);

        // 右侧译文容器（1:1 对称槽位）
        const transContainer = document.createElement('div');
        transContainer.id = `page-trans-container-${i}`;
        transContainer.className = 'page-container pdf-page-container trans-page-container is-unloaded';
        transContainer.dataset.pageNum = i;
        transContainer.style.width = `${defaultW}px`;
        transContainer.style.height = `${defaultH}px`;
        transContainer.innerHTML = `<div class="page-skeleton"><span class="page-skeleton-badge">第 ${i} 页 译文</span></div>`;
        fragmentTrans.appendChild(transContainer);
      }
      viewerContainer.appendChild(fragment);

      if (viewerContainerTrans) {
        viewerContainerTrans.innerHTML = '';
        viewerContainerTrans.appendChild(fragmentTrans);
        renderTransStageForPage(currentPage);
      }

      // 还原沉浸式翻译：异步懒加载生成左侧页面缩略图导航抽屉
      generateThumbnails(currentPdf);

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

  // --- 缩略图生成器 (异步懒加载) ---
  let thumbnailObserver = null;
  function generateThumbnails(pdf) {
    if (!sidebarThumbnailsList) return;
    sidebarThumbnailsList.innerHTML = '';
    if (sidebarPageCount) sidebarPageCount.textContent = `${pdf.numPages} 页`;

    if (thumbnailObserver) {
      thumbnailObserver.disconnect();
      thumbnailObserver = null;
    }

    const fragment = document.createDocumentFragment();

    for (let i = 1; i <= pdf.numPages; i++) {
      const card = document.createElement('div');
      card.className = `thumb-card ${i === currentPage ? 'active' : ''}`;
      card.dataset.pageNum = i;

      const canvas = document.createElement('canvas');
      canvas.id = `thumb-canvas-${i}`;

      const label = document.createElement('span');
      label.className = 'thumb-label';
      label.textContent = `${i}`;

      const badge = document.createElement('span');
      badge.id = `thumb-badge-${i}`;
      const isDone = pageTranslations.has(i) && pageTranslations.get(i).length > 0 && pageTranslations.get(i).some(b => b.transText);
      badge.className = `thumb-badge ${isDone ? '' : 'hidden'}`;
      badge.textContent = '✓';

      card.appendChild(canvas);
      card.appendChild(label);
      card.appendChild(badge);

      card.addEventListener('click', () => {
        scrollToPage(i);
      });

      fragment.appendChild(card);
    }

    sidebarThumbnailsList.appendChild(fragment);

    // 缩略图视口按需绘制 Observer
    thumbnailObserver = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
          const card = entry.target;
          thumbnailObserver.unobserve(card);
          const pNum = parseInt(card.dataset.pageNum, 10);
          try {
            const page = await pdf.getPage(pNum);
            const vp = page.getViewport({ scale: 0.22 });
            const canvas = card.querySelector('canvas');
            if (canvas) {
              canvas.width = vp.width;
              canvas.height = vp.height;
              const ctx = canvas.getContext('2d');
              await page.render({ canvasContext: ctx, viewport: vp }).promise;
            }
          } catch (e) {
            console.warn(`缩略图第 ${pNum} 页渲染跳过:`, e);
          }
        }
      });
    }, {
      root: viewerSidebar,
      rootMargin: '250px'
    });

    sidebarThumbnailsList.querySelectorAll('.thumb-card').forEach(card => {
      thumbnailObserver.observe(card);
    });
  }

  function updateActiveThumbnail(pageNum) {
    if (!sidebarThumbnailsList) return;
    const cards = sidebarThumbnailsList.querySelectorAll('.thumb-card');
    cards.forEach(c => {
      const p = parseInt(c.dataset.pageNum, 10);
      c.classList.toggle('active', p === pageNum);
    });
  }

  function updateThumbnailStatus(pageNum) {
    if (!sidebarThumbnailsList) return;
    const badge = document.getElementById(`thumb-badge-${pageNum}`);
    if (badge) {
      const cached = pageTranslations.get(pageNum);
      const isDone = cached && cached.length > 0 && cached.some(b => b.transText);
      badge.classList.toggle('hidden', !isDone);
    }
  }

  // 虚拟化视口监听器：进入视口挂载渲染，移出视口彻底销毁 Canvas 回收显存
  // 虚拟化视口监听器：进入视口挂载渲染，移出视口彻底销毁 Canvas 回收显存
  function setupVirtualObserver(renderId) {
    if (pageObserver) pageObserver.disconnect();

    pageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const pageNum = parseInt(entry.target.dataset.pageNum, 10);
        if (entry.isIntersecting) {
          mountPage(pageNum, renderId);
        } else {
          unmountPage(pageNum);
        }
      });
    }, {
      root: viewerMain,
      rootMargin: '600px 0px', // 上下缓冲一页，平滑滚屏无白屏闪烁
      threshold: 0
    });

    const pages = viewerContainer.querySelectorAll('.page-container');
    pages.forEach(p => pageObserver.observe(p));
  }

  // 页面阅读位置追踪与页码同步 (精准捕获主视口真实滚动位置)
  function setupScrollSpy() {
    if (!viewerMain) return;
    let ticking = false;

    viewerMain.addEventListener('scroll', () => {
      if (!currentPdf || ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        ticking = false;
        const pages = viewerContainer.querySelectorAll('.page-container');
        if (pages.length === 0) return;

        const mainRect = viewerMain.getBoundingClientRect();
        // 视口锚定线：顶部向下 80px
        const targetLine = mainRect.top + 80;

        let closestPage = currentPage;
        let minDistance = Infinity;

        pages.forEach(p => {
          const rect = p.getBoundingClientRect();
          if (rect.top <= targetLine && rect.bottom >= targetLine) {
            closestPage = parseInt(p.dataset.pageNum, 10);
            minDistance = 0;
          } else {
            const dist = Math.abs(rect.top - targetLine);
            if (dist < minDistance) {
              minDistance = dist;
              closestPage = parseInt(p.dataset.pageNum, 10);
            }
          }
        });

        if (closestPage !== currentPage) {
          currentPage = closestPage;
          if (pageNumInput) pageNumInput.value = currentPage;
          updatePaginationButtons();
          updateActiveThumbnail(currentPage);

          // 更新状态指示徽章
          if (pageTranslations.has(currentPage) && pageTranslations.get(currentPage).length > 0) {
            if (transActiveBadge) transActiveBadge.textContent = `已翻译 (第 ${currentPage} 页)`;
          } else {
            if (transActiveBadge) transActiveBadge.textContent = `第 ${currentPage} 页 (未翻译)`;
          }

          // 保持右侧双语对照联动
          if (translationPane && !translationPane.classList.contains('hidden')) {
            renderTransStageForPage(currentPage);
          }
        }
      });
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
    updateActiveThumbnail(currentPage);

    const targetLeft = viewerContainer.querySelector(`.page-container[data-page-num="${currentPage}"]`);
    if (targetLeft && viewerMain) {
      // 安全容器内平滑滚动，绝不触发 window / document 级偏移，保障顶栏坚如磐石
      const targetOffsetTop = targetLeft.offsetTop;
      viewerMain.scrollTo({
        top: Math.max(0, targetOffsetTop - 16),
        behavior: 'smooth'
      });
    }
    if (translationPane && !translationPane.classList.contains('hidden')) {
      renderTransStageForPage(currentPage);
    }
  }

  // 右侧 1:1 对称槽位页面渲染引擎
  let currentTransStageRenderTask = null;

  async function renderTransStageForPage(pageNum) {
    if (!viewerContainerTrans || !currentPdf) return null;
    const targetPageNum = Math.max(1, Math.min(pageNum || currentPage, currentPdf.numPages));

    let stageContainer = viewerContainerTrans.querySelector(`.page-container[data-page-num="${targetPageNum}"]`);
    if (!stageContainer) {
      stageContainer = document.createElement('div');
      stageContainer.id = `page-trans-container-${targetPageNum}`;
      stageContainer.className = 'page-container pdf-page-container trans-page-container is-unloaded';
      stageContainer.dataset.pageNum = targetPageNum;
      viewerContainerTrans.appendChild(stageContainer);
    }

    stageContainer.dataset.pageNum = targetPageNum;

    // 更新状态指示
    const hasTrans = pageTranslations.has(targetPageNum) && pageTranslations.get(targetPageNum).length > 0;
    if (targetPageNum === currentPage && transActiveBadge) {
      if (hasTrans) {
        transActiveBadge.textContent = `已翻译 (第 ${targetPageNum} 页)`;
      } else {
        transActiveBadge.textContent = `第 ${targetPageNum} 页 (未翻译)`;
      }
    }

    try {
      const page = await currentPdf.getPage(targetPageNum);
      const viewport = page.getViewport({ scale: currentScale });
      const wPx = Math.round(viewport.width);
      const hPx = Math.round(viewport.height);

      stageContainer.style.width = `${wPx}px`;
      stageContainer.style.height = `${hPx}px`;

      let canvas = stageContainer.querySelector('canvas');
      if (!canvas) {
        stageContainer.innerHTML = '';
        canvas = document.createElement('canvas');
        stageContainer.appendChild(canvas);
      }
      canvas.width = wPx;
      canvas.height = hPx;
      const ctx = canvas.getContext('2d');

      // 极速硬件加速：优先复用左侧已渲染 Canvas 图像（0延迟、无闪烁）
      const leftContainer = viewerContainer.querySelector(`.page-container[data-page-num="${targetPageNum}"]`);
      const leftCanvas = leftContainer ? leftContainer.querySelector('canvas') : null;
      if (leftCanvas && leftCanvas.width === wPx && leftCanvas.height === hPx) {
        ctx.drawImage(leftCanvas, 0, 0);
      } else {
        if (currentTransStageRenderTask) {
          try { currentTransStageRenderTask.cancel(); } catch(e){}
        }
        currentTransStageRenderTask = page.render({ canvasContext: ctx, viewport });
        await currentTransStageRenderTask.promise;
        currentTransStageRenderTask = null;
      }

      stageContainer.classList.remove('is-unloaded');

      let overlayLayer = stageContainer.querySelector('.trans-overlay-layer');
      if (!overlayLayer) {
        overlayLayer = document.createElement('div');
        overlayLayer.className = 'trans-overlay-layer';
        stageContainer.appendChild(overlayLayer);
      }

      // 存在译文缓存时直接重绘原排版覆盖译文块
      if (hasTrans) {
        const blocks = pageTranslations.get(targetPageNum);
        renderOverlayBlocksOnLayer(overlayLayer, blocks, page.getViewport({ scale: 1.0 }).height, currentScale, canvas);
      } else {
        overlayLayer.innerHTML = '';
      }

      return { stageContainer, canvas, overlayLayer, page, viewport };
    } catch (err) {
      if (err && err.name === 'RenderingCancelledException') return null;
      console.error(`渲染第 ${targetPageNum} 页舞台失败:`, err);
      return null;
    }
  }

  // 视口内挂载页面 (仅渲染左侧原文 Canvas 与文本层，零干扰右侧)
  async function mountPage(pageNum, renderId) {
    if (renderId && renderId !== currentRenderId) return;
    const pageState = renderedPages.get(pageNum);
    if (pageState && (pageState.isRendered || pageState.isRendering)) {
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

      renderedPages.set(pageNum, { isRendering: false, isRendered: true, canvas: canvas });

      // 若右侧处于显示态且该页已翻译或恰好是活动页，同步渲染右侧对称页
      if (translationPane && !translationPane.classList.contains('hidden')) {
        if (pageTranslations.has(pageNum) || pageNum === currentPage) {
          renderTransStageForPage(pageNum);
        }
      }
    } catch (e) {
      console.error(e);
      renderedPages.delete(pageNum);
    }
  }

  // 移出视口卸载回收显存 (保持双栏对称轻量)
  function unmountPage(pageNum) {
    if (pageNum === currentPage) return;

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

    // 右侧译文槽位离屏卸载重型 Canvas 回收 GPU 显存（译文数据结构保留在内存中，重返视口 0 延迟复原）
    if (viewerContainerTrans && pageNum !== currentPage) {
      const transContainer = viewerContainerTrans.querySelector(`.page-container[data-page-num="${pageNum}"]`);
      if (transContainer && !transContainer.classList.contains('is-unloaded')) {
        const transCanvas = transContainer.querySelector('canvas');
        if (transCanvas) {
          transCanvas.width = 0;
          transCanvas.height = 0;
        }
        const hasTrans = pageTranslations.has(pageNum);
        transContainer.innerHTML = `<div class="page-skeleton"><span class="page-skeleton-badge">第 ${pageNum} 页 译文${hasTrans ? ' (已就绪)' : ''}</span></div>`;
        transContainer.classList.add('is-unloaded');
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
      showToast('✓ 译文已复制到剪贴板');
    });
    overlayBlock.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.highlight-linked').forEach(el => el.classList.remove('highlight-linked'));
      overlayBlock.classList.add('highlight-linked');

      const pageContainerLeft = viewerContainer.querySelector(`.page-container[data-page-num="${pageNum}"]`);
      if (pageContainerLeft && viewerMain) {
        const targetTop = (pageHeight - block.box.y - block.box.h) * scale;
        const containerTop = pageContainerLeft.offsetTop;
        const targetScrollY = containerTop + targetTop - (viewerMain.clientHeight / 2) + 40;
        viewerMain.scrollTo({ top: Math.max(0, targetScrollY), behavior: 'smooth' });

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

  // 采样页面背景基色 (4个角落+顶部边缘采样，兼容暗黑主题与深色幻灯片)
  function getPageDominantBg(canvas) {
    if (!canvas || !canvas.width || !canvas.height) return '#ffffff';
    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const pts = [
        [15, 15],
        [canvas.width - 15, 15],
        [15, canvas.height - 15],
        [canvas.width - 15, canvas.height - 15],
        [Math.round(canvas.width / 2), 20]
      ];
      for (const [px, py] of pts) {
        const d = ctx.getImageData(Math.max(0, Math.min(canvas.width - 1, px)), Math.max(0, Math.min(canvas.height - 1, py)), 1, 1).data;
        if (d[3] > 120) {
          return `rgb(${d[0]}, ${d[1]}, ${d[2]})`;
        }
      }
    } catch (e) {}
    return '#ffffff';
  }

  // 采样指定包围盒区域的文字前景色与背景色
  function sampleBlockColors(canvas, box, pageHeight, scale) {
    const pageBg = getPageDominantBg(canvas);
    const result = { color: '#1c1c1e', bgColor: pageBg };
    if (!canvas || !canvas.width || !canvas.height) return result;

    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const cW = canvas.width;
      const cH = canvas.height;

      const left = Math.round(box.x * scale);
      const top = Math.round((pageHeight - box.y - box.h) * scale);
      const width = Math.round(box.w * scale);
      const height = Math.round(box.h * scale);

      // 1. 围绕包围盒四周多点采样底色 (上、下、左、右)
      const bgCandidates = [
        [left + Math.round(width / 2), top - 3],
        [left - 3, top + Math.round(height / 2)],
        [left + width + 3, top + Math.round(height / 2)],
        [left + Math.round(width / 2), top + height + 3],
        [left + 4, top - 3]
      ];

      for (const [bx, by] of bgCandidates) {
        if (bx >= 0 && bx < cW && by >= 0 && by < cH) {
          const d = ctx.getImageData(bx, by, 1, 1).data;
          if (d[3] > 120) {
            result.bgColor = `rgb(${d[0]}, ${d[1]}, ${d[2]})`;
            break;
          }
        }
      }

      // 解析背景 RGB
      let bgR = 255, bgG = 255, bgB = 255;
      const bgMatch = result.bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (bgMatch) {
        bgR = parseInt(bgMatch[1], 10);
        bgG = parseInt(bgMatch[2], 10);
        bgB = parseInt(bgMatch[3], 10);
      }

      // 2. 采样文字前景色：在文字框内部采样，寻找对比度最高、具有色彩倾向或最深/最亮色
      const sampleX = Math.max(0, Math.min(cW - 8, left + Math.min(width * 0.2, 16)));
      const sampleY = Math.max(0, Math.min(cH - 8, top + Math.min(height * 0.4, 16)));
      const sampleW = Math.min(32, Math.max(6, Math.round(width * 0.5)));
      const sampleH = Math.min(24, Math.max(6, Math.round(height * 0.5)));

      const imgData = ctx.getImageData(sampleX, sampleY, sampleW, sampleH).data;
      let bestColor = null;
      let maxDist = 0;

      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const a = imgData[i + 3];
        if (a < 128) continue;

        const dist = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
        const colorSpread = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));

        // 强色彩倾向优先（如红、蓝、绿等强调标题色）
        if (colorSpread > 35 && dist > 70) {
          result.color = `rgb(${r}, ${g}, ${b})`;
          return result;
        }

        if (dist > 50 && dist > maxDist) {
          maxDist = dist;
          bestColor = `rgb(${r}, ${g}, ${b})`;
        }
      }

      if (bestColor) {
        result.color = bestColor;
      } else {
        const isDarkBg = (bgR * 299 + bgG * 587 + bgB * 114) / 1000 < 128;
        result.color = isDarkBg ? '#ffffff' : '#1c1c1e';
      }
    } catch (e) {
      console.warn('色彩采样异常:', e);
    }
    return result;
  }

  // 重新绘制并挂载无痕原排版译文块 (底图原生擦除 Inpainting + 1:1 字号/颜色还原 + 智能自适应防重叠)
  function renderOverlayBlocksOnLayer(overlayLayer, blocks, pageHeight, scale, stageCanvas) {
    if (!overlayLayer || !blocks) return;
    overlayLayer.innerHTML = '';
    const pageNum = overlayLayer.parentElement ? parseInt(overlayLayer.parentElement.dataset.pageNum, 10) : currentPage;

    // 1. 如果提供了舞台底图 Canvas，先执行无痕底色擦除 (Inpainting)，抹除原版英文，防止透光重叠
    if (stageCanvas && stageCanvas.getContext && opacityModeIndex !== 2) {
      const ctx = stageCanvas.getContext('2d');
      blocks.forEach(block => {
        if (!block.box || block.type === 'formula' || !block.transText) return;
        const left = Math.round(block.box.x * scale);
        const top = Math.round((pageHeight - block.box.y - block.box.h) * scale);
        const width = Math.round(block.box.w * scale);
        const height = Math.round(block.box.h * scale);

        // 如果用户选择了对比衬底框 (mode-contrast)，则不需要在底图上生硬擦除
        if (opacityModeIndex !== 1) {
          ctx.fillStyle = block.style?.bgColor || '#ffffff';
          // 扩展 2px 覆盖边缘微小抗锯齿及字根外溢
          ctx.fillRect(Math.max(0, left - 2), Math.max(0, top - 2), width + 4, height + 4);
        }
      });
    }

    // 2. 原位挂载排版文本
    blocks.forEach(block => {
      if (!block.box) return;
      if (block.type === 'formula') return; // 公式保持原图渲染
      if (!block.transText) return;

      const overlayBlock = document.createElement('div');
      overlayBlock.className = 'trans-overlay-block';
      if (opacityModeIndex === 1) {
        overlayBlock.classList.add('mode-contrast');
      } else if (opacityModeIndex === 2) {
        overlayBlock.classList.add('mode-clear');
      }
      overlayBlock.dataset.blockId = block.id;

      const left = Math.round(block.box.x * scale);
      const top = Math.round((pageHeight - block.box.y - block.box.h) * scale);
      const width = Math.max(Math.round(block.box.w * scale), 20);
      const minHeight = Math.max(Math.round(block.box.h * scale), 12);

      // 原文字号 1:1 动态还原 (根据实际 PDF 变换矩阵计算的真实物理字号)
      const baseFontSize = block.style?.fontSize ? Math.round(block.style.fontSize * scale) : 13;
      const isBold = block.style?.isBold || false;
      const textColor = (opacityModeIndex === 1) ? '#111827' : (block.style?.color || '#1c1c1e');

      // 自适应弹性微调：根据译文字数与物理框高动态轻微微调字号，严丝合缝绝不挤压溢出下一段
      const textLen = block.transText.length;
      const charW = Math.max(8, baseFontSize * 0.95);
      const charsPerLine = Math.max(1, Math.floor(width / charW));
      const neededLines = Math.ceil(textLen / charsPerLine);
      const targetLineHeight = baseFontSize >= 22 ? 1.2 : (baseFontSize >= 15 ? 1.28 : 1.35);
      const estTotalHeight = neededLines * baseFontSize * targetLineHeight;

      let finalFontSize = baseFontSize;
      if (estTotalHeight > minHeight * 1.25 && minHeight >= 20) {
        finalFontSize = Math.max(9, Math.round(baseFontSize * Math.sqrt(minHeight / estTotalHeight)));
      }

      overlayBlock.style.left = `${left}px`;
      overlayBlock.style.top = `${top}px`;
      overlayBlock.style.width = `${width}px`;
      overlayBlock.style.minHeight = `${minHeight}px`;

      overlayBlock.style.fontSize = `${finalFontSize}px`;
      overlayBlock.style.fontWeight = isBold ? '700' : 'normal';
      overlayBlock.style.color = textColor;
      overlayBlock.style.lineHeight = finalFontSize >= 22 ? '1.2' : (finalFontSize >= 15 ? '1.28' : '1.35');
      if (block.type === 'heading') {
        overlayBlock.style.letterSpacing = '-0.2px';
      }

      overlayBlock.textContent = block.transText;
      overlayBlock.title = `原文: ${block.originalText}\n(双击复制译文，点击联动对齐原文)`;

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
      const transPages = viewerContainerTrans.querySelectorAll('.page-container');
      transPages.forEach(p => {
        p.style.width = `${defaultW}px`;
        p.style.height = `${defaultH}px`;
        p.innerHTML = `<div class="page-skeleton"><span class="page-skeleton-badge">第 ${p.dataset.pageNum} 页 译文</span></div>`;
        p.classList.add('is-unloaded');
      });
    }

    setupVirtualObserver(renderId);

    const targetPageElement = viewerContainer.querySelector(`.page-container[data-page-num="${lastPage}"]`);
    if (targetPageElement && viewerMain) {
      const targetOffsetTop = targetPageElement.offsetTop;
      viewerMain.scrollTo({ top: Math.max(0, targetOffsetTop - 16) });
    }

    if (translationPane && !translationPane.classList.contains('hidden')) {
      renderTransStageForPage(currentPage);
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
        // 计算实际物理字号: 根据 transform 仿射变换矩阵
        const fontSize = Math.round(Math.hypot(item.transform[0], item.transform[1]) * 10) / 10 || item.height || 12;
        const isBold = /bold|black|heavy|700/i.test(item.fontName || '');
        return {
          str: cleanStr,
          x: item.transform[4],
          y: item.transform[5],
          w: item.width,
          h: item.height || Math.abs(item.transform[3]) || fontSize,
          fontSize: fontSize,
          isBold: isBold,
          fontName: item.fontName || ''
        };
      })
      .filter(item => item.str.trim().length > 0);

    if (validItems.length === 0) return [];

    // 聚合成物理 Y 分组 (Y 容差 3pt)
    const rawYGroups = [];
    for (const item of validItems) {
      // 忽略页眉页脚（距离顶部或底部 28pt 以内的纯页码）
      if (item.y > pageHeight - 28 || item.y < 28) {
        if (/^\d+$/.test(item.str.trim()) || /^Page\s*\d+/i.test(item.str.trim())) {
          continue;
        }
      }

      let group = rawYGroups.find(g => Math.abs(g.y - item.y) <= 3);
      if (group) {
        group.items.push(item);
      } else {
        rawYGroups.push({ y: item.y, items: [item] });
      }
    }

    // 针对每个物理 Y 行，依据水平 X 间隙 (X-Gap) 与字号差异分割为独立线段，彻底避免左右分栏与图表被粘连
    const processedLines = [];
    for (const group of rawYGroups) {
      group.items.sort((a, b) => a.x - b.x);

      const segments = [];
      let currSeg = [group.items[0]];

      for (let i = 1; i < group.items.length; i++) {
        const prev = group.items[i - 1];
        const curr = group.items[i];
        const xGap = curr.x - (prev.x + prev.w);
        const refFont = Math.max(prev.fontSize, curr.fontSize);

        // 阈值：水平间隙超过 1.6 倍字号且绝对距离 > 14pt，或字号差距大于 5pt，分割为不同线段
        const maxGap = Math.max(14, refFont * 1.6);
        if (xGap > maxGap || Math.abs(curr.fontSize - prev.fontSize) > 5) {
          segments.push(currSeg);
          currSeg = [curr];
        } else {
          currSeg.push(curr);
        }
      }
      segments.push(currSeg);

      for (const seg of segments) {
        let text = seg[0].str;
        for (let i = 1; i < seg.length; i++) {
          const prev = seg[i - 1];
          const curr = seg[i];
          const gap = curr.x - (prev.x + prev.w);
          if (gap > 1.8 && !text.endsWith(' ') && !curr.str.startsWith(' ')) {
            text += ' ' + curr.str;
          } else {
            text += curr.str;
          }
        }

        const minX = Math.min(...seg.map(it => it.x));
        const maxX = Math.max(...seg.map(it => it.x + it.w));
        const minY = Math.min(...seg.map(it => it.y));
        const maxY = Math.max(...seg.map(it => it.y + it.h));
        const avgFontSize = seg.reduce((s, it) => s + it.fontSize, 0) / seg.length;
        const anyBold = seg.some(it => it.isBold);
        const fontName = seg[0].fontName;

        processedLines.push({
          text: text.trim(),
          x: minX,
          y: minY,
          w: maxX - minX,
          h: maxY - minY,
          fontSize: avgFontSize,
          isBold: anyBold,
          fontName: fontName,
          box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
        });
      }
    }

    // 检测学术论文/技术文档常见双栏排版布局
    const bodyLines = processedLines.filter(l => l.y > pageHeight * 0.12 && l.y < pageHeight * 0.88);
    const leftColLines = bodyLines.filter(l => (l.x + l.w / 2) < pageWidth * 0.48);
    const rightColLines = bodyLines.filter(l => (l.x + l.w / 2) > pageWidth * 0.52);
    const isTwoColumn = (leftColLines.length >= 6 && rightColLines.length >= 6);

    let orderedLines = [];
    if (isTwoColumn) {
      const topSpans = [];
      const col1 = [];
      const col2 = [];
      const bottomSpans = [];

      for (const line of processedLines) {
        const isWide = line.w > pageWidth * 0.62;
        if (isWide && line.y > pageHeight * 0.6) {
          topSpans.push(line);
        } else if (isWide && line.y < pageHeight * 0.25) {
          bottomSpans.push(line);
        } else if (line.x + line.w / 2 < pageWidth * 0.5) {
          col1.push(line);
        } else {
          col2.push(line);
        }
      }

      topSpans.sort((a, b) => b.y - a.y);
      col1.sort((a, b) => b.y - a.y);
      col2.sort((a, b) => b.y - a.y);
      bottomSpans.sort((a, b) => b.y - a.y);

      orderedLines = [...topSpans, ...col1, ...col2, ...bottomSpans];
    } else {
      orderedLines = processedLines.sort((a, b) => b.y - a.y);
    }

    // 按段落、行距、标题、图表将行聚合成语义块，并保留精确包围盒与字号样式
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

        const avgFontSize = currentParagraphLines.reduce((s, l) => s + l.fontSize, 0) / currentParagraphLines.length;
        const isBold = currentParagraphLines.some(l => l.isBold);
        const fontName = currentParagraphLines[0].fontName || '';

        let blockType = 'paragraph';
        if (avgFontSize >= 16 || (isBold && avgFontSize >= 12.5 && currentParagraphLines.length <= 2)) {
          blockType = 'heading';
        } else if (avgFontSize <= 9.5 || isChartCaption(mergedText)) {
          blockType = 'caption';
        }

        blocks.push({
          id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          type: blockType,
          originalText: mergedText.trim(),
          box: {
            x: Math.max(0, minX - 1),
            y: minY,
            w: Math.min(pageWidth - minX, maxX - minX + 2),
            h: maxY - minY
          },
          style: {
            fontSize: Math.round(avgFontSize * 10) / 10,
            isBold: isBold,
            fontName: fontName
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
          box: lineObj.box,
          style: {
            fontSize: Math.round(lineObj.fontSize * 10) / 10,
            isBold: lineObj.isBold,
            fontName: lineObj.fontName
          }
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
          box: lineObj.box,
          style: {
            fontSize: Math.round(lineObj.fontSize * 10) / 10,
            isBold: lineObj.isBold,
            fontName: lineObj.fontName
          }
        });
        continue;
      }

      // 3) 段落分界检测：垂直行距、字号差异与横向跳跃
      if (currentParagraphLines.length > 0) {
        const prevLine = currentParagraphLines[currentParagraphLines.length - 1];
        const lineGap = prevLine.y - lineObj.y;
        const avgH = (prevLine.h + lineObj.h) / 2;

        // 若行距过大、行距逆向、字号差异大于 2.2pt、或左右列对齐偏差过大 (> 35pt)，立即切断段落
        const fontDiff = Math.abs(prevLine.fontSize - lineObj.fontSize);
        const xOffset = Math.abs(prevLine.x - lineObj.x);

        if (lineGap > avgH * 1.55 || lineGap < 0 || fontDiff > 2.2 || xOffset > 35) {
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

  // 6.4 提取相邻页边缘语境（前页末尾或后页开头约 180~250 字符，用于跨页断句与代词滑动窗口补齐）
  async function getPageEdgeContext(pageNum, edge = 'bottom') {
    if (!currentPdf || pageNum < 1 || pageNum > currentPdf.numPages) return '';
    try {
      const page = await currentPdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const rawItems = (textContent.items || [])
        .filter(item => item.str && item.str.trim())
        .map(item => normalizePdfText(item.str).trim())
        .filter(s => s && !/^\d+$/.test(s) && !/^Page\s*\d+/i.test(s)); // 排除纯页码
      
      if (rawItems.length === 0) return '';

      if (edge === 'bottom') {
        const sliceItems = rawItems.slice(-15);
        const joined = sliceItems.join(' ');
        if (/^(Fig\.|Figure|Table|Ref\.|\[\d+\])/i.test(joined.trim())) {
          return '';
        }
        return joined.slice(-250).trim();
      } else {
        const sliceItems = rawItems.slice(0, 15);
        const joined = sliceItems.join(' ');
        if (/^(Fig\.|Figure|Table)/i.test(joined.trim())) {
          return '';
        }
        return joined.slice(0, 250).trim();
      }
    } catch (e) {
      console.warn(`提取第 ${pageNum} 页边缘语境异常:`, e);
      return '';
    }
  }

  // 6.5 整页 JSON 结构化批量翻译 API (优先走本地多角色学术引擎与隐私脱敏，支持跨页语境 context 注入)
  function requestBatchTranslation(items, engine, targetLang, model, context = null, persona = 'biochem') {
    return new Promise((resolve, reject) => {
      // 统一角色标识 (向后兼容 boolean 参数: true -> 'biochem', false -> 'general')
      const activePersona = typeof persona === 'string' ? persona : (persona ? 'biochem' : 'general');

      chrome.storage.local.get({
        deepseekApiKey: '',
        glmApiKey: '',
        customModels: []
      }, (settings) => {
        let apiKey = settings.deepseekApiKey || settings.glmApiKey;
        let endpoint = 'https://api.deepseek.com/chat/completions';
        let modelName = 'deepseek-chat';

        if (engine && engine.startsWith('custom_')) {
          const customId = engine.substring(7);
          const cm = settings.customModels.find(m => m.id === customId);
          if (cm) {
            apiKey = cm.apiKey;
            endpoint = cm.endpoint;
            modelName = cm.modelName;
          }
        }

        fetch('http://localhost:3300/api/translate/bio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            targetLang,
            crossPageContext: context,
            apiKey: apiKey || '',
            endpoint,
            model: modelName,
            persona: activePersona,
            enableHybrid: true
          })
        }).then(r => r.json()).then(res => {
          if (res && res.success && Array.isArray(res.translations)) {
            if (res.dispatchStats) {
              console.log(`[${activePersona} 智能分流] ${res.dispatchStats.totalCount} 段落处理完毕: ${res.dispatchStats.freeCount} 段免Key直达，${res.dispatchStats.aiCount} 段大模型推理 (节约 Token: ${res.dispatchStats.savedTokenRatio})`);
            }
            if (res.matchedTerms && res.matchedTerms.length > 0) {
              console.log(`[${activePersona} 术语增强] 命中 ${res.matchedTerms.length} 个权威专有词条:`, res.matchedTerms.slice(0, 5).map(t => `${t.term} -> ${t.translation}`).join('; '));
            }
            resolve(res.translations);
            return;
          }
          // 本地接口异常时无缝回退到扩展 background
          fallbackChromeBatch(items, engine, targetLang, model, context, activePersona).then(resolve).catch(reject);
        }).catch(() => {
          // 本地服务未开时平滑回退
          fallbackChromeBatch(items, engine, targetLang, model, context, activePersona).then(resolve).catch(reject);
        });
      });
    });
  }

  function fallbackChromeBatch(items, engine, targetLang, model, context, persona) {
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'translateBatch',
          items: items,
          engine: engine,
          targetLang: targetLang,
          model: model,
          context: context,
          persona: persona
        }, (response) => {
          if (chrome.runtime.lastError || !response || !response.success) {
            fallbackLocalBatch(items, targetLang, context).then(resolve).catch(reject);
          } else if (response.success && Array.isArray(response.translations)) {
            resolve(response.translations);
          } else {
            fallbackLocalBatch(items, targetLang, context).then(resolve).catch(reject);
          }
        });
      } else {
        fallbackLocalBatch(items, targetLang, context).then(resolve).catch(reject);
      }
    });
  }

  async function fallbackLocalBatch(items, targetLang, context = null) {
    try {
      const res = await fetch('/api/translate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, targetLang, context })
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.translations)) {
        return data.translations;
      }
      throw new Error(data.error || '本地后端翻译异常');
    } catch (e) {
      throw new Error('批量翻译失败: ' + e.message);
    }
  }

  // 7. 翻译单页核心方法 (原排版独立靶向舞台 + 批量 JSON 协议)
  async function translatePage(pageNum, isBatch = false) {
    if (!currentPdf) return;
    const targetPageNum = Math.max(1, Math.min(pageNum || currentPage, currentPdf.numPages));
    const skipFormulas = skipFormulasCheckbox ? skipFormulasCheckbox.checked : true;

    // 1. 展开并显示右侧排版对照栏及顶部操作区
    translationPane.classList.remove('hidden');
    toggleBilingualBtn.classList.add('active');
    if (transToolbarActions) transToolbarActions.classList.remove('hidden');
    if (transActiveBadge) transActiveBadge.textContent = isBatch ? '全文翻译中...' : `第 ${targetPageNum} 页 (准备中...)`;

    // 2. 渲染右侧当前页独立靶向画板（Stage）
    const stage = await renderTransStageForPage(targetPageNum);
    if (!stage) {
      console.error(`挂载第 ${targetPageNum} 页舞台失败`);
      return;
    }

    const { overlayLayer, page } = stage;
    const pageHeight = page.getViewport({ scale: 1.0 }).height;

    // 3. 提取并结构化页面内容块与物理边界
    const blocks = await extractPageBlocks(page, skipFormulas);

    if (!blocks || blocks.length === 0) {
      if (scannedPdfAlert) {
        const alertText = scannedPdfAlert.querySelector('.scanned-alert-text');
        if (alertText) {
          alertText.textContent = `检测到第 ${targetPageNum} 页为扫描件/纯图片 PDF（无可选文本层），暂无法直接提取文字。建议使用 OCR 工具识别文本后再进行排版翻译。`;
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
    const targetLang = (targetLanguageSelect && targetLanguageSelect.value) ? targetLanguageSelect.value : (settings.defaultTargetLang || 'zh-CN');

    // 3.5 采样当前页面各块的文字前景色与底色
    blocks.forEach(b => {
      if (b.box) {
        const colors = sampleBlockColors(stage.canvas, b.box, pageHeight, currentScale);
        b.style = b.style || {};
        b.style.color = colors.color;
        b.style.bgColor = colors.bgColor;
      }
    });

    // 4. 创建原位排版占位框（立即显示半透明磨砂气泡，感知0等待）
    overlayLayer.innerHTML = '';
    const tasksToTranslate = [];

    for (const block of blocks) {
      if (block.type === 'formula' && skipFormulas) {
        block.transText = block.originalText;
        continue;
      }

      let textToTranslate = block.originalText;
      let tokenMap = null;
      if (skipFormulas) {
        const protectedObj = protectInlineFormulas(textToTranslate);
        textToTranslate = protectedObj.text;
        tokenMap = protectedObj.tokenMap;
      }

      const overlayBlock = document.createElement('div');
      overlayBlock.className = 'trans-overlay-block is-translating';
      overlayBlock.dataset.blockId = block.id;

      const left = Math.round(block.box.x * currentScale);
      const top = Math.round((pageHeight - block.box.y - block.box.h) * currentScale);
      const width = Math.max(Math.round(block.box.w * currentScale), 20);
      const minHeight = Math.max(Math.round(block.box.h * currentScale), 12);
      const placeholderFont = Math.round((block.style?.fontSize || 12) * currentScale);

      overlayBlock.style.left = `${left}px`;
      overlayBlock.style.top = `${top}px`;
      overlayBlock.style.width = `${width}px`;
      overlayBlock.style.minHeight = `${minHeight}px`;
      overlayBlock.style.fontSize = `${Math.min(placeholderFont, 14)}px`;
      overlayBlock.textContent = '翻译中...';

      overlayLayer.appendChild(overlayBlock);

      tasksToTranslate.push({
        block,
        overlayBlock,
        textToTranslate,
        tokenMap
      });
    }

    if (tasksToTranslate.length === 0) {
      renderOverlayBlocksOnLayer(overlayLayer, blocks, pageHeight, currentScale, stage.canvas);
      pageTranslations.set(targetPageNum, blocks);
      transActiveBadge.textContent = isBatch ? '全文翻译中...' : `第 ${targetPageNum} 页 (无需翻译)`;
      return;
    }

    transActiveBadge.textContent = isBatch ? '全文翻译中...' : `第 ${targetPageNum} 页 (AI 翻译中...)`;

    // 5. 跨页断句滑动窗口上下文注入与结构化批量请求 (Context-Aware Sliding Window)
    try {
      let crossPageContext = null;
      try {
        const [prefixContext, suffixContext] = await Promise.all([
          targetPageNum > 1 ? getPageEdgeContext(targetPageNum - 1, 'bottom') : Promise.resolve(''),
          targetPageNum < currentPdf.numPages ? getPageEdgeContext(targetPageNum + 1, 'top') : Promise.resolve('')
        ]);

        if (prefixContext || suffixContext) {
          crossPageContext = {
            prefix: prefixContext,
            suffix: suffixContext
          };
        }
      } catch (ctxErr) {
        console.warn('获取跨页上下文忽略:', ctxErr);
      }

      const payload = tasksToTranslate.map(t => ({ id: t.block.id, text: t.textToTranslate }));
      let transResults;
      try {
        transResults = await requestBatchTranslation(payload, engine, targetLang, selectedModel, crossPageContext, currentPersona);
      } catch (firstErr) {
        console.warn(`第 ${targetPageNum} 页批量翻译遇阻，正在退避重试:`, firstErr.message);
        if (isBatch) showToast(`通道繁忙，第 ${targetPageNum} 页启动退避重试...`);
        await new Promise(r => setTimeout(r, 1200));
        transResults = await requestBatchTranslation(payload, engine, targetLang, selectedModel, crossPageContext, currentPersona);
      }

      if (activeTranslateController && activeTranslateController.aborted) return;

      const transMap = new Map();
      if (Array.isArray(transResults)) {
        transResults.forEach(r => transMap.set(r.id, r.text));
      }

      for (const task of tasksToTranslate) {
        const rawTrans = transMap.get(task.block.id) || task.block.originalText;
        const finalText = task.tokenMap ? restoreInlineFormulas(rawTrans, task.tokenMap) : rawTrans;
        task.block.transText = finalText;
      }

      // 再次确认色彩采样
      blocks.forEach(b => {
        if (b.box && (!b.style?.color || !b.style?.bgColor)) {
          const colors = sampleBlockColors(stage.canvas, b.box, pageHeight, currentScale);
          b.style = b.style || {};
          b.style.color = colors.color;
          b.style.bgColor = colors.bgColor;
        }
      });

      // 原排版无痕覆盖渲染：底图 Inpainting 擦除原英文 + 1:1 字号颜色还原
      renderOverlayBlocksOnLayer(overlayLayer, blocks, pageHeight, currentScale, stage.canvas);

      pageTranslations.set(targetPageNum, blocks);
      transActiveBadge.textContent = isBatch ? '全文翻译中...' : `已翻译 (第 ${targetPageNum} 页)`;
      updateThumbnailStatus(targetPageNum);
      if (!isBatch) {
        showToast(`✓ 第 ${targetPageNum} 页翻译完成`);
      }

      // 超长篇批量翻译优化：若当前页不在视口内，立即释放重型 Canvas 显存，保留轻量骨架与已就绪状态
      if (isBatch && targetPageNum !== currentPage) {
        const stageElem = document.getElementById(`page-trans-container-${targetPageNum}`);
        if (stageElem) {
          const rect = stageElem.getBoundingClientRect();
          const isVisible = (rect.bottom >= -200 && rect.top <= window.innerHeight + 200);
          if (!isVisible) {
            const c = stageElem.querySelector('canvas');
            if (c) { c.width = 0; c.height = 0; }
            stageElem.innerHTML = `<div class="page-skeleton"><span class="page-skeleton-badge">第 ${targetPageNum} 页 译文 (已就绪)</span></div>`;
            stageElem.classList.add('is-unloaded');
          }
        }
      }
    } catch (err) {
      console.error('批量翻译失败:', err);
      transActiveBadge.textContent = `翻译失败: ${err.message}`;
      tasksToTranslate.forEach(t => {
        if (t.overlayBlock) {
          t.overlayBlock.classList.remove('is-translating');
          t.overlayBlock.classList.add('error');
          t.overlayBlock.textContent = `翻译失败: ${err.message}`;
        }
      });
    }
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
    if (translateRangeBtn) translateRangeBtn.disabled = true;

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
        updateThumbnailStatus(p);
        continue;
      }

      await translatePage(p, true);
      updateThumbnailStatus(p);

      // 防限流自适应平滑调度延迟 (350ms 冷却)，保障公共翻译通道不被封禁
      await new Promise(r => setTimeout(r, 350));
    }

    if (activeTranslateController.aborted) {
      transProgressLabel.textContent = '翻译已停止';
      transActiveBadge.textContent = '已停止';
      showToast('全文翻译已中止');
    } else {
      transProgressFill.style.width = '100%';
      transProgressLabel.textContent = '全文翻译完成！';
      transActiveBadge.textContent = '已完成';
      showToast('✓ 全文翻译已全部完成');
    }

    renderTransStageForPage(currentPage);

    setTimeout(() => {
      transProgressCard.classList.add('hidden');
    }, 2500);

    isTranslatingDoc = false;
    if (translateDocBtn) translateDocBtn.disabled = false;
    if (translatePageBtn) translatePageBtn.disabled = false;
    if (translateRangeBtn) translateRangeBtn.disabled = false;
  }

  // 8.5 沉浸式选页范围解析与批量调度器
  function parsePageRanges(rangeStr, maxPages) {
    if (!rangeStr || !rangeStr.trim() || !maxPages) return [];
    const parts = rangeStr.split(/[,，\s]+/);
    const pagesSet = new Set();

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const from = Math.max(1, Math.min(start, end));
          const to = Math.min(maxPages, Math.max(start, end));
          for (let p = from; p <= to; p++) {
            pagesSet.add(p);
          }
        }
      } else {
        const p = parseInt(trimmed, 10);
        if (!isNaN(p) && p >= 1 && p <= maxPages) {
          pagesSet.add(p);
        }
      }
    }
    return Array.from(pagesSet).sort((a, b) => a - b);
  }

  async function translatePageList(pages) {
    if (!currentPdf || isTranslatingDoc || !pages || pages.length === 0) return;
    isTranslatingDoc = true;
    activeTranslateController = { aborted: false };

    transProgressCard.classList.remove('hidden');
    transActiveBadge.textContent = '选页翻译中...';
    if (translateDocBtn) translateDocBtn.disabled = true;
    if (translatePageBtn) translatePageBtn.disabled = true;
    if (translateRangeBtn) translateRangeBtn.disabled = true;

    const total = pages.length;

    for (let idx = 0; idx < total; idx++) {
      if (activeTranslateController.aborted) break;
      const p = pages[idx];
      const percent = Math.round((idx / total) * 100);
      transProgressFill.style.width = `${percent}%`;
      transProgressLabel.textContent = `正在翻译第 ${p} 页 (${idx + 1}/${total} 页, ${percent}%)...`;

      const cached = pageTranslations.get(p);
      const isAlreadyDone = cached && cached.length > 0 && cached.some(b => b.transText);
      if (!isAlreadyDone) {
        await translatePage(p, true);
      }
      updateThumbnailStatus(p);

      // 防限流自适应平滑调度延迟 (350ms 冷却)，保障公共翻译通道不被封禁
      await new Promise(r => setTimeout(r, 350));
    }

    if (activeTranslateController.aborted) {
      transProgressLabel.textContent = '选页翻译已停止';
      transActiveBadge.textContent = '已停止';
      showToast('选页翻译已中止');
    } else {
      transProgressFill.style.width = '100%';
      transProgressLabel.textContent = `选页翻译完成 (共 ${total} 页)！`;
      transActiveBadge.textContent = '已完成';
      showToast(`✓ 选页翻译完成 (共 ${total} 页)`);
    }

    renderTransStageForPage(currentPage);

    setTimeout(() => {
      transProgressCard.classList.add('hidden');
    }, 2500);

    isTranslatingDoc = false;
    if (translateDocBtn) translateDocBtn.disabled = false;
    if (translatePageBtn) translatePageBtn.disabled = false;
    if (translateRangeBtn) translateRangeBtn.disabled = false;
  }

  // 9. 绑定沉浸式翻译双层工具栏与视图模式事件
  if (toggleSidebarBtn && viewerSidebar) {
    toggleSidebarBtn.addEventListener('click', () => {
      const isCollapsed = viewerSidebar.classList.toggle('collapsed');
      toggleSidebarBtn.classList.toggle('active', !isCollapsed);
    });
  }

  // 对照显示模式切换: 双语对照 / 仅原文 / 仅译文
  if (controlStyleSelect) {
    controlStyleSelect.addEventListener('change', () => {
      const mode = controlStyleSelect.value;
      if (mode === 'bilingual') {
        pdfPane.classList.remove('hidden');
        translationPane.classList.remove('hidden');
        renderTransStageForPage(currentPage);
      } else if (mode === 'original') {
        pdfPane.classList.remove('hidden');
        translationPane.classList.add('hidden');
      } else if (mode === 'translation') {
        pdfPane.classList.add('hidden');
        translationPane.classList.remove('hidden');
        renderTransStageForPage(currentPage);
      }
    });
  }

  // 预设缩放与适合页宽计算
  if (zoomPresetSelect) {
    zoomPresetSelect.addEventListener('change', () => {
      const val = zoomPresetSelect.value;
      if (val === 'fit-width') {
        if (currentPdf) {
          currentPdf.getPage(currentPage).then(p => {
            const vp = p.getViewport({ scale: 1.0 });
            const isBilingual = (controlStyleSelect && controlStyleSelect.value === 'bilingual');
            const availableW = viewerMain.clientWidth - (viewerSidebar.classList.contains('collapsed') ? 60 : 260);
            const targetScale = Math.max(0.5, Math.min(2.5, availableW / (vp.width * (isBilingual ? 2.1 : 1.05))));
            changeZoom(Math.round(targetScale * 100) / 100);
          });
        }
      } else if (val === 'fit-page') {
        if (currentPdf) {
          currentPdf.getPage(currentPage).then(p => {
            const vp = p.getViewport({ scale: 1.0 });
            const availableH = viewerMain.clientHeight - 90;
            const targetScale = Math.max(0.4, Math.min(2.0, availableH / vp.height));
            changeZoom(Math.round(targetScale * 100) / 100);
          });
        }
      } else {
        changeZoom(parseFloat(val));
      }
    });
  }

  // 顶栏沉浸式隐藏与一键浮动唤回 + 回到顶部
  if (topBackBtn) {
    topBackBtn.addEventListener('click', () => {
      scrollToPage(1);
    });
  }

  if (hideTopBtn && showTopFloatingBtn) {
    hideTopBtn.addEventListener('click', () => {
      if (viewerHeaderTop) viewerHeaderTop.classList.add('hidden');
      if (viewerHeaderSub) viewerHeaderSub.classList.add('hidden');
      showTopFloatingBtn.classList.remove('hidden');
    });

    showTopFloatingBtn.addEventListener('click', () => {
      if (viewerHeaderTop) viewerHeaderTop.classList.remove('hidden');
      if (viewerHeaderSub) viewerHeaderSub.classList.remove('hidden');
      showTopFloatingBtn.classList.add('hidden');
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (viewerHeaderTop && viewerHeaderTop.classList.contains('hidden')) {
          viewerHeaderTop.classList.remove('hidden');
          if (viewerHeaderSub) viewerHeaderSub.classList.remove('hidden');
          showTopFloatingBtn.classList.add('hidden');
        }
      }
    });
  }

  // 目标语言切换联动
  if (targetLanguageSelect) {
    chrome.storage.local.get({ defaultTargetLang: 'zh-CN' }, (res) => {
      if (res.defaultTargetLang) targetLanguageSelect.value = res.defaultTargetLang;
    });

    targetLanguageSelect.addEventListener('change', () => {
      chrome.storage.local.set({ defaultTargetLang: targetLanguageSelect.value });
      if (pageTranslations.has(currentPage)) {
        translatePage(currentPage, false);
      }
    });
  }

  // 翻译专家角色体系管理与多处联动
  function syncPersona(newVal) {
    currentPersona = newVal || 'general';
    if (personaSelect) personaSelect.value = currentPersona;
    if (advPersonaSelect) advPersonaSelect.value = currentPersona;
    chrome.storage.local.set({ translationPersona: currentPersona });

    const personaLabels = {
      general: '默认通用翻译 (大众通俗·流畅自然)',
      biochem: '生化学术专家 (博士前沿·3,100+权威术语)',
      economics: '经济学专家 (顶刊标准·量化与计量)'
    };
    showToast(`翻译角色已切换为: ${personaLabels[currentPersona] || currentPersona}`);
  }

  if (personaSelect) {
    personaSelect.addEventListener('change', (e) => syncPersona(e.target.value));
  }
  if (advPersonaSelect) {
    advPersonaSelect.addEventListener('change', (e) => syncPersona(e.target.value));
  }

  chrome.storage.local.get({ translationPersona: 'biochem' }, (res) => {
    if (res.translationPersona) {
      currentPersona = res.translationPersona;
      if (personaSelect) personaSelect.value = currentPersona;
      if (advPersonaSelect) advPersonaSelect.value = currentPersona;
    }
  });

  // 高级翻译设置模态框
  if (advancedTransBtn && advancedModal) {
    advancedTransBtn.addEventListener('click', () => {
      advancedModal.classList.remove('hidden');
    });
  }

  if (closeAdvancedModalBtn && advancedModal) {
    closeAdvancedModalBtn.addEventListener('click', () => {
      advancedModal.classList.add('hidden');
    });
  }

  if (advOpacityModeSelect) {
    advOpacityModeSelect.addEventListener('change', () => {
      opacityModeIndex = parseInt(advOpacityModeSelect.value, 10);
      renderTransStageForPage(currentPage);
    });
  }

  if (advTogglePeekBtn) {
    advTogglePeekBtn.addEventListener('click', () => {
      isPeekingLocked = !isPeekingLocked;
      viewerWorkspace.classList.toggle('is-peeking', isPeekingLocked);
      advTogglePeekBtn.textContent = isPeekingLocked ? '恢复正常显示 (已锁定透视)' : '锁定透视原图';
    });
  }

  if (advExportBilingualBtn) {
    advExportBilingualBtn.addEventListener('click', () => {
      exportBilingualDocument();
    });
  }

  // 欢迎屏幕文件选择框
  if (welcomeFileInput) {
    welcomeFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) readLocalFile(file);
    });
  }

  // 页面关键词检索悬浮窗
  if (searchToolBtn && searchModal) {
    searchToolBtn.addEventListener('click', () => {
      searchModal.classList.toggle('hidden');
      if (!searchModal.classList.contains('hidden') && searchInput) {
        searchInput.focus();
      }
    });
  }

  if (closeSearchBtn && searchModal) {
    closeSearchBtn.addEventListener('click', () => {
      searchModal.classList.add('hidden');
    });
  }

  // 帮助与快捷键弹窗
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      alert(
        '【Lite Translate · PDF 沉浸式双语对照阅读指南】\n\n' +
        '1. 翻页：点击上方 ‹ › 翻页，或按键盘 ← / → 键\n' +
        '2. 划词：鼠标直接在左侧原文或右侧译文划选，即刻弹出极速翻译浮标\n' +
        '3. 透视原图：长按键盘 Alt 键随时淡化译文、核对原图与图表\n' +
        '4. 缩略图：点击左上方侧边栏图标展开 118 页全局缩略图导航\n' +
        '5. 隐藏顶栏：点击 Hide top 进入全屏极简沉浸式阅读'
      );
    });
  }

  // 设置中心直达
  if (setupBtn) {
    setupBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open('/options.html', '_blank');
      }
    });
  }

  // 翻译控制按钮
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

  // 选页翻译交互与模态框绑定
  function updateRangeModalSummary() {
    if (!rangePagesInput || !rangeCalcStatus || !currentPdf) return;
    const pages = parsePageRanges(rangePagesInput.value, currentPdf.numPages);
    if (pages.length === 0) {
      rangeCalcStatus.textContent = '未匹配到有效页码 (有效范围 1 - ' + currentPdf.numPages + ')';
      rangeCalcStatus.style.color = '#ef4444';
    } else {
      rangeCalcStatus.style.color = '#2563eb';
      const preview = pages.length > 8 ? pages.slice(0, 8).join(', ') + '...' : pages.join(', ');
      rangeCalcStatus.textContent = `已选取：${pages.length} 页 (${preview})`;
    }
  }

  if (translateRangeBtn && rangeModal) {
    translateRangeBtn.addEventListener('click', () => {
      if (!currentPdf) return;
      rangeModal.classList.remove('hidden');
      if (rangePagesInput && (!rangePagesInput.value || rangePagesInput.value.trim() === '')) {
        rangePagesInput.value = `${currentPage}`;
      }
      updateRangeModalSummary();
      if (rangePagesInput) rangePagesInput.focus();
    });
  }

  if (closeRangeModalBtn && rangeModal) {
    closeRangeModalBtn.addEventListener('click', () => {
      rangeModal.classList.add('hidden');
    });
  }

  if (cancelRangeBtn && rangeModal) {
    cancelRangeBtn.addEventListener('click', () => {
      rangeModal.classList.add('hidden');
    });
  }

  if (rangePagesInput) {
    rangePagesInput.addEventListener('input', () => {
      updateRangeModalSummary();
    });
    rangePagesInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (startRangeBtn) startRangeBtn.click();
      }
    });
  }

  // 绑定预设按钮
  const presetBtns = document.querySelectorAll('.range-preset-btn');
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!currentPdf || !rangePagesInput) return;
      const preset = btn.dataset.preset;
      const total = currentPdf.numPages;
      if (preset === 'current') {
        rangePagesInput.value = `${currentPage}`;
      } else if (preset === '1-3') {
        rangePagesInput.value = `1-${Math.min(3, total)}`;
      } else if (preset === '1-10') {
        rangePagesInput.value = `1-${Math.min(10, total)}`;
      } else if (preset === 'all') {
        rangePagesInput.value = `1-${total}`;
      }
      updateRangeModalSummary();
    });
  });

  if (startRangeBtn && rangeModal) {
    startRangeBtn.addEventListener('click', () => {
      if (!currentPdf || !rangePagesInput) return;
      const pages = parsePageRanges(rangePagesInput.value, currentPdf.numPages);
      if (pages.length === 0) {
        showToast('请输入有效的页码范围');
        return;
      }
      rangeModal.classList.add('hidden');
      translatePageList(pages);
    });
  }

  if (cancelTransBtn) {
    cancelTransBtn.addEventListener('click', () => {
      if (activeTranslateController) {
        activeTranslateController.aborted = true;
      }
    });
  }

  if (pdfTranslateEngine) {
    pdfTranslateEngine.addEventListener('change', () => {
      chrome.storage.local.set({ pdfTranslateEngine: pdfTranslateEngine.value });
      updateToolbarModelSelect(pdfTranslateEngine.value);
    });
  }

  // --- 智能图标功能解释小浮窗 (Smart Tooltips) ---
  function initSmartTooltips() {
    const tooltipEl = document.getElementById('pdf-smart-tooltip');
    if (!tooltipEl) return;

    let currentTarget = null;
    let hideTimeout = null;

    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('[data-tooltip-title]');
      if (!target) return;
      if (target === currentTarget) return;

      currentTarget = target;
      clearTimeout(hideTimeout);

      const title = target.getAttribute('data-tooltip-title') || '';
      const desc = target.getAttribute('data-tooltip-desc') || '';
      const shortcut = target.getAttribute('data-tooltip-shortcut');

      tooltipEl.innerHTML = `
        <div class="tooltip-header">
          <span class="tooltip-title">${title}</span>
          ${shortcut ? `<span class="tooltip-shortcut">${shortcut}</span>` : ''}
        </div>
        <div class="tooltip-desc">${desc}</div>
      `;

      // 计算位置与智能视口避让
      tooltipEl.classList.add('visible');
      const rect = target.getBoundingClientRect();
      const tooltipRect = tooltipEl.getBoundingClientRect();

      let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
      let top = rect.bottom + 8; // 默认向下浮现

      // 若下方贴底，自动向上反转弹出
      if (top + tooltipRect.height > window.innerHeight - 10) {
        top = Math.max(10, rect.top - tooltipRect.height - 8);
      }

      // 水平防溢出约束
      if (left < 10) left = 10;
      if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
      }

      tooltipEl.style.left = `${Math.round(left)}px`;
      tooltipEl.style.top = `${Math.round(top)}px`;
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest('[data-tooltip-title]');
      if (!target) return;
      if (target === currentTarget) {
        currentTarget = null;
        hideTimeout = setTimeout(() => {
          tooltipEl.classList.remove('visible');
        }, 120);
      }
    });
  }

  initSmartTooltips();
});
