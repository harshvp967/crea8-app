'use client';

import { useCalendar, ListStateFilter } from '@gitroom/frontend/components/launches/calendar.context';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { useCallback } from 'react';
import { SelectCustomer } from '@gitroom/frontend/components/launches/select.customer';
import { customerFilterValue } from '@gitroom/frontend/components/launches/customer.filter';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import i18next from 'i18next';
import { displayDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { SegmentedControl } from '@gitroom/frontend/components/ui/segmented-control';

// Helper function to get start and end dates based on display type
function getDateRange(
  display: 'day' | 'week' | 'month' | 'list',
  referenceDate?: string
) {
  const date = referenceDate ? displayDayjs(referenceDate) : displayDayjs();

  switch (display) {
    case 'day':
      return {
        startDate: date.format('YYYY-MM-DD'),
        endDate: date.format('YYYY-MM-DD'),
      };
    case 'week':
      return {
        startDate: date.startOf('isoWeek').format('YYYY-MM-DD'),
        endDate: date.endOf('isoWeek').format('YYYY-MM-DD'),
      };
    case 'month':
      return {
        startDate: date.startOf('month').format('YYYY-MM-DD'),
        endDate: date.endOf('month').format('YYYY-MM-DD'),
      };
    case 'list':
      return {
        startDate: date.format('YYYY-MM-DD'),
        endDate: date.format('YYYY-MM-DD'),
      };
  }
}

export const Filters = () => {
  const calendar = useCalendar();
  const t = useT();

  // Set dayjs locale based on current language
  const currentLanguage = i18next.resolvedLanguage || 'en';
  dayjs.locale();

  // Calculate display date range text
  const getDisplayText = () => {
    const startDate = displayDayjs(calendar.startDate);
    const endDate = displayDayjs(calendar.endDate);

    switch (calendar.display) {
      case 'day':
        return startDate.format('dddd, MMM D');
      case 'week':
        if (
          startDate.month() === endDate.month() &&
          startDate.year() === endDate.year()
        ) {
          return `${startDate.format('MMM D')} – ${endDate.format('D, YYYY')}`;
        }
        return `${startDate.format('MMM D')} – ${endDate.format('MMM D, YYYY')}`;
      case 'month':
        return startDate.format('MMMM YYYY');
      default:
        return '';
    }
  };

  const setToday = useCallback(() => {
    const today = displayDayjs();
    const currentRange = getDateRange(
      calendar.display as 'day' | 'week' | 'month'
    );

    // Check if we're already showing today's range
    if (
      calendar.startDate === currentRange.startDate &&
      calendar.endDate === currentRange.endDate
    ) {
      return; // No need to set the same range
    }

    calendar.setFilters({
      startDate: currentRange.startDate,
      endDate: currentRange.endDate,
      display: calendar.display as 'day' | 'week' | 'month',
      customer: calendar.customer,
    });
  }, [calendar]);

  const setDay = useCallback(() => {
    // If already in day view and showing today, don't change
    if (calendar.display === 'day') {
      const todayRange = getDateRange('day');
      if (calendar.startDate === todayRange.startDate) {
        return;
      }
    }

    const range = getDateRange('day');
    calendar.setFilters({
      startDate: range.startDate,
      endDate: range.endDate,
      display: 'day',
      customer: calendar.customer,
    });
  }, [calendar]);

  const setWeek = useCallback(() => {
    // If already in week view and showing current week, don't change
    if (calendar.display === 'week') {
      const currentWeekRange = getDateRange('week');
      if (calendar.startDate === currentWeekRange.startDate) {
        return;
      }
    }

    const range = getDateRange('week');
    calendar.setFilters({
      startDate: range.startDate,
      endDate: range.endDate,
      display: 'week',
      customer: calendar.customer,
    });
  }, [calendar]);

  const setMonth = useCallback(() => {
    // If already in month view and showing current month, don't change
    if (calendar.display === 'month') {
      const currentMonthRange = getDateRange('month');
      if (calendar.startDate === currentMonthRange.startDate) {
        return;
      }
    }

    const range = getDateRange('month');
    calendar.setFilters({
      startDate: range.startDate,
      endDate: range.endDate,
      display: 'month',
      customer: calendar.customer,
    });
  }, [calendar]);

  const setList = useCallback(() => {
    if (calendar.display === 'list') {
      return;
    }

    const range = getDateRange('list');
    calendar.setFilters({
      startDate: range.startDate,
      endDate: range.endDate,
      display: 'list',
      customer: calendar.customer,
    });
  }, [calendar]);

  const setCalendarView = useCallback(() => {
    if (calendar.display !== 'list') {
      return;
    }

    const range = getDateRange('week');
    calendar.setFilters({
      startDate: range.startDate,
      endDate: range.endDate,
      display: 'week',
      customer: calendar.customer,
    });
  }, [calendar]);

  const setDisplay = useCallback(
    (next: string) => {
      if (next === 'week' && calendar.display === 'list') {
        setCalendarView();
        return;
      }
      if (next === 'day') setDay();
      else if (next === 'week') setWeek();
      else if (next === 'month') setMonth();
      else if (next === 'list') setList();
    },
    [calendar.display, setCalendarView, setDay, setWeek, setMonth, setList]
  );

  const setCustomer = useCallback(
    (customer: string) => {
      const next = customerFilterValue(customer);
      if (customerFilterValue(calendar.customer) === next) {
        return; // No need to set the same customer
      }
      calendar.setFilters({
        startDate: calendar.startDate,
        endDate: calendar.endDate,
        display: calendar.display as 'day' | 'week' | 'month' | 'list',
        customer: next,
      });
    },
    [calendar]
  );

  const next = useCallback(() => {
    const currentStart = displayDayjs(calendar.startDate);
    let nextStart: dayjs.Dayjs;

    switch (calendar.display) {
      case 'day':
        nextStart = currentStart.add(1, 'day');
        break;
      case 'week':
        nextStart = currentStart.add(1, 'week');
        break;
      case 'month':
        nextStart = currentStart.add(1, 'month');
        break;
      default:
        nextStart = currentStart.add(1, 'week');
    }

    const range = getDateRange(
      calendar.display as 'day' | 'week' | 'month',
      nextStart.format('YYYY-MM-DD')
    );
    calendar.setFilters({
      startDate: range.startDate,
      endDate: range.endDate,
      display: calendar.display as 'day' | 'week' | 'month',
      customer: calendar.customer,
    });
  }, [calendar]);

  const previous = useCallback(() => {
    const currentStart = displayDayjs(calendar.startDate);
    let prevStart: dayjs.Dayjs;

    switch (calendar.display) {
      case 'day':
        prevStart = currentStart.subtract(1, 'day');
        break;
      case 'week':
        prevStart = currentStart.subtract(1, 'week');
        break;
      case 'month':
        prevStart = currentStart.subtract(1, 'month');
        break;
      default:
        prevStart = currentStart.subtract(1, 'week');
    }

    const range = getDateRange(
      calendar.display as 'day' | 'week' | 'month',
      prevStart.format('YYYY-MM-DD')
    );
    calendar.setFilters({
      startDate: range.startDate,
      endDate: range.endDate,
      display: calendar.display as 'day' | 'week' | 'month',
      customer: calendar.customer,
    });
  }, [calendar]);

  const setCurrent = useCallback(
    (type: 'day' | 'week' | 'month') => () => {
      if (type === 'day') {
        setDay();
      } else if (type === 'week') {
        setWeek();
      } else if (type === 'month') {
        setMonth();
      }
    },
    [setDay, setWeek, setMonth]
  );

  const isListView = calendar.display === 'list';

  const setListStateFilter = useCallback(
    (next: ListStateFilter) => () => {
      if (calendar.listState === next) return;
      calendar.setListState(next);
    },
    [calendar]
  );

  const listStateOptions: { value: ListStateFilter; label: string }[] = [
    { value: 'all', label: t('all', 'All') },
    { value: 'scheduled', label: t('scheduled', 'Scheduled') },
    { value: 'published', label: t('published', 'Published') },
    { value: 'draft', label: t('drafts', 'Drafts') },
  ];

  const previousPage = useCallback(() => {
    if (calendar.listPage > 0) {
      calendar.setListPage(calendar.listPage - 1);
    }
  }, [calendar]);

  const nextPage = useCallback(() => {
    if (calendar.listPage < calendar.listTotalPages - 1) {
      calendar.setListPage(calendar.listPage + 1);
    }
  }, [calendar]);

  const pageLabel = `${t('page', 'Page')} ${calendar.listPage + 1} ${t('of', 'of')} ${Math.max(1, calendar.listTotalPages)}`;
  const stepPrevious = isListView ? previousPage : previous;
  const stepNext = isListView ? nextPage : next;
  const listAtStart = isListView && calendar.listPage <= 0;
  const listAtEnd = isListView && calendar.listPage >= calendar.listTotalPages - 1;

  const phonePeriod = (() => {
    if (isListView) {
      return { title: pageLabel, small: '', full: true };
    }
    if (calendar.display === 'day') {
      const start = displayDayjs(calendar.startDate);
      const key = start.format('YYYY-MM-DD');
      const small = start.format('ddd, MMM D');
      if (key === displayDayjs().format('YYYY-MM-DD')) {
        return { title: t('today', 'Today'), small, full: false };
      }
      if (key === displayDayjs().add(1, 'day').format('YYYY-MM-DD')) {
        return { title: t('tomorrow', 'Tomorrow'), small, full: false };
      }
      if (key === displayDayjs().subtract(1, 'day').format('YYYY-MM-DD')) {
        return { title: t('yesterday', 'Yesterday'), small, full: false };
      }
      return { title: start.format('dddd, MMM D'), small: '', full: true };
    }
    if (calendar.display === 'week') {
      const weekStart = displayDayjs(calendar.startDate).startOf('isoWeek');
      const weekEnd = displayDayjs(calendar.startDate).endOf('isoWeek');
      const range = `${weekStart.format('MMM D')} - ${weekEnd.format('MMM D, YYYY')}`;
      const diff = weekStart.diff(displayDayjs().startOf('isoWeek'), 'week');
      if (diff === 0) {
        return { title: t('this_week', 'This week'), small: range, full: false };
      }
      if (diff === 1) {
        return { title: t('next_week', 'Next week'), small: range, full: false };
      }
      if (diff === -1) {
        return { title: t('last_week', 'Last week'), small: range, full: false };
      }
      return { title: range, small: '', full: true };
    }
    const month = displayDayjs(calendar.startDate).startOf('month');
    const thisMonth = displayDayjs().startOf('month');
    const name = month.format('MMMM YYYY');
    const diff = month.diff(thisMonth, 'month');
    if (diff === 0) {
      return { title: t('this_month', 'This month'), small: name, full: false };
    }
    if (diff === 1) {
      return { title: t('next_month', 'Next month'), small: name, full: false };
    }
    if (diff === -1) {
      return { title: t('last_month', 'Last month'), small: name, full: false };
    }
    return { title: name, small: '', full: true };
  })();

  const viewOptions = [
    { value: 'day', label: t('day', 'Day') },
    { value: 'week', label: t('week', 'Week') },
    { value: 'month', label: t('month', 'Month') },
    { value: 'list', label: t('list', 'List') },
  ];

  return (
    <>
    <div className="c8-cal-head">
      <div className="c8-cal-kicker">
        <span className="c8-cal-sticker">{t('schedule', 'Schedule')}</span>
        {!isListView && (
          <span className="c8-cal-when">{getDisplayText()}</span>
        )}
      </div>
      <h1 className="c8-cal-title">
        {isListView ? t('calendar', 'Calendar') : t('calendar', 'Calendar')}
      </h1>
    </div>
    <div
      className={clsx(
        'filters-bar text-textColor flex flex-wrap items-center gap-[10px] select-none w-full min-w-0',
        isListView && 'is-list-mode'
      )}
    >
      {phonePeriod && (
        <div className={clsx('c8-phone-period', phonePeriod.full ? 'is-full' : 'is-relative')}>
          <button
            type="button"
            className={clsx('c8-phone-step', listAtStart && 'opacity-50 cursor-not-allowed')}
            aria-label="Previous"
            onClick={stepPrevious}
          >
            <HugeIcon name="chevron-left" size={16} />
          </button>
          <button type="button" className="c8-phone-period-label" onClick={setToday}>
            <span className="c8-phone-period-title">{phonePeriod.title}</span>
            {phonePeriod.small ? (
              <span className="c8-phone-period-small">{phonePeriod.small}</span>
            ) : null}
          </button>
          <button
            type="button"
            className={clsx('c8-phone-step', listAtEnd && 'opacity-50 cursor-not-allowed')}
            aria-label="Next"
            onClick={stepNext}
          >
            <HugeIcon name="chevron-right" size={16} />
          </button>
        </div>
      )}
      <div className="date-range flex flex-1 min-w-0 flex-row items-center gap-[10px]">
          <div className="cal-nav border h-[44px] border-newBorder bg-transparent gap-[1px] flex items-center rounded-[18px] overflow-hidden">
            <div
              onClick={stepPrevious}
              role="button"
              aria-label="Previous"
              className={clsx(
                'cal-nav-arrow cursor-pointer text-textItemBlur rtl:rotate-180 px-[12px] bg-newBgColorInner h-full flex items-center justify-center hover:text-[color:var(--arc-accent-text)] hover:bg-[var(--arc-selected)] transition-colors',
                listAtStart && 'opacity-50 cursor-not-allowed'
              )}
            >
              <HugeIcon name="chevron-left" size={12} />
            </div>
            <div className="cal-range-label min-w-[200px] text-center bg-newBgColorInner h-full flex items-center justify-center">
              <div className="cal-range-desktop py-[3px] px-[12px] rounded-[5px] transition-all text-[14px] font-[500] whitespace-nowrap">
                {isListView ? pageLabel : getDisplayText()}
              </div>
              <div className="cal-range-phone py-[3px] px-[12px] text-[16px] font-[600] whitespace-nowrap">
                {isListView
                  ? pageLabel
                  : calendar.display === 'month'
                  ? getDisplayText()
                  : (() => {
                      const start = displayDayjs(calendar.startDate).startOf('isoWeek');
                      const end = start.endOf('isoWeek');
                      return start.month() === end.month()
                        ? `${start.format('MMM D')} – ${end.format('D, YYYY')}`
                        : `${start.format('MMM D')} – ${end.format('MMM D, YYYY')}`;
                    })()}
              </div>
            </div>
            <div
              onClick={stepNext}
              role="button"
              aria-label="Next"
              className={clsx(
                'cal-nav-arrow cursor-pointer text-textItemBlur rtl:rotate-180 px-[12px] bg-newBgColorInner h-full flex items-center justify-center hover:text-[color:var(--arc-accent-text)] hover:bg-[var(--arc-selected)] transition-colors',
                listAtEnd && 'opacity-50 cursor-not-allowed'
              )}
            >
              <HugeIcon name="chevron-right" size={12} />
            </div>
          </div>
          <div className="cal-today flex-1 text-[14px] font-[500]">
            <div className="text-center flex h-[40px]">
              <div
                onClick={setToday}
                className="hover:text-newTextColor hover:bg-newBoxHover h-[36px] px-[12px] flex justify-center items-center rounded-[18px] transition-all cursor-pointer text-[14px] font-[500] bg-newBgColorInner border border-newBorder text-textItemBlur shadow-[var(--arc-shadow-resting)]"
              >
                {t('today', 'Today')}
              </div>
            </div>
          </div>
        </div>
      {isListView && (
          <div className="cal-list-states-row">
          <SegmentedControl
            variant="pill"
            className="cal-list-states"
            aria-label={t('post_state', 'Post state')}
            value={calendar.listState}
            onValueChange={(value) =>
              setListStateFilter(value as ListStateFilter)()
            }
            options={listStateOptions}
          />
          </div>
      )}
      <div className="cal-scope-row">
      <div className="cal-customer">
      <SelectCustomer
        customer={calendar.customer || ''}
        ariaLabel={t('customers', 'Customers')}
        onChange={(customer: string) => setCustomer(customer)}
        integrations={calendar.allIntegrations}
      />
      </div>
      <SegmentedControl
        variant="pill"
        className="cal-mode"
        aria-label={t('calendar_view', 'Calendar view')}
        value={calendar.display}
        onValueChange={setDisplay}
        options={viewOptions}
      />
      </div>
    </div>
    </>
  );
};
