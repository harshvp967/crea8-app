'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

export type C8ButtonVariant = 'primary' | 'secondary' | 'ghost';

const variantClass: Record<C8ButtonVariant, string> = {
  primary:
    'bg-c8-cyan text-c8-on-cyan border-c8-sticker border-c8-hard shadow-c8-hard hover:bg-c8-cyan-hover hover:shadow-c8-hard-hover hover:-translate-y-0.5 active:bg-c8-cyan-pressed active:shadow-c8-hard-press active:translate-y-[3px]',
  secondary:
    'bg-c8-btn-secondary text-c8-ink border-c8-sticker border-c8-btn-secondary-stroke shadow-c8-hard hover:bg-c8-btn-hover hover:shadow-c8-hard-hover hover:-translate-y-0.5 active:bg-c8-btn-secondary active:shadow-c8-hard-press active:translate-y-[3px]',
  ghost: 'bg-transparent text-c8-ink border border-transparent hover:bg-c8-btn-hover active:bg-c8-btn-hover',
};

export function C8Button({
  variant = 'primary',
  icon,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: C8ButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
}) {
  const inert = disabled || loading;
  return (
    <button
      {...props}
      type={type}
      disabled={inert}
      aria-busy={loading || undefined}
      className={clsx(
        'c8-btn relative inline-flex items-center justify-center gap-2 h-[46px] pl-5 pr-[22px] rounded-c8-pill font-c8-body text-c8-button whitespace-nowrap',
        'transition-[background-color,box-shadow,transform] duration-c8-hover ease-c8-out',
        'active:duration-c8-press active:ease-c8-in',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-c8-ink',
        !inert && variantClass[variant],
        inert &&
          'border border-c8-line bg-c8-soft text-c8-muted shadow-c8-none hover:translate-y-0 hover:bg-c8-soft hover:shadow-c8-none active:translate-y-0 active:bg-c8-soft active:shadow-c8-none',
        disabled && 'cursor-not-allowed',
        loading && 'cursor-wait',
        className
      )}
    >
      <span className={clsx('inline-flex items-center gap-2', loading && 'opacity-0')}>
        {icon ? (
          <span className="inline-flex shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]" aria-hidden>
            {icon}
          </span>
        ) : null}
        {children}
      </span>
      {loading ? (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <span className="h-5 w-5 rounded-full border-[2.5px] border-current border-t-transparent animate-c8-spin" />
        </span>
      ) : null}
    </button>
  );
}
