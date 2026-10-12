'use client';

import { ReactNode, useEffect } from 'react';

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
      <div className="lib-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mb-[14px] flex items-center justify-between gap-[12px]">
          <h2 className="text-[18px] font-[600]">{title}</h2>
          <button type="button" className="text-[18px] text-textItemBlur" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
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

export const linkPrimary =
  'inline-flex h-[40px] items-center justify-center rounded-[18px] bg-forth px-[16px] text-[14px] font-[600] text-[#0A0A0A] disabled:opacity-50';
export const linkSecondary =
  'inline-flex h-[40px] items-center justify-center rounded-[18px] border border-newBorder bg-transparent px-[16px] text-[14px] font-[500]';
export const linkDanger =
  'inline-flex h-[40px] items-center justify-center rounded-[18px] border border-[#f07178] px-[16px] text-[14px] font-[600] text-[#f07178]';
