import { useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { ChevronDown, SlidersHorizontal, Pencil, Check, X, Download } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { conversationRepo, messageRepo, providerRepo } from '@/db';
import type { Conversation, Message, Provider } from '@/types';
import { MessageItem } from './MessageItem';
import { ChatInput } from './ChatInput';
import { ModelSwitcher } from './ModelSwitcher';
import { dispatchChat } from '@/services/adapters';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLockStore } from '@/store/lockStore';
import { exportConversationAsMarkdown, downloadMarkdown } from '@/services/exportMarkdown';
import { useMessageMaxWidth } from '@/hooks/useMessageMaxWidth';
import { confirmDialog } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';

interface Props {
  conversationId?: string;
  onOpenSettings: () => void;
  /** 搜索跳转到的消息 id，传给 MessageItem 做高亮闪烁 */
  highlightMessageId?: string;
}

export function ChatView({ conversationId, onOpenSettings, highlightMessageId }: Props) {
  const conversation = useLiveQuery(
    () => (conversationId ? conversationRepo.get(conversationId) : Promise.resolve(undefined)),
    [conversationId],
  );

  const messages = useLiveQuery(
    () =>
      conversationId ? messageRepo.listByConversation(conversationId) : Promise.resolve([]),
    [conversationId],
  );

  const providers = useLiveQuery(() => providerRepo.list(), []);
  const { width: messageMaxWidth, onMouseDown: onResizeMessage } = useMessageMaxWidth();
  // 解锁状态变化时强制重读
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
  const effectiveProviders = providersReloaded ?? providers;

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleCancelledRef = useRef(false); // BUG-2: Escape 取消标记

  const [streaming, setStreaming] = useState(false);
  const [pending, setPending] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // 滚动到底部
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setUnreadCount(0);
    }
  }, [messages?.length, streamedText, autoScroll]);

  // 未读计数：当不处于 autoScroll 且有新消息时累加（不跟踪流式文本增量）
  useEffect(() => {
    if (!autoScroll && messages && messages.length > 0) {
      setUnreadCount((c) => c + 1);
    }
  }, [messages?.length]);

  // 跳转到某条消息（来自搜索）
  useEffect(() => {
    if (!highlightMessageId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(
      `[data-message-id="${highlightMessageId}"]`,
    ) as HTMLElement | null;
    if (!el) return;
    setAutoScroll(false);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightMessageId, messages?.length]);

  // 切换会话时清理
  useEffect(() => {
    setStreamedText('');
    setError(null);
    setPending(false);
    abortRef.current?.abort();
    setStreaming(false);
  }, [conversationId]);

  // 切换会话时退出编辑态
  useEffect(() => {
    setEditingTitle(false);
  }, [conversationId]);

  // 进入编辑态时聚焦输入框
  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  const startEditTitle = () => {
    if (!conversation) return;
    setTitleDraft(conversation.title);
    setEditingTitle(true);
    titleCancelledRef.current = false;
  };

  const commitTitle = async () => {
    if (!conversation || titleCancelledRef.current) return; // BUG-2
    const next = titleDraft.trim();
    if (next && next !== conversation.title) {
      await conversationRepo.rename(conversation.id, next);
    }
    setEditingTitle(false);
  };

  const cancelEditTitle = () => {
    titleCancelledRef.current = true; // BUG-2: 标记取消
    setEditingTitle(false);
  };

  const activeProvider: Provider | undefined = useMemo(() => {
    if (!conversation?.providerId || !effectiveProviders) return undefined;
    return effectiveProviders.find((p) => p.id === conversation.providerId);
  }, [conversation?.providerId, effectiveProviders]);

  const activeModel = conversation?.model || activeProvider?.models?.[0];

  // 改签名：接收可选的 images（仅在内存中使用）
  const handleSend = async (
    text: string,
    attachments?: import('@/services/image').Attachment[],
  ) => {
    if (streaming) return; // BUG-005: 防并发
    if (!conversation || !activeProvider || !activeModel) {
      setError('请先在设置中配置 Provider 与模型');
      return;
    }
    setError(null);
    setStreamedText('');
    setAutoScroll(true);

    // 构造这一轮多模态 user content
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
      .filter((a): a is typeof a & { dataUrl: string } =>
        (a.kind === 'image' || a.kind === 'pdf') && typeof a.dataUrl === 'string',
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
        > = imageBlocks.length + textBlocks.length > 0
      ? [...textBlocks, ...imageBlocks]
      : text;

    // ★ 入库：只存附件元数据占位，绝不存 base64
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

    // 构造上下文：包含本轮多模态 user content（仅在内存中传）
    const all = await messageRepo.listByConversation(conversation.id);
    const ctx = all
      .filter((m) => m.role !== 'system')
      .map((m, idx, arr) => {
        const isLastUser =
          m.role === 'user' && idx === arr.length - 2;
        if (isLastUser && Array.isArray(userContent)) {
          return { role: m.role, content: userContent };
        }
        return { role: m.role as 'user' | 'assistant', content: m.content };
      });

    // 自动用首条消息当标题
    let titleSeed = text;
    if (!titleSeed && atts.length) titleSeed = `${atts[0].name}${atts.length > 1 ? ` 等 ${atts.length} 项` : ''}`;
    if (!titleSeed) titleSeed = '新会话';
    if (conversation.title === '新会话' && ctx.length === 1) {
      await conversationRepo.update(conversation.id, {
        title: titleSeed.slice(0, 30),
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
          setPending(false); // 收到首个 token，取消 pending
        },
      });
      // 流式完成 → 写入数据库
      await messageRepo.update(assistantId, { content: acc });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // 用户中止：保留已生成内容
        if (acc) await messageRepo.update(assistantId, { content: acc });
      } else {
        const msg = err?.message || String(err);
        setError(msg);
        await messageRepo.update(assistantId, { content: `⚠️ 出错了：${msg}` });
      }
    } finally {
      setStreaming(false);
      setPending(false);
      setStreamedText('');
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleRegenerate = async (assistantMsgId: string) => {
    if (!conversation || !activeProvider || !activeModel || streaming) return;
    const all = await messageRepo.listByConversation(conversation.id);
    const idx = all.findIndex((m) => m.id === assistantMsgId);
    if (idx < 1) return;
    const userMsg = all[idx - 1];
    // 阅后即焚：原图已不在 IndexedDB，重新生成时无法再带图
    if (userMsg.hasAttachments) {
      const ok = await confirmDialog({
        title: '附件已阅后即焚',
        message: '这条消息原本包含附件，但附件不会保存到本地。重新生成时模型将无法看到原附件（只会基于文本重答）。\n\n确定要继续吗？',
        confirmLabel: '继续重新生成',
      });
      if (!ok) return;
    }
    // 删除该 assistant 消息及其后所有消息（BUG-007 修复：清除孤儿分支）
    await messageRepo.deleteAfter(conversation.id, all[idx].createdAt);
    // BUG-006 修复：slice(0, idx) 保留该 assistant 之前的全部消息（包含 idx-1 的用户消息）
    const ctx = all
      .slice(0, idx)
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    // 重新生成
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
  };

  const handleDeleteMessage = async (id: string) => {
    if (streaming) return;
    const ok = await confirmDialog({
      title: '删除消息',
      message: '确认要删除这条消息？',
      confirmLabel: '删除',
      danger: true,
    });
    if (!ok) return;
    await messageRepo.delete(id);
  };

  const handleEditMessage = async (id: string, newContent: string) => {
    if (streaming || !conversation || !activeProvider || !activeModel) return;
    if (!newContent.trim()) return;
    const all = await messageRepo.listByConversation(conversation.id);
    const idx = all.findIndex((m) => m.id === id);
    if (idx < 0) return;
    const targetMsg = all[idx];
    if (targetMsg.role !== 'user') return;
    // BUG-7: 附件警告
    if (targetMsg.hasAttachments) {
      const ok = await confirmDialog({
        title: '附件已阅后即焚',
        message: '这条消息原本包含附件。编辑后重新生成时，模型将无法看到原附件。\n\n确定要继续编辑吗？',
        confirmLabel: '继续编辑',
      });
      if (!ok) return;
    }
    await messageRepo.update(id, { content: newContent });
    if (idx + 1 < all.length) {
      await messageRepo.deleteAfter(conversation.id, all[idx + 1].createdAt);
    }
    // BUG-8: 更新会话时间戳
    await conversationRepo.touch(conversation.id);
    // 构造上下文重新发送
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
        await messageRepo.update(assistantId, { content: `⚠️ 出错了：${err?.message || err}` });
      }
    } finally {
      setStreaming(false);
      setPending(false);
      setStreamedText('');
      abortRef.current = null;
    }
  };

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink-400 dark:text-dark-muted">
        请选择或新建一个会话
      </div>
    );
  }

  const placeholder = !activeProvider
    ? '请先在右上角选择 Provider…'
    : !activeModel
    ? '当前会话未选择模型，请打开"参数"选择一个模型…'
    : '输入消息，回车发送，Shift+回车换行';

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-white dark:bg-dark-bg">
      {/* 顶栏：克制高度 h-12 */}
      <header className="flex items-center justify-between gap-2 px-4 h-12 border-b border-surface-border dark:border-dark-border shrink-0">
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.nativeEvent as any).isComposing) return; // BUG-5: IME
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitTitle();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelEditTitle();
                  }
                }}
                onBlur={commitTitle}
                className="min-w-0 max-w-md flex-1 h-7 rounded-md border border-accent bg-white dark:bg-dark-panel px-2 text-sm font-medium text-ink-900 dark:text-dark-ink focus:outline-none focus:ring-2 focus:ring-accent/20"
                placeholder="输入会话标题"
              />
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={commitTitle}
                className="rounded p-1 text-green-600 hover:bg-green-500/10"
                aria-label="保存"
              >
                <Check size={14} />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={cancelEditTitle}
                className="rounded p-1 text-ink-500 hover:bg-ink-100 dark:hover:bg-dark-subtle"
                aria-label="取消"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="group flex items-center gap-1.5">
              <div
                onDoubleClick={startEditTitle}
                className="truncate text-[13px] font-semibold text-ink-900 dark:text-dark-ink cursor-text"
                title="双击编辑标题"
              >
                {conversation.title}
              </div>
              <button
                onClick={startEditTitle}
                className="rounded p-1 text-ink-400 opacity-0 transition-opacity duration-fast hover:bg-ink-100 hover:text-ink-700 group-hover:opacity-100 dark:hover:bg-dark-subtle"
                aria-label="编辑标题"
              >
                <Pencil size={11} />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <ModelSwitcher conversationId={conversationId} onOpenParams={onOpenSettings} />
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              if (!conversation?.id) return;
              try {
                const md = await exportConversationAsMarkdown(conversation.id);
                const name = (conversation.title || '新会话').replace(/[/\\?%*:|"<>]/g, '_');
                downloadMarkdown(md, `${name}-${new Date().toISOString().slice(0, 10)}.md`);
              } catch (e: any) {
                toast.error(`导出失败：${e?.message || e}`);
              }
            }}
            title="导出为 Markdown"
          >
            <Download size={13} />
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenSettings}>
            <SlidersHorizontal size={13} />
            参数
          </Button>
        </div>
      </header>

      {/* 消息流 */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          setAutoScroll(nearBottom);
        }}
        className="relative flex-1 overflow-y-auto"
      >
        <div style={{ maxWidth: messageMaxWidth }} className="relative mx-auto w-full px-6 py-8 flex flex-col gap-6">
          <div
            onMouseDown={onResizeMessage}
            title="拖动调整消息宽度"
            className="absolute top-0 -right-3 bottom-0 w-1.5 cursor-ew-resize hover:bg-accent/30 transition-colors z-10 hidden md:block"
          />
          {(!messages || messages.length === 0) &&
            (!activeProvider ? (
              <EmptyState
                icon="🔧"
                title="还没有配置 Provider"
                desc="按以下步骤开始你的第一次对话"
                steps={[
                  { num: 1, text: '在设置中添加一个 Provider（如 DeepSeek）', done: false },
                  { num: 2, text: '在顶部选择 Provider 和模型', done: false },
                  { num: 3, text: '在下方输入框输入消息开始对话', done: false },
                ]}
                actionLabel="打开设置"
                onAction={onOpenSettings}
              />
            ) : (
              <div className="py-12 space-y-8">
                <div className="text-center">
                  <div className="text-4xl mb-3">💬</div>
                  <h3 className="text-[18px] font-semibold text-ink-900 dark:text-dark-ink">
                    开始一段新对话
                  </h3>
                  <p className="mt-1.5 text-[13px] text-ink-500 dark:text-dark-muted">
                    在下方输入框输入消息，回车发送 · 或点下方示例快速开始
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl mx-auto">
                  {[
                    { icon: '💡', text: '用 3 句话解释一下量子计算' },
                    { icon: '✍️', text: '帮我润色一段产品介绍文案' },
                    { icon: '🐛', text: '帮我写一个 Python 抓取网页的脚本' },
                    { icon: '🌐', text: '把这段中文翻译成英文：' },
                  ].map((s) => (
                    <button
                      key={s.text}
                      onClick={() => {
                        const el = document.querySelector('textarea');
                        if (el instanceof HTMLTextAreaElement) {
                          el.focus();
                        }
                      }}
                      className="flex items-start gap-2.5 text-left rounded-lg border border-surface-border dark:border-dark-border bg-white dark:bg-dark-panel p-3 hover:border-accent dark:hover:border-accent hover:bg-accent-soft/30 dark:hover:bg-accent/10 transition-colors"
                    >
                      <span className="text-base shrink-0 mt-0.5">{s.icon}</span>
                      <span className="text-[12.5px] text-ink-700 dark:text-dark-ink leading-relaxed">
                        {s.text}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="text-center text-[11px] text-ink-400 dark:text-dark-muted">
                  ⌘K 打开命令面板 · / 唤起 Prompt 模板 · ⌘⇧F 全局搜索
                </div>
              </div>
            ))}

          {messages?.map((m, i) => (
            <MessageItem
              key={m.id}
              message={m}
              streaming={streaming && i === messages.length - 1 && m.role === 'assistant'}
              highlighted={m.id === highlightMessageId}
              onRegenerate={m.role === 'assistant' ? () => handleRegenerate(m.id) : undefined}
              onEdit={m.role === 'user' ? (newC) => handleEditMessage(m.id, newC) : undefined}
              onDelete={() => handleDeleteMessage(m.id)}
            />
          ))}

          {streaming && streamedText && messages?.[messages.length - 1]?.content === '' && (
            <MessageItem
              message={{
                id: 'streaming',
                conversationId: conversation.id,
                role: 'assistant',
                content: streamedText,
                createdAt: Date.now(),
              }}
              streaming
            />
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 animate-fade-in">
              {error}
            </div>
          )}
        </div>

        {!autoScroll && (
          <button
            onClick={() => {
              setAutoScroll(true);
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }
            }}
            className="sticky bottom-3 left-1/2 -translate-x-1/2 mx-auto inline-flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-dark-panel/95 px-3.5 py-2 text-xs font-medium text-ink-700 dark:text-dark-ink shadow-sm border border-surface-border dark:border-dark-border backdrop-blur-sm hover:bg-white dark:hover:bg-dark-panel transition-colors"
          >
            <ChevronDown size={13} />
            {unreadCount > 0 ? `${unreadCount} 条新消息` : '滚到底部'}
          </button>
        )}
      </div>

      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        streaming={streaming}
        pending={pending}
        placeholder={placeholder}
      />
    </div>
  );
}