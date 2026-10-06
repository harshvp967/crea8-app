// Instant fallback while a Stalker tab renders (no blocking on the dynamic layout).
export default function StalkerLoading() {
  return (
    <div className="flex flex-col gap-[12px] p-[24px]" aria-hidden>
      <div className="h-[28px] w-[180px] animate-pulse rounded-full bg-newBoxHover" />
      <div className="h-[18px] w-[260px] animate-pulse rounded-full bg-newBoxHover" />
      <div className="mt-[8px] h-[120px] animate-pulse rounded-[16px] border border-newBorder bg-newBoxHover" />
      <div className="h-[120px] animate-pulse rounded-[16px] border border-newBorder bg-newBoxHover" />
    </div>
  );
}
