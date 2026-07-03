# AI 聊天网站项目设计文档

> 类 Chatbox 的网页端 AI 聊天应用，用户使用自己的 API Key 调用各大模型厂商的大模型进行对话，所有数据存储在浏览器本地。

---

## 一、项目概述

### 1.1 项目目标
构建一个轻量、隐私优先的网页端 AI 聊天应用，用户无需注册登录，只需配置自己的 API Key 即可与各大模型厂商（OpenAI、Anthropic、Google、DeepSeek、通义千问、智谱等）的大模型对话。所有聊天记录、设置数据全部存储在浏览器本地（IndexedDB / localStorage），不上传任何服务器。

### 1.2 核心定位
- **隐私优先**：零后端、零数据收集，API Key 与聊天内容只存在用户本地。
- **多厂商支持**：统一抽象多家 AI 厂商的 API 差异。
- **开箱即用**：纯前端部署（可托管在 GitHub Pages / Vercel / 任意静态服务器）。
- **可移植**：支持导出 / 导入全部数据。

### 1.3 关键技术决策（已确认）

| 决策项 | 结论 | 说明 |
|--------|------|------|
| 前端框架 | **React 18 + TypeScript + Vite** | 搭配 Tailwind + shadcn/ui |
| 首期范围 | **MVP 单厂商（OpenAI 兼容协议）** | 先跑通核心闭环，多厂商适配移到二期 |
| 部署形态 | **纯前端，零后端** | 浏览器直连厂商 API，仅静态托管 |
| CORS 处理 | **不做代理，文档说明限制** | 仅支持允许 CORS 的厂商 / 中转地址（见 §8） |

> 因 MVP 锁定 OpenAI 兼容协议，**DeepSeek、Moonshot (Kimi)、智谱 GLM、硅基流动、通义千问（兼容模式）、百度千帆、字节豆包、讯飞星火、腾讯混元、MiniMax、OpenRouter、本地 Ollama** 等国内主流厂商在 MVP 阶段即可直接接入，覆盖面很广。Anthropic / Gemini 等非兼容协议厂商留待二期。

> 已内置上述厂商的 Base URL / 默认模型 / CORS 提示预设（在"设置 → Provider 管理"或首次进入引导页可见），点一下即可填好。

### 1.4 与 Chatbox 的区别
| 特性 | Chatbox | 本项目 |
|------|---------|--------|
| 形态 | 桌面 / 移动客户端 | 纯 Web 应用 |
| 部署 | 安装包 | 静态托管，免安装 |
| 数据存储 | 本地文件 / IndexedDB | 浏览器本地（IndexedDB） |
| 跨设备 | 需手动同步 | 浏览器内（可扩展 WebDAV 同步） |

---

## 二、技术栈选型

### 2.1 推荐技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 框架 | **React 18 + TypeScript** | 生态成熟，类型安全 |
| 构建 | **Vite** | 极速冷启动与 HMR |
| 状态管理 | **Zustand** | 轻量，API 友好 |
| 路由 | React Router v6 | 多页面切换 |
| UI 组件 | **Tailwind CSS + shadcn/ui** | 原子化 CSS + 可定制组件 |
| Markdown 渲染 | react-markdown + remark-gfm + rehype-highlight | 支持 GFM 与代码高亮 |
| 公式渲染 | KaTeX (rehype-katex) | LaTeX 公式 |
| 本地存储 | **Dexie.js (IndexedDB 封装)** | 处理大量聊天数据 |
| 流式请求 | Fetch API + ReadableStream | 实现 SSE 流式输出 |
| 图标 | lucide-react | 现代图标库 |
| 国际化 | i18next | 中英文支持 |

### 2.2 为什么不用 Next.js？
本项目是纯前端应用，无需 SSR / 服务端 API 路由（API Key 直连厂商，不经我们的服务器）。Vite + React 更轻量，部署更简单（单静态站点即可）。

### 2.3 备选方案
- 如果追求更小体积：Vue 3 + Vite + Pinia。
- 如果需要桌面化：后期可用 Tauri / Electron 套壳。

---

## 三、功能需求

### 3.1 核心功能（MVP）

#### 3.1.1 模型与 Provider 管理
- 内置常见 Provider 模板：OpenAI、Anthropic、Google Gemini、DeepSeek、Moonshot、通义千问、智谱 GLM、硅基流动、Ollama（本地）等。
- 每个 Provider 可配置：
  - 名称
  - API Base URL（可自定义，兼容代理 / 中转）
  - API Key（本地加密存储）
  - 可用模型列表（可手动增删、或从 API 拉取）
- 支持自定义 Provider（兼容任意 OpenAI 协议兼容的接口）。

#### 3.1.2 对话管理
- 多会话（Session / Conversation）：新建、重命名、删除、置顶、分组（文件夹）。
- 会话内多轮消息，支持编辑、重新生成、复制、删除单条消息。
- 上下文长度可控（可设置携带最近 N 条 / Token 截断）。
- 草稿自动保存。

#### 3.1.3 消息交互
- **流式输出**（SSE 打字机效果）。
- Markdown 渲染：标题、列表、表格、代码块（高亮 + 一键复制）。
- 数学公式（LaTeX）。
- 支持发送图片（视觉模型，多模态）。
- 支持发送文件 / 文本片段作为上下文。
- 停止生成、重新生成、继续生成。
- Token 用量与耗时显示。

#### 3.1.4 Prompt 与预设
- 系统提示词（System Prompt）每个会话可独立设置。
- 内置 / 自定义 Prompt 模板库（角色扮演、翻译、总结等）。
- 快捷变量（如 {{date}}、{{input}}）。

#### 3.1.5 参数调节
- temperature、top_p、max_tokens、presence_penalty、frequency_penalty。
- 每个会话可单独配置，也可设全局默认。

#### 3.1.6 数据管理
- 导出：单个会话 / 全部数据（JSON / Markdown）。
- 导入：从 JSON 恢复。
- 清空数据。
- 浏览器内搜索（全文搜索历史消息）。

### 3.2 增强功能（二期）

- **WebDAV / 云盘同步**：把本地数据同步到坚果云、Nextcloud 等，实现多设备同步（仍是端到端用户自有存储）。
- **对话分支与版本**：消息树状结构（类似 ChatGPT 的分支切换）。
- **快捷指令 / 斜杠命令**：输入 `/` 唤起 Prompt 与操作。
- **伪插件系统**：可定义"快捷动作"（选中文字 → 调用某 Prompt）。
- **TTS / 语音输入**：浏览器 Web Speech API。
- **PWA**：可安装到桌面，离线可用。
- **主题**：明暗主题 + 自定义配色 + 代码主题。
- **Token 计费统计**：累计统计本次 API 花费估算。
- **多 Key 轮询 / 负载均衡**：同一 Provider 配置多个 Key。

### 3.3 非功能需求

| 维度 | 要求 |
|------|------|
| 性能 | 首屏 < 2s；流式首字延迟 < 800ms |
| 隐私 | API Key 加密存储；无任何埋点上报 |
| 兼容性 | Chromium / Firefox / Safari 最新版 |
| 可访问性 | 键盘快捷键、合理的 ARIA 标签 |
| 体积 | 首包 gzipped < 300KB（不含懒加载） |

---

## 四、系统架构

### 4.1 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                       浏览器 (前端)                         │
│  ┌────────────┐   ┌────────────┐   ┌──────────────────┐  │
│  │   UI 层     │──▶│  状态层     │──▶│   数据层          │  │
│  │ React 组件 │   │  Zustand   │   │ Dexie/IndexedDB  │  │
│  └────────────┘   └─────┬──────┘   └──────────────────┘  │
│                         │                                  │
│                  ┌──────▼───────┐                          │
│                  │ Provider 抽象 │                          │
│                  │   Adapter    │                          │
│                  └──────┬───────┘                          │
└─────────────────────────┼──────────────────────────────────┘
                          │ HTTPS (用户自己的 API Key)
                          ▼
              ┌────────────────────────┐
              │  各 AI 厂商 API 服务    │
              │ OpenAI / Claude / ...  │
              └────────────────────────┘
```

**关键点**：本项目**没有自己的后端**，浏览器直接请求厂商 API。所有数据流均发生在用户设备与厂商之间。

### 4.2 分层职责

| 层 | 职责 |
|----|------|
| **UI 层** | 页面渲染、用户交互、流式渲染 |
| **State 层** | 全局状态（当前会话、设置、Provider 列表） |
| **Service 层** | Provider 适配器、流式请求、消息构建 |
| **Storage 层** | IndexedDB 增删改查、加密、导入导出 |
| **Provider Adapter** | 统一不同厂商的请求/响应格式 |

### 4.3 Provider 适配器设计

为屏蔽厂商差异，抽象统一接口：

```typescript
interface ChatAdapter {
  name: string;
  // 把统一消息格式转换为厂商请求体
  buildRequest(params: ChatParams): RequestInit;
  // 解析厂商的流式 / 非流式响应
  parseStreamChunk(chunk: string): StreamDelta;
  parseResponse(data: any): ChatResult;
  // 从厂商 API 拉取可用模型
  fetchModels?(config: ProviderConfig): Promise<string[]>;
}
```

实现示例：
- `OpenAIAdapter`（同时兼容 DeepSeek、Moonshot、硅基流动、本地 Ollama 等 OpenAI 协议厂商）
- `AnthropicAdapter`
- `GeminiAdapter`
- `CustomAdapter`（用户自定义请求模板）

> 大多数国内外厂商都兼容 OpenAI 协议，因此 `OpenAIAdapter` 可覆盖 80% 场景，显著降低适配成本。

### 4.4 数据存储设计

使用 Dexie (IndexedDB) 存储结构化数据，localStorage 存少量设置。

**表结构：**

```typescript
// 会话表
interface Conversation {
  id: string;            // uuid
  title: string;
  folderId?: string;
  providerId: string;
  model: string;
  systemPrompt?: string;
  params: ModelParams;   // temperature 等
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
}

// 消息表（与会话 1:N）
interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];     // base64 / blob url
  createdAt: number;
  tokens?: number;
  // 分支支持可加 parentId
}

// Provider 配置表
interface Provider {
  id: string;
  name: string;
  type: AdapterType;     // 'openai' | 'anthropic' | 'gemini' | 'custom'
  baseUrl: string;
  apiKey: string;        // 加密存储
  models: string[];
  enabled: boolean;
}

// 文件夹
interface Folder {
  id: string;
  name: string;
  order: number;
}

// Prompt 模板
interface PromptTemplate {
  id: string;
  title: string;
  content: string;
  builtin?: boolean;
}
```

**索引设计**：`Message` 按 `conversationId` 建索引，`Conversation` 按 `updatedAt` 排序，支持全文搜索（可在 content 上建索引 + 内存倒排）。

**API Key 安全**：
- 使用 Web Crypto API（AES-GCM）加密后存入 IndexedDB。
- 加密密钥由用户可选设置的"主密码"派生（PBKDF2），或使用浏览器绑定的密钥。
- 界面显示时掩码（`sk-****1234`）。

### 4.5 流式请求实现

利用 `fetch` + `ReadableStream` 读取 SSE 流：

```typescript
async function streamChat(req: RequestInit, onDelta: (text: string) => void) {
  const res = await fetch(url, req);
  if (!res.ok) throw await buildError(res);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // 按 SSE 事件分隔
    const lines = buffer.split('\n');
    buffer = lines.pop()!; // 保留不完整行
    for (const line of lines) {
      const delta = adapter.parseStreamChunk(line);
      if (delta?.content) onDelta(delta.content);
    }
  }
}
```

支持 `AbortController` 实现"停止生成"。

---

## 五、界面设计

### 5.1 整体布局（三栏式）

```
┌──────────┬─────────────────────────────────┬──────────┐
│          │        顶部栏                    │          │
│  会话    │  [模型选择 ▼]  [设置]  [主题]    │   设置   │
│  列表    ├─────────────────────────────────┤   抽屉   │
│          │                                 │  (滑出)  │
│ + 新建   │                                 │          │
│ ───────  │        消息流（渲染区）           │  会话参数│
│ 📌 会话1 │   user: ...                     │  模型参数│
│   会话2  │   assistant: ...(流式)           │  系统提示│
│   会话3  │                                 │          │
│          │                                 │          │
│ 📁 文件夹│                                 │          │
│          ├─────────────────────────────────┤          │
│ ⚙ 设置   │  [输入框]              [发送 ➤] │          │
└──────────┴─────────────────────────────────┴──────────┘
```

- **左侧栏**：会话列表、文件夹、新建、搜索、设置入口。可折叠。
- **中间主区**：顶部模型/会话切换 + 消息流 + 输入框。
- **右侧抽屉**：会话级参数（温度、System Prompt 等），按需滑出。

### 5.2 关键页面

1. **首次进入引导页**：欢迎 + "添加你的第一个 Provider" 向导。
2. **设置页**：
   - Provider 管理列表（增删改、测试连接、刷新模型）。
   - 全局默认参数。
   - 外观（主题、语言、字体大小）。
   - 数据（导入 / 导出 / 清空）。
3. **对话主界面**：如上布局。
4. **Prompt 模板库**。

### 5.3 移动端适配
- 左侧栏变为抽屉式（汉堡菜单唤起）。
- 输入框自适应宽度，键盘弹起时界面调整。
- 触摸友好的按钮间距（≥ 44px）。

---

## 六、目录结构（建议）

```
ai-chat/
├── public/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/          # 通用组件
│   │   ├── ui/              # shadcn/ui 基础组件
│   │   ├── chat/            # 聊天相关组件
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageItem.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   └── ModelSelector.tsx
│   │   ├── sidebar/
│   │   └── settings/
│   ├── pages/               # 路由页面
│   ├── store/               # Zustand stores
│   │   ├── chatStore.ts
│   │   ├── settingsStore.ts
│   │   └── providerStore.ts
│   ├── services/            # 业务服务
│   │   ├── adapters/        # Provider 适配器
│   │   │   ├── base.ts
│   │   │   ├── openai.ts
│   │   │   ├── anthropic.ts
│   │   │   └── gemini.ts
│   │   ├── chat.ts          # 流式请求封装
│   │   └── crypto.ts        # API Key 加密
│   ├── db/                  # Dexie 数据层
│   │   ├── index.ts
│   │   ├── conversations.ts
│   │   ├── messages.ts
│   │   └── providers.ts
│   ├── hooks/
│   ├── utils/
│   ├── i18n/
│   ├── types/
│   └── styles/
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 七、开发计划与里程碑

### 阶段 0：项目初始化（0.5 天）
- [ ] Vite + React + TS 脚手架
- [ ] 接入 Tailwind + shadcn/ui
- [ ] 路由、Zustand、Dexie 基础搭建
- [ ] 基础布局骨架

### 阶段 1：MVP 核心（单厂商：OpenAI 兼容协议，3 ~ 5 天）
- [ ] Provider 配置（仅 OpenAI 兼容类型，含自定义 Base URL）
- [ ] Dexie 存储 + CRUD
- [ ] 会话 / 消息管理
- [ ] 流式聊天（OpenAI Adapter）
- [ ] Markdown 渲染 + 代码高亮
- [ ] 基础设置页

### 阶段 2：体验完善（2 ~ 3 天）
- [ ] 多 Adapter（Anthropic / Gemini）
- [ ] 消息编辑、重生成、删除
- [ ] 搜索、文件夹、置顶
- [ ] 导入 / 导出
- [ ] 移动端适配
- [ ] 主题、快捷键、i18n

### 阶段 3：增强（按需）
- [ ] WebDAV 同步
- [ ] 多模态（图片）
- [ ] PWA
- [ ] Prompt 模板库、斜杠命令
- [ ] Token 统计

---

## 八、潜在风险与对策

| 风险 | 说明 | 对策 |
|------|------|------|
| **CORS** | 浏览器直连厂商 API 可能被 CORS 拦截（OpenAI 允许，Anthropic/Gemini 等不允许） | **本项目决策：不提供代理，纯前端**。在 UI 和文档中明确提示：仅支持允许 CORS 的厂商或中转地址（如 OpenAI、OpenRouter、各类兼容协议中转、本地 Ollama）。非兼容厂商的接入放到二期，届时再评估方案 |
| **API Key 泄露** | XSS 可能读取本地数据 | 严格 CSP；API Key 加密；不渲染未转义内容；依赖审计 |
| **存储配额** | IndexedDB 浏览器配额有限（图片多时易满） | 图片压缩；超限提醒；支持清理 / 导出后删除 |
| **厂商协议变更** | API 升级导致适配失效 | Adapter 解耦；版本化；社区贡献新 Adapter |
| **流式兼容** | 各厂商流式格式不同 | Adapter 的 `parseStreamChunk` 隔离差异 |

---

## 九、部署方案

- **静态托管**：构建产物为纯静态文件，部署到：
  - GitHub Pages（免费）
  - Vercel / Netlify / Cloudflare Pages（免费 + CDN）
  - Nginx / 任意静态服务器
- **构建命令**：`npm run build` → `dist/`
- **自定义部署**：提供 Dockerfile（nginx 基础镜像）方便私有部署。

---

## 十、参考资料

- [Chatbox](https://github.com/binhuang/chatbox) — 桌面端参考实现
- [OpenAI API 文档](https://platform.openai.com/docs/api-reference)
- [Anthropic API](https://docs.anthropic.com/)
- [Google Gemini API](https://ai.google.dev/)
- [Dexie.js](https://dexie.org/)
- [shadcn/ui](https://ui.shadcn.com/)

---

## 附录 A：术语表

| 术语 | 含义 |
|------|------|
| Provider | 大模型服务提供方（如 OpenAI） |
| Adapter | 适配器，屏蔽不同厂商 API 差异 |
| Session / Conversation | 一次完整对话会话 |
| System Prompt | 系统提示词，定义 AI 角色 / 行为 |
| SSE | Server-Sent Events，流式传输协议 |
| IndexedDB | 浏览器内置的结构化数据库 |

---

*文档版本：v1.0  ·  创建日期：2026-07-02*
