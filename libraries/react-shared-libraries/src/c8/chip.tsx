import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type ChipVariant = 'filter' | 'nav' | 'sticker' | 'popular' | 'sentiment';

const variantClass: Record<ChipVariant, string> = {
  filter:
    'h-[34px] border border-c8-line bg-c8-surface px-3.5 py-2 text-c8-body-sm font-medium text-c8-ink aria-[pressed=true]:border-c8-ink aria-[pressed=true]:bg-c8-ink aria-[pressed=true]:text-c8-on-ink',
  nav: 'h-[30px] border-c8-sticker border-c8-hard bg-c8-surface px-3 py-1.5 text-[12px] font-semibold text-c8-ink',
  sticker: 'bg-c8-schedule px-2.5 py-1 text-c8-badge text-[#121016]',
  popular: 'bg-c8-cyan px-2.5 py-1 text-c8-badge text-[#121016]',
  sentiment: 'bg-c8-positive px-2.5 py-[5px] text-c8-badge text-[#121016]',
};

export function C8Chip({
  variant = 'filter',
  active = false,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ChipVariant;
  active?: boolean;
}) {
  return (
    <button
      {...props}
      type={type}
      aria-pressed={variant === 'filter' ? active : undefined}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-c8-pill font-c8-body whitespace-nowrap',
        variantClass[variant],
        className
      )}
    />
  );
}
