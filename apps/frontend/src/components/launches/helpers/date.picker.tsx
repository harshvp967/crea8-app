import { FC, useCallback, useState } from 'react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Calendar, TimeInput } from '@mantine/dates';
import { useClickOutside } from '@mantine/hooks';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { displayDayjs, displayNow, isPastCalendarDay } from '@gitroom/frontend/components/layout/set.timezone';
import { CalendarIcon } from '@gitroom/frontend/components/ui/icons';
export const DatePicker: FC<{
  date: dayjs.Dayjs;
  onChange: (day: dayjs.Dayjs) => void;
}> = (props) => {
  const { date, onChange } = props;
  const [open, setOpen] = useState(false);
  const t = useT();

  const changeShow = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);
  const ref = useClickOutside<HTMLDivElement>(() => {
    setOpen(false);
  });
  const changeDate = useCallback(
    (type: 'date' | 'time') => (day: Date) => {
      const picked = dayjs(day);
      const current = displayDayjs(date);
      onChange(
        displayDayjs(
          type === 'time'
            ? current.format('YYYY-MM-DD') + ' ' + picked.format('HH:mm:ss')
            : picked.format('YYYY-MM-DD') + ' ' + current.format('HH:mm:ss')
        )
      );
    },
    [date]
  );
  const wall = displayDayjs(date);
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
        'po-date-chip px-[16px] border rounded-[8px] justify-center flex gap-[8px] items-center relative h-[44px] text-[15px] font-[600] ml-[7px] select-none flex-1',
        open ? 'border-[#00D9FF] bg-[#00D9FF]/10' : 'border-newTextColor/10'
      )}
      onClick={changeShow}
      ref={ref}
    >
      <div className="cursor-pointer">
        <CalendarIcon />
      </div>
      <div className="po-date-label cursor-pointer whitespace-nowrap">
        {wall.format('ddd, MMM D · h:mm A')}
      </div>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="po-date-pop animate-fadeIn absolute bottom-[calc(100%+8px)] end-0 z-[300] flex flex-col"
        >
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
            <label className="po-date-clock">
              <CalendarIcon />
              <span>{wall.format('h:mm A')}</span>
              <TimeInput
                onChange={changeDate('time')}
                classNames={{
                  wrapper: 'po-date-native-wrap',
                  input: 'po-date-native',
                }}
                defaultValue={pickerValue}
              />
            </label>
            <button type="button" className="po-date-close" onClick={changeShow}>
              {t('close', 'Close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
