'use client';

import { ReactNode } from 'react';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

// One header for Calendar, Agent, Analytics, Media, Plugs, Integrations,
// and Settings. The badge, context, title, and subtitle stay in this order.
// Calendar passes className for its grid cell and stays full width.
// Composer does not use this shell.
export const SchedulePageHead = ({
  title,
  context,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  context?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) => {
  const t = useT();
  return (
    <header className={className ? `c8-sched-head ${className}` : 'c8-sched-head'}>
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
