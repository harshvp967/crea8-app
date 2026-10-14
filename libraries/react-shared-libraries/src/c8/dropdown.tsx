'use client';

import { useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';

export type C8DropdownOption = {
  value: string | number;
  label: string;
};

export function C8Dropdown({
  label,
  name,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  name?: string;
  value: string | number;
  options: C8DropdownOption[];
  onChange: (event: { target: { name?: string; value: string } }) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((option) => String(option.value) === String(value));

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={clsx('c8-dropdown relative flex flex-col gap-[6px]', className)}>
      <div className="c8-dropdown-label text-[14px]">{label}</div>
      <button
        type="button"
        name={name}
        ref={triggerRef}
        className="c8-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          const rect = triggerRef.current?.getBoundingClientRect();
          if (rect) {
            setMenuBox({ top: rect.bottom + 6, left: rect.left, width: rect.width });
          }
          setOpen(true);
        }}
      >
        <span>{selected?.label ?? ''}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {open ? (
        <div
          id={listId}
          role="listbox"
          className="c8-dropdown-menu animate-c8-menu"
          style={menuBox ? { top: menuBox.top, left: menuBox.left, width: menuBox.width } : undefined}
        >
          {options.map((option) => {
            const isSelected = String(option.value) === String(value);
            return (
              <button
                key={String(option.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={clsx('c8-dropdown-option', isSelected && 'is-selected')}
                onClick={() => {
                  onChange({ target: { name, value: String(option.value) } });
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
