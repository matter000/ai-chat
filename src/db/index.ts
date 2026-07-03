import Dexie, { type EntityTable } from 'dexie';
import type { Conversation, Message, Provider, PromptTemplate } from '@/types';
import type { UserProfile } from '@/store/userStore';
import {
  encryptApiKey,
  decryptApiKey,
  isEncryptionEnabled,
} from '@/services/crypto';
import { seedBuiltinPrompts } from '@/services/promptSeed';

// IndexedDB 数据库
class ChatDB extends Dexie {
  conversations!: EntityTable<Conversation, 'id'>;
  messages!: EntityTable<Message, 'id'>;
  providers!: EntityTable<Provider, 'id'>;
  promptTemplates!: EntityTable<PromptTemplate, 'id'>;
  users!: EntityTable<UserProfile, 'id'>;

  constructor() {
    super('ai-chat-db');
    // v1
    this.version(1).stores({
      conversations: 'id, updatedAt, pinned, providerId',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      providers: 'id, name, enabled',
    });
    // v2: promptTemplates
    this.version(2).stores({
      conversations: 'id, updatedAt, pinned, providerId',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      providers: 'id, name, enabled',
      promptTemplates: 'id, command, category, builtin, enabled, createdAt',
    });
    // v3: users
    this.version(3).stores({
      conversations: 'id, updatedAt, pinned, providerId',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      providers: 'id, name, enabled',
      promptTemplates: 'id, command, category, builtin, enabled, createdAt',
      users: 'id, email, createdAt',
    });
  }
}

export const db = new ChatDB();

// 首次启动注入内置模板（幂等）
seedBuiltinPrompts(db);

// ===== Conversations =====
export const conversationRepo = {
  async list() {
    return db.conversations.orderBy('updatedAt').reverse().toArray();
  },
  async get(id: string) {
    return db.conversations.get(id);
  },
  async create(c: Conversation) {
    await db.conversations.put(c);
    return c;
  },
  async update(id: string, patch: Partial<Conversation>) {
    await db.conversations.update(id, { ...patch, updatedAt: Date.now() });
  },
  async touch(id: string) {
    await db.conversations.update(id, { updatedAt: Date.now() });
  },
  async rename(id: string, title: string) {
    const t = title.trim() || '新会话';
    await db.conversations.update(id, { title: t, updatedAt: Date.now() });
  },
  async delete(id: string) {
    await db.transaction('rw', db.conversations, db.messages, async () => {
      await db.conversations.delete(id);
      await db.messages.where('conversationId').equals(id).delete();
    });
  },
  async clear() {
    await db.transaction('rw', db.conversations, db.messages, async () => {
      await db.conversations.clear();
      await db.messages.clear();
    });
  },
};

// ===== Messages =====
export const messageRepo = {
  async listByConversation(conversationId: string) {
    return db.messages
      .where('conversationId')
      .equals(conversationId)
      .sortBy('createdAt');
  },
  async add(m: Message) {
    await db.messages.put(m);
    return m;
  },
  async update(id: string, patch: Partial<Message>) {
    await db.messages.update(id, patch);
  },
  async delete(id: string) {
    await db.messages.delete(id);
  },
  async deleteAfter(conversationId: string, createdAt: number) {
    const items = await db.messages
      .where('conversationId')
      .equals(conversationId)
      .and((m) => m.createdAt >= createdAt)
      .toArray();
    await db.messages.bulkDelete(items.map((m) => m.id));
  },
};

// ===== Providers =====
// 入库前对 apiKey 自动加密（如果启用加密）；读取时按需解密。

async function encryptIfNeeded(p: Provider): Promise<Provider> {
  if (!p.apiKey) return p;
  if (!isEncryptionEnabled()) return p;
  if (p.apiKey.startsWith('enc:')) return p; // 已经是密文
  return { ...p, apiKey: await encryptApiKey(p.apiKey) };
}

async function decryptIfNeeded(p: Provider): Promise<Provider> {
  if (!p.apiKey) return p;
  if (!p.apiKey.startsWith('enc:')) return p;
  try {
    const plain = await decryptApiKey(p.apiKey);
    return { ...p, apiKey: plain };
  } catch {
    return { ...p, apiKey: '' }; // 解密失败（未解锁或密码错）
  }
}

export const providerRepo = {
  /** 存储：列表读取返回解密后的明文（供 UI 使用） */
  async list() {
    const items = await db.providers.toArray();
    return Promise.all(items.map(decryptIfNeeded));
  },
  /** 存储：单条返回解密后的明文 */
  async get(id: string) {
    const p = await db.providers.get(id);
    if (!p) return undefined;
    return decryptIfNeeded(p);
  },
  /** 写入：保存前自动加密 apiKey */
  async upsert(p: Provider) {
    const stored = await encryptIfNeeded(p);
    await db.providers.put(stored);
    return decryptIfNeeded(stored);
  },
  /** 删除 */
  async delete(id: string) {
    await db.providers.delete(id);
  },
  /** 批量加密现有明文（供一次性迁移） */
  async encryptAllPlaintext(): Promise<number> {
    if (!isEncryptionEnabled()) return 0;
    const items = await db.providers.toArray();
    let count = 0;
    await db.transaction('rw', db.providers, async () => {
      for (const p of items) {
        if (p.apiKey && !p.apiKey.startsWith('enc:')) {
          const ct = await encryptApiKey(p.apiKey);
          await db.providers.update(p.id, { apiKey: ct });
          count++;
        }
      }
    });
    return count;
  },
};

// ===== Prompt Templates =====
export const promptRepo = {
  async list() {
    return db.promptTemplates.toArray();
  },
  async get(id: string) {
    return db.promptTemplates.get(id);
  },
  async upsert(t: PromptTemplate) {
    await db.promptTemplates.put(t);
    return t;
  },
  async delete(id: string) {
    await db.promptTemplates.delete(id);
  },
  async setEnabled(id: string, enabled: boolean) {
    await db.promptTemplates.update(id, { enabled });
  },
};

// ===== Users =====
export const userRepo = {
  async list() {
    return db.users.toArray();
  },
  async get(id: string) {
    return db.users.get(id);
  },
  async findByEmail(email: string) {
    return db.users.where('email').equals(email).first();
  },
  async upsert(u: UserProfile) {
    await db.users.put(u);
    return u;
  },
  async delete(id: string) {
    await db.users.delete(id);
  },
};

// 全量导出 / 导入
export type ExportedData = Awaited<ReturnType<typeof exportAll>>;

export async function exportAll() {
  const [conversations, messages, providersRaw] = await Promise.all([
    db.conversations.toArray(),
    db.messages.toArray(),
    db.providers.toArray(),
  ]);
  // 导出时对 apiKey 做轻度遮罩，避免意外泄露（密文也遮罩）
  const safeProviders = providersRaw.map((p) => ({
    ...p,
    apiKey: p.apiKey
      ? p.apiKey.startsWith('enc:')
        ? '(已加密的 API Key)'
        : `${p.apiKey.slice(0, 4)}****${p.apiKey.slice(-4)}`
      : '',
  }));
  return {
    version: 1,
    exportedAt: Date.now(),
    conversations,
    messages,
    providers: safeProviders,
  };
}

export async function importAll(data: ExportedData) {
  if (!data || data.version !== 1) throw new Error('不支持的备份版本');
  await db.transaction('rw', db.conversations, db.messages, db.providers, async () => {
    await db.conversations.clear();
    await db.messages.clear();
    await db.providers.clear();
    if (data.conversations?.length) await db.conversations.bulkPut(data.conversations);
    if (data.messages?.length) await db.messages.bulkPut(data.messages);
    if (data.providers?.length) {
      const items = data.providers.map((p: Provider) => ({ ...p, apiKey: '' }));
      await db.providers.bulkPut(items);
    }
  });
}