import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** ≥sm 屏宽，<sm 屏会全屏覆盖 */
  width?: number;
  children?: ReactNode;
}

export function Drawer({ open, onClose, title, width = 380, children }: Props) {
  return (
    <>
      <div
        onClick={onClose}
        className={clsx(
          'fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]',
          'transition-opacity duration-200 ease-out',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside
        className={clsx(
          'fixed inset-y-0 right-0 z-50 flex flex-col',
          'bg-white dark:bg-dark-panel',
          'border-l border-surface-border dark:border-dark-border',
          'shadow-lg',
          'transition-transform duration-200 ease-out',
          'w-full sm:w-[var(--drawer-w)]',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        style={{ '--drawer-w': `${width}px` } as React.CSSProperties}
      >
        <header className="flex items-center justify-between px-5 h-12 border-b border-surface-border dark:border-dark-border shrink-0">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </>
  );
}