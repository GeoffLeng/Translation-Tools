# Translate FY

<p align="right">
  <a href="README.md">English</a> | <strong>简体中文</strong>
</p>

> 专注纯粹高效的极简划词翻译、多模型 AI 智能查词与长文档 PDF 沉浸式双栏对照阅读 Chrome / Edge 扩展。

---

## 核心特性

### 1. 零门槛免 Key 免费翻译矩阵
- **三大主流免 Key 通道**：
  - **Google 翻译**：原生免 Key 公共通道，开箱即用，毫秒级响应。
  - **Bing 翻译**：内置微软全球高速网络与动态令牌防刷机制，零配置享受精准必应翻译。
  - **DeepL 翻译**：世界领先的自然流畅译文，支持免 Key 快速通道，亦支持填入官方 API Key（享一次性 1,000,000 字符额度）。
- **智能故障自动回退**：若某个已选服务异常，插件将自动无缝回退至 Google 翻译，保障翻译流程不中断。

### 2. AI 智能翻译矩阵
- **官方内置免费 AI**：
  - **智谱 GLM（4 / 4.5 / 4.7 Flash 免费）**：官方承诺 `glm-4-flash`、`glm-4.5-flash`、`glm-4.7-flash`、`glm-4-flashx` **永久完全免费调用**，极速推理零成本；划词翻译与浮窗精简保留全套免费模型。
- **自定义模型管理中心**：支持自由添加主流第三方与开源模型提供商：
  - **OpenRouter**：全模型聚合平台（自动注入 Referer/Title 头，聚合 Claude 3.7、GPT-4o、Llama 3 及数百款免费/低价模型）
  - **OpenCode**：开源与低门槛代码/推理 API
  - **硅基流动 (SiliconFlow)** / **Groq** / **OpenAI** / **本地 Ollama**
- **动态获取与智能模糊搜索**：输入 API Key 后一键拉取支持的全部模型，特别标注官方免费模型，输入关键字即可实时模糊过滤候选列表，一键选中，亦支持直接手动填入任意模型 ID。
- **多端实时联动切换**：所有自定义模型与启用的核心模型实时同步至工具栏 Popup、网页划词浮层、PDF 阅读浮窗。

### 3. 智能 PDF 阅读与双栏对照翻译
- **一键单页与全文对照翻译**：支持“翻译当前页”与“一键翻译全文”，默认 Google 翻译并支持下拉自由切换智谱 GLM 等任意引擎；右侧同步渲染双语对照卡片，左侧原文与右侧译文精确互照。
- **段落、换行、图表与公式精准识别**：内置 PDF 物理排版重构算法，智能识别中西文连缀、连字符断词修复（如 `infor-\nmation`）与图表标题（Figure / Table 说明）。
- **公式占位保护开关**：提供“公式不翻译”勾选选项，独立公式块原样保留，行内数学符号与公式以 Token 占位符隔离保护后无损还原，杜绝数学公式被译文篡改错乱。
- **浮窗左右双向自由拉伸**：翻译浮窗支持左边缘与右边缘手柄自由拖拽拉伸（280px 至 90vw 自适应），并自动记忆用户偏好宽度，长段落与对照阅读更舒畅。
- **视口虚拟化极速渲染**：采用 `IntersectionObserver` 视口监听，移出可视区域的页面自动销毁 Canvas 并释放 GPU 显存，千页长文档极速翻阅不卡顿。

### 4. 极致轻量化与低内存驻留
- **MV3 事件驱动**：采用 Manifest V3 Service Worker 架构，后台无任何轮询定时器，无调用时自动休眠，常驻后台内存为 0。
- **Shadow DOM 封闭容器**：网页划词浮层基于原生 Web Components + Shadow DOM 封装，与宿主网页样式完全解耦，绝不污染页面排版；未划词或失焦后即刻隐藏并销毁临时状态，零内存泄漏。
- **纯原生微型产物**：无 React/Vue 等前端框架负担，构建后后台代码仅约 13 KB，界面加载毫秒级响应。

### 5. 零泄露风险的隐私与安全防护
- **端到端直连官方**：无任何自建中间人服务器，无任何行为埋点或数据收集。所有翻译网络请求均直接由用户本地 Chrome 发起至各大 AI 官方开放平台。
- **本地沙盒隔离存储**：所有 API Key 均严格存储在浏览器受保护的沙盒存储空间（`chrome.storage.local`），绝不上云。
- **UI 密码遮罩防窥**：全站所有 API Key 输入框均采用 `type="password"` 密码掩码，防止屏幕共享、录屏或物理窥屏。
- **Git 严密忽略规则**：`.gitignore` 全量屏蔽 `.env*`、`*.key`、`*secret*`、`*credential*`、`key.json` 及生产构建产物，源码无任何硬编码测试私钥。

---

## 安装与使用

### 从源码编译安装

1. **克隆仓库**
   ```bash
   git clone https://github.com/GeoffLeng/Translation-Tools.git
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

## 项目目录结构

```text
Translation-Tools/
├── dist/                  # 编译打包输出目录
├── icons/                 # 扩展图标资源
├── src/                   # 源代码
│   ├── background.js      # 后台服务脚本 (API 调度、鉴权与右键菜单)
│   ├── content.js         # 网页内容注入脚本 (Shadow DOM 划词浮层与交互)
│   ├── options.js         # 设置页交互逻辑 (引擎过滤、模型选择与参数持久化)
│   ├── pdf_viewer.js      # PDF 阅读器 (虚拟化视口渲染与双栏对照翻译)
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
├── PROBLEM_SOLVING_TRACKER.md # 缺陷排查、技术方案与工程演进追踪档案
├── README.md              # 英文说明文档 (默认)
└── README.zh-CN.md        # 中文说明文档
```

---

## 常用命令

| 命令 | 说明 |
| :--- | :--- |
| `npm run dev` | 启动本地开发服务 |
| `npm run build` | 编译打包全量扩展产物至 `dist/` |

---

## 开源许可证

本项目基于 [MIT License](LICENSE) 开源。
