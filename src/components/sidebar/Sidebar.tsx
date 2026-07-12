import { useEffect, useRef, useState } from 'react';
import { Plus, Settings, Trash2, Pin, PinOff, Search, Check, X, Pencil, MessageSquare, Sun, Moon, Monitor, User, GripVertical, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { conversationRepo, userRepo } from '@/db';
import { nanoid } from 'nanoid';
import type { Conversation } from '@/types';
import { useUIStore } from '@/store/uiStore';
import { getAuthState } from '@/store/userStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { clsx } from 'clsx';
import { Logo } from '@/components/Logo';
import { confirmDialog } from '@/store/confirmStore';

export function Sidebar({
  activeId,
  onSelect,
  onResizeSidebar,
}: {
  activeId?: string;
  onSelect: (id: string) => void;
  onResizeSidebar?: (e: React.MouseEvent) => void;
}) {
  const [keyword, setKeyword] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const openSettings = useUIStore((s) => s.openSettings);
  const collapseSidebar = useUIStore((s) => s.collapseSidebar);

  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  const themeOptions = [
    { value: 'light' as const, icon: Sun, label: '浅色' },
    { value: 'dark' as const, icon: Moon, label: '深色' },
    { value: 'system' as const, icon: Monitor, label: '跟随系统' },
  ];
  const currentTheme = themeOptions.find((o) => o.value === theme) ?? themeOptions[2];


  // 当前用户信息
  const auth = getAuthState();
  const currentUser = useLiveQuery(
    () => (auth.userId ? userRepo.get(auth.userId) : Promise.resolve(undefined)),
    [auth.userId],
  );

  const openUserCenter = () => {
    window.dispatchEvent(new CustomEvent('app:open-user-center'));
  };

  const conversations = useLiveQuery(async () => {
    const list = await conversationRepo.list();
    if (!keyword.trim()) return list;
    const k = keyword.toLowerCase();
    return list.filter((c) => c.title.toLowerCase().includes(k));
  }, [keyword]);

  const newConversation = async () => {
    const now = Date.now();
    const c: Conversation = {
      id: nanoid(),
      title: '新会话',
      params: { temperature: 0.7 },
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    await conversationRepo.create(c);
    onSelect(c.id);
  };

  const remove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirmDialog({
      title: '删除会话',
      message: '该会话及其全部消息将被永久删除，无法恢复。',
      confirmLabel: '删除',
      danger: true,
    });
    if (!ok) return;
    await conversationRepo.delete(id);
    if (activeId === id) onSelect('');
  };

  const togglePin = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const c = await conversationRepo.get(id);
    if (!c) return;
    await conversationRepo.update(id, { pinned: !c.pinned });
  };

  const startEdit = (c: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(c.id);
    setTitleDraft(c.title);
  };

  const commitEdit = async (id: string) => {
    const next = titleDraft.trim();
    if (next) await conversationRepo.rename(id, next);
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitleDraft('');
  };

  useEffect(() => {
    if (editingId) {
      requestAnimationFrame(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      });
    }
  }, [editingId]);

  useEffect(() => {
    if (!activeId && conversations && conversations.length === 0) {
      newConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations?.length]);

  return (
    <aside className="relative flex h-full w-full flex-col bg-surface-alt dark:bg-dark-panel border-r border-surface-border dark:border-dark-border">
      {/* Logo */}
      <div className="flex items-center justify-between px-3 h-12 shrink-0 gap-1">
        <button
          type="button"
          onClick={collapseSidebar}
          aria-label="收起侧栏"
          title="收起侧栏"
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-500 dark:text-dark-muted hover:bg-ink-100 dark:hover:bg-dark-subtle transition-colors"
        >
          <PanelLeftClose size={15} />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <Logo size={24} className="shrink-0" />
          <span className="text-sm font-semibold tracking-tight truncate">AI Chat</span>
        </div>
        <Button size="icon" variant="ghost" onClick={openSettings} aria-label="设置">
          <Settings size={15} />
        </Button>
      </div>

      {/* New + Search */}
      <div className="px-3 space-y-2 shrink-0">
        <Button onClick={newConversation} variant="primary" className="w-full" size="md">
          <Plus size={14} strokeWidth={2.5} />
          新建会话
        </Button>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 dark:text-dark-muted pointer-events-none" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索会话 (Ctrl+Shift+K 快捷搜索)"
            className="w-full h-7 pl-7 pr-2 rounded-md text-xs bg-white dark:bg-dark-subtle border border-surface-border dark:border-dark-border text-ink-900 dark:text-dark-ink placeholder:text-ink-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 mt-1">
        {conversations?.length === 0 && (
          <div className="px-3 py-10 text-center">
            <div className="text-2xl mb-2 opacity-40">💬</div>
            <div className="text-xs text-ink-500 dark:text-dark-muted mb-3 leading-relaxed">
              点击下方按钮<br />开始你的第一次对话
            </div>
          </div>
        )}
        {conversations
          ?.slice()
          .sort((a, b) => Number(b.pinned) - Number(a.pinned))
          .map((c) => {
            const isEditing = editingId === c.id;
            const isActive = activeId === c.id;
            return (
              <div
                key={c.id}
                onClick={() => {
                  if (!isEditing) onSelect(c.id);
                }}
                onDoubleClick={(e) => startEdit(c, e)}
                className={clsx(
                  'group relative flex items-center gap-2 rounded-md pl-2 pr-1 py-1.5 mb-0.5 cursor-pointer',
                  'transition-colors duration-fast ease-out',
                  isActive
                    ? 'bg-accent-soft dark:bg-accent/15 text-accent-hover dark:text-blue-300'
                    : 'text-ink-700 dark:text-dark-ink hover:bg-ink-100 dark:hover:bg-dark-subtle',
                )}
              >
                {c.pinned && (
                  <Pin size={10} className="shrink-0 text-ink-400 dark:text-dark-muted" fill="currentColor" />
                )}
                {!c.pinned && (
                  <MessageSquare size={13} className="shrink-0 opacity-50" />
                )}
                {isEditing ? (
                  <>
                    <input
                      ref={editInputRef}
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitEdit(c.id);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelEdit();
                        }
                      }}
                      onBlur={() => commitEdit(c.id)}
                      className="min-w-0 flex-1 rounded border border-accent bg-white dark:bg-dark-panel px-1.5 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        commitEdit(c.id);
                      }}
                      className="rounded p-0.5 text-green-600 hover:bg-green-500/10"
                      aria-label="保存"
                    >
                      <Check size={11} />
                    </button>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelEdit();
                      }}
                      className="rounded p-0.5 text-ink-500 hover:bg-ink-100 dark:hover:bg-dark-subtle"
                      aria-label="取消"
                    >
                      <X size={11} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 truncate text-[13px]">
                      {c.title || '新会话'}
                    </div>
                    <div className="hidden gap-0.5 group-hover:flex shrink-0">
                      <button
                        onClick={(e) => startEdit(c, e)}
                        className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10"
                        aria-label="重命名"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={(e) => togglePin(c.id, e)}
                        className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10"
                        aria-label={c.pinned ? '取消置顶' : '置顶'}
                      >
                        {c.pinned ? <PinOff size={11} /> : <Pin size={11} />}
                      </button>
                      <button
                        onClick={(e) => remove(c.id, e)}
                        className="rounded p-1 text-red-500 hover:bg-red-500/10"
                        aria-label="删除"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
      </div>

      {/* Footer: 用户 + 主题切换 + 状态 */}
      <div className="shrink-0 border-t border-surface-border dark:border-dark-border px-3 py-2.5 space-y-2.5">
        {/* 用户区域 */}
        {currentUser && (
          <button
            onClick={openUserCenter}
            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-ink-100 dark:hover:bg-dark-subtle transition-colors"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft dark:bg-accent/15 text-base">
              {currentUser.avatarEmoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-ink-900 dark:text-dark-ink">
                {currentUser.name}
              </div>
              <div className="truncate text-[10.5px] text-ink-400 dark:text-dark-muted">
                {currentUser.email}
              </div>
            </div>
            <User size={13} className="shrink-0 text-ink-400" />
          </button>
        )}

        {/* 主题三态切换 */}
        <div
          className="flex items-center gap-0.5 p-0.5 rounded-lg bg-ink-100 dark:bg-dark-subtle border border-surface-border dark:border-dark-border"
          role="tablist"
          aria-label="主题切换"
        >
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                role="tab"
                aria-selected={active}
                title={opt.label}
                className={clsx(
                  'flex-1 inline-flex items-center justify-center gap-1 h-6 rounded-md text-[11px] transition-colors duration-fast ease-out',
                  active
                    ? 'bg-white dark:bg-dark-panel text-ink-900 dark:text-dark-ink shadow-xs'
                    : 'text-ink-500 dark:text-dark-muted hover:text-ink-900 dark:hover:text-dark-ink',
                )}
              >
                <Icon size={11} />
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            );
          })}
        </div>
        <div className="px-1 text-[11px] text-ink-400 dark:text-dark-muted">
          本地存储 · {conversations?.length ?? 0} 个会话 · 当前 {currentTheme.label}
        </div>
      </div>
      {/* 右侧拖拽手柄：调整侧栏宽度 */}
      {onResizeSidebar && (
        <div
          onMouseDown={onResizeSidebar}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-accent/30 transition-colors z-10 group/resizer"
          title="拖动调整侧栏宽度"
        >
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 opacity-0 group-hover/resizer:opacity-100 transition-opacity">
            <GripVertical size={12} className="text-ink-300" />
          </div>
        </div>
      )}
    </aside>
  );
}