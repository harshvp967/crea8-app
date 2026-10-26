import { FC, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Calendar, TimeInput } from '@mantine/dates';
import { useClickOutside } from '@mantine/hooks';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { displayDayjs, displayNow, getTimezone, isPastCalendarDay } from '@gitroom/frontend/components/layout/set.timezone';
import { CalendarIcon } from '@gitroom/frontend/components/ui/icons';
import {
  CLOCK_PREFERENCE_EVENT,
  isUSCitizen,
} from '@gitroom/frontend/components/launches/helpers/isuscitizen.utils';
import {
  composerDateLabel,
  composerTimeLabel,
  resolveWallClock,
} from '@gitroom/frontend/components/launches/helpers/date.picker.time';
import { useGrabToClose } from '@gitroom/frontend/components/launches/helpers/grab.to.close';

function subscribeClockPreference(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === 'isUS' || event.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CLOCK_PREFERENCE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CLOCK_PREFERENCE_EVENT, onStoreChange);
  };
}

function readTwelveHour() {
  return isUSCitizen();
}

export const DatePicker: FC<{
  date: dayjs.Dayjs;
  onChange: (day: dayjs.Dayjs) => void;
  /** Pill matches the draft-card clock. Composer is the footer chip. */
  variant?: 'composer' | 'pill';
}> = (props) => {
  const { date, onChange, variant = 'composer' } = props;
  const pill = variant === 'pill';
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const t = useT();
  const popRef = useRef<HTMLDivElement>(null);

  const changeShow = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  useGrabToClose(popRef, open, close);
  const ref = useClickOutside<HTMLDivElement>(() => {
    if (pill) {
      return;
    }
    setOpen(false);
  });
  const place = useCallback(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const rect = node.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 16);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = window.innerWidth - width - 8;
    }
    left = Math.max(8, left);
    const estimated = 380;
    let top = rect.bottom + 8;
    if (top + estimated > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estimated - 8);
    }
    setBox({ top, left, width });
  }, [ref]);
  useEffect(() => {
    if (!open || !pill) {
      return;
    }
    place();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || popRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open, pill, place, ref]);
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);
  const changeDate = useCallback(
    (type: 'date' | 'time') => (day: Date | null) => {
      if (!day) {
        return;
      }
      const picked = dayjs(day);
      const current = displayDayjs(date);
      const datePart =
        type === 'time' ? current.format('YYYY-MM-DD') : picked.format('YYYY-MM-DD');
      const clock = type === 'time' ? picked : current;
      const resolved = resolveWallClock(
        datePart,
        clock.hour(),
        clock.minute(),
        clock.second(),
        getTimezone()
      );
      onChange(displayDayjs(resolved.wall));
    },
    [date, onChange]
  );
  const wall = displayDayjs(date);
  // Server render stays on the 12-hour label. The client snapshot follows
  // the AM/PM setting, including a change made while this picker is open.
  const twelveHour = useSyncExternalStore(
    subscribeClockPreference,
    readTwelveHour,
    () => true
  );
  const dateLabel = composerDateLabel(wall, twelveHour);
  const timeLabel = composerTimeLabel(wall, twelveHour);
  const pillLabel = wall.format(twelveHour ? 'MMM D, h:mm A' : 'MMM D, HH:mm');
  const pickerValue = new Date(
    wall.year(),
    wall.month(),
    wall.date(),
    wall.hour(),
    wall.minute(),
    wall.second()
  );
  const popup = open ? (
        <div
          ref={popRef}
          onClick={(e) => e.stopPropagation()}
          className={
            pill
              ? 'po-date-pop c8-date-pop flex flex-col'
              : 'po-date-pop animate-fadeIn absolute bottom-[calc(100%+8px)] end-0 z-[300] flex flex-col'
          }
          style={
            pill
              ? box
                ? { position: 'fixed', top: box.top, left: box.left, width: box.width, zIndex: 1200 }
                : { position: 'fixed', visibility: 'hidden' }
              : undefined
          }
        >
          <div className="arc-grab" aria-hidden />
          <Calendar
            onChange={changeDate('date')}
            value={pickerValue}
            hideOutsideDates
            allowLevelChange={false}
            weekendDays={[]}
            excludeDate={(day) => isPastCalendarDay(day, displayNow())}
            dayClassName={(cell, modifiers) => {
              if (modifiers.outside) {
                return 'po-day-out';
              }
              if (modifiers.selected) {
                return 'po-day-on';
              }
              if (modifiers.disabled) {
                return 'po-day-past';
              }
              if (
                dayjs(cell).format('YYYY-MM-DD') ===
                displayNow().format('YYYY-MM-DD')
              ) {
                return 'po-day-today';
              }
              return 'po-day';
            }}
            classNames={{
              calendarHeaderControl: 'text-textColor',
              calendarHeaderLevel: 'text-textColor',
            }}
          />
          <div className="po-date-time">
            <div className="po-date-zone text-[12px] font-[500] text-textItemBlur px-[4px]">
              {getTimezone()}
            </div>
            <label className="po-date-clock">
              <CalendarIcon />
              <span>{timeLabel}</span>
              <TimeInput
                value={pickerValue}
                format={twelveHour ? '12' : '24'}
                onChange={changeDate('time')}
                classNames={{
                  wrapper: 'po-date-native-wrap',
                  input: 'po-date-native',
                }}
              />
            </label>
            <button type="button" className="po-date-close" onClick={changeShow}>
              {t('done', 'Done')}
            </button>
          </div>
        </div>
  ) : null;
  return (
    <div
      className={
        pill
          ? 'po-date-chip c8-date-pill'
          : clsx(
              'po-date-chip border rounded-[8px] justify-center flex items-center relative h-[44px] text-[15px] font-[600] ml-[7px] select-none flex-1',
              open ? 'border-[#00D9FF] bg-[#00D9FF]/10' : 'border-newTextColor/10'
            )
      }
      ref={ref}
    >
      <button
        type="button"
        className="po-date-trigger"
        aria-expanded={open}
        aria-label={pill ? pillLabel : dateLabel}
        onClick={changeShow}
      >
        {pill ? (
          <HugeIcon name="clock" size={14} />
        ) : (
          <div className="cursor-pointer">
            <CalendarIcon />
          </div>
        )}
        <div className="po-date-label cursor-pointer whitespace-nowrap">
          {pill ? pillLabel : dateLabel}
        </div>
      </button>
      {pill && popup && typeof document !== 'undefined'
        ? createPortal(popup, document.body)
        : popup}
    </div>
  );
};
