import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

// Meta's daily insight end_time is the first instant after the day it
// describes. A noon stamp is already on that day and stays there.
export function insightDay(endTime: string) {
  const parsed = dayjs.utc(endTime);
  if (!parsed.isValid()) {
    return String(endTime || '').slice(0, 10);
  }
  return parsed.subtract(1, 'second').format('YYYY-MM-DD');
}

// A 7-day chart must end on today. Drop any point dated after `today`
// (YYYY-MM-DD in the viewer's timezone), including a server day that is
// already tomorrow locally.
export function throughToday<T extends { date?: string | null }>(
  points: T[] | null | undefined,
  today: string
): T[] {
  const end = String(today || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return [];
  }
  return (Array.isArray(points) ? points : []).filter((point) => {
    const day = String(point?.date || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= end;
  });
}
