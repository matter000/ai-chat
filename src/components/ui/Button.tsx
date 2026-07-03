import { clsx } from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'outline' | 'subtle' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'icon';
  children?: ReactNode;
}

export function Button({
  variant = 'ghost',
  size = 'md',
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 font-medium',
        'rounded-md transition-colors duration-fast ease-out',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
        // sizes
        size === 'xs' && 'h-6 px-2 text-xs',
        size === 'sm' && 'h-7 px-2.5 text-xs',
        size === 'md' && 'h-8 px-3 text-sm',
        size === 'icon' && 'h-7 w-7 p-0',
        // variants
        variant === 'primary' &&
          'bg-accent text-white hover:bg-accent-hover active:scale-[.98]',
        variant === 'ghost' &&
          'text-ink-700 hover:bg-ink-100 dark:text-dark-ink dark:hover:bg-dark-subtle',
        variant === 'subtle' &&
          'bg-ink-100 text-ink-700 hover:bg-ink-200 dark:bg-dark-subtle dark:text-dark-ink dark:hover:bg-dark-border',
        variant === 'outline' &&
          'border border-surface-border text-ink-700 hover:bg-ink-50 dark:border-dark-border dark:text-dark-ink dark:hover:bg-dark-subtle',
        variant === 'danger' &&
          'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10',
        className,
      )}
    >
      {children}
    </button>
  );
}