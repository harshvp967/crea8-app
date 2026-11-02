'use client';

import { ReactNode } from 'react';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

// One header for Agent, Analytics, Media, Plugs, Integrations, and Settings.
// The badge, context, title, and subtitle stay in this order so a later page
// cannot move them. Calendar and Composer do not use this shell.
export const SchedulePageHead = ({
  title,
  context,
  subtitle,
  actions,
}: {
  title: ReactNode;
  context?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) => {
  const t = useT();
  return (
    <header className="c8-sched-head">
      <div className="c8-sched-copy">
        <div className="c8-sched-kicker">
          <span className="c8-sched-badge">{t('schedule', 'Schedule')}</span>
          {context ? <span className="c8-sched-context">{context}</span> : null}
        </div>
        <h1 className="c8-sched-title">{title}</h1>
        <div className="c8-sched-sub">{subtitle}</div>
      </div>
      {actions ? <div className="c8-sched-actions">{actions}</div> : null}
    </header>
  );
};
