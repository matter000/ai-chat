import { forwardRef } from 'react';
import { clsx } from 'clsx';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: 'bordered' | 'borderless';
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, variant = 'bordered', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      {...rest}
      className={clsx(
        variant === 'bordered' &&
          'h-8 rounded-md border border-surface-border dark:border-dark-border bg-white dark:bg-dark-subtle px-3 hover:border-ink-300 dark:hover:border-dark-border/80 focus:border-accent focus:ring-2 focus:ring-accent/20',
        variant === 'borderless' && 'bg-transparent',
        'w-full text-sm text-ink-900 dark:text-dark-ink placeholder:text-ink-400 dark:placeholder:text-dark-muted',
        'transition-colors duration-fast ease-out',
        'focus:outline-none',
        className,
      )}
    />
  );
});

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={clsx(
        'w-full rounded-md px-3 py-2 text-sm resize-none',
        'bg-white dark:bg-dark-subtle',
        'border border-surface-border dark:border-dark-border',
        'text-ink-900 dark:text-dark-ink placeholder:text-ink-400 dark:placeholder:text-dark-muted',
        'transition-colors duration-fast ease-out',
        'hover:border-ink-300',
        'focus:border-accent focus:ring-2 focus:ring-accent/20',
        className,
      )}
    />
  );
}