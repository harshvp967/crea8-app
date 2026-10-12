'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

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
        <HugeIcon name="more" size={18} />
      </button>
      {open ? (
        <div className="arc-menu" role="menu">
          {children}
        </div>
      ) : null}
    </div>
  );
};
