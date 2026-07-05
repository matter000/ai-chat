import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ArrowRight, Hash } from 'lucide-react';
import { clsx } from 'clsx';
import { globalSearch, highlightSnippet, type SearchHit } from '@/services/search';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/Input';
import { conversationRepo } from '@/db';
import { useUIStore } from '@/store/uiStore';
import { renderPrompt } from '@/services/promptRender';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 命中后跳转的回调：父组件设置 activeId 并跳转 */
  onJump: (conversationId: string, messageId: string) => void;
  /** 当前会话 ID，用于"仅本会话"过滤 */
  activeConversationId?: string;
}

export function GlobalSearch({ open, onClose, onJump, activeConversationId }: Props) {
  const [raw, setRaw] = useState('');
  const [scope, setScope] = useState<'all' | 'current'>('all');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeSettings = useUIStore((s) => s.closeSettings);

  const q = useDebounce(raw, 180);

  // 打开时聚焦
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
    if (!open) {
      setRaw('');
      setHits([]);
      setActive(0);
    }
  }, [open]);

  // 执行搜索
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!q.trim()) {
        setHits([]);
        return;
      }
      setBusy(true);
      try {
        let h = await globalSearch(q);
        if (scope === 'current' && activeConversationId) {
          h = h.filter((x) => x.conversation.id === activeConversationId);
        }
        if (!cancelled) {
          setHits(h);
          setActive(0);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, scope, activeConversationId]);

  // 键盘上下选择 + 回车
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // IME 组合中（中文拼音）跳过
      if ((e as unknown as { isComposing?: boolean }).isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, hits.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const h = hits[active];
        if (h) handleJump(h);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hits, active]);

  const handleJump = (h: SearchHit) => {
    onJump(h.conversation.id, h.message.id);
    onClose();
    closeSettings();
  };

  if (!open) return null;

  // 按会话分组
  const grouped = useMemo(() => {
    const map = new Map<string, { conv: SearchHit['conversation']; hits: SearchHit[] }>();
    for (const h of hits) {
      const cur = map.get(h.conversation.id);
      if (cur) cur.hits.push(h);
      else map.set(h.conversation.id, { conv: h.conversation, hits: [h] });
    }
    return Array.from(map.values());
  }, [hits]);

  // 命中的全局索引（用于键盘选中）
  let runningIdx = -1;

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center pt-[12vh] animate-fade-in">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={clsx(
          'relative z-10 w-[680px] max-w-[92vw]',
          'rounded-xl border border-surface-border dark:border-dark-border',
          'bg-white dark:bg-dark-panel shadow-lg',
          'flex flex-col max-h-[68vh] overflow-hidden animate-slide-up',
        )}
      >
        {/* 搜索栏 */}
        <div className="flex items-center gap-2 px-4 h-12 border-b border-surface-border dark:border-dark-border">
          <Search size={15} className="text-ink-400 dark:text-dark-muted shrink-0" />
          <Input
            ref={inputRef}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="全局搜索消息内容（支持空格分多关键词 AND 匹配）"
            variant="borderless"
            className="border-0 px-0 focus:ring-0"
          />
          <div className="flex shrink-0 items-center gap-1 text-[11px]">
            <button
              onClick={() => setScope('all')}
              className={clsx(
                'rounded px-2 py-0.5 transition-colors',
                scope === 'all'
                  ? 'bg-accent-soft dark:bg-accent/15 text-accent-hover dark:text-blue-300'
                  : 'text-ink-500 dark:text-dark-muted hover:bg-ink-100 dark:hover:bg-dark-subtle',
              )}
            >
              全部
            </button>
            <button
              onClick={() => setScope('current')}
              disabled={!activeConversationId}
              className={clsx(
                'rounded px-2 py-0.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                scope === 'current'
                  ? 'bg-accent-soft dark:bg-accent/15 text-accent-hover dark:text-blue-300'
                  : 'text-ink-500 dark:text-dark-muted hover:bg-ink-100 dark:hover:bg-dark-subtle',
              )}
            >
              当前会话
            </button>
          </div>
          <kbd className="text-[10px] text-ink-400 dark:text-dark-muted bg-ink-50 dark:bg-dark-subtle px-1.5 py-0.5 rounded border border-surface-border dark:border-dark-border">
            Esc
          </kbd>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto py-1">
          {!q.trim() && (
            <div className="px-6 py-10 text-center text-sm text-ink-400 dark:text-dark-muted">
              输入关键词开始搜索。空格分隔多个词会全部匹配（AND）。
            </div>
          )}
          {q.trim() && busy && (
            <div className="px-6 py-10 text-center text-sm text-ink-400 dark:text-dark-muted">
              搜索中…
            </div>
          )}
          {q.trim() && !busy && hits.length === 0 && (
            <div className="px-6 py-10 text-center text-sm text-ink-400 dark:text-dark-muted">
              没有匹配 “{q}” 的消息
            </div>
          )}
          {q.trim() && !busy && grouped.map((g) => (
            <div key={g.conv.id} className="mb-1">
              <div className="flex items-center gap-2 px-4 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-400 dark:text-dark-muted">
                <Hash size={10} />
                <span className="truncate">{g.conv.title}</span>
                <span className="opacity-70">· {g.hits.length} 处</span>
              </div>
              {g.hits.map((h) => {
                runningIdx++;
                const isActive = runningIdx === active;
                const myIdx = runningIdx;
                return (
                  <button
                    key={h.message.id}
                    onMouseEnter={() => setActive(myIdx)}
                    onClick={() => handleJump(h)}
                    className={clsx(
                      'flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors',
                      isActive
                        ? 'bg-accent-soft dark:bg-accent/15'
                        : 'hover:bg-ink-50 dark:hover:bg-dark-subtle',
                    )}
                  >
                    <div
                      className={clsx(
                        'mt-0.5 inline-flex h-5 w-10 shrink-0 items-center justify-center rounded text-[10px] font-medium',
                        h.message.role === 'user'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                          : 'bg-ink-100 text-ink-700 dark:bg-dark-subtle dark:text-dark-ink',
                      )}
                    >
                      {h.message.role === 'user' ? '你' : 'AI'}
                    </div>
                    <div
                      className="min-w-0 flex-1 text-[12.5px] text-ink-700 dark:text-dark-ink leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: highlightSnippet(h.snippet, q) }}
                      // 高亮标签来源是 escape 后的 query，是安全的
                    />
                    <ArrowRight
                      size={13}
                      className={clsx(
                        'shrink-0 mt-0.5 opacity-50',
                        isActive && 'opacity-100',
                      )}
                    />
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="px-4 h-9 border-t border-surface-border dark:border-dark-border flex items-center justify-between text-[10.5px] text-ink-400 dark:text-dark-muted">
          <span>↑↓ 选择 · ↵ 跳转 · Esc 关闭</span>
          <span>{hits.length} 个结果</span>
        </div>
      </div>
    </div>
  );
}