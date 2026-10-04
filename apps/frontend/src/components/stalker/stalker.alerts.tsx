import Link from 'next/link';

export const StalkerAlerts = () => {
  return (
    <div className="flex max-w-[640px] flex-col gap-[12px]">
      <h1 className="text-[28px] font-[600]">Alerts</h1>
      <p className="text-[14px] leading-[1.5] text-textItemBlur">
        When classification marks a mention as a bug report or a complaint, or
        gives it an urgency of 70 or higher, Stalker emails the address saved
        on the project. Nothing is sent until alerts are turned on.
      </p>
      <Link className="text-[14px] text-[#00D9FF] underline" href="/stalker/settings">
        Choose the address in Settings
      </Link>
    </div>
  );
};
