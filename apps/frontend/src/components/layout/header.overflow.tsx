'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

export const HeaderOverflow = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  return (
    <div className="header-overflow relative shrink-0" ref={ref}>
      <button
        type="button"
        className="arc-icon-btn"
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
          <circle cx="3.5" cy="9" r="1.35" />
          <circle cx="9" cy="9" r="1.35" />
          <circle cx="14.5" cy="9" r="1.35" />
        </svg>
      </button>
      {open ? (
        <div className="arc-menu" role="menu">
          {children}
        </div>
      ) : null}
    </div>
  );
};
