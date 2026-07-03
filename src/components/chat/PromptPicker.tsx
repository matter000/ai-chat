import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sparkles, Check } from 'lucide-react';
import { promptRepo } from '@/db';
import { clsx } from 'clsx';

interface Props {
  /** 输入框当前文字 */
  text: string;
  /** 选中一个模板后的回调（已展开的最终正文） */
  onPick: (rendered: string, command: string) => void;
  /** 关闭浮层（通常意味着用户没选） */
  onClose: () => void;
  /** 当前 `/` 后的过滤词 */
  filter: string;
}

export function PromptPicker({ text, onPick, onClose, filter }: Props) {
  const [active, setActive] = useState(0);
  const list = useLiveQuery(async () => {
    const all = await promptRepo.list();
    return all
      .filter((t) => t.enabled)
      .sort((a, b) => {
        if (a.builtin !== b.builtin) return a.builtin ? -1 : 1;
        return a.title.localeCompare(b.title, 'zh-CN');
      });
  }, []);

  const filtered = useMemo(() => {
    const all = list ?? [];
    const f = filter.toLowerCase().trim();
    if (!f) return all;
    return all.filter(
      (t) =>
        t.command.toLowerCase().includes(f) ||
        t.title.toLowerCase().includes(f) ||
        (t.description || '').toLowerCase().includes(f),
    );
  }, [list, filter]);

  useEffect(() => {
    setActive(0);
  }, [filter]);

  // 选中后渲染正文（这里先不做变量展开，由调用方完成）
  const handlePick = async (t: (typeof filtered)[number]) => {
    const { renderPrompt } = await import('@/services/promptRender');
    // 计算"用户已输入的文字"：去掉末尾的 /触发词
    const beforeSlash = text.replace(/\/[\w-]*$/, '');
    const rendered = renderPrompt(t.content, beforeSlash);
    onPick(rendered, t.command);
  };

  if (list === undefined) {
    return (
      <div
        className={clsx(
          'absolute z-30 left-3 right-3 bottom-full mb-2',
          'rounded-xl border border-surface-border dark:border-dark-border',
          'bg-white dark:bg-dark-panel shadow-lg overflow-hidden',
        )}
      >
        <div className="px-4 py-8 text-center text-sm text-ink-400 dark:text-dark-muted">
          加载中…
        </div>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div
        className={clsx(
          'absolute z-30 left-3 right-3 bottom-full mb-2',
          'rounded-xl border border-surface-border dark:border-dark-border',
          'bg-white dark:bg-dark-panel shadow-lg overflow-hidden',
        )}
      >
        <div className="px-4 py-8 text-center text-sm text-ink-400 dark:text-dark-muted">
          还没有 Prompt 模板，去设置里添加
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'absolute z-30 left-3 right-3 bottom-full mb-2',
        'rounded-xl border border-surface-border dark:border-dark-border',
        'bg-white dark:bg-dark-panel shadow-lg overflow-hidden',
        'animate-slide-up',
      )}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-border dark:border-dark-border text-[11px] text-ink-500 dark:text-dark-muted">
        <Sparkles size={11} />
        <span>选择 Prompt 模板</span>
        <span className="ml-auto opacity-70">
          ↑↓ 选中 · ↵ 插入 · Esc 关闭
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-ink-400 dark:text-dark-muted">
            没有匹配 /{filter} 的模板
          </div>
        ) : (
          filtered.map((t, i) => (
            <button
              key={t.id}
              onClick={() => handlePick(t)}
              onMouseEnter={() => setActive(i)}
              className={clsx(
                'flex w-full items-start gap-3 px-3 py-2 text-left transition-colors',
                i === active
                  ? 'bg-accent-soft dark:bg-accent/15'
                  : 'hover:bg-ink-50 dark:hover:bg-dark-subtle',
              )}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink-100 dark:bg-dark-subtle text-ink-500 dark:text-dark-muted font-mono text-[11px]">
                /
                <span className="ml-px truncate">{t.command.slice(0, 3)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-ink-900 dark:text-dark-ink truncate">
                    {t.title}
                  </span>
                  <span className="rounded-full bg-ink-100 dark:bg-dark-subtle px-1.5 py-0 text-[10px] text-ink-500 dark:text-dark-muted">
                    {t.category}
                  </span>
                </div>
                {t.description && (
                  <div className="mt-0.5 truncate text-[11.5px] text-ink-500 dark:text-dark-muted">
                    {t.description}
                  </div>
                )}
              </div>
              {i === active && <Check size={14} className="mt-1 text-accent" />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}