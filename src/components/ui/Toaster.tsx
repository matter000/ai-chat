import { useToastStore } from '@/store/toastStore';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { clsx } from 'clsx';

const ICON_MAP = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
};

const KIND_CLASS = {
  info: 'border-surface-border dark:border-dark-border text-ink-700 dark:text-dark-ink',
  success: 'border-green-500/30 bg-green-500/10 text-green-800 dark:text-green-300',
  error: 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300',
} as const;

const ICON_CLASS = {
  info: 'text-ink-400',
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
} as const;

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 -translate-x-1/2 z-[120] flex flex-col items-center gap-1.5">
      {toasts.map((t) => {
        const Icon = ICON_MAP[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className={clsx(
              'pointer-events-auto flex max-w-[480px] items-start gap-2 rounded-lg border bg-white dark:bg-dark-panel px-3.5 py-2.5 shadow-md animate-slide-up',
              KIND_CLASS[t.kind],
            )}
          >
            <Icon size={15} className={clsx('shrink-0 mt-0.5', ICON_CLASS[t.kind])} />
            <span className="flex-1 text-[12.5px] leading-relaxed whitespace-pre-wrap break-words">
              {t.message}
            </span>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="关闭"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
