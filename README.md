# Lite Translate

<p align="right">
  <strong>English</strong> | <a href="README.zh-CN.md">简体中文</a>
</p>

> A minimalist, privacy-first Chrome & Edge extension for selection translation, multi-model AI lookup, and immersive bilingual PDF reading.

---

## Core Features

### 1. Free Translation Channels (No API Key Required)
- **Three Core Channels**:
  - **Google Translate**: Built-in public endpoint, zero configuration, low latency.
  - **Bing Translate**: Microsoft translation network with dynamic token rotation.
  - **DeepL Translate**: Natural, accurate translations supporting official API keys (one-time 1,000,000 character quota) or keyless free access.
- **Automatic Fallback**: Automatically degrades to Google Translate if any selected service encounters network errors.

### 2. AI Translation Matrix
- **Built-in Free AI Models**:
  - **Zhipu GLM (4 / 4.5 / 4.7 Flash Free)**: Completely free official access to `glm-4-flash`, `glm-4.5-flash`, `glm-4.7-flash`, and `glm-4-flashx`. Selection menus exclusively filter and display free models.
- **Custom Model Management**:
  - Connect any OpenAI-compatible provider: **OpenRouter**, **OpenCode**, **SiliconFlow**, **Groq**, **OpenAI**, or local **Ollama** endpoints.
- **Dynamic Model Fetching**: Fetch model lists with a single click after entering an API Key, featuring special highlighting for free models and fuzzy search filtering.
- **Multi-surface Synchronization**: Custom models and active engines automatically sync across the toolbar popup, webpage floating panel, and PDF viewer.

### 3. Smart PDF Reader & Bilingual Translation
- **One-Click Page & Full-Document Translation**: Translate the active page or entire documents with progress bars and cancel controls. Defaults to Google Translate, with easy dropdown switching to Zhipu GLM and other engines.
- **Parallel Bilingual Contrast**: Side-by-side view featuring original PDF pages on the left and responsive translation cards on the right.
- **Layout & Structure Recognition**: Automatically recognizes paragraphs, fixes hyphenated line breaks (e.g., `infor-\nmation`), and detects figure and table captions.
- **Formula Protection Toggle**: Dedicated "Skip Formulas" switch preserves standalone formula blocks and shields inline math symbols via temporary token isolation.
- **Bidirectional Float Resizing**: Floating panel supports left and right edge dragging (280px to 90vw) with persistent width memory.
- **Virtualized Viewport Rendering**: Powered by `IntersectionObserver`, off-screen canvases are unmounted to free GPU memory, allowing smooth navigation across documents with 1,000+ pages.

### 4. Lightweight & Resource Efficiency
- **Manifest V3 Event Driven**: Service worker architecture with zero background polling timers; inactive memory footprint is 0 MB.
- **Isolated Shadow DOM**: Injected translation elements are isolated inside Shadow DOM to avoid host-page CSS conflicts and memory leaks.
- **Native Implementation**: Built with modern vanilla JavaScript without bloated frontend frameworks.

### 5. Privacy & Security
- **Direct Official Communication**: All translation requests are dispatched directly from the local browser to official AI endpoints with no proxy servers.
- **Local Sandbox Storage**: API Keys are saved exclusively inside `chrome.storage.local`.
- **Masked Password Inputs**: Password fields protect sensitive API tokens from shoulder-surfing and screen sharing.

---

## Installation & Setup

### Building from Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/GeoffLeng/Translation-Tools.git
   cd Translation-Tools
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```
   The build script generates the distribution bundle in the `/dist` directory.

4. **Load into browser**
   - Open any Chromium-based browser (Chrome, Edge, Brave, Arc) and navigate to `chrome://extensions/`.
   - Enable **Developer mode** in the top-right corner.
   - Click **Load unpacked** in the top-left corner.
   - Select the **`dist`** folder located in the project root.

---

## Project Structure

```text
Translation-Tools/
├── dist/                  # Compiled production bundle
├── icons/                 # Extension icon assets
├── src/                   # Source files
│   ├── background.js      # Background service worker (API dispatch, auth, context menus)
│   ├── content.js         # Webpage content script (Shadow DOM selection panel)
│   ├── options.js         # Options page logic (engine config, model filtering)
│   ├── pdf_viewer.js      # PDF reader (virtualized rendering & bilingual contrast)
│   ├── popup.js           # Toolbar popup logic (quick translation & sync)
│   └── styles/            # Stylesheets (options.css, pdf_viewer.css, popup.css)
├── build.js               # Lightweight Vite-based automated build pipeline
├── manifest.json          # Chrome Extension Manifest V3 configuration
├── options.html           # Settings page HTML
├── popup.html             # Extension popup panel HTML
├── pdf_viewer.html        # PDF reader entry HTML
├── package.json           # Project dependencies and script commands
├── .gitignore             # Git ignore rules
├── .gitattributes         # Git line ending configuration
├── LICENSE                # MIT License
├── README.md              # English documentation (Default)
└── README.zh-CN.md        # Simplified Chinese documentation
```

---

## Available Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start local development server |
| `npm run build` | Build production extension bundle into `dist/` |

---

## License

This project is licensed under the [MIT License](LICENSE).
