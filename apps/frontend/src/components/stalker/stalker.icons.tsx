export const SourceIcon = ({
  source,
  className = 'h-[14px] w-[14px]',
}: {
  source: string;
  className?: string;
}) => {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    'aria-hidden': true as const,
  };
  if (source.startsWith('YOUTUBE')) {
    return (
      <svg {...common}>
        <rect x="3" y="6" width="18" height="12" rx="3" />
        <path d="M11 10l4 2-4 2z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (source.startsWith('REDDIT')) {
    return (
      <svg {...common}>
        <circle cx="12" cy="13" r="7" />
        <circle cx="9" cy="12.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12.5" r="1" fill="currentColor" stroke="none" />
        <path d="M9.5 15.5c.8.8 1.6 1.1 2.5 1.1s1.7-.3 2.5-1.1" />
      </svg>
    );
  }
  if (source === 'X' || source.startsWith('X_')) {
    return (
      <svg {...common}>
        <path d="M5 5l14 14M19 5L5 19" />
      </svg>
    );
  }
  if (source.startsWith('LINKEDIN')) {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 10v6M8 8h.01M12 16v-3.5a2 2 0 114 0V16" />
      </svg>
    );
  }
  if (source.startsWith('INSTAGRAM')) {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <circle cx="12" cy="12" r="3.5" />
        <circle cx="17" cy="7" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M8 12h8" />
    </svg>
  );
};
