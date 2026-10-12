// Content Script for iOS Translate Lite (v2.0)

(function () {
  if (window.__iosTranslateInjected) return;
  window.__iosTranslateInjected = true;

  // 1. 创建 Shadow Host
  const host = document.createElement('div');
  host.id = 'ios-translate-shadow-host';
  host.style.position = 'absolute';
  host.style.top = '0';
  host.style.left = '0';
  host.style.width = '100%';
  host.style.height = '0';
  host.style.zIndex = '2147483647';
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });

  // 2. 注入 iOS 26 极简玻璃拟态样式
  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    .hidden {
      display: none !important;
    }

    /* 悬浮小图标 */
    .ios-float-icon {
      position: absolute;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.4);
      border-radius: 10px;
      background: linear-gradient(135deg, #0A84FF, #5E5CE6);
      box-shadow: 0 4px 12px rgba(9, 132, 255, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.2);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease;
      transform: scale(0.9);
      opacity: 0;
      z-index: 10000;
    }
    
    .ios-float-icon.show {
      transform: scale(1);
      opacity: 1;
    }

    .ios-float-icon:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 16px rgba(9, 132, 255, 0.45);
    }

    .ios-float-icon svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: white;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* 翻译面板 - iOS 26 毛玻璃卡片 */
    .ios-panel {
      position: absolute;
      width: 360px;
      min-height: 160px;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.4);
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(20px) saturate(190%);
      -webkit-backdrop-filter: blur(20px) saturate(190%);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04), inset 0 0 0 1px rgba(255, 255, 255, 0.2);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      font-size: 14px;
      color: #1c1c1e;
      z-index: 10001;
      opacity: 0;
      transform: scale(0.95) translateY(10px);
      transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .ios-panel.show {
      opacity: 1;
      transform: scale(1) translateY(0);
    }

    /* 左右拉伸手柄 */
    .panel-resize-handle {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 10px;
      cursor: ew-resize;
      z-index: 100;
    }

    .resize-handle-left {
      left: 0;
    }

    .resize-handle-right {
      right: 0;
    }

    .panel-resize-handle:hover,
    .panel-resize-handle.active {
      background: rgba(0, 122, 255, 0.15);
    }

    /* 面板头部 */
    .panel-header {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      cursor: move;
      user-select: none;
    }

    .panel-logo {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      font-size: 13px;
      letter-spacing: -0.2px;
      color: #3a3a3c;
    }

    .panel-logo svg {
      width: 14px;
      height: 14px;
      stroke: currentColor;
      stroke-width: 2.5;
    }

    .panel-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* 精美 iOS 下拉选择器 */
    .panel-select {
      background: rgba(0, 0, 0, 0.05);
      border: none;
      outline: none;
      font-size: 12px;
      font-weight: 500;
      padding: 4px 8px;
      border-radius: 8px;
      color: #3a3a3c;
      cursor: pointer;
      max-width: 110px;
      transition: background 0.15s ease;
    }

    .panel-select:hover {
      background: rgba(0, 0, 0, 0.08);
    }

    .panel-close {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.06);
      border: none;
      color: #8e8e93;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 11px;
      font-weight: bold;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .panel-close:hover {
      background: rgba(0, 0, 0, 0.12);
      color: #3a3a3c;
    }

    .panel-icon-btn {
      width: 22px;
      height: 22px;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.05);
      border: none;
      color: #8e8e93;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
      padding: 0;
    }

    .panel-icon-btn:hover {
      background: rgba(0, 0, 0, 0.1);
      color: #1c1c1e;
    }

    .panel-icon-btn.active {
      background: rgba(0, 122, 255, 0.15);
      color: #007AFF;
    }

    .panel-toolbar-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .panel-btn-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* 面板内容 */
    .panel-body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .panel-source-text {
      color: #8e8e93;
      font-size: 13px;
      line-height: 1.5;
      max-height: 80px;
      overflow-y: auto;
      word-break: break-word;
    }

    .panel-divider {
      height: 1px;
      background: rgba(0, 0, 0, 0.06);
      margin: 2px 0;
    }

    .panel-result-wrapper {
      position: relative;
      min-height: 48px;
    }

    .panel-result {
      font-size: 14.5px;
      line-height: 1.5;
      font-weight: 400;
      color: #1c1c1e;
      word-break: break-word;
      white-space: pre-wrap;
    }

    .panel-result.error {
      color: #ff3b30;
      font-size: 13px;
    }

    .panel-loader {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid rgba(0, 122, 255, 0.15);
      border-radius: 50%;
      border-top-color: #007AFF;
      animation: spin 0.8s linear infinite;
      position: absolute;
      top: 50%;
      left: 50%;
      margin-top: -9px;
      margin-left: -9px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* PDF 链接询问模态弹窗 */
    .ios-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200000;
    }

    .modal-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      animation: fadeIn 0.25s ease-out;
    }

    .modal-box {
      position: relative;
      width: 320px;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.4);
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
      padding: 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transform: scale(0.95);
      animation: modalPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      color: #1c1c1e;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes modalPop {
      to { transform: scale(1); }
    }

    .modal-box h3 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
      letter-spacing: -0.2px;
    }

    .modal-desc {
      font-size: 13px;
      color: #8e8e93;
      margin: 0;
      line-height: 1.4;
    }

    .modal-file-info {
      font-size: 12px;
      font-family: monospace;
      background: rgba(0, 0, 0, 0.05);
      padding: 6px 10px;
      border-radius: 8px;
      word-break: break-all;
      color: #555;
    }

    .modal-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 8px;
    }

    .modal-btn {
      border: none;
      outline: none;
      padding: 12px;
      border-radius: 12px;
      font-size: 14.5px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.1s ease;
      background: rgba(0, 0, 0, 0.05);
      color: #1c1c1e;
    }

    .modal-btn:hover {
      background: rgba(0, 0, 0, 0.08);
    }

    .modal-btn:active {
      transform: scale(0.98);
    }

    .modal-btn.primary {
      background: linear-gradient(135deg, #0A84FF, #5E5CE6);
      color: white;
      font-weight: 600;
    }

    .modal-btn.primary:hover {
      opacity: 0.95;
    }
  `;
  shadowRoot.appendChild(style);

  // 3. 构建 DOM 骨架
  const container = document.createElement('div');
  container.className = 'ios-translate-root';
  container.innerHTML = `
    <button id="float-icon" class="ios-float-icon hidden" title="翻译">
      <svg viewBox="0 0 24 24">
        <path d="M4 7h16M12 7v13M9 20h6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </button>

    <div id="translate-panel" class="ios-panel hidden">
      <!-- 左右拉伸调整手柄 -->
      <div class="panel-resize-handle resize-handle-left" title="左右拖动调整宽度"></div>
      <div class="panel-resize-handle resize-handle-right" title="左右拖动调整宽度"></div>
      <div class="panel-header" id="panel-drag-handle">
        <div class="panel-logo">
          <svg viewBox="0 0 24 24" class="logo-mini"><path d="M4 7h16M12 7v13M9 20h6" fill="none" stroke="currentColor" stroke-linecap="round"/></svg>
          <span>翻译</span>
        </div>
        <div class="panel-actions">
          <select id="panel-engine-select" class="panel-select">
            <option value="google">Google</option>
          </select>
          <select id="panel-model-select" class="panel-select hidden"></select>
          <button id="panel-pin-btn" class="panel-icon-btn" title="固定浮窗">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-2l-2-2V5a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v8l-2 2v2z"></path></svg>
          </button>
          <button id="panel-close-btn" class="panel-close" title="关闭">✕</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="panel-toolbar-row">
          <span style="font-size:11.5px; color:#8e8e93; font-weight:500;">原文</span>
          <button id="panel-speak-src-btn" class="panel-icon-btn" title="朗读原文">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
        </div>
        <div class="panel-source-text" id="panel-source-text">...</div>
        <div class="panel-divider"></div>
        <div class="panel-toolbar-row">
          <span style="font-size:11.5px; color:#8e8e93; font-weight:500;">译文</span>
          <div class="panel-btn-group">
            <button id="panel-speak-res-btn" class="panel-icon-btn" title="朗读译文">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            </button>
            <button id="panel-copy-res-btn" class="panel-icon-btn" title="复制译文">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
        </div>
        <div class="panel-result-wrapper">
          <div id="panel-result-text" class="panel-result">...</div>
          <div id="panel-loader" class="panel-loader hidden"></div>
        </div>
      </div>
    </div>

    <div id="pdf-modal" class="ios-modal hidden">
      <div class="modal-overlay" id="pdf-modal-overlay"></div>
      <div class="modal-box">
        <h3>打开 PDF 文件</h3>
        <p class="modal-file-info" id="pdf-link-display">file.pdf</p>
        <p class="modal-desc">检测到 PDF 文档，您希望如何打开它？</p>
        <div class="modal-actions">
          <button id="pdf-opt-extension" class="modal-btn primary">用扩展翻译阅读</button>
          <button id="pdf-opt-native" class="modal-btn">浏览器原生打开</button>
          <button id="pdf-opt-download" class="modal-btn">下载文件</button>
        </div>
      </div>
    </div>
  `;
  shadowRoot.appendChild(container);

  // 获取 DOM 引用
  const floatIcon = shadowRoot.getElementById('float-icon');
  const translatePanel = shadowRoot.getElementById('translate-panel');
  const panelEngineSelect = shadowRoot.getElementById('panel-engine-select');
  const panelModelSelect = shadowRoot.getElementById('panel-model-select');
  const panelSourceText = shadowRoot.getElementById('panel-source-text');
  const panelResultText = shadowRoot.getElementById('panel-result-text');
  const panelLoader = shadowRoot.getElementById('panel-loader');
  const panelCloseBtn = shadowRoot.getElementById('panel-close-btn');
  const panelPinBtn = shadowRoot.getElementById('panel-pin-btn');
  const speakSrcBtn = shadowRoot.getElementById('panel-speak-src-btn');
  const speakResBtn = shadowRoot.getElementById('panel-speak-res-btn');
  const copyResBtn = shadowRoot.getElementById('panel-copy-res-btn');
  const dragHandle = shadowRoot.getElementById('panel-drag-handle');

  const pdfModal = shadowRoot.getElementById('pdf-modal');
  const pdfLinkDisplay = shadowRoot.getElementById('pdf-link-display');
  const pdfOptExtension = shadowRoot.getElementById('pdf-opt-extension');
  const pdfOptNative = shadowRoot.getElementById('pdf-opt-native');
  const pdfOptDownload = shadowRoot.getElementById('pdf-opt-download');
  const pdfModalOverlay = shadowRoot.getElementById('pdf-modal-overlay');

  let currentSelectedText = '';
  let activePdfLink = '';
  let isDragging = false;
  let isPinned = false;
  let dragOffset = { x: 0, y: 0 };

  // 浮窗左右拉伸逻辑
  const handleLeft = shadowRoot.querySelector('.resize-handle-left');
  const handleRight = shadowRoot.querySelector('.resize-handle-right');

  // 从 storage 读取并恢复用户偏好的浮窗宽度
  chrome.storage.local.get({ contentPanelWidth: 360 }, (res) => {
    if (res.contentPanelWidth && res.contentPanelWidth >= 280) {
      translatePanel.style.width = `${res.contentPanelWidth}px`;
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
      chrome.storage.local.set({ contentPanelWidth: finalWidth });
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  if (handleLeft) handleLeft.addEventListener('mousedown', (e) => initResize(e, 'left'));
  if (handleRight) handleRight.addEventListener('mousedown', (e) => initResize(e, 'right'));

  // 网页文本语义段落重构与断行清洗函数
  function reconstructParagraphs(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';
    let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rawParagraphs = text.split(/\n\s*\n+/);
    const cleanParagraphs = rawParagraphs.map(paragraph => {
      const rawLines = paragraph.split('\n').map(l => l.trim()).filter(Boolean);
      if (rawLines.length === 0) return '';
      if (rawLines.length === 1) return rawLines[0];

      let merged = rawLines[0];
      for (let i = 1; i < rawLines.length; i++) {
        const prevLine = rawLines[i - 1];
        const currLine = rawLines[i];
        const isListItem = /^([-*•·]|(?:\d+|[a-zA-Z])[\.)])\s+/.test(currLine);
        if (isListItem) {
          merged += '\n' + currLine;
          continue;
        }
        if (/([a-zA-Z]+)-$/.test(prevLine) && /^[a-zA-Z]/.test(currLine)) {
          merged = merged.slice(0, -1) + currLine;
          continue;
        }
        const prevEndsCJK = /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]$/.test(merged);
        const currStartsCJK = /^[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(currLine);
        if (prevEndsCJK && currStartsCJK) {
          merged += currLine;
        } else {
          merged += ' ' + currLine;
        }
      }
      return merged;
    });
    return cleanParagraphs.filter(Boolean).join('\n\n');
  }

  // AI 模型内置字典 (智谱 GLM 4/4.5/4.7 Flash 官方模型永久免费)
  const AI_MODELS = {
    glm: [
      'glm-4-flash',
      'glm-4.5-flash',
      'glm-4.7-flash',
      'glm-4-flashx'
    ]
  };

  // 4. 动态加载可用引擎列表
  function loadAvailableEngines(callback) {
    chrome.storage.local.get({
      glmApiKey: '',
      glmModels: null,
      deeplApiKey: '',
      youdaoAppKey: '',
      youdaoAppSecret: '',
      customModels: []
    }, (result) => {
      // 动态载入用户在设置中启用的模型列表
      if (Array.isArray(result.glmModels) && result.glmModels.length > 0) AI_MODELS.glm = result.glmModels;

      const currentVal = panelEngineSelect.value;
      panelEngineSelect.innerHTML = '';

      const available = [
        { value: 'google', label: 'Google' },
        { value: 'bing', label: 'Bing' },
        { value: 'deepl', label: 'DeepL' }
      ];

      if (result.glmApiKey) {
        available.push({ value: 'glm', label: '智谱GLM' });
      }
      if (result.youdaoAppKey && result.youdaoAppSecret) {
        available.push({ value: 'youdao', label: '有道' });
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

  // 读取偏好设置
  function getSettings(callback) {
    chrome.storage.local.get({
      enableSelectionTranslate: true,
      autoShowPanel: false,
      defaultTargetLang: 'zh-CN',
      defaultEngine: 'google',
      triggerMode: 'direct'
    }, callback);
  }

  // 5. 网页划词事件监听
  document.addEventListener('mouseup', (e) => {
    if (e.target === host || host.contains(e.target)) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const rawText = selection.toString().trim();

      if (!rawText || rawText.length < 1 || rawText.length > 2000) {
        if (!translatePanel.classList.contains('show')) {
          hideIcon();
        }
        return;
      }

      const text = reconstructParagraphs(rawText);
      currentSelectedText = text;

      getSettings((settings) => {
        if (!settings.enableSelectionTranslate) return;

        // 快捷键触发控制 (直接 / Alt+划词 / Ctrl+划词)
        if (settings.triggerMode === 'alt' && !e.altKey) return;
        if (settings.triggerMode === 'ctrl' && !(e.ctrlKey || e.metaKey)) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        const posX = rect.right + scrollX + 4;
        const posY = rect.bottom + scrollY + 4;

        if (settings.autoShowPanel) {
          showPanel(posX, posY, text, settings.defaultEngine, settings.defaultTargetLang);
        } else {
          showIcon(posX, posY);
        }
      });
    }, 20);
  });

  // 点击其它区域隐藏翻译组件
  document.addEventListener('mousedown', (e) => {
    if (e.target === host || host.contains(e.target)) return;
    if (!floatIcon.classList.contains('hidden')) {
      hideIcon();
    }
    const isClickedInsideHost = (e.target === host || host.contains(e.target));
    if (!isClickedInsideHost && !isPinned && translatePanel.classList.contains('show')) {
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
      
      // 更新模型二级选择器状态
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

  // 更新模型二级下拉选择器
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
      
      // 读取该引擎的已选模型版本
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

  // 发起翻译请求
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

  // 点击悬浮图标触发翻译
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

  // 浮窗常驻固定
  panelPinBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isPinned = !isPinned;
    panelPinBtn.classList.toggle('active', isPinned);
    panelPinBtn.title = isPinned ? '取消固定' : '固定浮窗';
  });

  // TTS 语音朗读
  function speakText(text) {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[一-龥]/.test(text) ? 'zh-CN' : 'en-US';
    window.speechSynthesis.speak(utterance);
  }

  speakSrcBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    speakText(panelSourceText.textContent);
  });

  speakResBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    speakText(panelResultText.textContent);
  });

  // 复制译文
  copyResBtn.addEventListener('click', (e) => {
    e.stopPropagation();
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

  // 面板内切换引擎
  panelEngineSelect.addEventListener('change', () => {
    const engine = panelEngineSelect.value;
    updateModelSelect(engine, () => {
      getSettings((settings) => {
        doTranslation(currentSelectedText, engine, settings.defaultTargetLang, panelModelSelect.value);
      });
    });
  });

  // 面板内切换模型
  panelModelSelect.addEventListener('change', () => {
    const engine = panelEngineSelect.value;
    const model = panelModelSelect.value;
    
    // 保存当前选中的模型为该引擎的活跃模型
    const storageKey = `${engine}ActiveModel`;
    chrome.storage.local.set({ [storageKey]: model });

    getSettings((settings) => {
      doTranslation(currentSelectedText, engine, settings.defaultTargetLang, model);
    });
  });

  // 右键菜单唤起监听
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showSelectionTranslatePopup') {
      currentSelectedText = message.text;
      const x = window.innerWidth / 2 - 180 + window.scrollX;
      const y = window.innerHeight / 3 + window.scrollY;
      getSettings((settings) => {
        showPanel(x, y, message.text, settings.defaultEngine, settings.defaultTargetLang);
      });
      sendResponse({ status: 'ok' });
    }
  });

  // 面板拖拽逻辑
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

  // PDF 链接拦截功能
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.href;
    if (href) {
      const cleanHref = href.split('?')[0].split('#')[0].toLowerCase();
      if (cleanHref.endsWith('.pdf') || href.toLowerCase().includes('/pdf/')) {
        chrome.storage.local.get({ pdfAction: 'ask' }, (result) => {
          if (result.pdfAction === 'ask') {
            e.preventDefault();
            activePdfLink = href;
            pdfLinkDisplay.textContent = decodeURIComponent(cleanHref.substring(cleanHref.lastIndexOf('/') + 1) || 'document.pdf');
            pdfModal.classList.remove('hidden');
          } else if (result.pdfAction === 'extension') {
            e.preventDefault();
            const viewerUrl = chrome.runtime.getURL('pdf_viewer.html') + '?file=' + encodeURIComponent(href);
            window.open(viewerUrl, '_blank');
          }
        });
      }
    }
  });

  // PDF Modal 交互处理
  pdfOptExtension.addEventListener('click', () => {
    const viewerUrl = chrome.runtime.getURL('pdf_viewer.html') + '?file=' + encodeURIComponent(activePdfLink);
    window.open(viewerUrl, '_blank');
    pdfModal.classList.add('hidden');
  });

  pdfOptNative.addEventListener('click', () => {
    window.open(activePdfLink, '_blank');
    pdfModal.classList.add('hidden');
  });

  pdfOptDownload.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = activePdfLink;
    a.download = activePdfLink.substring(activePdfLink.lastIndexOf('/') + 1);
    a.click();
    pdfModal.classList.add('hidden');
  });

  pdfModalOverlay.addEventListener('click', () => {
    pdfModal.classList.add('hidden');
  });

  // Escape 键快捷关闭浮层
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!pdfModal.classList.contains('hidden')) {
        pdfModal.classList.add('hidden');
      }
      if (translatePanel.classList.contains('show') && !isPinned) {
        hidePanel();
      }
      if (!floatIcon.classList.contains('hidden')) {
        hideIcon();
      }
    }
  });
})();
