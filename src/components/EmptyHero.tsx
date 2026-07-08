interface Props {
  size?: number;
  className?: string;
}

export function EmptyHero({ size = 200, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 200 160"
      className={className}
    >
      <defs>
        <linearGradient id="emptyGrad1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id="emptyGrad2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="80" r="70" fill="url(#emptyGrad1)" />
      <circle cx="35" cy="40" r="4" fill="#3B82F6" opacity="0.3" />
      <circle cx="165" cy="50" r="6" fill="#60A5FA" opacity="0.25" />
      <circle cx="40" cy="120" r="3" fill="#A78BFA" opacity="0.35" />
      <circle cx="170" cy="115" r="5" fill="#3B82F6" opacity="0.2" />
      <circle cx="105" cy="25" r="2" fill="#60A5FA" opacity="0.4" />
      <circle cx="95" cy="140" r="3" fill="#A78BFA" opacity="0.3" />
      <g transform="translate(40, 50)">
        <path d="M0 8c0-4.4 3.6-8 8-8h44c4.4 0 8 3.6 8 8v24c0 4.4-3.6 8-8 8H20l-8 8v-8H8c-4.4 0-8-3.6-8-8z" fill="white" stroke="#3B82F6" strokeWidth="2" />
        <circle cx="20" cy="24" r="2.5" fill="#3B82F6" />
        <circle cx="30" cy="24" r="2.5" fill="#60A5FA" />
        <circle cx="40" cy="24" r="2.5" fill="#A78BFA" />
      </g>
      <g transform="translate(110, 90)">
        <circle cx="20" cy="20" r="20" fill="url(#emptyGrad2)" stroke="#A78BFA" strokeWidth="2" />
        <path d="M14 22c0-1.7 1.3-3 3-3h6c1.7 0 3 1.3 3 3v6c0 1.7-1.3 3-3 3h-3l-3 3v-3h-0c-1.7 0-3-1.3-3-3z" fill="white" />
      </g>
      <g opacity="0.6">
        <path d="M150 30l3-3 3 3-3 3z" fill="#60A5FA" />
        <path d="M30 100l2-2 2 2-2 2z" fill="#A78BFA" />
      </g>
    </svg>
  );
}
