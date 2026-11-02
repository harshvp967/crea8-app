import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export type ListPostsState = 'all' | 'scheduled' | 'draft' | 'published';

// Midnight at the start of today in `zone`, as a UTC instant.
export function startOfTodayUtc(zone: string, now: Date = new Date()): string {
  return dayjs(now).tz(zone).startOf('day').utc().toISOString();
}

// A week or single-day range hides posts from earlier in that month. Month
// view still shows them. The list starts at the beginning of the month that
// contains the range, so Week, Month, and List agree on those posts.
export function listFromInstant(input: {
  zone: string;
  startDate?: string;
  endDate?: string;
  now?: Date;
}): string {
  if (input.startDate && input.endDate) {
    return dayjs
      .tz(input.startDate, input.zone)
      .startOf('month')
      .utc()
      .toISOString();
  }
  return startOfTodayUtc(input.zone, input.now ?? new Date());
}

// /posts/list query. All adds `from` and no end. A calendar range starts at
// the beginning of that month; with no range, `from` is the start of today.
// Scheduled, published, and drafts do not send a date. Drafts are every
// draft; the list request is the same at every screen width.
export function listPostsSearch(input: {
  page: number;
  limit?: number;
  customer?: string | null;
  state: ListPostsState;
  timezone?: string;
  now?: Date;
  includeFrom?: boolean;
  startDate?: string;
  endDate?: string;
}): string {
  const params = new URLSearchParams({
    page: String(input.page),
    limit: String(input.limit ?? 100),
    customer: input.customer || '',
    state: input.state,
  });
  if (input.state === 'all' && input.includeFrom !== false && input.timezone) {
    params.set(
      'from',
      listFromInstant({
        zone: input.timezone,
        startDate: input.startDate,
        endDate: input.endDate,
        now: input.now,
      })
    );
  }
  return params.toString();
}
