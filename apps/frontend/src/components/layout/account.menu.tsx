'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import type { HugeIconName } from '@gitroom/frontend/components/icons/hugeicons/paths';
import { LogoutComponent } from '@gitroom/frontend/components/layout/logout.component';
import { WorkspaceSwitchList } from '@gitroom/frontend/components/layout/organization.selector';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import dynamic from 'next/dynamic';

const sheetQuery = '(max-width: 639px), (max-height: 500px)';
const expandedSidebarWidth = 160;

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
  const [planOpen, setPlanOpen] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
    setHelpOpen(false);
    setPlanOpen(false);
  }, []);
  const toggle = useCallback(() => {
    setOpen((value) => {
      if (value) {
        setHelpOpen(false);
        setPlanOpen(false);
      }
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
    router.push('/account');
  }, [close, router]);
  const onBilling = useCallback(() => {
    close();
    router.push('/account?section=billing');
  }, [close, router]);
  const onHelpToggle = useCallback(() => {
    setHelpOpen((value) => !value);
    setPlanOpen(false);
  }, []);
  const onPlanToggle = useCallback(() => {
    setPlanOpen((value) => !value);
    setHelpOpen(false);
  }, []);

  return {
    open,
    helpOpen,
    planOpen,
    toggle,
    close,
    onSettings,
    onBilling,
    onHelpToggle,
    onPlanToggle,
  };
};

const ModeComponent = dynamic(
  () => import('@gitroom/frontend/components/layout/mode.component'),
  { ssr: false }
);

const planLabel = (current: string | undefined) => {
  const name = (current || 'FREE').toLowerCase();
  return name.charAt(0).toUpperCase() + name.slice(1);
};

const postLineOf = (posts: number | undefined) => {
  if (!posts) return 'No monthly posts';
  if (posts > 10000) return 'Unlimited posts';
  return `${posts} posts / month`;
};

const channelLineOf = (channels: number | undefined) => {
  if (!channels || channels <= 0) return null;
  return channels === 1 ? '1 channel' : `${channels} channels`;
};

// Allowance comes from the plan tier. totalChannels is not a usage count
// (without Stripe it is a 10000 sentinel), so it must not be shown as "used of limit".
const planSummary = (channels: number | undefined, posts: number | undefined) => {
  const postLine = postLineOf(posts);
  const channelLine = channelLineOf(channels);
  return {
    channelLine,
    postLine,
    facts: channelLine ? [channelLine, postLine] : [postLine],
  };
};

const useFlyoutBox = (rowRef: RefObject<HTMLElement | null>) => {
  const flyRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const row = rowRef.current;
    const fly = flyRef.current;
    if (!row || !fly) return;
    const rect = row.getBoundingClientRect();
    const pad = 12;
    const gap = 8;
    const width = fly.offsetWidth;
    const height = fly.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.right + gap;
    let top = rect.top;
    const fitsRight = left + width <= vw - pad;
    const flipped = rect.left - gap - width;
    const fitsLeft = flipped >= pad;
    if (fitsRight) left = rect.right + gap;
    else if (fitsLeft) left = flipped;
    else {
      left = Math.max(pad, Math.min(rect.left, vw - pad - width));
      top = rect.top - gap - height;
    }
    if (top + height > vh - pad) top = Math.max(pad, vh - pad - height);
    if (top < pad) top = pad;
    const next = { top: Math.round(top), left: Math.round(left) };
    setBox((prev) =>
      prev && prev.top === next.top && prev.left === next.left ? prev : next
    );
  }, [rowRef]);

  useLayoutEffect(() => {
    place();
  }, [place]);

  useEffect(() => {
    const onMove = () => place();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [place]);

  return { flyRef, box };
};

const AccountFlyout = ({
  rowRef,
  label,
  children,
  className = '',
}: {
  rowRef: RefObject<HTMLElement | null>;
  label: string;
  children: ReactNode;
  className?: string;
}) => {
  const { flyRef, box } = useFlyoutBox(rowRef);
  return (
    <div
      ref={flyRef}
      className={`c8-account-fly ${className}`.trim()}
      role="menu"
      aria-label={label}
      style={{
        top: box?.top ?? 0,
        left: box?.left ?? 0,
        visibility: box ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>
  );
};

const RowLead = ({ icon, children }: { icon: HugeIconName; children: ReactNode }) => (
  <span className="c8-account-lead">
    <HugeIcon name={icon} size={16} className="c8-account-ico" />
    {children}
  </span>
);

export const AccountMenu = ({
  open,
  helpOpen,
  planOpen,
  onHelpToggle,
  onPlanToggle,
  onClose,
  onSettings,
  onBilling,
  anchorRef,
  surface,
}: {
  open: boolean;
  helpOpen: boolean;
  planOpen: boolean;
  onHelpToggle: () => void;
  onPlanToggle: () => void;
  onClose: () => void;
  onSettings: () => void;
  onBilling: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  surface: 'sidebar' | 'header';
}) => {
  const user = useUser();
  const sheet = useAccountSheet();
  const popRef = useRef<HTMLDivElement>(null);
  const planRowRef = useRef<HTMLButtonElement>(null);
  const helpRowRef = useRef<HTMLButtonElement>(null);
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
    const maxHeight = Math.max(160, vh - pad * 2);
    const height = Math.min(pop.offsetHeight, maxHeight);
    const expanded = !!host && host.width >= expandedSidebarWidth;
    let left: number;
    let top: number;
    let width: number;

    if (expanded && host) {
      const maxRight = Math.min(host.right, vw - pad);
      left = rect.left;
      width = host.right - left;
      if (left + width > maxRight) width = maxRight - left;
      if (left < pad) {
        width -= pad - left;
        left = pad;
      }
      width = Math.min(Math.max(160, width), Math.max(160, maxRight - left));
      top = rect.top - gap - height;
      if (top < pad) {
        const below = rect.bottom + gap;
        if (below + height <= vh - pad) top = below;
        else top = pad;
      }
      if (top + height > vh - pad) top = Math.max(pad, vh - pad - height);
    } else {
      width = Math.min(280, Math.max(0, vw - pad * 2));
      const originRight = host?.right ?? rect.right;
      const originLeft = host?.left ?? rect.left;
      left = originRight + gap;
      if (left + width > vw - pad) {
        const flipped = originLeft - gap - width;
        left = flipped >= pad ? flipped : Math.max(pad, vw - pad - width);
      }
      if (left < pad) left = pad;
      top = rect.bottom - height;
      if (top + height > vh - pad) top = vh - pad - height;
      if (top < pad) top = pad;
    }

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
  }, [show, sheet, helpOpen, planOpen, box?.width, place]);

  useEffect(() => {
    if (!show || sheet) return;
    const onMove = () => place();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    const pop = popRef.current;
    const observer = pop ? new ResizeObserver(() => place()) : null;
    if (pop && observer) observer.observe(pop);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
      observer?.disconnect();
    };
  }, [show, sheet, place]);

  if (!show || typeof document === 'undefined') return null;

  const credits = user?.billingEnabled ? user.credits : null;
  const meter = credits ? `${credits.used}/${credits.allowance}` : null;
  const plan = credits
    ? user?.tier?.display_name || planLabel(user?.tier?.current)
    : planLabel(user?.tier?.current);
  const summary = planSummary(user?.tier?.channel, user?.tier?.posts_per_month);

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
                width: box?.width ?? 240,
                minWidth: box?.width ?? 240,
                maxHeight: box?.maxHeight,
                visibility: box ? 'visible' : 'hidden',
              }
        }
      >
        <WorkspaceSwitchList onDone={onClose} />
        <button
          ref={planRowRef}
          type="button"
          className="c8-account-plan"
          role="menuitem"
          aria-expanded={planOpen}
          aria-haspopup="menu"
          onClick={onPlanToggle}
        >
          <RowLead icon="gauge">
            <span className="c8-account-plan-copy">
              <span className="c8-account-plan-name">{plan}</span>
              {meter ? null : (
                <span className="c8-account-usage">
                  {summary.channelLine ? (
                    <span>
                      {summary.channelLine}
                      {' · '}
                    </span>
                  ) : null}
                  <span>{summary.postLine}</span>
                </span>
              )}
            </span>
          </RowLead>
          {meter ? <span className="c8-account-meter">{meter}</span> : null}
          <HugeIcon name="chevron-right" size={16} className="c8-account-chevron" />
        </button>
        <button type="button" className="c8-account-item" role="menuitem" onClick={onSettings}>
          <RowLead icon="settings">
            <span>Settings</span>
          </RowLead>
        </button>
        <button
          ref={helpRowRef}
          type="button"
          className="c8-account-item"
          role="menuitem"
          aria-expanded={helpOpen}
          aria-haspopup="menu"
          onClick={onHelpToggle}
        >
          <RowLead icon="book">
            <span>Help & support</span>
          </RowLead>
          <HugeIcon name="chevron-right" size={16} className="c8-account-chevron" />
        </button>
        <div className="c8-account-item c8-account-theme">
          <RowLead icon="palette">
            <span>Theme</span>
          </RowLead>
          <ModeComponent />
        </div>
        <div className="c8-account-rule" />
        <div className="c8-account-item c8-account-logout" role="menuitem">
          <HugeIcon name="logout" size={16} className="c8-account-ico" />
          <LogoutComponent label="Log out" />
        </div>
      </div>
      {planOpen ? (
        <AccountFlyout rowRef={planRowRef} label={`${plan} plan`} className="is-plan">
          <div className="c8-account-fly-title">{plan}</div>
          {meter ? (
            <div className="c8-account-fly-line">{meter}</div>
          ) : (
            summary.facts.map((fact) => (
              <div key={fact} className="c8-account-fly-line">
                {fact}
              </div>
            ))
          )}
          <div className="c8-account-rule" />
          <button type="button" className="c8-account-item" role="menuitem" onClick={onBilling}>
            Manage plan
          </button>
        </AccountFlyout>
      ) : null}
      {helpOpen ? (
        <AccountFlyout rowRef={helpRowRef} label="Help and support">
          <a role="menuitem" href="https://crea8.one/docs" target="_blank" rel="noreferrer" onClick={onClose}>
            Docs
          </a>
          <a role="menuitem" href="mailto:support@crea8.one" onClick={onClose}>
            Contact support
          </a>
          <a role="menuitem" href="https://crea8.one/changelog" target="_blank" rel="noreferrer" onClick={onClose}>
            What&apos;s new
          </a>
        </AccountFlyout>
      ) : null}
    </>,
    document.body
  );
};
