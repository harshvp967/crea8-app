'use client';

import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div aria-hidden="true" className={clsx('c8-skeleton', className)} {...props} />
  );
}

export function SelectSkeleton() {
  return (
    <div className="flex flex-col gap-[8px]" aria-hidden="true">
      <Skeleton className="h-[14px] w-[128px] max-w-full rounded-full" />
      <Skeleton className="h-[44px] w-full rounded-[14px]" />
    </div>
  );
}

export function ToggleRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="settings-row" key={index}>
          <div className="settings-row-copy">
            <Skeleton className="h-[14px] w-[160px] max-w-full rounded-full" />
          </div>
          <Skeleton className="h-[28px] w-[57px] rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SettingsListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-[12px]" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          className="flex items-center gap-[12px] rounded-c8-row border border-c8-line bg-c8-surface p-[12px]"
          key={index}
        >
          <Skeleton className="h-[36px] w-[36px] shrink-0 rounded-c8-tile" />
          <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
            <Skeleton className="h-[14px] w-[40%] rounded-full" />
            <Skeleton className="h-[12px] w-[68%] rounded-full" />
          </div>
          <Skeleton className="hidden h-[32px] w-[72px] shrink-0 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

export function CalendarPostSkeleton() {
  return (
    <div className="flex w-full items-center gap-[8px] p-[6px]" aria-hidden="true">
      <Skeleton className="h-[28px] w-[28px] shrink-0 rounded-full" />
      <Skeleton className="h-[12px] min-w-0 flex-1 rounded-full" />
    </div>
  );
}

export function CalendarGridSkeleton() {
  return (
    <div
      className="grid h-full min-h-[280px] grid-cols-1 gap-[8px] sm:grid-cols-2 md:grid-cols-7"
      aria-hidden="true"
    >
      {Array.from({ length: 7 }).map((_, day) => (
        <div
          className="flex min-h-[120px] flex-col gap-[8px] rounded-[12px] border border-c8-line p-[8px] md:min-h-0"
          key={day}
        >
          <Skeleton className="mx-auto h-[12px] w-[48px] rounded-full" />
          <CalendarPostSkeleton />
          {day % 2 === 0 ? <CalendarPostSkeleton /> : null}
        </div>
      ))}
    </div>
  );
}

export function CalendarListSkeleton() {
  return (
    <div className="cal-list flex flex-1 flex-col gap-[10px] px-[10px]" aria-hidden="true">
      <Skeleton className="mx-auto mt-[10px] h-[14px] w-[180px] max-w-full rounded-full" />
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          className="flex items-center gap-[10px] rounded-[12px] border border-c8-line bg-c8-surface p-[10px]"
          key={index}
        >
          <Skeleton className="h-[36px] w-[36px] shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
            <Skeleton className="h-[12px] w-[30%] rounded-full" />
            <Skeleton className="h-[14px] w-[72%] rounded-full" />
          </div>
          <Skeleton className="h-[12px] w-[48px] shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SchedulePageSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 gap-[12px]" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div
        className="hidden w-[280px] shrink-0 flex-col gap-[14px] rounded-[26px] border border-c8-line bg-c8-surface p-[18px] md:flex"
        aria-hidden="true"
      >
        <Skeleton className="h-[18px] w-[96px] rounded-full" />
        <Skeleton className="h-[44px] w-full rounded-[14px]" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="flex items-center gap-[10px]" key={index}>
            <Skeleton className="h-[36px] w-[36px] shrink-0 rounded-full" />
            <Skeleton className="h-[12px] w-[120px] max-w-full rounded-full" />
          </div>
        ))}
      </div>
      <div
        className="calendar-panel flex min-w-0 flex-1 flex-col gap-[12px] rounded-c8-card border border-c8-line bg-c8-bg p-[16px]"
        aria-hidden="true"
      >
        <div className="flex items-center gap-[8px]">
          <Skeleton className="h-[36px] w-[36px] rounded-full md:hidden" />
          <Skeleton className="h-[36px] w-[120px] max-w-[40%] rounded-full" />
          <Skeleton className="ms-auto h-[36px] w-[160px] max-w-[46%] rounded-full" />
        </div>
        <CalendarGridSkeleton />
      </div>
    </div>
  );
}

export function ComposerFrameSkeleton() {
  return (
    <div
      className="composer c8-composer flex h-full w-full flex-1 p-[16px] md:p-[40px]"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading</span>
      <div
        className="composer-frame flex min-h-[480px] flex-1 flex-col gap-[16px] rounded-[20px] bg-newBgColorInner p-[16px] md:flex-row md:p-[24px]"
        aria-hidden="true"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-[12px]">
          <div className="flex gap-[8px]">
            <Skeleton className="h-[36px] w-[36px] rounded-full" />
            <Skeleton className="h-[36px] w-[36px] rounded-full" />
            <Skeleton className="h-[36px] w-[120px] max-w-[40%] rounded-full" />
          </div>
          <Skeleton className="min-h-[220px] flex-1 rounded-[16px]" />
          <div className="flex gap-[8px]">
            <Skeleton className="h-[36px] w-[36px] rounded-[12px]" />
            <Skeleton className="h-[36px] w-[36px] rounded-[12px]" />
            <Skeleton className="ms-auto h-[40px] w-[120px] rounded-full" />
          </div>
        </div>
        <div className="flex w-full flex-col gap-[12px] md:w-[280px] md:shrink-0">
          <Skeleton className="h-[18px] w-[120px] rounded-full" />
          <Skeleton className="h-[160px] w-full rounded-[18px]" />
          <Skeleton className="h-[44px] w-full rounded-[14px]" />
          <Skeleton className="h-[44px] w-full rounded-[14px]" />
        </div>
      </div>
    </div>
  );
}

export function ContinueGridSkeleton() {
  return (
    <div className="cc-pages flex flex-col gap-[20px]" aria-hidden="true">
      <Skeleton className="h-[18px] w-[180px] max-w-full rounded-full" />
      <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton className="h-[92px] w-full rounded-[8px]" key={index} />
        ))}
      </div>
      <Skeleton className="h-[44px] w-[96px] rounded-full" />
    </div>
  );
}

export function OAuthConsentSkeleton() {
  return (
    <div
      className="oauth-consent-card flex flex-col gap-[24px] rounded-[26px] border border-c8-line bg-c8-surface p-[32px]"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-[16px]">
        <div className="flex items-center gap-[12px]">
          <Skeleton className="h-[56px] w-[56px] rounded-[16px]" />
          <Skeleton className="h-[16px] w-[16px] rounded-full" />
          <Skeleton className="h-[56px] w-[56px] rounded-[16px]" />
        </div>
        <Skeleton className="h-[22px] w-[180px] max-w-full rounded-full" />
        <Skeleton className="h-[14px] w-[96px] rounded-full" />
        <Skeleton className="h-[12px] w-[70%] rounded-full" />
        <Skeleton className="h-[12px] w-[54%] rounded-full" />
      </div>
      <div className="oauth-consent-actions flex gap-[12px]">
        <Skeleton className="h-[44px] flex-1 rounded-[18px]" />
        <Skeleton className="h-[44px] flex-1 rounded-[18px]" />
      </div>
    </div>
  );
}

export function CreditsCardSkeleton() {
  return (
    <section
      className="settings-section account-bill-card flex flex-col gap-[12px]"
      aria-hidden="true"
    >
      <Skeleton className="h-[16px] w-[72px] rounded-full" />
      <Skeleton className="h-[32px] w-[120px] max-w-full rounded-full" />
      <Skeleton className="h-[8px] w-full rounded-full" />
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="flex items-center gap-[12px]" key={index}>
          <Skeleton className="h-[28px] w-[28px] shrink-0 rounded-[10px]" />
          <Skeleton className="h-[12px] min-w-0 flex-1 rounded-full" />
          <Skeleton className="h-[12px] w-[40px] shrink-0 rounded-full" />
        </div>
      ))}
    </section>
  );
}

export function AccountBillingSkeleton() {
  return (
    <div
      className="account-bill flex flex-col gap-[16px]"
      data-billing-state="loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading</span>
      <div className="account-bill-grid" aria-hidden="true">
        <section className="settings-section account-bill-card account-bill-hold flex flex-col gap-[12px]">
          <Skeleton className="h-[16px] w-[40%] rounded-full" />
          <Skeleton className="h-[28px] w-[55%] rounded-full" />
          <Skeleton className="h-[12px] w-[70%] rounded-full" />
          <Skeleton className="mt-auto h-[40px] w-[140px] max-w-full rounded-full" />
        </section>
        <CreditsCardSkeleton />
      </div>
      <section
        className="settings-section account-bill-card account-bill-hold is-packs flex flex-wrap items-center gap-[12px]"
        aria-hidden="true"
      >
        <Skeleton className="h-[16px] w-[120px] rounded-full" />
        <Skeleton className="ms-auto h-[36px] w-[96px] rounded-full" />
      </section>
      <section
        className="settings-section account-bill-card account-bill-hold is-invoices flex flex-col gap-[10px]"
        aria-hidden="true"
      >
        <Skeleton className="h-[14px] w-[100px] rounded-full" />
        <Skeleton className="h-[12px] w-full rounded-full" />
        <Skeleton className="h-[12px] w-[80%] rounded-full" />
      </section>
    </div>
  );
}

export function LinkBlockSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-[12px]" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          className="flex items-center gap-[12px] rounded-c8-row border border-c8-line bg-c8-surface p-[12px]"
          key={index}
        >
          <Skeleton className="h-[40px] w-[40px] shrink-0 rounded-c8-tile" />
          <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
            <Skeleton className="h-[14px] w-[46%] rounded-full" />
            <Skeleton className="h-[12px] w-[72%] rounded-full" />
          </div>
          <Skeleton className="h-[28px] w-[48px] shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function LinkPreviewSkeleton() {
  return (
    <div
      className="flex h-full w-full flex-col items-center gap-[12px] px-[24px] py-[32px]"
      aria-hidden="true"
    >
      <Skeleton className="h-[72px] w-[72px] rounded-full" />
      <Skeleton className="h-[16px] w-[120px] rounded-full" />
      <Skeleton className="h-[12px] w-[80%] rounded-full" />
      <Skeleton className="mt-[8px] h-[44px] w-full rounded-full" />
      <Skeleton className="h-[44px] w-full rounded-full" />
      <Skeleton className="h-[44px] w-full rounded-full" />
    </div>
  );
}

export function LinkToggleRows({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div className={index === rows - 1 ? 'lib-toggle-row' : 'lib-toggle-row mb-[14px]'} key={index}>
          <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
            <Skeleton className="h-[14px] w-[46%] max-w-[220px] rounded-full" />
            <Skeleton className="h-[12px] w-[70%] max-w-[320px] rounded-full" />
          </div>
          <Skeleton className="h-[28px] w-[48px] shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function LeadsTableSkeleton() {
  return (
    <section
      className="overflow-hidden rounded-c8-card border border-c8-line bg-c8-surface"
      aria-hidden="true"
    >
      <div className="hidden gap-[12px] border-b border-c8-line px-[16px] py-[12px] md:grid md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton className="h-[12px] w-[70%] rounded-full" key={index} />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, row) => (
        <div
          className="flex flex-col gap-[8px] border-b border-c8-line px-[16px] py-[14px] last:border-b-0 md:grid md:grid-cols-4 md:items-center md:gap-[12px] lg:grid-cols-6"
          key={row}
        >
          {Array.from({ length: 6 }).map((_, col) => (
            <Skeleton
              className={col > 3 ? 'hidden h-[12px] w-[80%] rounded-full lg:block' : 'h-[12px] w-[80%] rounded-full'}
              key={col}
            />
          ))}
        </div>
      ))}
    </section>
  );
}

export function MetricCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-[12px] min-[1200px]:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          className="flex flex-col gap-[10px] rounded-c8-card border border-c8-line bg-c8-surface p-[16px]"
          key={index}
        >
          <Skeleton className="h-[12px] w-[50%] rounded-full" />
          <Skeleton className="h-[24px] w-[40%] rounded-full" />
          <Skeleton className="h-[10px] w-[30%] rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function ChartCardSkeleton() {
  return (
    <section
      className="flex flex-col gap-[12px] rounded-c8-card border border-c8-line bg-c8-surface p-[20px]"
      aria-hidden="true"
    >
      <Skeleton className="h-[16px] w-[160px] max-w-[60%] rounded-full" />
      <Skeleton className="h-[180px] w-full rounded-c8-row" />
    </section>
  );
}

export function MentionCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-[12px]" aria-hidden="true">
      {Array.from({ length: rows }).map((_, row) => (
        <div
          className="flex flex-col gap-[12px] rounded-c8-row border border-c8-line bg-c8-surface p-[16px]"
          key={row}
        >
          <div className="flex items-center gap-[12px]">
            <Skeleton className="h-[28px] w-[28px] rounded-full" />
            <Skeleton className="h-[14px] w-[160px] max-w-[60%] rounded-full" />
          </div>
          <Skeleton className="h-[14px] w-full rounded-full" />
          <Skeleton className="h-[14px] w-[70%] rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function StalkerPageSkeleton() {
  return (
    <div className="flex flex-col gap-[12px] p-[24px]" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="flex flex-col gap-[12px]" aria-hidden="true">
        <Skeleton className="h-[28px] w-[180px] max-w-full rounded-full" />
        <Skeleton className="h-[14px] w-[260px] max-w-full rounded-full" />
        <MentionCardSkeleton rows={2} />
      </div>
    </div>
  );
}

export function ThemeCardSkeleton() {
  return (
    <div className="flex flex-col gap-[12px]" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <article
          className="flex flex-col gap-[10px] rounded-[26px] border border-c8-line bg-c8-surface p-[20px]"
          key={index}
        >
          <div className="flex items-center gap-[12px]">
            <Skeleton className="h-[18px] min-w-0 flex-1 rounded-full" />
            <Skeleton className="h-[14px] w-[28px] rounded-full" />
          </div>
          <Skeleton className="h-[14px] w-full rounded-full" />
          <Skeleton className="h-[14px] w-[80%] rounded-full" />
        </article>
      ))}
    </div>
  );
}

export function StalkerAnalyticsSkeleton() {
  return (
    <div className="stk-an-loading flex flex-col gap-[16px]" aria-busy="true" aria-hidden="true">
      <Skeleton className="h-[280px] w-full rounded-c8-row" />
      <div className="stk-an-grid">
        <Skeleton className="h-[180px] w-full rounded-c8-row" />
        <Skeleton className="h-[180px] w-full rounded-c8-row" />
        <Skeleton className="h-[180px] w-full rounded-c8-row" />
      </div>
    </div>
  );
}

export function NotificationListSkeleton() {
  return (
    <div className="flex flex-col" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="flex items-start gap-[12px] border-b border-c8-line px-[16px] py-[14px]" key={index}>
          <Skeleton className="h-[32px] w-[32px] shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
            <Skeleton className="h-[12px] w-[80%] rounded-full" />
            <Skeleton className="h-[10px] w-[40%] rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableRowsSkeleton({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="flex flex-col gap-[10px] overflow-x-auto rounded-[8px] border border-c8-line p-[12px]" aria-hidden="true">
      {Array.from({ length: rows }).map((_, row) => (
        <div className="grid min-w-[520px] gap-[12px]" key={row} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton className="h-[12px] w-[80%] rounded-full" key={col} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ChannelListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-[8px]" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="flex items-center gap-[10px] rounded-[14px] px-[8px] py-[8px]" key={index}>
          <Skeleton className="h-[36px] w-[36px] shrink-0 rounded-full" />
          <Skeleton className="h-[14px] w-[140px] max-w-[70%] rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function CommentsSkeleton() {
  return (
    <div className="mb-6 flex flex-col gap-[12px]" aria-hidden="true">
      <Skeleton className="h-[98px] w-full rounded-[12px]" />
      <div className="flex justify-end">
        <Skeleton className="h-[36px] w-[88px] rounded-full" />
      </div>
      {Array.from({ length: 2 }).map((_, index) => (
        <div className="flex gap-[10px]" key={index}>
          <Skeleton className="h-[32px] w-[32px] shrink-0 rounded-full" />
          <Skeleton className="h-[48px] min-w-0 flex-1 rounded-[12px]" />
        </div>
      ))}
    </div>
  );
}

export function TagsSkeleton() {
  return (
    <div className="flex flex-1 flex-wrap items-center gap-[8px]" aria-hidden="true">
      <Skeleton className="h-[28px] w-[72px] rounded-full" />
      <Skeleton className="h-[28px] w-[96px] rounded-full" />
      <Skeleton className="h-[32px] min-w-[120px] flex-1 rounded-[8px]" />
    </div>
  );
}

export function PlugGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          className="flex flex-col gap-[10px] rounded-c8-row border border-c8-line bg-c8-surface p-[16px]"
          key={index}
        >
          <Skeleton className="h-[16px] w-[50%] rounded-full" />
          <Skeleton className="h-[12px] w-full rounded-full" />
          <Skeleton className="h-[12px] w-[70%] rounded-full" />
          <Skeleton className="mt-[4px] h-[32px] w-[48px] rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function DeveloperCardSkeleton() {
  return (
    <div className="flex flex-col gap-[16px]" aria-hidden="true">
      <Skeleton className="h-[14px] w-[80%] rounded-full" />
      <Skeleton className="h-[14px] w-[62%] rounded-full" />
      <div className="flex flex-col gap-[12px] overflow-hidden rounded-[12px] border border-c8-line bg-c8-surface p-[20px]">
        <Skeleton className="h-[16px] w-[180px] max-w-full rounded-full" />
        <Skeleton className="h-[12px] w-[70%] rounded-full" />
        <Skeleton className="h-[40px] w-[140px] max-w-full rounded-full" />
      </div>
    </div>
  );
}

export function FieldCardSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <section className="flex flex-col gap-[12px] rounded-c8-card border border-c8-line bg-c8-surface p-[20px]" aria-hidden="true">
      <Skeleton className="h-[16px] w-[160px] max-w-[50%] rounded-full" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton className="h-[44px] w-full rounded-[14px]" key={index} />
      ))}
    </section>
  );
}

export function AppearanceSectionsSkeleton() {
  return (
    <div className="flex flex-col gap-[12px]" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          className="flex items-center gap-[12px] rounded-c8-row border border-c8-line bg-c8-surface p-[16px]"
          key={index}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
            <Skeleton className="h-[16px] w-[34%] rounded-full" />
            <Skeleton className="h-[12px] w-[52%] rounded-full" />
          </div>
          <Skeleton className="h-[16px] w-[16px] shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SummaryCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-[12px] sm:flex-row" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          className="flex min-w-0 flex-1 flex-col gap-[10px] rounded-c8-row border border-c8-line bg-c8-surface p-[16px]"
          key={index}
        >
          <Skeleton className="h-[12px] w-[60%] rounded-full" />
          <Skeleton className="h-[28px] w-[40%] rounded-full" />
        </div>
      ))}
    </div>
  );
}
