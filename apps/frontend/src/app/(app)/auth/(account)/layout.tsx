import { getT } from '@gitroom/react/translation/get.translation.service.backend';

export const dynamic = 'force-dynamic';
import { ReactNode } from 'react';
import loadDynamic from 'next/dynamic';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
const ReturnUrlComponent = loadDynamic(() => import('../return.url.component'));

export default async function AccountAuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getT();

  return (
    <div className="auth-shell">
      <ReturnUrlComponent />
      <aside className="auth-pitch">
        <LogoTextComponent />
        <div className="auth-pitch-copy">
          <h1>
            {t(
              'auth_panel_headline',
              'Schedule, listen and share from one place.'
            )}
          </h1>
          <p className="auth-pitch-kicker">
            {t('auth_panel_kicker', 'Schedule · Stalker')}
          </p>
          <ul>
            <li>
              <span className="auth-pitch-icon" aria-hidden>
                <HugeIcon name="calendar" size={18} />
              </span>
              <span>{t('auth_panel_schedule_body', 'Plan a week of posts in one calendar')}</span>
            </li>
            <li>
              <span className="auth-pitch-icon" aria-hidden>
                <HugeIcon name="target" size={18} />
              </span>
              <span>{t('auth_panel_insights_body', 'Every mention of your brand in one feed')}</span>
            </li>
            <li>
              <span className="auth-pitch-icon" aria-hidden>
                <HugeIcon name="pencil" size={18} />
              </span>
              <span>{t('auth_panel_draft_body', 'Turn an insight into a ready-to-edit post')}</span>
            </li>
          </ul>
        </div>
        <div className="auth-pitch-foot">crea8.one</div>
      </aside>
      <main className="auth-main">
        <div className="auth-logo-mobile">
          <LogoTextComponent />
        </div>
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
