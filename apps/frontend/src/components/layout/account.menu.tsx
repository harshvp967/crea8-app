'use client';

import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { LogoutComponent } from '@gitroom/frontend/components/layout/logout.component';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import dynamic from 'next/dynamic';

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
}: {
  open: boolean;
  helpOpen: boolean;
  onHelpToggle: () => void;
  onClose: () => void;
  onSettings: () => void;
  onBilling: () => void;
}) => {
  const user = useUser();
  if (!open) return null;

  const plan = planLabel(user?.tier?.current);
  const usage = usageLabel(
    user?.totalChannels || 0,
    user?.tier?.channel,
    user?.tier?.posts_per_month
  );

  return (
    <>
      <button type="button" className="c8-account-scrim" aria-label="Close account menu" onClick={onClose} />
      <div className="c8-account-pop" role="menu" aria-label="Account">
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
    </>
  );
};
