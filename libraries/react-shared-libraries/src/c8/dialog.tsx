'use client';

import { ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

const focusable =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function C8Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide = false,
  titleSize = 'h2',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  titleSize?: 'h1' | 'h2';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const nodes = panel ? Array.from(panel.querySelectorAll<HTMLElement>(focusable)) : [];
    (nodes[0] || panel)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const list = Array.from(panel.querySelectorAll<HTMLElement>(focusable));
      if (!list.length) {
        event.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center c8-tablet:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-c8-scrim c8-tablet:bg-c8-scrim max-[639px]:bg-c8-scrim-sheet"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          'relative z-[1] flex w-full flex-col gap-[18px] border-c8-sticker border-c8-hard bg-c8-surface outline-none',
          'max-[639px]:animate-c8-sheet max-[639px]:rounded-t-c8-dialog max-[639px]:px-5 max-[639px]:pb-[30px] max-[639px]:pt-5',
          'c8-tablet:animate-c8-pop c8-tablet:rounded-c8-dialog c8-tablet:p-6 c8-tablet:shadow-c8-hard-lg',
          wide ? 'c8-tablet:w-[520px]' : 'c8-tablet:w-[480px]'
        )}
      >
        <div className="mx-auto h-[5px] w-10 rounded-[9px] bg-c8-line c8-tablet:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <h2
              id={titleId}
              className={clsx(
                'font-c8-heading text-c8-ink',
                titleSize === 'h1' ? 'text-c8-h1' : 'text-c8-h2'
              )}
            >
              {title}
            </h2>
            {description ? <p className="text-c8-body text-c8-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-c8-tile bg-c8-soft text-c8-ink"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M4.5 4.5 L13.5 13.5 M13.5 4.5 L4.5 13.5" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
        </div>
        {children}
        {footer ? <div className="flex justify-end gap-2.5 pb-1.5">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
