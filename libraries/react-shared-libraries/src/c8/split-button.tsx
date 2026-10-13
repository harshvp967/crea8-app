'use client';

import {
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import clsx from 'clsx';

export type C8SplitItem = {
  id: string;
  label: string;
  icon?: ReactNode;
};

const defaultItems: C8SplitItem[] = [
  { id: 'post-now', label: 'Post now' },
  { id: 'draft', label: 'Save as draft' },
];

export function C8SplitButton({
  label = 'Add to calendar',
  icon,
  items = defaultItems,
  onSelect,
  loading = false,
  disabled = false,
  className,
}: {
  label?: string;
  icon?: ReactNode;
  items?: C8SplitItem[];
  onSelect?: (id: string) => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [upward, setUpward] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const inert = disabled || loading;

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) caretRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    if (root) {
      const rect = root.getBoundingClientRect();
      setUpward(window.innerHeight - rect.bottom < 180 && rect.top > 180);
    }
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return (
    <div
      ref={rootRef}
      className={clsx(
        'relative inline-flex h-[46px] w-full max-w-[230px] overflow-visible c8-tablet:w-[230px]',
        className
      )}
    >
      <div
        className={clsx(
          'flex h-full w-full overflow-hidden rounded-c8-pill border-c8-sticker shadow-c8-hard',
          inert
            ? 'border-c8-line bg-c8-soft text-c8-muted shadow-c8-none'
            : 'border-c8-hard bg-c8-cyan text-c8-on-cyan'
        )}
      >
        <button
          type="button"
          disabled={inert}
          className={clsx(
            'relative inline-flex min-w-0 flex-1 items-center gap-2 pl-5 pr-[18px] font-c8-body text-c8-button whitespace-nowrap',
            'transition-colors duration-c8-hover ease-c8-out active:duration-c8-press active:ease-c8-in',
            !inert && 'hover:bg-c8-cyan-hover active:bg-c8-cyan-pressed'
          )}
        >
          <span className={clsx('inline-flex items-center gap-2', loading && 'opacity-0')}>
            {icon ? <span className="inline-flex [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span> : null}
            {label}
          </span>
          {loading ? (
            <span className="pointer-events-none absolute left-5 h-5 w-5 rounded-full border-[2.5px] border-current border-t-transparent animate-c8-spin" />
          ) : null}
        </button>
        <span className={clsx('w-[1.5px] self-stretch', inert ? 'bg-c8-line' : 'bg-c8-hard')} />
        <button
          ref={caretRef}
          type="button"
          disabled={inert}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
          className={clsx(
            'inline-flex w-[46px] shrink-0 items-center justify-center transition-colors duration-c8-release ease-c8-out',
            open && !inert && 'bg-c8-cyan-pressed'
          )}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            aria-hidden
            className={clsx('transition-transform duration-c8-hover ease-c8-out', open && 'rotate-180')}
          >
            <path d="M4.5 7 L9 11.5 L13.5 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {open && !inert ? (
        <div
          id={menuId}
          role="menu"
          className={clsx(
            'absolute right-0 z-30 flex min-w-[240px] flex-col gap-0.5 rounded-c8-row border-c8-sticker border-c8-hard bg-c8-surface p-1.5 shadow-c8-hard-lg animate-c8-menu',
            upward ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]'
          )}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="flex h-10 items-center gap-3 rounded-c8-item px-3 py-2.5 text-left font-c8-body text-c8-body-lg font-medium text-c8-ink hover:bg-c8-soft"
              onClick={() => {
                onSelect?.(item.id);
                close(true);
              }}
            >
              {item.icon ? (
                <span className="inline-flex text-c8-muted [&>svg]:h-5 [&>svg]:w-5">{item.icon}</span>
              ) : null}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
