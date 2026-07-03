import { Button } from './Button';

interface Props {
  icon?: string;
  title: string;
  desc?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** 多步骤引导 */
  steps?: Array<{ num: number; text: string; done?: boolean }>;
}

export function EmptyState({ icon = '✨', title, desc, actionLabel, onAction, steps }: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-surface-border dark:border-dark-border px-8 py-10 animate-fade-in">
      <div className="text-3xl mb-3">{icon}</div>
      <div className="text-[15px] font-semibold text-ink-900 dark:text-dark-ink">{title}</div>
      {desc && (
        <div className="mt-1.5 text-[13px] text-ink-500 dark:text-dark-muted max-w-sm mx-auto leading-relaxed">
          {desc}
        </div>
      )}
      {steps && steps.length > 0 && (
        <div className="mt-5 flex flex-col items-center gap-1.5">
          {steps.map((s) => (
            <div
              key={s.num}
              className="flex items-center gap-2.5 text-[12.5px] text-ink-500 dark:text-dark-muted"
            >
              <span
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${
                  s.done
                    ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
                    : 'bg-ink-100 text-ink-500 dark:bg-dark-subtle dark:text-dark-muted'
                }`}
              >
                {s.done ? '✓' : s.num}
              </span>
              {s.text}
            </div>
          ))}
        </div>
      )}
      {actionLabel && onAction && (
        <div className="mt-5">
          <Button size="md" variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}