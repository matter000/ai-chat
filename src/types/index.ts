// 通用类型定义

export type Role = 'system' | 'user' | 'assistant';

export type AdapterType = 'openai-compatible' | 'anthropic' | 'gemini';

export interface ModelParams {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}

export interface Provider {
  id: string;
  name: string;
  type: AdapterType;
  baseUrl: string;       // 例如 https://api.openai.com/v1
  apiKey: string;        // MVP 阶段明文存储（仅本地），二期接入加密
  models: string[];      // 用户可手动维护的模型列表
  enabled: boolean;
}

export interface PromptTemplate {
  id: string;
  command: string;          // 唯一斜杠命令前缀（小写）
  title: string;
  description?: string;
  category: '通用' | '写作' | '编程' | '翻译' | '角色' | '自定义';
  content: string;         // 支持 {{input}} / {{date}} / {{time}} / {{lang}}
  builtin: boolean;
  enabled: boolean;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  providerId?: string;
  model?: string;
  systemPrompt?: string;
  params: ModelParams;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  createdAt: number;
  tokens?: number;
  // 历史中"曾经有过附件"的轻量标记（不保存 base64）
  hasAttachments?: boolean;
  attachments?: AttachmentMeta[];
}

// 传输期使用的多模态消息（仅在内存中存在，不入库）
export interface TransientChatMessage {
  role: Role;
  // OpenAI 视觉协议：content 为字符串或内容块数组
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >;
}

// 入库历史中"曾经有过附件"的轻量标记（不存文件内容）
export interface AttachmentMeta {
  id: string;
  name: string;
  kind: 'image' | 'text' | 'pdf';
  size: number;
  mime: string;
}

export interface ChatRequestParams {
  provider: Provider;
  model: string;
  messages: TransientChatMessage[];
  systemPrompt?: string;
  params: ModelParams;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}

export interface ChatResult {
  content: string;
  tokens?: { prompt: number; completion: number; total: number };
}