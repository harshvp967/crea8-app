'use client';

import { ReactNode } from 'react';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useUser } from '@gitroom/frontend/components/layout/user.context';

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
  const user = useUser();
  const mark = user?.partnerPlan === 'gta6clips_free' ? 'Scheduled with crea8.one' : '';
  return (
    <header className={className ? `c8-sched-head ${className}` : 'c8-sched-head'}>
      <div className="c8-sched-copy">
        <div className="c8-sched-kicker">
          <span className="c8-sched-badge">{t('schedule', 'Schedule')}</span>
          {context ? <span className="c8-sched-context">{context}</span> : null}
          {mark ? <span className="c8-sched-context">{mark}</span> : null}
        </div>
        <h1 className="c8-sched-title">{title}</h1>
        <div className="c8-sched-sub">{subtitle}</div>
      </div>
      {actions ? <div className="c8-sched-actions">{actions}</div> : null}
    </header>
  );
};
