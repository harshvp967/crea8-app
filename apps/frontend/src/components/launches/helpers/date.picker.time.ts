import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/** Footer and clock text. 12-hour follows the AM/PM setting, otherwise 24-hour. */
export function composerDateLabel(
  wall: { format: (pattern: string) => string },
  twelveHour: boolean
) {
  return wall.format(
    twelveHour ? 'ddd, MMM D · h:mm A' : 'ddd, D MMM · HH:mm'
  );
}

export function composerTimeLabel(
  wall: { format: (pattern: string) => string },
  twelveHour: boolean
) {
  return wall.format(twelveHour ? 'h:mm A' : 'HH:mm');
}

export type ResolvedWallClock = {
  /** Wall time that exists in `zone`. A spring-forward gap moves past the skip. */
  wall: string;
  /** True when the requested clock time does not exist and was moved forward. */
  shifted: boolean;
};

/**
 * Spring-forward gaps (for example 02:30 in America/New_York) are not real
 * times. dayjs turns them into a later hour. Return that later wall time once
 * so the picker does not shift the same gap again.
 */
export function resolveWallClock(
  date: string,
  hour24: number,
  minute: number,
  second: number,
  zone: string
): ResolvedWallClock {
  const hour = String(Math.min(23, Math.max(0, Math.trunc(hour24)))).padStart(2, '0');
  const min = String(Math.min(59, Math.max(0, Math.trunc(minute)))).padStart(2, '0');
  const sec = String(Math.min(59, Math.max(0, Math.trunc(second)))).padStart(2, '0');
  const requested = `${date} ${hour}:${min}:${sec}`;
  const parsed = dayjs.tz(requested, zone);
  if (!parsed.isValid()) {
    return { wall: requested, shifted: false };
  }
  const formatted = parsed.format('YYYY-MM-DD HH:mm:ss');
  if (formatted === requested) {
    return { wall: requested, shifted: false };
  }
  return { wall: formatted, shifted: true };
}
