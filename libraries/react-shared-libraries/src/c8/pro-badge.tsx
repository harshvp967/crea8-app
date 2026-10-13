import clsx from 'clsx';

export function C8ProBadge({
  className,
  label = 'Pro',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-c8-pill border border-c8-pro-stroke bg-c8-pro px-2.5 py-1 font-c8-body text-c8-badge text-c8-on-pro',
        className
      )}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="currentColor">
        <path d="M6 1.2 7.3 4.2 10.6 4.5 8.1 6.7 8.9 10 6 8.3 3.1 10 3.9 6.7 1.4 4.5 4.7 4.2 6 1.2Z" />
      </svg>
      {label}
    </span>
  );
}
