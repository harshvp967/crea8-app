'use client';

import clsx from 'clsx';

export function C8Toggle({
  checked,
  onCheckedChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={clsx(
        'relative inline-flex h-7 w-[46px] shrink-0 items-center rounded-c8-pill px-[3px] transition-colors duration-c8-toggle ease-c8-out',
        checked ? 'bg-c8-ink' : 'bg-c8-toggle-off',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <span
        className={clsx(
          'h-[22px] w-[22px] rounded-full transition-transform duration-c8-toggle ease-c8-out',
          checked ? 'translate-x-[18px] bg-c8-cyan' : 'translate-x-0 bg-white dark:bg-c8-bg'
        )}
      />
    </button>
  );
}
