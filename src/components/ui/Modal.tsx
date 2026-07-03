import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, size = 'md', children, footer }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={clsx(
          'relative z-10 w-full rounded-xl',
          'bg-white dark:bg-dark-panel',
          'border border-surface-border dark:border-dark-border',
          'shadow-lg',
          'flex flex-col max-h-[90vh] animate-slide-up',
          size === 'sm' && 'max-w-sm',
          size === 'md' && 'max-w-lg',
          size === 'lg' && 'max-w-2xl',
        )}
      >
        <header className="flex items-center justify-between px-5 h-12 border-b border-surface-border dark:border-dark-border shrink-0">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="px-5 h-12 border-t border-surface-border dark:border-dark-border flex items-center justify-end gap-2 shrink-0">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}