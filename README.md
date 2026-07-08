# AI Chat

<div align="center">

**纯前端 AI 聊天应用 · 隐私优先 · 支持 15+ 国内外大模型**

[在线体验](https://matter000.github.io/ai-chat/) · [反馈问题](../../issues) · [一键部署](https://github.com/matter000/ai-chat/fork)

</div>

一个类 Chatbox 的纯前端 AI 聊天应用。使用自己的 API Key 调用大模型，所有聊天数据存储在浏览器本地（IndexedDB），不上传任何服务器。

## 🎬 截图

> _这里放置主界面截图。建议跑一下 dev 后截图，丢到 `docs/screenshot.png` 然后在 README 引用。_

## ✨ 功能

- 🔒 **隐私优先**—— 零后端、零埋点，API Key 与聊天记录仅存本地
- 🌐 **多厂商支持**—— DeepSeek / Moonshot (Kimi) / 智谱 GLM / 通义千问 / 硅基流动 / 百度千帆 / 字节豆包 / 讯飞星火 / 腾讯混元 / MiniMax / OpenAI / Anthropic / Google Gemini / OpenRouter / Ollama
- 💬 **流式输出**—— SSE 打字机效果，支持停止 / 重新生成 / 编辑消息
- 🖼️ **多模态**—— 图片 / PDF / 文本文件上传，阅后即焚
- 📝 **Prompt 模板库**—— 10 个内置模板 + 自定义，输入 `/` 唤起
- 🔍 **全局搜索**—— 跨所有会话搜消息内容，点击跳转高亮
- ⌨️ **命令面板**—— ⌘K 唤起，搜索所有功能
- 🔐 **API Key 加密**—— AES-GCM 256 + PBKDF2 主密码保护
- 👤 **用户系统**—— 本地注册/登录，密码哈希存储
- 📊 **Mermaid 图表**—— 渲染流程图/时序图/Gantt 等
- 🌓 **主题切换**—— 浅色 / 深色 / 跟随系统
- 📥 **导入导出**—— JSON 备份 + Markdown 导出
- 📱 **PWA 就绪**—— 可安装到桌面

## 🚀 快速开始

```bash
# 克隆
git clone https://github.com/your-username/ai-chat.git
cd ai-chat

# 安装依赖
npm install

# 启动开发服务器
npm run dev
# 浏览器打开 http://localhost:5173

# 生产构建
npm run build
# 产物在 dist/ 目录，可直接部署到任意静态服务器
```

## 🌍 部署

构建产物为纯静态文件，可部署到：

- **GitHub Pages**—— 免费，直接托管
- **Vercel / Netlify**—— 免费 + CDN
- **Cloudflare Pages**—— 免费 + 全球加速
- **Nginx / 任意静态服务器**—— 一个 `dist/` 目录即可

```bash
npm run build
# 把 dist/ 目录部署到你的服务器
```

## ⌨️ 快捷键

| 快捷键 (Mac) | 快捷键 (Win/Linux) | 功能 |
|-------------|-------------------|------|
| ⌘+K | Ctrl+K | 命令面板 |
| ⌘+Shift+O | Ctrl+Shift+O | 新建会话 |
| ⌘+Shift+F | Ctrl+Shift+F | 全局搜索 |
| ⌘+Shift+K | Ctrl+Shift+K | 聚焦侧栏搜索 |
| ⌘+, | Ctrl+, | 打开设置 |
| ⌘+/ | Ctrl+/ | 打开会话参数 |
| ⌘+Enter | Ctrl+Enter | 发送消息 |
| Esc | Esc | 关闭抽屉/面板 |

## 🛡️ 隐私

- **没有任何后端服务器**—— 浏览器直接调用 API
- **所有数据存本地**—— IndexedDB + localStorage
- **API Key 加密**—— 可选 AES-GCM + 主密码
- **附件阅后即焚**—— 发送后立刻从内存清除
- **导出遮罩**—— 备份文件中 Key 被遮罩处理

## 📁 技术栈

| 层 | 技术 |
|----|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite |
| 样式 | Tailwind CSS |
| 状态 | Zustand |
| 数据库 | Dexie.js（IndexedDB） |
| Markdown | react-markdown + highlight.js + KaTeX |
| 加密 | Web Crypto API（AES-GCM + PBKDF2） |
| 图表 | Mermaid |

## 📖 项目结构

```
src/
├── components/          # UI 组件
│   ├── chat/           # 聊天主区、消息、输入框
│   ├── sidebar/        # 侧栏
│   ├── settings/       # 设置页各面板
│   └── ui/             # 基础组件
├── db/                 # Dexie 数据层
├── services/           # 业务逻辑
│   ├── adapters/       # OpenAI / Anthropic / Gemini
│   └── crypto.ts       # 加密服务
├── store/              # Zustand 状态
├── hooks/              # 自定义 hooks
└── types/              # TypeScript 类型
```

## ⚠️ CORS 注意事项

部分厂商 API 不允许浏览器直连。目前以下厂商已验证可直连：

- ✅ DeepSeek / Moonshot / 智谱 GLM / 硅基流动 / 通义千问 / MiniMax / OpenRouter / Ollama
- ✅ OpenAI / Anthropic / Google Gemini
- ⚠️ 百度千帆 / 字节豆包 / 讯飞星火 / 腾讯混元 —— 可能需要自建代理

## 📝 License

MIT