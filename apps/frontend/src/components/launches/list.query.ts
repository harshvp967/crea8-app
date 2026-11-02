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

// A list range of one day (startDate=endDate) hides every post on the other
// days of that month. The list starts at the beginning of the month instead.
export function listFromInstant(input: {
  zone: string;
  startDate?: string;
  endDate?: string;
  now?: Date;
}): string {
  if (input.startDate && input.endDate && input.startDate === input.endDate) {
    return dayjs
      .tz(input.startDate, input.zone)
      .startOf('month')
      .utc()
      .toISOString();
  }
  if (input.startDate && input.endDate) {
    return dayjs.tz(input.startDate, input.zone).startOf('day').utc().toISOString();
  }
  return startOfTodayUtc(input.zone, input.now ?? new Date());
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
