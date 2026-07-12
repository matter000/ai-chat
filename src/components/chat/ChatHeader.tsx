/**
 * ChatView 顶部 header：标题（可编辑）+ 右侧操作
 */
import { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X, Download, SlidersHorizontal, Menu } from 'lucide-react';
import type { Conversation } from '@/types';
import { ModelSwitcher } from './ModelSwitcher';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';

interface Props {
  conversationId?: string;
  conversation: Conversation;
  onOpenSettings: () => void;
  onExport: () => Promise<void>;
}

export function ChatHeader({ conversationId, conversation, onOpenSettings, onExport }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(conversation.title);
    setEditing(true);
    cancelledRef.current = false;
  };

  const commit = async () => {
    if (cancelledRef.current) return;
    const next = draft.trim();
    if (next && next !== conversation.title) {
      const { conversationRepo } = await import('@/db');
      await conversationRepo.rename(conversation.id, next);
    }
    setEditing(false);
  };

  const cancel = () => {
    cancelledRef.current = true;
    setEditing(false);
  };

  const expandSidebar = useUIStore((s) => s.expandSidebar);

  return (
    <header className="flex items-center justify-between gap-2 px-3 sm:px-4 h-12 border-b border-surface-border dark:border-dark-border shrink-0">
      {/* mobile 专用：展开侧栏按钮（仅 md 以下显示，且侧栏收起时） */}
      <Button
        size="icon"
        variant="ghost"
        onClick={expandSidebar}
        aria-label="打开侧栏"
        title="打开侧栏"
        className="md:hidden shrink-0"
      >
        <Menu size={18} />
      </Button>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.nativeEvent as any).isComposing) return;
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancel();
                }
              }}
              onBlur={commit}
              className="min-w-0 max-w-md flex-1 h-7 rounded-md border border-accent bg-white dark:bg-dark-panel px-2 text-sm font-medium text-ink-900 dark:text-dark-ink focus:outline-none focus:ring-2 focus:ring-accent/20"
              placeholder="输入会话标题"
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={commit}
              className="rounded p-1 text-green-600 hover:bg-green-500/10"
              aria-label="保存"
            >
              <Check size={14} />
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={cancel}
              className="rounded p-1 text-ink-500 hover:bg-ink-100 dark:hover:bg-dark-subtle"
              aria-label="取消"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="group flex items-center gap-1.5">
            <div
              onDoubleClick={startEdit}
              className="truncate text-[13px] font-semibold text-ink-900 dark:text-dark-ink cursor-text"
              title="双击编辑标题"
            >
              {conversation.title}
            </div>
            <button
              onClick={startEdit}
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
          onClick={onExport}
          title="导出为 Markdown"
          aria-label="导出为 Markdown"
        >
          <Download size={13} />
        </Button>
        <Button size="sm" variant="ghost" onClick={onOpenSettings}>
          <SlidersHorizontal size={13} />
          参数
        </Button>
      </div>
    </header>
  );
}
