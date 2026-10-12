'use client';

import { ButtonHTMLAttributes, ReactNode, useEffect } from 'react';
import { HugeIcon, type HugeIconName } from '@gitroom/frontend/components/icons/hugeicons';
import {
  stkClose,
  stkDanger,
  stkDialog,
  stkDialogBody,
  stkDialogHead,
  stkPrimary,
  stkSecondary,
} from '@gitroom/frontend/components/stalker/stalker.chrome';

export const LinkToggle = ({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) => (
  <button
    type="button"
    className="lib-toggle"
    data-on={checked ? 'true' : 'false'}
    aria-label={label}
    aria-pressed={checked}
    onClick={() => onChange(!checked)}
  >
    <i />
  </button>
);

export const LinkModal = ({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="lib-modal"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={`lib-dialog ${stkDialog}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className={stkDialogHead}>
          <h2 className="min-w-0 text-[18px] font-[600] leading-[1.2] tracking-[-0.02em]">{title}</h2>
          <button type="button" className={stkClose} aria-label="Close" onClick={onClose}>
            <HugeIcon name="close" size={16} />
          </button>
        </div>
        <div className={stkDialogBody}>{children}</div>
      </div>
    </div>
  );
};

export const LinkField = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <label className="lib-field">
    <span>{label}</span>
    {children}
  </label>
);

export const LinkMenuRow = ({
  icon,
  danger,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: HugeIconName; danger?: boolean }) => (
  <button type="button" className={`${danger ? 'danger ' : ''}${className || ''}`} {...props}>
    <HugeIcon name={icon} size={16} />
    <span>{children}</span>
  </button>
);

export const linkPrimary = `${stkPrimary} lib-raised`;
export const linkSecondary = stkSecondary;
export const linkDanger = `${stkDanger} lib-danger`;
export const linkChoice =
  'stk-wave inline-flex h-[44px] min-h-[44px] shrink-0 items-center justify-center gap-[8px] rounded-[18px] border border-[color:var(--arc-selected-border)] bg-newBgColorInner px-[16px] text-[14px] font-[500] text-newTextColor shadow-[var(--arc-shadow-resting)]';
