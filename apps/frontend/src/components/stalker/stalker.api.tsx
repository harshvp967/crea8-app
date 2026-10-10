'use client';

import {
  stkEmpty,
  stkIconTile,
  stkPage,
  stkSub,
  stkTitle,
} from '@gitroom/frontend/components/stalker/stalker.chrome';

export const StalkerApi = () => {
  return (
    <div className={stkPage}>
      <div>
        <h1 className={stkTitle}>API</h1>
        <p className={stkSub}>Alert your agents as soon as Stalker finds a new mention.</p>
      </div>
      <section className={stkEmpty}>
        <span className={stkIconTile} aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13 6l-2 12" />
          </svg>
        </span>
        <h2 className="text-[16px] font-[600]">Coming soon</h2>
        <p className="max-w-[420px] text-[14px] leading-[1.5] text-textItemBlur">
          API keys and signed webhooks for new mentions are not part of this release. The workspace public API stays for scheduling and integrations. A project can still store a mention webhook on the server; this tab will be the place to create keys and endpoints.
        </p>
      </section>
    </div>
  );
};
