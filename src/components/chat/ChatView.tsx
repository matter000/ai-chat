/**
 * ChatView：纯渲染层。所有业务逻辑在 hooks/useChat.ts 里。
 */
import { ChevronDown } from 'lucide-react';
import { MessageItem } from './MessageItem';
import { ChatInput } from './ChatInput';
import { ChatHeader } from './ChatHeader';
import { EmptyChatHero } from './EmptyChatHero';
import { useChat } from '@/hooks/useChat';
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
  const {
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
  } = useChat(conversationId);

  const { width: messageMaxWidth, onMouseDown: onResizeMessage } = useMessageMaxWidth();

  // 跳转高亮
  if (typeof window !== 'undefined' && highlightMessageId && scrollRef.current) {
    const el = scrollRef.current.querySelector(
      `[data-message-id="${highlightMessageId}"]`,
    ) as HTMLElement | null;
    if (el) {
      setAutoScroll(false);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

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

  // handleRegenerate / handleEditMessage 包装：先 confirm 附件警告，再调 hook
  const onRegenerate = async (assistantMsgId: string) => {
    const targetMsg = messages?.find((m) => m.id === assistantMsgId);
    if (!targetMsg) return;
    const userMsg = messages?.[messages.indexOf(targetMsg) - 1];
    if (userMsg?.hasAttachments) {
      const ok = await confirmDialog({
        title: '附件已阅后即焚',
        message:
          '这条消息原本包含附件，但附件不会保存到本地。重新生成时模型将无法看到原附件（只会基于文本重答）。\n\n确定要继续吗？',
        confirmLabel: '继续重新生成',
      });
      if (!ok) return;
    }
    await regenerate(assistantMsgId);
  };

  const onEdit = async (id: string, newContent: string) => {
    const target = messages?.find((m) => m.id === id);
    if (target?.hasAttachments) {
      const ok = await confirmDialog({
        title: '附件已阅后即焚',
        message:
          '这条消息原本包含附件。编辑后重新生成时，模型将无法看到原附件。\n\n确定要继续编辑吗？',
        confirmLabel: '继续编辑',
      });
      if (!ok) return;
    }
    await editMessage(id, newContent);
  };

  const onDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: '删除消息',
      message: '确认要删除这条消息？',
      confirmLabel: '删除',
      danger: true,
    });
    if (!ok) return;
    await deleteMessage(id);
  };

  const onExportClick = async () => {
    try {
      await exportMarkdown();
    } catch (e: any) {
      toast.error(`导出失败：${e?.message || e}`);
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-white dark:bg-dark-bg">
      <ChatHeader
        conversationId={conversationId}
        conversation={conversation}
        onOpenSettings={onOpenSettings}
        onExport={onExportClick}
      />

      {/* 消息流 */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const nearBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          setAutoScroll(nearBottom);
        }}
        className="relative flex-1 overflow-y-auto"
      >
        <div
          style={{ maxWidth: messageMaxWidth }}
          className="relative mx-auto w-full px-6 py-8 flex flex-col gap-6"
        >
          <div
            onMouseDown={onResizeMessage}
            title="拖动调整消息宽度"
            className="absolute top-0 -right-3 bottom-0 w-1.5 cursor-ew-resize hover:bg-accent/30 transition-colors z-10 hidden md:block"
          />
          {(!messages || messages.length === 0) && (
            <EmptyChatHero hasProvider={!!activeProvider} onOpenSettings={onOpenSettings} />
          )}

          {messages?.map((m, i) => (
            <MessageItem
              key={m.id}
              message={m}
              streaming={streaming && i === messages.length - 1 && m.role === 'assistant'}
              highlighted={m.id === highlightMessageId}
              onRegenerate={m.role === 'assistant' ? () => onRegenerate(m.id) : undefined}
              onEdit={m.role === 'user' ? (newC) => onEdit(m.id, newC) : undefined}
              onDelete={() => onDelete(m.id)}
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
        onSend={send}
        onStop={stop}
        streaming={streaming}
        pending={pending}
        placeholder={placeholder}
      />
    </div>
  );
}
