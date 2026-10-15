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

// /posts/list query. All adds `from` (start of today, no end).
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
}): string {
  const params = new URLSearchParams({
    page: String(input.page),
    limit: String(input.limit ?? 100),
    customer: input.customer || '',
    state: input.state,
  });
  if (input.state === 'all' && input.includeFrom !== false && input.timezone) {
    params.set('from', startOfTodayUtc(input.timezone, input.now ?? new Date()));
  }
  return params.toString();
}
