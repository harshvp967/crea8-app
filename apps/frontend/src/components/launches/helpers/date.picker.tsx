import { FC, useCallback, useRef, useState, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Calendar, TimeInput } from '@mantine/dates';
import { useClickOutside } from '@mantine/hooks';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
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
}> = (props) => {
  const { date, onChange } = props;
  const [open, setOpen] = useState(false);
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
    setOpen(false);
  });
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
  const pickerValue = new Date(
    wall.year(),
    wall.month(),
    wall.date(),
    wall.hour(),
    wall.minute(),
    wall.second()
  );
  return (
    <div
      className={clsx(
        'po-date-chip border rounded-[8px] justify-center flex items-center relative h-[44px] text-[15px] font-[600] ml-[7px] select-none flex-1',
        open ? 'border-[#00D9FF] bg-[#00D9FF]/10' : 'border-newTextColor/10'
      )}
      ref={ref}
    >
      <button
        type="button"
        className="po-date-trigger"
        aria-expanded={open}
        aria-label={dateLabel}
        onClick={changeShow}
      >
        <div className="cursor-pointer">
          <CalendarIcon />
        </div>
        <div className="po-date-label cursor-pointer whitespace-nowrap">
          {dateLabel}
        </div>
      </button>
      {open && (
        <div
          ref={popRef}
          onClick={(e) => e.stopPropagation()}
          className="po-date-pop animate-fadeIn absolute bottom-[calc(100%+8px)] end-0 z-[300] flex flex-col"
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
            <div className="text-[12px] font-[500] text-textItemBlur px-[4px]">
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
      )}
    </div>
  );
};
