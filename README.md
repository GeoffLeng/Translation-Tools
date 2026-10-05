# Lite Translate

> 专注纯粹高效的极简划词翻译、多模型 AI 智能查词与长文档 PDF 沉浸式阅读 Chrome / Edge 扩展。

---

## ✨ 核心特性

### 1. 🌐 默认谷歌翻译，开箱即用零门槛
- **免 Key 全球高速通道**：原生集成 Google 翻译公共接口，新安装或重置后默认启用，零配置即可享受毫秒级划词与弹窗翻译。
- **智能故障自动回退**：若某个已选服务异常或被清空配置，插件将自动无缝回退至 Google 翻译，保障翻译流程不中断。

### 2. 🤖 AI 引擎按需展示与模型自选（成本控制）
- **按需挂载原则**：未导入 API Key 的 AI 引擎绝不出现在下拉菜单中，杜绝视觉干扰与报错。
- **全量校准官方真实模型**：全面移除过时或非官方虚构名称，统一接入各大厂商现役主流接口：
  - **OpenAI**：`gpt-4o-mini`（推荐·成本降 90% 以上）、`gpt-4o`、`gpt-3.5-turbo`
  - **Gemini**：`gemini-1.5-flash`（推荐·极速且提供免费额度）、`gemini-2.0-flash`、`gemini-1.5-flash-8b`、`gemini-1.5-pro`
  - **Claude**：`claude-3-5-haiku-latest`（推荐·超低成本极速响应）、`claude-3-5-sonnet-latest`、`claude-3-haiku-20240307`
  - **DeepSeek**：`deepseek-chat`（推荐·DeepSeek-V3 极致性价比，百万 Token 仅数毛钱）、`deepseek-reasoner`（R1 深度思考）
  - **Kimi (月之暗面)**：`moonshot-v1-8k`（推荐·标准 8k 上下文最省成本）、`moonshot-v1-32k`、`moonshot-v1-128k`
  - **智谱 GLM**：`glm-4-flash`（推荐·官方免费/超低成本）、`glm-4-air`、`glm-4-plus`
  - **火山引擎豆包**：支持自定义接入点（Endpoint ID），预设常用 `doubao-lite-4k` 等经济型模型
  - **NVIDIA NIM**：`meta/llama-3.1-8b-instruct`（推荐·极速低耗）、`meta/llama-3.3-70b-instruct`、`deepseek-ai/deepseek-r1`
  - **有道智云**：官方 OpenAPI v3 签名鉴权，长效稳定合规
  - **自定义模型**：支持接入任何 OpenAI 兼容协议接口（如 Ollama、vLLM、OneAPI、NewAPI 等）
- **多端实时联动切换**：用户可在设置页自由设定偏好模型，也可在工具栏 Popup、网页划词浮层、PDF 侧边栏内直接无缝切换模型，设定实时持久化同步。

### 3. ⚡ 极致轻量化与低内存驻留
- **MV3 事件驱动**：采用 Manifest V3 Service Worker 架构，后台无任何轮询定时器，无调用时自动休眠，常驻后台内存为 0。
- **Shadow DOM 封闭容器**：网页划词浮层基于原生 Web Components + Shadow DOM 封装，与宿主网页样式完全解耦，绝不污染页面排版；未划词或失焦后即刻隐藏并销毁临时状态，零内存泄漏。
- **PDF 虚拟化视口渲染**：内置 PDF 阅读器采用 `IntersectionObserver` 视口监听，移出可视区域的页面自动销毁 Canvas 并释放 GPU 显存，千页长文档极速翻阅不卡顿。
- **纯原生微型产物**：无 React/Vue 等庞大前端框架负担，构建后后台代码仅约 6.9 KB，页面脚本仅约 20.5 KB。

### 4. 🔒 零泄露风险的隐私与安全防护
- **端到端直连官方**：无任何自建中间人服务器，无任何行为埋点或数据收集。所有翻译网络请求均直接由用户本地 Chrome 发起至各大 AI 官方开放平台。
- **本地沙盒隔离存储**：所有 API Key 均严格存储在浏览器受保护的沙盒存储空间（`chrome.storage.local`），绝不上云。
- **UI 密码遮罩防窥**：全站所有 API Key 输入框均采用 `type="password"` 密码掩码，防止屏幕共享、录屏或物理窥屏。
- **Git 严密忽略规则**：`.gitignore` 全量屏蔽 `.env*`、`*.key`、`*secret*`、`*credential*`、`key.json` 及生产构建产物，源码无任何硬编码测试私钥。

---

## 🚀 安装与使用

### 从源码编译安装

1. **克隆仓库**
   ```bash
   git clone https://github.com/<your-username>/Translation-Tools.git
   cd Translation-Tools
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **编译构建**
   ```bash
   npm run build
   ```
   构建脚本将自动打包前端页面、Worker 与脚本，并在根目录下生成 `/dist` 目录。

4. **载入浏览器**
   - 打开 Chromium 内核浏览器（Chrome、Edge、Brave、Arc 等），在地址栏访问：`chrome://extensions/`
   - 在右上角开启 **“开发者模式” (Developer mode)**
   - 点击左上角的 **“加载已解压的扩展程序” (Load unpacked)**
   - 选择项目根目录下的 **`dist`** 文件夹即可完成安装。

---

## 🛠️ 项目目录结构

```text
Translation-Tools/
├── dist/                  # 编译打包输出目录 (已在 .gitignore 中忽略)
├── icons/                 # 扩展图标资源
├── src/                   # 源代码
│   ├── background.js      # 后台服务脚本 (API 调度、鉴权与右键菜单)
│   ├── content.js         # 网页内容注入脚本 (Shadow DOM 划词浮层与交互)
│   ├── options.js         # 设置页交互逻辑 (引擎过滤、模型选择与参数持久化)
│   ├── pdf_viewer.js      # PDF 阅读器 (虚拟化视口渲染与划词翻译)
│   ├── popup.js           # 工具栏弹窗交互逻辑 (快速查词与模型联动)
│   └── styles/            # 样式文件 (options.css, pdf_viewer.css, popup.css)
├── build.js               # 基于 Vite 的轻量自动化构建脚本
├── manifest.json          # Chrome Extension MV3 配置文件
├── options.html           # 设置页面入口
├── popup.html             # 工具栏弹出面板入口
├── pdf_viewer.html        # PDF 阅读器页面入口
├── package.json           # 项目依赖与脚本配置
├── .gitignore             # Git 忽略规则
├── .gitattributes         # Git 行尾符规范
├── LICENSE                # MIT 开源许可证
└── README.md              # 项目说明文档
```

---

## ⚙️ 常用命令

| 命令 | 说明 |
| :--- | :--- |
| `npm run dev` | 启动本地开发服务 |
| `npm run build` | 编译打包全量扩展产物至 `dist/` |

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源。

