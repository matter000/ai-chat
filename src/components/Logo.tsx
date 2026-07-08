interface Props {
  size?: number;
  className?: string;
}

export function Logo({ size = 24, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-label="AI Chat Logo"
    >
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        {/* 深色模式下更亮的渐变 */}
        <linearGradient id="logoGradDark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#logoGrad)" className="dark:fill-[url(#logoGradDark)]" />
      <path
        d="M14 26c0-3 2-5 5-5h20c3 0 5 2 5 5v12c0 3-2 5-5 5H26l-7 6v-6h-0c-3 0-5-2-5-5z"
        fill="white"
        opacity="0.95"
      />
      <circle cx="24" cy="32" r="2.2" fill="currentColor" className="text-blue-500 dark:text-blue-300" />
      <circle cx="32" cy="32" r="2.2" fill="currentColor" className="text-blue-500 dark:text-blue-300" />
      <circle cx="40" cy="32" r="2.2" fill="currentColor" className="text-blue-500 dark:text-blue-300" />
    </svg>
  );
}
