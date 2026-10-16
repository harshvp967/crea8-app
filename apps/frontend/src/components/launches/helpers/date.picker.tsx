import { FC, useCallback, useRef, useState, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Calendar } from '@mantine/dates';
import { useClickOutside } from '@mantine/hooks';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { displayDayjs, displayNow, getTimezone, isPastCalendarDay } from '@gitroom/frontend/components/layout/set.timezone';
import { CalendarIcon } from '@gitroom/frontend/components/ui/icons';
import { isUSCitizen } from '@gitroom/frontend/components/launches/helpers/isuscitizen.utils';
import {
  ClockPeriod,
  clockPeriod,
  composerDateLabel,
  composerTimeLabel,
  hour24FromChoice,
  hour24WithPeriod,
  hourChoices,
  minuteChoices,
  wallClockString,
} from '@gitroom/frontend/components/launches/helpers/date.picker.time';
import { useGrabToClose } from '@gitroom/frontend/components/launches/helpers/grab.to.close';

function subscribeClockPreference(): () => void {
  return () => undefined;
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
    (day: Date) => {
      const picked = dayjs(day);
      const current = displayDayjs(date);
      onChange(
        displayDayjs(
          picked.format('YYYY-MM-DD') + ' ' + current.format('HH:mm:ss')
        )
      );
    },
    [date, onChange]
  );
  const setWallTime = useCallback(
    (hour24: number, minute: number) => {
      onChange(displayDayjs(wallClockString(displayDayjs(date), hour24, minute)));
    },
    [date, onChange]
  );
  const wall = displayDayjs(date);
  // Server render stays on the previous 12-hour label. The client snapshot
  // reads the AM/PM setting after hydration, without touching localStorage
  // during the server render.
  const twelveHour = useSyncExternalStore(
    subscribeClockPreference,
    readTwelveHour,
    () => true
  );
  const hours = hourChoices(wall.hour(), twelveHour);
  const minutes = minuteChoices(wall.minute());
  const period = twelveHour ? clockPeriod(wall.hour()) : null;
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
  const pickHour = (choice: number) => {
    setWallTime(
      hour24FromChoice(choice, period, twelveHour),
      wall.minute()
    );
  };
  const pickMinute = (minute: number) => {
    setWallTime(wall.hour(), minute);
  };
  const pickPeriod = (next: ClockPeriod) => {
    setWallTime(hour24WithPeriod(wall.hour(), next), wall.minute());
  };
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
            onChange={(day) => {
              if (day) {
                changeDate(day);
              }
            }}
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
            <div className="po-date-clock">
              <CalendarIcon />
              <span>{timeLabel}</span>
            </div>
            <button type="button" className="po-date-close" onClick={changeShow}>
              {t('done', 'Done')}
            </button>
          </div>
          <div
            className="flex flex-col gap-[8px] px-[4px] pb-[8px]"
            role="group"
            aria-label={t('time', 'Time')}
          >
            <div role="listbox" aria-label={t('hour', 'Hour')} className="flex flex-wrap gap-[4px]">
              {hours.map((hour) => (
                <button
                  key={hour.label}
                  type="button"
                  role="option"
                  aria-selected={hour.selected}
                  className={clsx('po-menu-row', hour.selected && 'is-on')}
                  onClick={() => pickHour(hour.value)}
                >
                  {hour.label}
                </button>
              ))}
            </div>
            <div role="listbox" aria-label={t('minutes', 'Minutes')} className="flex flex-wrap gap-[4px]">
              {minutes.map((minute) => (
                <button
                  key={minute.label}
                  type="button"
                  role="option"
                  aria-selected={minute.selected}
                  className={clsx('po-menu-row', minute.selected && 'is-on')}
                  onClick={() => pickMinute(minute.value)}
                >
                  {minute.label}
                </button>
              ))}
            </div>
            {twelveHour && (
              <div role="listbox" aria-label={t('am_pm', 'AM/PM')} className="flex gap-[4px]">
                {(['AM', 'PM'] as ClockPeriod[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="option"
                    aria-selected={period === item}
                    className={clsx('po-menu-row', period === item && 'is-on')}
                    onClick={() => pickPeriod(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
