/**
 * ChatView 业务逻辑 hook：
 * - 加载当前会话 + 消息流
 * - 处理发送 / 重新生成 / 编辑 / 删除 / 停止
 * - 流式增量状态（streamedText / pending / streaming / error）
 * - 自动滚动
 *
 * 之所以抽出来：让 ChatView 组件只负责"渲染"，业务逻辑可单测。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  conversationRepo,
  messageRepo,
  providerRepo,
} from '@/db';
import type { Conversation, Message, Provider } from '@/types';
import { dispatchChat } from '@/services/adapters';
import { useLockStore } from '@/store/lockStore';
import { toast } from '@/store/toastStore';
import type { TransientChatMessage } from '@/types';

export interface UseChatResult {
  // 数据
  conversation: Conversation | undefined;
  messages: Message[] | undefined;
  activeProvider: Provider | undefined;
  activeModel: string | undefined;

  // 流式状态
  streaming: boolean;
  pending: boolean;
  streamedText: string;
  error: string | null;

  // DOM ref
  scrollRef: React.RefObject<HTMLDivElement>;
  autoScroll: boolean;
  unreadCount: number;
  setAutoScroll: (v: boolean) => void;

  // 操作
  send: (text: string, attachments?: import('@/services/image').Attachment[]) => Promise<void>;
  stop: () => void;
  regenerate: (assistantMsgId: string) => Promise<void>;
  editMessage: (id: string, newContent: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  exportMarkdown: () => Promise<void>;
}

/**
 * 处理一次聊天上下文构造：把当前消息流 + 多模态 content 转成可发给 API 的 messages。
 * 抽出来便于测试。
 */
function buildCtx(
  all: Message[],
  finalUserContent: TransientChatMessage['content'],
): TransientChatMessage[] {
  return all
    .filter((m) => m.role !== 'system')
    .map((m, idx, arr) => {
      const isLastUser = m.role === 'user' && idx === arr.length - 2;
      if (isLastUser && Array.isArray(finalUserContent)) {
        return { role: m.role, content: finalUserContent };
      }
      return { role: m.role as 'user' | 'assistant', content: m.content };
    });
}

/** 标题自动命名：取首条用户消息文本（或首附件名） */
function titleSeed(
  text: string,
  atts: import('@/services/image').Attachment[],
): string {
  if (text) return text;
  if (atts.length) {
    return `${atts[0].name}${atts.length > 1 ? ` 等 ${atts.length} 项` : ''}`;
  }
  return '新会话';
}

export function useChat(conversationId: string | undefined): UseChatResult {
  const conversation = useLiveQuery(
    () =>
      conversationId
        ? conversationRepo.get(conversationId)
        : Promise.resolve(undefined),
    [conversationId],
  );

  const messages = useLiveQuery(
    () =>
      conversationId
        ? messageRepo.listByConversation(conversationId)
        : Promise.resolve([] as Message[]),
    [conversationId],
  );

  // 锁状态变化时强制重读 provider
  const lockUnlocked = useLockStore((s) => s.unlocked);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setTick((t) => t + 1);
  }, [lockUnlocked]);
  const providersReloaded = useLiveQuery(
    async () => {
      void tick; // 依赖 tick 触发
      return providerRepo.list();
    },
    [tick],
  );
  const providers = providersReloaded;

  const [streaming, setStreaming] = useState(false);
  const [pending, setPending] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeProvider: Provider | undefined = useMemo(() => {
    if (!conversation?.providerId || !providers) return undefined;
    return providers.find((p) => p.id === conversation.providerId);
  }, [conversation?.providerId, providers]);

  const activeModel = conversation?.model || activeProvider?.models?.[0];

  // 切换会话时清理
  useEffect(() => {
    setStreamedText('');
    setError(null);
    setPending(false);
    abortRef.current?.abort();
    setStreaming(false);
  }, [conversationId]);

  // 收到 stream 时自动滚动
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setUnreadCount(0);
    }
  }, [messages?.length, streamedText, autoScroll]);

  // 不在 autoScroll 时累加未读数
  useEffect(() => {
    if (!autoScroll && messages && messages.length > 0) {
      setUnreadCount((c) => c + 1);
    }
  }, [messages?.length]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback<UseChatResult['send']>(
    async (text, attachments) => {
      if (streaming) return; // BUG-005: 防并发
      if (!conversation || !activeProvider || !activeModel) {
        setError('请先在设置中配置 Provider 与模型');
        return;
      }
      setError(null);
      setPending(false);
      setStreamedText('');
      setAutoScroll(true);

      const atts = attachments ?? [];

      // 文本块：附件中的文本内容直接内联（含用户输入）
      const textBlocks: { type: 'text'; text: string }[] = [];
      if (text) textBlocks.push({ type: 'text', text });
      for (const a of atts) {
        if (a.kind === 'text' && a.textContent) {
          textBlocks.push({
            type: 'text',
            text: `\n\n[文件附件 ${a.name}]\n\`\`\`\n${a.textContent}\n\`\`\``,
          });
        }
      }

      // 图片块：图片 + PDF 都走 image_url / image.source / inline_data 协议
      const imageBlocks = atts
        .filter(
          (a): a is typeof a & { dataUrl: string } =>
            (a.kind === 'image' || a.kind === 'pdf') &&
            typeof a.dataUrl === 'string',
        )
        .map((a) => ({
          type: 'image_url' as const,
          image_url: { url: a.dataUrl },
        }));

      const userContent:
        | string
        | Array<
            | { type: 'text'; text: string }
            | { type: 'image_url'; image_url: { url: string } }
          > =
        imageBlocks.length + textBlocks.length > 0
          ? [...textBlocks, ...imageBlocks]
          : text;

      const attachmentMetas = atts.map((a) => ({ ...a.meta, id: a.id }));
      const userMsg: Message = {
        id: nanoid(),
        conversationId: conversation.id,
        role: 'user',
        content: text,
        createdAt: Date.now(),
        hasAttachments: atts.length > 0,
        attachments: atts.length > 0 ? attachmentMetas : undefined,
      };
      await messageRepo.add(userMsg);

      const assistantId = nanoid();
      const assistantPlaceholder: Message = {
        id: assistantId,
        conversationId: conversation.id,
        role: 'assistant',
        content: '',
        createdAt: Date.now() + 1,
      };
      await messageRepo.add(assistantPlaceholder);

      const all = await messageRepo.listByConversation(conversation.id);
      const ctx = buildCtx(all, userContent);

      const seed = titleSeed(text, atts);
      if (conversation.title === '新会话' && ctx.length === 1) {
        await conversationRepo.update(conversation.id, {
          title: seed.slice(0, 30),
        });
      } else {
        await conversationRepo.touch(conversation.id);
      }

      const ac = new AbortController();
      abortRef.current = ac;
      setStreaming(true);
      setPending(true);

      let acc = '';
      try {
        await dispatchChat(activeProvider, {
          model: activeModel,
          messages: ctx,
          systemPrompt: conversation.systemPrompt,
          params: conversation.params,
          signal: ac.signal,
          onDelta: (delta) => {
            acc += delta;
            setStreamedText(acc);
            setPending(false);
          },
        });
        await messageRepo.update(assistantId, { content: acc });
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          if (acc) await messageRepo.update(assistantId, { content: acc });
        } else {
          const msg = err?.message || String(err);
          setError(msg);
          // 同时弹 toast：方便用户切到别的页面也能看到
          // 推断错误类型给出更友好的提示
          const isNetwork = /fetch|network|timeout|cors/i.test(msg);
          const hint = isNetwork
            ? `${msg}\n\n提示：可能是网络/CORS 问题，可考虑使用支持 CORS 的中转服务（如 OpenRouter）或本地 Ollama。`
            : msg;
          toast.error(`请求失败：${hint}`, 6000);
          await messageRepo.update(assistantId, {
            content: `⚠️ 出错了：${msg}`,
          });
        }
      } finally {
        setStreaming(false);
        setPending(false);
        setStreamedText('');
        abortRef.current = null;
      }
    },
    [streaming, conversation, activeProvider, activeModel],
  );

  const regenerate = useCallback<UseChatResult['regenerate']>(
    async (assistantMsgId) => {
      if (!conversation || !activeProvider || !activeModel || streaming) return;
      const all = await messageRepo.listByConversation(conversation.id);
      const idx = all.findIndex((m) => m.id === assistantMsgId);
      if (idx < 1) return;
      const userMsg = all[idx - 1];

      // 阅后即焚检查由 ChatView 层做（弹 confirmDialog），这里只负责执行
      // 跳过该检查的实际逻辑在 ChatView 的 handleRegenerate 调用前
      // （保持 hook 无 UI 依赖）
      void userMsg;

      await messageRepo.deleteAfter(conversation.id, all[idx].createdAt);
      const ctx = all
        .slice(0, idx)
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      setError(null);
      setPending(false);
      setStreamedText('');

      const ac = new AbortController();
      abortRef.current = ac;
      setStreaming(true);
      setPending(true);

      let acc = '';
      try {
        await dispatchChat(activeProvider, {
          model: activeModel,
          messages: ctx,
          systemPrompt: conversation.systemPrompt,
          params: conversation.params,
          signal: ac.signal,
          onDelta: (delta) => {
            acc += delta;
            setStreamedText(acc);
            setPending(false);
          },
        });
        const newAssistant: Message = {
          id: nanoid(),
          conversationId: conversation.id,
          role: 'assistant',
          content: acc,
          createdAt: Date.now(),
        };
        await messageRepo.add(newAssistant);
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setError(err?.message || String(err));
        }
      } finally {
        setStreaming(false);
        setPending(false);
        setStreamedText('');
        abortRef.current = null;
      }
    },
    [streaming, conversation, activeProvider, activeModel],
  );

  const editMessage = useCallback<UseChatResult['editMessage']>(
    async (id, newContent) => {
      if (streaming || !conversation || !activeProvider || !activeModel) return;
      if (!newContent.trim()) return;
      const all = await messageRepo.listByConversation(conversation.id);
      const idx = all.findIndex((m) => m.id === id);
      if (idx < 0) return;
      const targetMsg = all[idx];
      if (targetMsg.role !== 'user') return;

      await messageRepo.update(id, { content: newContent });
      if (idx + 1 < all.length) {
        await messageRepo.deleteAfter(conversation.id, all[idx + 1].createdAt);
      }
      await conversationRepo.touch(conversation.id);

      const updatedAll = await messageRepo.listByConversation(conversation.id);
      const ctx = updatedAll
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const assistantId = nanoid();
      await messageRepo.add({
        id: assistantId,
        conversationId: conversation.id,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
      });

      setError(null);
      setPending(false);
      setStreamedText('');
      setAutoScroll(true);

      const ac = new AbortController();
      abortRef.current = ac;
      setStreaming(true);
      setPending(true);
      let acc = '';
      try {
        await dispatchChat(activeProvider, {
          model: activeModel,
          messages: ctx,
          systemPrompt: conversation.systemPrompt,
          params: conversation.params,
          signal: ac.signal,
          onDelta: (delta) => {
            acc += delta;
            setStreamedText(acc);
            setPending(false);
          },
        });
        await messageRepo.update(assistantId, { content: acc });
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setError(err?.message || String(err));
          await messageRepo.update(assistantId, {
            content: `⚠️ 出错了：${err?.message || err}`,
          });
        }
      } finally {
        setStreaming(false);
        setPending(false);
        setStreamedText('');
        abortRef.current = null;
      }
    },
    [streaming, conversation, activeProvider, activeModel],
  );

  const deleteMessage = useCallback<UseChatResult['deleteMessage']>(
    async (id) => {
      if (streaming) return;
      await messageRepo.delete(id);
    },
    [streaming],
  );

  const exportMarkdown = useCallback(async () => {
    // 用动态 import 避免循环依赖 + 减少初始包体
    const { exportConversationAsMarkdown, downloadMarkdown } = await import(
      '@/services/exportMarkdown'
    );
    if (!conversation?.id) return;
    const md = await exportConversationAsMarkdown(conversation.id);
    const name = (conversation.title || '新会话').replace(/[/\\?%*:|"<>]/g, '_');
    downloadMarkdown(md, `${name}-${new Date().toISOString().slice(0, 10)}.md`);
  }, [conversation?.id, conversation?.title]);

  return {
    conversation,
    messages,
    activeProvider,
    activeModel,
    streaming,
    pending,
    streamedText,
    error,
    scrollRef,
    autoScroll,
    unreadCount,
    setAutoScroll,
    send,
    stop,
    regenerate,
    editMessage,
    deleteMessage,
    exportMarkdown,
  };
}
