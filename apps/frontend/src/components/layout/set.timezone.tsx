'use client';
import dayjs, { ConfigType, Dayjs } from 'dayjs';
import { FC, useEffect } from 'react';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.extend(relativeTime);

const { utc: originalUtc } = dayjs;

/** Zone reported by the browser. This is never the server clock. */
export const browserTimezone = () => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (zone) {
    return zone;
  }
  return dayjs.tz.guess();
};

/**
 * Display timezone. A saved value is used only when the user chose one.
 * Otherwise the browser zone from Intl is the default.
 */
export const getTimezone = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('timezone');
    if (saved) {
      return saved;
    }
  }
  return browserTimezone();
};

/** Current instant in the display timezone. */
export const displayNow = (instant: ConfigType = new Date()): Dayjs => {
  return dayjs(instant).tz(getTimezone());
};

/**
 * A calendar value in the display timezone.
 * Date-only and wall-clock strings are read in that zone.
 * Dates and timestamps are instants converted into that zone.
 */
export const displayDayjs = (config?: ConfigType): Dayjs => {
  const zone = getTimezone();
  if (config == null) {
    return dayjs().tz(zone);
  }
  if (dayjs.isDayjs(config)) {
    return config.tz(zone);
  }
  if (config instanceof Date || typeof config === 'number') {
    return dayjs(config).tz(zone);
  }
  return dayjs.tz(config, zone);
};

/** Hour 0 is midnight in `zone`, not UTC. */
export const hourSlotInZone = (day: string, hour: number, zone: string) => {
  return dayjs.tz(day, zone).startOf('day').add(hour, 'hour');
};

export const nowInZone = (zone: string, instant: Date = new Date()) => {
  return dayjs(instant).tz(zone);
};

/** The current hour stays open. Any earlier hour has fully passed. */
export const isPastHour = (slot: Dayjs, now: Dayjs) => {
  return slot.startOf('hour').isBefore(now.startOf('hour'));
};

/** A picker day is past only when that calendar day is before today in the display zone. */
export const isPastCalendarDay = (cell: Date, now: Dayjs = displayNow()) => {
  return dayjs(cell).format('YYYY-MM-DD') < now.format('YYYY-MM-DD');
};

export const newDayjs = (config?: ConfigType) => {
  return dayjs(config);
};

const installTimezone = () => {
  dayjs.utc = (config?: ConfigType, format?: string, strict?: boolean) => {
    const result = originalUtc(config, format, strict);
    result.local = function () {
      return result.tz(getTimezone());
    };
    return result;
  };
  if (typeof window !== 'undefined' && localStorage.getItem('timezone')) {
    dayjs.tz.setDefault(getTimezone());
  }
};

const SetTimezone: FC = () => {
  useEffect(() => {
    installTimezone();
  }, []);
  return null;
};

export default SetTimezone;
