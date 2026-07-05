import { AlertTriangle } from 'lucide-react';
import { useConfirmStore } from '@/store/confirmStore';
import { clsx } from 'clsx';

export function ConfirmDialog() {
  const open = useConfirmStore((s) => s.open);
  const title = useConfirmStore((s) => s.title);
  const message = useConfirmStore((s) => s.message);
  const confirmLabel = useConfirmStore((s) => s.confirmLabel);
  const danger = useConfirmStore((s) => s.danger);
  const onConfirm = useConfirmStore((s) => s.onConfirm);
  const onCancel = useConfirmStore((s) => s.onCancel);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />
      <div
        className={clsx(
          'relative z-10 w-full max-w-sm rounded-xl',
          'bg-white dark:bg-dark-panel',
          'border border-surface-border dark:border-dark-border',
          'shadow-lg animate-slide-up',
        )}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
      >
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-start gap-3">
            {danger && (
              <div className="shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
                <AlertTriangle size={16} className="text-red-600 dark:text-red-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 id="confirm-title" className="text-sm font-semibold text-ink-900 dark:text-dark-ink">
                {title}
              </h3>
              <p id="confirm-desc" className="mt-1.5 text-[13px] text-ink-600 dark:text-dark-muted leading-relaxed whitespace-pre-wrap">
                {message}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 pb-4 pt-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-ink-700 dark:text-dark-ink hover:bg-ink-100 dark:hover:bg-dark-subtle transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className={clsx(
              'rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors',
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-accent hover:bg-accent-hover',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
