'use client';

import { ReactNode } from 'react';

export function BillingShell({ children }: { children: ReactNode }) {
  return (
    <div className="billing-root flex flex-col gap-[16px] text-[14px] leading-[1.5] text-newTextColor">
      {children}
    </div>
  );
}

export function BillingHeading({
  as = 'h2',
  children,
}: {
  as?: 'h1' | 'h2' | 'h3';
  children: ReactNode;
}) {
  const Tag = as;
  return (
    <Tag className="billing-display m-0 text-[22px] font-[600] leading-[1.2]">
      {children}
    </Tag>
  );
}

export function BillingButton({
  kind = 'secondary',
  children,
  disabled,
  onClick,
  type = 'button',
}: {
  kind?: 'primary' | 'secondary' | 'danger';
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  const shared = 'rounded-[8px] border px-[14px] py-[8px] text-[14px] font-[600] disabled:opacity-50';
  if (kind === 'primary') {
    return (
      <button
        type={type}
        disabled={disabled}
        onClick={onClick}
        className={shared}
        style={{ background: '#00D9FF', color: '#0A0A0A', borderColor: '#00D9FF' }}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${shared} bg-transparent ${kind === 'danger' ? 'text-red-500 border-red-500' : 'border-newBorder text-newTextColor'}`}
    >
      {children}
    </button>
  );
}
