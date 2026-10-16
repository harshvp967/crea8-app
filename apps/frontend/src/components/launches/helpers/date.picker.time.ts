export type ClockPeriod = 'AM' | 'PM';

export type HourChoice = {
  value: number;
  label: string;
  selected: boolean;
};

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

export function clockPeriod(hour24: number): ClockPeriod {
  return hour24 >= 12 ? 'PM' : 'AM';
}

export function hourChoices(hour24: number, twelveHour: boolean): HourChoice[] {
  if (!twelveHour) {
    return Array.from({ length: 24 }, (_, hour) => ({
      value: hour,
      label: String(hour).padStart(2, '0'),
      selected: hour === hour24,
    }));
  }

  const shown = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return Array.from({ length: 12 }, (_, index) => {
    const label = index === 0 ? 12 : index;
    return {
      value: label,
      label: String(label),
      selected: label === shown,
    };
  });
}

export function minuteChoices(minute: number): HourChoice[] {
  return Array.from({ length: 60 }, (_, value) => ({
    value,
    label: String(value).padStart(2, '0'),
    selected: value === minute,
  }));
}

/** Map a 12-hour face value plus AM/PM back to 0–23. 24-hour choices pass through. */
export function hour24FromChoice(
  choice: number,
  period: ClockPeriod | null,
  twelveHour: boolean
) {
  if (!twelveHour || !period) {
    return Math.min(23, Math.max(0, choice));
  }
  const base = choice % 12;
  return period === 'PM' ? base + 12 : base;
}

/** Keep the hour on the clock face and switch AM/PM. */
export function hour24WithPeriod(hour24: number, period: ClockPeriod) {
  const base = hour24 % 12;
  return period === 'PM' ? base + 12 : base;
}

/**
 * Wall-clock string in the display zone. `displayDayjs` reads this in that
 * zone, so the saved instant matches the hour and minute the user picked.
 */
export function wallClockString(
  wall: { format: (pattern: string) => string },
  hour24: number,
  minute: number
) {
  const hour = String(Math.min(23, Math.max(0, hour24))).padStart(2, '0');
  const min = String(Math.min(59, Math.max(0, minute))).padStart(2, '0');
  return `${wall.format('YYYY-MM-DD')} ${hour}:${min}:00`;
}
