import { getT } from '@gitroom/react/translation/get.translation.service.backend';

export const dynamic = 'force-dynamic';
import { ReactNode } from 'react';
import loadDynamic from 'next/dynamic';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Toaster } from '@gitroom/react/toaster/toaster';
const ReturnUrlComponent = loadDynamic(() => import('./return.url.component'));
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getT();

  return (
    <MantineWrapper>
      <Toaster />
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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="3" y="5" width="18" height="16" rx="3" />
                    <path d="M3 10h18M8 3v4M16 3v4" />
                  </svg>
                </span>
                <span>{t('auth_panel_schedule_body', 'Plan a week of posts in one calendar')}</span>
              </li>
              <li>
                <span className="auth-pitch-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="12" cy="12" r="8" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </span>
                <span>{t('auth_panel_insights_body', 'Every mention of your brand in one feed')}</span>
              </li>
              <li>
                <span className="auth-pitch-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                  </svg>
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
    </MantineWrapper>
  );
};
