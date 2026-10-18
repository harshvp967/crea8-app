'use client';

import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { stkPage, stkTitle } from '@gitroom/frontend/components/stalker/stalker.chrome';

export const StalkerApi = () => {
  return (
    <div className={`${stkPage} stk-api`}>
      <div className="stk-head">
        <div className="min-w-0">
          <div className="stk-kicker">
            <span className="stk-sticker">Stalker</span>
          </div>
          <h1 className={`${stkTitle} stk-api-title`}>API</h1>
        </div>
      </div>
      <section className="stk-api-panel">
        <div className="stk-api-soon stk-state">
          <span className="stk-api-mark stk-state-mark" aria-hidden>
            <HugeIcon name="code" size={24} />
          </span>
          <p>Coming soon</p>
        </div>
      </section>
    </div>
  );
};
