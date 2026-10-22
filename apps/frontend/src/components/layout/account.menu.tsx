'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { LogoutComponent } from '@gitroom/frontend/components/layout/logout.component';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import dynamic from 'next/dynamic';

const sheetQuery = '(max-width: 639px), (max-height: 500px)';

const useAccountSheet = () => {
  const [sheet, setSheet] = useState(false);
  useLayoutEffect(() => {
    const media = window.matchMedia(sheetQuery);
    const apply = () => setSheet(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  return sheet;
};

export const useAccountMenu = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
    setHelpOpen(false);
  }, []);
  const toggle = useCallback(() => {
    setOpen((value) => {
      if (value) setHelpOpen(false);
      return !value;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (document.querySelector('.arc-dialog-wrap')) return;
      event.preventDefault();
      close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, open]);

  const onSettings = useCallback(() => {
    close();
    router.push('/account?section=profile');
  }, [close, router]);
  const onBilling = useCallback(() => {
    close();
    router.push('/account?section=billing');
  }, [close, router]);
  const onHelpToggle = useCallback(() => {
    setHelpOpen((value) => !value);
  }, []);

  return { open, helpOpen, toggle, close, onSettings, onBilling, onHelpToggle };
};

const ModeComponent = dynamic(
  () => import('@gitroom/frontend/components/layout/mode.component'),
  { ssr: false }
);

const planLabel = (current: string | undefined) => {
  const name = (current || 'FREE').toLowerCase();
  return name.charAt(0).toUpperCase() + name.slice(1);
};

const usageLabel = (
  used: number,
  limit: number | undefined,
  posts: number | undefined
) => {
  const postLine =
    !posts ? 'No monthly posts' : posts > 10000 ? 'Unlimited posts' : `${posts} posts / month`;
  if (!limit) return postLine;
  return `${used} of ${limit} channels · ${postLine}`;
};

export const AccountMenu = ({
  open,
  helpOpen,
  onHelpToggle,
  onClose,
  onSettings,
  onBilling,
  anchorRef,
  surface,
}: {
  open: boolean;
  helpOpen: boolean;
  onHelpToggle: () => void;
  onClose: () => void;
  onSettings: () => void;
  onBilling: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  surface: 'sidebar' | 'header';
}) => {
  const user = useUser();
  const sheet = useAccountSheet();
  const popRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const show = open && (surface === 'header' ? sheet : !sheet);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const pop = popRef.current;
    if (!anchor || !pop) return;
    const rect = anchor.getBoundingClientRect();
    const host = anchor.closest('.c8-sidebar')?.getBoundingClientRect();
    const pad = 12;
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(280, Math.max(0, vw - pad * 2));
    const maxHeight = Math.max(160, vh - pad * 2);
    const height = Math.min(pop.scrollHeight, maxHeight);
    const originRight = host?.right ?? rect.right;
    const originLeft = host?.left ?? rect.left;
    let left = originRight + gap;
    if (left + width > vw - pad) {
      const flipped = originLeft - gap - width;
      left = flipped >= pad ? flipped : Math.max(pad, vw - pad - width);
    }
    if (left < pad) left = pad;
    let top = rect.bottom - height;
    if (top + height > vh - pad) top = vh - pad - height;
    if (top < pad) top = pad;
    const next = {
      top: Math.round(top),
      left: Math.round(left),
      width: Math.round(width),
      maxHeight: Math.round(maxHeight),
    };
    setBox((prev) =>
      prev &&
      prev.top === next.top &&
      prev.left === next.left &&
      prev.width === next.width &&
      prev.maxHeight === next.maxHeight
        ? prev
        : next
    );
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!show || sheet) return;
    place();
  }, [show, sheet, helpOpen, place]);

  useEffect(() => {
    if (!show || sheet) return;
    const onMove = () => place();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [show, sheet, place]);

  if (!show || typeof document === 'undefined') return null;

  const plan = planLabel(user?.tier?.current);
  const usage = usageLabel(
    user?.totalChannels || 0,
    user?.tier?.channel,
    user?.tier?.posts_per_month
  );

  return createPortal(
    <>
      <button
        type="button"
        className={sheet ? 'c8-account-scrim is-sheet' : 'c8-account-scrim'}
        aria-label="Close account menu"
        onClick={onClose}
      />
      <div
        ref={popRef}
        className={sheet ? 'c8-account-pop is-sheet' : 'c8-account-pop'}
        role="menu"
        aria-label="Account"
        style={
          sheet
            ? undefined
            : {
                top: box?.top ?? 12,
                left: box?.left ?? 12,
                width: Math.max(box?.width ?? 240, 240),
                maxHeight: box?.maxHeight,
                visibility: box ? 'visible' : 'hidden',
              }
        }
      >
        <button type="button" className="c8-account-plan" role="menuitem" onClick={onBilling}>
          <span className="c8-account-plan-copy">
            <span className="c8-account-plan-name">{plan}</span>
            <span className="c8-account-usage">{usage}</span>
          </span>
          <HugeIcon name="chevron-right" size={16} />
        </button>
        <button type="button" className="c8-account-item" role="menuitem" onClick={onSettings}>
          Settings
        </button>
        <button
          type="button"
          className="c8-account-item"
          role="menuitem"
          aria-expanded={helpOpen}
          aria-haspopup="menu"
          onClick={onHelpToggle}
        >
          <span>Help & support</span>
          <HugeIcon name={helpOpen ? 'chevron-up' : 'chevron-right'} size={16} />
        </button>
        {helpOpen ? (
          <div className="c8-account-sub" role="menu" aria-label="Help and support">
            <a role="menuitem" href="https://crea8.one/docs" target="_blank" rel="noreferrer" onClick={onClose}>
              Docs
            </a>
            <a role="menuitem" href="mailto:support@crea8.one" onClick={onClose}>
              Contact support
            </a>
            <a role="menuitem" href="https://crea8.one/changelog" target="_blank" rel="noreferrer" onClick={onClose}>
              What&apos;s new
            </a>
          </div>
        ) : null}
        <div className="c8-account-item c8-account-theme">
          <span>Theme</span>
          <ModeComponent />
        </div>
        <div className="c8-account-rule" />
        <div className="c8-account-item c8-account-logout" role="menuitem">
          <LogoutComponent label="Log out" />
        </div>
      </div>
    </>,
    document.body
  );
};
