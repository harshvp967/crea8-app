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
