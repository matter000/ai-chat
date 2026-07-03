import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Search, Plus, Settings, SlidersHorizontal, Sun, Moon, Monitor, MessageSquare, Globe } from 'lucide-react';
import { clsx } from 'clsx';
import { useUIStore } from '@/store/uiStore';
import { conversationRepo } from '@/db';
import { nanoid } from 'nanoid';
import { formatShortcut } from '@/hooks/useShortcuts';

interface CommandItem {
  id: string;
  title: string;
  hint?: string;
  shortcut?: string;
  icon: LucideIcon;
  group: '会话' | '导航' | '主题' | '危险';
  run: () => void | Promise<void>;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const openSettings = useUIStore((s) => s.openSettings);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  // ⌘K 唤起
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = (e.key || '').toLowerCase();
      const mod = (e.ctrlKey || e.metaKey) && e.shiftKey === false && e.altKey === false;
      if (mod && k === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery('');
        setActive(0);
      } else if (k === 'escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // 构造命令列表
  const commands: CommandItem[] = useMemo(
    () => [
      {
        id: 'new',
        title: '新建会话',
        icon: Plus,
        shortcut: 'mod+shift+o',
        group: '会话',
        run: async () => {
          const now = Date.now();
          await conversationRepo.create({
            id: nanoid(),
            title: '新会话',
            params: { temperature: 0.7 },
            pinned: false,
            createdAt: now,
            updatedAt: now,
          });
          setOpen(false);
          // 通过自定义事件通知 App 选中最新会话
          window.dispatchEvent(new CustomEvent('app:select-latest'));
        },
      },
      {
        id: 'toggle-theme-light',
        title: '切换为浅色主题',
        hint: '当前 ' + (theme === 'light' ? '✓' : ''),
        icon: Sun,
        group: '主题',
        run: () => {
          setTheme('light');
          setOpen(false);
        },
      },
      {
        id: 'toggle-theme-dark',
        title: '切换为深色主题',
        hint: '当前 ' + (theme === 'dark' ? '✓' : ''),
        icon: Moon,
        group: '主题',
        run: () => {
          setTheme('dark');
          setOpen(false);
        },
      },
      {
        id: 'toggle-theme-system',
        title: '跟随系统主题',
        hint: '当前 ' + (theme === 'system' ? '✓' : ''),
        icon: Monitor,
        group: '主题',
        run: () => {
          setTheme('system');
          setOpen(false);
        },
      },
      {
        id: 'open-settings',
        title: '打开设置',
        hint: 'Provider 管理 / 数据管理',
        icon: Settings,
        shortcut: 'mod+,',
        group: '导航',
        run: () => {
          openSettings();
          setOpen(false);
        },
      },
      {
        id: 'open-params',
        title: '打开会话参数',
        hint: 'System Prompt / 温度',
        icon: SlidersHorizontal,
        shortcut: 'mod+/',
        group: '导航',
        run: () => {
          window.dispatchEvent(new CustomEvent('app:open-params'));
          setOpen(false);
        },
      },
      {
        id: 'focus-sidebar-search',
        title: '聚焦侧栏搜索',
        icon: Search,
        shortcut: 'mod+shift+k',
        group: '导航',
        run: () => {
          window.dispatchEvent(new CustomEvent('app:focus-sidebar-search'));
          setOpen(false);
        },
      },
      {
        id: 'focus-input',
        title: '聚焦消息输入框',
        icon: MessageSquare,
        shortcut: 'mod+enter',
        group: '导航',
        run: () => {
          window.dispatchEvent(new CustomEvent('app:focus-input'));
          setOpen(false);
        },
      },
      {
        id: 'global-search',
        title: '全局搜索消息',
        hint: '跨所有会话的 user / assistant 正文',
        icon: Globe,
        shortcut: 'mod+shift+f',
        group: '导航',
        run: () => {
          window.dispatchEvent(new CustomEvent('app:open-global-search'));
          setOpen(false);
        },
      },
    ],
    [openSettings, theme, setTheme],
  );

  // 过滤
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) => c.title.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q),
    );
  }, [query, commands]);

  // 键盘上下选择
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e as any).isComposing || e.keyCode === 229) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const c = filtered[active];
        if (c) c.run();
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, active]);

  if (!open) return null;

  const grouped: Record<string, CommandItem[]> = {};
  for (const c of filtered) {
    grouped[c.group] = grouped[c.group] || [];
    grouped[c.group].push(c);
  }

  // 计算 flattened 索引以便滚动激活
  let runningIdx = -1;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[14vh] animate-fade-in">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <div
        className={clsx(
          'relative z-10 w-[560px] max-w-[92vw]',
          'rounded-xl border border-surface-border dark:border-dark-border',
          'bg-white dark:bg-dark-panel shadow-lg',
          'flex flex-col max-h-[60vh] overflow-hidden animate-slide-up',
        )}
      >
        {/* 输入行 */}
        <div className="flex items-center gap-2 px-4 h-12 border-b border-surface-border dark:border-dark-border">
          <Search size={15} className="text-ink-400 dark:text-dark-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="输入命令或搜索…"
            className="flex-1 bg-transparent text-[14px] text-ink-900 dark:text-dark-ink placeholder:text-ink-400 focus:outline-none"
          />
          <kbd className="text-[10px] text-ink-400 dark:text-dark-muted bg-ink-50 dark:bg-dark-subtle px-1.5 py-0.5 rounded border border-surface-border dark:border-dark-border">
            Esc
          </kbd>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-ink-400 dark:text-dark-muted">
              没有匹配的命令
            </div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="mb-1">
                <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-dark-muted">
                  {group}
                </div>
                {items.map((c) => {
                  runningIdx++;
                  const isActive = runningIdx === active;
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.id}
                      onMouseEnter={() => setActive(filtered.indexOf(c))}
                      onClick={c.run}
                      className={clsx(
                        'flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors',
                        isActive
                          ? 'bg-accent-soft dark:bg-accent/15 text-accent-hover dark:text-blue-300'
                          : 'text-ink-700 dark:text-dark-ink hover:bg-ink-50 dark:hover:bg-dark-subtle',
                      )}
                    >
                      <Icon size={14} />
                      <span className="flex-1 truncate">{c.title}</span>
                      {c.hint && (
                        <span className="text-[11px] text-ink-400 dark:text-dark-muted">
                          {c.hint}
                        </span>
                      )}
                      {c.shortcut && (
                        <kbd className="text-[10px] text-ink-400 dark:text-dark-muted bg-ink-50 dark:bg-dark-subtle px-1.5 py-0.5 rounded border border-surface-border dark:border-dark-border font-mono">
                          {formatShortcut(c.shortcut)}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="px-4 h-9 border-t border-surface-border dark:border-dark-border flex items-center justify-between text-[10.5px] text-ink-400 dark:text-dark-muted">
          <span>↑↓ 选择 · ↵ 执行</span>
          <span>{filtered.length} 个结果</span>
        </div>
      </div>
    </div>
  );
}