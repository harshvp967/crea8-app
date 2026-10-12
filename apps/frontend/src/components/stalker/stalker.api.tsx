'use client';

import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

export const StalkerApi = () => {
  return (
    <div className="stk-page stk-api">
      <section className="stk-api-panel">
        <h1 className="stk-api-title">API</h1>
        <div className="stk-api-soon">
          <span className="stk-api-mark" aria-hidden>
            <HugeIcon name="code" size={24} />
          </span>
          <p>Coming soon</p>
        </div>
      </section>
    </div>
  );
};
