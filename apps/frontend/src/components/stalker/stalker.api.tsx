'use client';

export const StalkerApi = () => {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-[16px] px-[20px] py-[24px]">
      <div>
        <h1 className="text-[22px] font-[600]">API</h1>
        <p className="mt-[6px] text-[14px] text-textItemBlur">
          Alert your agents as soon as Stalker finds a new mention.
        </p>
      </div>
      <section className="rounded-[16px] border border-dashed border-newBorder bg-newBgColorInner px-[18px] py-[22px]">
        <p className="text-[15px] font-[600]">Coming soon</p>
        <p className="mt-[8px] text-[14px] leading-[1.5] text-textItemBlur">
          API keys and signed webhooks for new mentions are not part of this release. The workspace public API stays for scheduling and integrations. A project can still store a mention webhook on the server; this tab will be the place to create keys and endpoints.
        </p>
      </section>
    </div>
  );
};
