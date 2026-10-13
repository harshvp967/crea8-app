'use client';

import React, {
  FC,
  Fragment,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CalendarContext,
  Integrations,
  useCalendar,
} from '@gitroom/frontend/components/launches/calendar.context';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import 'dayjs/locale/he';
import 'dayjs/locale/ru';
import 'dayjs/locale/zh';
import 'dayjs/locale/fr';
import 'dayjs/locale/es';
import 'dayjs/locale/pt';
import 'dayjs/locale/de';
import 'dayjs/locale/it';
import 'dayjs/locale/ja';
import 'dayjs/locale/ko';
import 'dayjs/locale/ar';
import 'dayjs/locale/tr';
import 'dayjs/locale/vi';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { ExistingDataContextProvider } from '@gitroom/frontend/components/launches/helpers/use.existing.data';
import { useDrag, useDrop } from 'react-dnd';
import { Integration, Post, State, Tags } from '@prisma/client';
import { useAddProvider } from '@gitroom/frontend/components/launches/add.provider.component';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { groupBy, random, sortBy } from 'lodash';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { extend } from 'dayjs';
import { isUSCitizen } from './helpers/isuscitizen.utils';
import { useInterval } from '@mantine/hooks';
import { StatisticsModal } from '@gitroom/frontend/components/launches/statistics';
import { MissingReleaseModal } from '@gitroom/frontend/components/launches/missing-release.modal';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import i18next from 'i18next';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import { CreationMethodBadge } from '@gitroom/frontend/components/launches/creation.method.badge';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import copy from 'copy-to-clipboard';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import {
  displayDayjs,
  displayNow,
  getTimezone,
  isPastHour,
} from '@gitroom/frontend/components/layout/set.timezone';
import { Button } from '@gitroom/react/form/button';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

// Extend dayjs with necessary plugins
extend(isSameOrAfter);
extend(isSameOrBefore);
extend(localizedFormat);

// Initialize language
const updateDayjsLocale = () => {
  const currentLanguage = i18next.resolvedLanguage || 'en';
  dayjs.locale(currentLanguage);
};

// Set dayjs locale whenever i18next language changes
i18next.on('languageChanged', () => {
  updateDayjsLocale();
});

// Initial setup
updateDayjsLocale();

const convertTimeFormatBasedOnLocality = (time: number) => {
  if (isUSCitizen()) {
    const hour = time % 12 === 0 ? 12 : time % 12;
    return `${hour} ${time >= 12 ? 'PM' : 'AM'}`;
  }
  return `${String(time).padStart(2, '0')}:00`;
};

export const hours = Array.from(
  {
    length: 24,
  },
  (_, i) => i
);

// Shared hook for post actions (edit, delete, statistics)
const usePostActions = (onMutate?: () => void) => {
  const t = useT();
  const fetch = useFetch();
  const modal = useModals();
  const toaster = useToaster();
  const { integrations, reloadCalendarView } = useCalendar();

  const mutate = useCallback(() => {
    reloadCalendarView();
    onMutate?.();
  }, [reloadCalendarView, onMutate]);

  const editPost = useCallback(
    (loadPost: any, isDuplicate?: boolean) => async () => {
      const post = {
        ...loadPost,
        publishDate: loadPost.actualDate || loadPost.publishDate,
      };

      const data = await (await fetch(`/posts/group/${post.group}`)).json();
      const date = !isDuplicate
        ? null
        : (await (await fetch('/posts/find-slot')).json()).date;
      const publishDate = dayjs
        .utc(date || data.posts[0].publishDate)
        .tz(getTimezone());
      const ExistingData = !isDuplicate
        ? ExistingDataContextProvider
        : Fragment;
      modal.openModal({
        id: 'add-edit-modal',
        closeOnClickOutside: false,
        removeLayout: true,
        closeOnEscape: false,
        withCloseButton: false,
        askClose: true,
        fullScreen: true,
        classNames: {
          modal: 'w-[100%] max-w-[1400px] text-textColor',
        },
        children: (
          <ExistingData value={data}>
            <AddEditModal
              {...(isDuplicate
                ? {
                    onlyValues: data.posts.map(
                      ({ image, settings, content }: any) => ({
                        image,
                        settings,
                        content,
                      })
                    ),
                  }
                : {})}
              allIntegrations={integrations.map((p) => ({ ...p }))}
              reopenModal={editPost(post)}
              mutate={mutate}
              integrations={
                isDuplicate
                  ? integrations
                  : integrations
                      .slice(0)
                      .filter((f) => f.id === data.integration)
                      .map((p) => ({
                        ...p,
                        picture: data.integrationPicture,
                      }))
              }
              date={publishDate}
            />
          </ExistingData>
        ),
        size: '80%',
        title: ``,
      });
    },
    [integrations, fetch, modal, mutate]
  );

  const copyDebugJson = useCallback(
    (post: any) => () => {
      modal.openModal({
        title: t('copy_debug_json', 'Copy Debug JSON'),
        closeOnClickOutside: true,
        closeOnEscape: true,
        withCloseButton: true,
        classNames: {
          modal: 'w-[100%] max-w-[500px]',
        },
        children: <DebugJsonModal post={post} />,
      });
    },
    [modal, t]
  );

  const deletePost = useCallback(
    (post: any) => async () => {
      if (
        !(await deleteDialog(
          t(
            'are_you_sure_you_want_to_delete_post',
            'Are you sure you want to delete post?'
          )
        ))
      ) {
        return;
      }

      await fetch(`/posts/${post.group}`, {
        method: 'DELETE',
      });

      toaster.show(
        t('post_deleted_successfully', 'Post deleted successfully'),
        'success'
      );

      mutate();
    },
    [toaster, t, fetch, mutate]
  );

  const openStatistics = useCallback(
    (id: string) => () => {
      modal.openModal({
        title: t('statistics', 'Statistics'),
        closeOnClickOutside: true,
        closeOnEscape: true,
        withCloseButton: true,
        classNames: {
          modal: 'w-[100%] max-w-[1400px]',
        },
        children: <StatisticsModal postId={id} />,
        size: '80%',
      });
    },
    [modal, t]
  );

  const openMissingRelease = useCallback(
    (id: string) => () => {
      modal.openModal({
        title: t('connect_post', 'Connect Post'),
        closeOnClickOutside: true,
        closeOnEscape: true,
        withCloseButton: true,
        classNames: {
          modal: 'w-[100%] max-w-[800px]',
        },
        children: (
          <MissingReleaseModal postId={id} onSuccess={mutate} />
        ),
        size: '60%',
      });
    },
    [modal, t, mutate]
  );

  return { editPost, deletePost, copyDebugJson, openStatistics, openMissingRelease };
};

const useNarrowLayout = () => {
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const sync = () => setNarrow(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return narrow;
};

const PhoneDayStrip = () => {
  const calendar = useCalendar();
  const weekStart = displayDayjs(calendar.startDate).startOf('isoWeek');
  const days = Array.from({ length: 7 }, (_, index) => weekStart.add(index, 'day'));
  const shiftWeek = (direction: number) => {
    const nextDay = displayDayjs(calendar.startDate).add(direction, 'week');
    calendar.setFilters({
      startDate: nextDay.format('YYYY-MM-DD'),
      endDate: nextDay.format('YYYY-MM-DD'),
      display: 'day',
      customer: calendar.customer,
    });
  };

  return (
    <div className="phone-week">
      <button
        type="button"
        className="phone-week-arrow"
        aria-label="Previous week"
        onClick={() => shiftWeek(-1)}
      >
        <HugeIcon name="chevron-left" size={12} />
      </button>
      <div className="phone-day-strip">
        {days.map((day) => {
          const iso = day.format('YYYY-MM-DD');
          const selected = iso === calendar.startDate;
          return (
            <button
              key={iso}
              type="button"
              className={clsx(selected && 'arc-selected')}
              onClick={() => {
                if (selected) {
                  return;
                }
                calendar.setFilters({
                  startDate: iso,
                  endDate: iso,
                  display: 'day',
                  customer: calendar.customer,
                });
              }}
            >
              <span>{day.format('ddd')}</span>
              <span>{day.format('D')}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="phone-week-arrow"
        aria-label="Next week"
        onClick={() => shiftWeek(1)}
      >
        <HugeIcon name="chevron-right" size={12} />
      </button>
    </div>
  );
};

export const DayView = () => {
  const calendar = useCalendar();
  const narrow = useNarrowLayout();
  const listRef = useRef<HTMLDivElement>(null);
  const { integrations, posts, startDate } = calendar;

  // Set dayjs locale based on current language
  const currentLanguage = i18next.resolvedLanguage || 'en';
  dayjs.locale(currentLanguage);

  const currentDay = displayDayjs(startDate);

  const options = useMemo(() => {
    const zone = getTimezone();
    const createdPosts = posts.map((post) => {
      const zoned = dayjs.utc(post.publishDate).tz(zone);
      return {
        integration: [integrations.find((i) => i.id === post.integration.id)!],
        image: post?.integration?.picture || '',
        identifier: post?.integration?.providerIdentifier || '',
        id: post?.integration?.id || '',
        name: post?.integration?.name || '',
        time: zoned.diff(zoned.startOf('day'), 'minute'),
      };
    });
    return sortBy(
      Object.values(
        groupBy(
          [
            ...createdPosts,
            ...integrations.flatMap((p) =>
              p.time.flatMap((t) => {
                const zoned = dayjs
                  .utc(startDate)
                  .startOf('day')
                  .add(t?.time || 0, 'minute')
                  .tz(zone);
                return {
                  integration: p,
                  identifier: p?.identifier,
                  name: p?.name,
                  id: p?.id,
                  image: p?.picture,
                  time: zoned.diff(zoned.startOf('day'), 'minute'),
                };
              })
            ),
          ],
          (p: any) => p.time
        )
      ),
      (p) => p[0].time
    );
  }, [integrations, posts, startDate]);

  const slotRow = (option: (typeof options)[number]) => (
    <CalendarContext.Provider
      key={option[0].time}
      value={{
        ...calendar,
        integrations: option.flatMap((p) => p.integration),
      }}
    >
      <CalendarColumn
        getDate={currentDay.startOf('day').add(option[0].time, 'minute')}
      />
    </CalendarContext.Provider>
  );

  const scrollHour = useMemo(() => {
    const zone = getTimezone();
    if (displayDayjs(startDate).format('YYYY-MM-DD') === displayNow().format('YYYY-MM-DD')) {
      return displayNow().hour();
    }
    if (!posts.length) {
      return 0;
    }
    return Math.min(
      ...posts.map((post) => dayjs.utc(post.publishDate).tz(zone).hour())
    );
  }, [posts, startDate]);

  const dayHours = hours;

  useLayoutEffect(() => {
    if (!narrow) {
      return;
    }
    const root = listRef.current;
    const target = root?.querySelector(
      `[data-hour="${scrollHour}"]`
    ) as HTMLElement | null;
    if (!root || !target) {
      return;
    }
    const top =
      target.getBoundingClientRect().top -
      root.getBoundingClientRect().top +
      root.scrollTop;
    root.scrollTop = top;
  }, [narrow, scrollHour, startDate]);

  const shiftDay = (direction: number) => {
    const nextDay = displayDayjs(startDate).add(direction, 'day');
    calendar.setFilters({
      startDate: nextDay.format('YYYY-MM-DD'),
      endDate: nextDay.format('YYYY-MM-DD'),
      display: 'day',
      customer: calendar.customer,
    });
  };

  const dayPager = (
    <div className="c8-day-phone-nav">
      <button
        type="button"
        className="phone-week-arrow"
        aria-label="Previous day"
        onClick={() => shiftDay(-1)}
      >
        <HugeIcon name="chevron-left" size={12} />
      </button>
      <span className="c8-week-phone-span">{currentDay.format('MMM D')}</span>
      <button
        type="button"
        className="phone-week-arrow"
        aria-label="Next day"
        onClick={() => shiftDay(1)}
      >
        <HugeIcon name="chevron-right" size={12} />
      </button>
    </div>
  );

  if (narrow) {
    const hours = Array.from({ length: 24 }, (_, hour) => hour);
    return (
      <div className="c8-day flex flex-col gap-[8px] flex-1 min-h-0">
        {dayPager}
        <div className="c8-day-body flex flex-col gap-[8px] flex-1 min-h-0">
        <PhoneDayStrip />
        <div ref={listRef} className="phone-day-list flex-1 min-h-0">
          {hours.map((hour) => {
            const rows = options.filter(
              (option) => Math.floor(option[0].time / 60) === hour
            );
            return (
              <div key={hour} className="phone-slot" data-hour={hour}>
                <span className="phone-slot-time">
                  {currentDay
                    .startOf('day')
                    .add(hour, 'hour')
                    .format(isUSCitizen() ? 'h A' : 'LT')}
                </span>
                <div className="phone-slot-posts">
                  {rows.length ? (
                    rows.map(slotRow)
                  ) : (
                    <CalendarContext.Provider
                      value={{
                        ...calendar,
                        integrations,
                      }}
                    >
                      <CalendarColumn
                        getDate={currentDay.startOf('day').add(hour, 'hour')}
                      />
                    </CalendarContext.Provider>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="c8-day flex flex-col gap-[8px] flex-1 min-h-0">
      {dayPager}
      <div className="c8-day-body flex flex-col gap-[8px] flex-1 min-h-0">
      <PhoneDayStrip />
      <div className="relative flex-1 min-h-0">
        <div className="day-scroll absolute start-0 top-0 w-full h-full overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
          <div className="day-grid">
            <div className="c8-day-label">{currentDay.format('ddd, MMM D')}</div>
            {dayHours.map((hour) => {
              const rows = options.filter(
                (option) => Math.floor(option[0].time / 60) === hour
              );
              return (
                <Fragment key={hour}>
                  <div className="day-time">
                    {convertTimeFormatBasedOnLocality(hour)}
                  </div>
                  <div className="day-cell">
                    {rows.length
                      ? rows.map(slotRow)
                      : (
                        <CalendarColumn
                          getDate={currentDay.startOf('day').add(hour, 'hour')}
                        />
                      )}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
export const WeekView = () => {
  const { startDate } = useCalendar();
  const visibleHours = hours;
  const [phoneWeek, setPhoneWeek] = useState(false);
  const [phonePage, setPhonePage] = useState(0);

  useLayoutEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const sync = () => setPhoneWeek(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    setPhonePage(0);
  }, [startDate]);

  // Use dayjs to get localized day names
  const localizedDays = useMemo(() => {
    const currentLanguage = i18next.resolvedLanguage || 'en';
    dayjs.locale(currentLanguage);

    const days = [];
    const weekStart = displayDayjs(startDate);
    for (let i = 0; i < 7; i++) {
      const day = weekStart.add(i, 'day');
      days.push({
        name: day.format('ddd'),
        day: day.format('D'),
        date: day,
      });
    }
    return days;
  }, [i18next.resolvedLanguage, startDate]);

  const shownDays = useMemo(() => {
    if (!phoneWeek) {
      return localizedDays;
    }
    const offset = phonePage * 3;
    return [0, 1, 2].map((index) => localizedDays[offset + index] || null);
  }, [localizedDays, phonePage, phoneWeek]);

  const today = displayNow().format('YYYY-MM-DD');

  return (
    <div className="c8-week flex flex-col text-textColor flex-1 min-h-0">
      <div className="c8-week-phone-nav">
        <button
          type="button"
          className="phone-week-arrow"
          aria-label="Previous days"
          disabled={phonePage === 0}
          onClick={() => setPhonePage((page) => Math.max(0, page - 1))}
        >
          <HugeIcon name="chevron-left" size={12} />
        </button>
        <span className="c8-week-phone-span">3 days</span>
        <button
          type="button"
          className="phone-week-arrow"
          aria-label="Next days"
          disabled={phonePage >= 2}
          onClick={() => setPhonePage((page) => Math.min(2, page + 1))}
        >
          <HugeIcon name="chevron-right" size={12} />
        </button>
      </div>
      <div className="flex-1 relative min-h-0">
        <div
          className={clsx(
            'week-grid grid [grid-template-columns:60px_repeat(7,minmax(0,1fr))] absolute h-full start-0 top-0 w-full overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor',
            phoneWeek && 'is-phone-slice'
          )}
        >
          <div className="week-corner sticky top-0 z-10" />
          {shownDays.map((day, index) =>
            day ? (
              <div
                key={day.date.format('YYYY-MM-DD')}
                className={clsx(
                  'week-head sticky top-0 z-[20]',
                  day.date.format('YYYY-MM-DD') === today && 'is-today'
                )}
              >
                <div className="week-dow text-[13px] font-[500] text-textItemBlur">
                  {day.name}
                </div>
                <div
                  className={clsx(
                    'week-num text-[14px] font-[600]',
                    day.date.format('YYYY-MM-DD') === today && 'is-today'
                  )}
                >
                  {day.day}
                </div>
              </div>
            ) : (
              <div key={`empty-head-${index}`} className="week-head is-empty" />
            )
          )}
          {visibleHours.map((hour) => (
            <Fragment key={hour}>
              <div className="week-time">
                {convertTimeFormatBasedOnLocality(hour)}
              </div>
              {shownDays.map((day, index) =>
                day ? (
                  <div
                    key={`${startDate}-${day.date.format('YYYY-MM-DD')}-${hour}`}
                    className={clsx(
                      'week-cell',
                      day.date.format('YYYY-MM-DD') === today && 'is-today'
                    )}
                  >
                    <CalendarColumn
                      getDate={day.date.hour(hour).startOf('hour')}
                    />
                  </div>
                ) : (
                  <div
                    key={`empty-${hour}-${index}`}
                    className="week-cell is-empty"
                  />
                )
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
export const MonthView = () => {
  const { startDate } = useCalendar();
  const t = useT();
  const narrow = useNarrowLayout();

  // Use dayjs to get localized day names. Phone cells are too narrow for full names.
  const localizedDays = useMemo(() => {
    const currentLanguage = i18next.resolvedLanguage || 'en';
    dayjs.locale(currentLanguage);

    const days = [];
    // Starting from Monday (1) to Sunday (7)
    for (let i = 1; i <= 7; i++) {
      days.push(displayNow().day(i).format(narrow ? 'ddd' : 'dddd'));
    }
    return days;
  }, [i18next.resolvedLanguage, narrow]);

  const calendarDays = useMemo(() => {
    const monthStart = displayDayjs(startDate);
    const currentMonth = monthStart.month();
    const currentYear = monthStart.year();

    const startOfMonth = displayDayjs(
      `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
    );

    // Calculate the day offset for Monday (isoWeekday() returns 1 for Monday)
    const startDayOfWeek = startOfMonth.isoWeekday(); // 1 for Monday, 7 for Sunday
    const daysBeforeMonth = startDayOfWeek - 1; // Days to show from the previous month

    // Get the start date (Monday of the first week that includes this month)
    const calendarStartDate = startOfMonth.subtract(daysBeforeMonth, 'day');

    // Create an array to hold the calendar days (6 weeks * 7 days = 42 days max)
    const calendarDays = [];
    let currentDay = calendarStartDate;
    for (let i = 0; i < 42; i++) {
      let label = 'current-month';
      if (currentDay.month() < currentMonth) label = 'previous-month';
      if (currentDay.month() > currentMonth) label = 'next-month';
      calendarDays.push({
        day: currentDay,
        label,
      });

      // Move to the next day
      currentDay = currentDay.add(1, 'day');
    }
    return calendarDays;
  }, [startDate]);

  return (
    <div className="flex flex-col text-textColor flex-1">
      <div className="flex-1 flex relative">
        <div className="month-grid grid grid-cols-7 absolute start-0 top-0 overflow-auto w-full h-full scrollbar scrollbar-thumb-tableBorder scrollbar-track-secondary">
          {localizedDays.map((day) => (
            <div
              key={day}
              className="month-head z-[20] sticky top-0 text-[14px] font-[500] text-textItemBlur"
            >
              <div>{day}</div>
            </div>
          ))}
          {calendarDays.map((date, index) => (
            <div
              key={index}
              className={clsx(
                'month-cell text-center items-center justify-center flex',
                date.label !== 'current-month' && 'opacity-40'
              )}
            >
              <CalendarColumn
                getDate={date.day.endOf('day')}
                randomHour={true}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export const ListView = () => {
  const t = useT();
  const user = useUser();
  const { integrations, loading, listPosts, listState } = useCalendar();
  const emptyMessage =
    listState === 'scheduled'
      ? t('no_upcoming_posts', 'No upcoming posts scheduled')
      : listState === 'draft'
      ? t('no_draft_posts', 'No draft posts')
      : listState === 'published'
      ? t('no_published_posts', 'No published posts')
      : t('no_posts', 'No posts');

  // Use shared post actions hook
  const { editPost, deletePost, copyDebugJson, openStatistics, openMissingRelease } = usePostActions();

  // Group posts by date
  const groupedPosts = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    listPosts.forEach((post) => {
      const dateKey = dayjs.utc(post.publishDate).tz(getTimezone()).format('YYYY-MM-DD');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(post);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [listPosts]);

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <div className="text-textColor">{t('loading', 'Loading...')}</div>
      </div>
    );
  }

  if (listPosts.length === 0) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <div className="text-textColor text-[16px]">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="cal-list flex flex-col gap-[10px] flex-1 relative">
      <div className="absolute start-0 top-0 w-full h-full flex flex-col overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
        {groupedPosts.map(([dateKey, datePosts]) => (
          <Fragment key={dateKey}>
            <div className="cal-list-day text-center text-[14px] min-h-[21px] text-textColor font-[500] mt-[10px]">
              {displayDayjs(dateKey).format(isUSCitizen() ? 'dddd, MMMM D, YYYY' : 'dddd, D MMMM YYYY')}
            </div>
            <div className="cal-list-group flex flex-col gap-[10px] mb-[20px] px-[10px]">
              {datePosts.map((post) => (
                <CalendarItem
                  key={post.id}
                  display="day"
                  isBeforeNow={false}
                  date={dayjs.utc(post.publishDate).tz(getTimezone())}
                  state={post.state}
                  statistics={openStatistics(post.id)}
                  missingRelease={openMissingRelease(post.id)}
                  editPost={editPost(post, false)}
                  duplicatePost={editPost(post, true)}
                  copyDebugJson={user?.isSuperAdmin ? copyDebugJson(post) : undefined}
                  post={post}
                  integrations={integrations}
                  deletePost={deletePost(post)}
                  showTime={true}
                />
              ))}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
};

export const Calendar = () => {
  const { display } = useCalendar();
  useEffect(() => {
    document.body.dataset.c8View = display;
    return () => {
      delete document.body.dataset.c8View;
    };
  }, [display]);
  return (
    <>
      {display === 'list' ? (
        <ListView />
      ) : display === 'day' ? (
        <DayView />
      ) : display === 'week' ? (
        <WeekView />
      ) : (
        <MonthView />
      )}
    </>
  );
};
export const CalendarColumn: FC<{
  getDate: dayjs.Dayjs;
  randomHour?: boolean;
}> = memo((props) => {
  const t = useT();

  const { getDate, randomHour } = props;
  const [num, setNum] = useState(0);
  const user = useUser();
  const {
    integrations,
    posts,
    changeDate,
    display,
    reloadCalendarView,
    sets,
    signature,
    loading,
  } = useCalendar();
  const modal = useModals();
  const fetch = useFetch();

  // Use shared post actions hook
  const { editPost, deletePost, copyDebugJson, openStatistics, openMissingRelease } = usePostActions();
  const postList = useMemo(() => {
    return posts.filter((post) => {
      const pList = dayjs.utc(post.publishDate).tz(getTimezone());
      const check =
        display === 'day'
          ? pList.format('YYYY-MM-DD HH:mm') ===
            getDate.format('YYYY-MM-DD HH:mm')
          : display === 'week'
          ? pList.isSameOrAfter(getDate.startOf('hour')) &&
            pList.isBefore(getDate.endOf('hour'))
          : pList.format('DD/MM/YYYY') === getDate.format('DD/MM/YYYY');
      return check;
    });
  }, [posts, display, getDate]);
  const [showAll, setShowAll] = useState(false);
  const showAllFunc = useCallback(() => {
    setShowAll(true);
  }, []);
  const showLessFunc = useCallback(() => {
    setShowAll(false);
  }, []);
  const list = useMemo(() => {
    if (showAll) {
      return postList;
    }
    return postList.slice(0, 3);
  }, [postList, showAll]);

  const isBeforeNow = useMemo(() => {
    return isPastHour(getDate, displayNow());
  }, [getDate, num]);

  const { start, stop } = useInterval(
    useCallback(() => {
      if (isBeforeNow) {
        return;
      }
      setNum(num + 1);
    }, [isBeforeNow]),
    random(120000, 150000)
  );

  useEffect(() => {
    start();
    return () => {
      stop();
    };
  }, []);
  const [{ canDrop }, drop] = useDrop(() => ({
    accept: 'post',
    drop: async (item: any) => {
      if (isBeforeNow) return;

      // Find the post to check its state
      const post = posts.find((p) => p.id === item.id);
      let action: 'schedule' | 'update' = 'schedule';

      // Check if post is already published or queued in the past
      if (
        post &&
        (post.state === 'PUBLISHED' ||
          (post.state === 'QUEUE' && dayjs().isAfter(dayjs.utc(post.publishDate))))
      ) {
        const whatToDo = await new Promise<'schedule' | 'update' | 'cancel'>(
          (resolve) => {
            modal.openModal({
              title: t('what_do_you_want_to_do', 'What do you want to do?'),
              children: (
                <div className="flex flex-col">
                  <div className="text-[20px] mb-[20px]">
                    {t(
                      'post_already_published_republish_warning',
                      'This post was already published. Republishing will publish it again to'
                    )}{' '}
                    {post.integration?.name}{' '}
                    {t('republish_at', 'at')} {getDate.format('DD/MM/YYYY HH:mm')}.
                    {(!!item.interval || !!post.intervalInDays) && (
                      <div className="mt-[10px]">
                        {t(
                          'republish_recurring_note',
                          'This is a recurring post: your changes apply to all future recurrences starting now.'
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex w-full gap-[10px]">
                    <div className="flex-1 flex">
                      <Button
                        type="button"
                        secondary
                        className="flex-1"
                        onClick={() => {
                          modal.closeAll();
                          resolve('update');
                        }}
                      >
                        {t('just_update_post_details', 'Just update the post details')}
                      </Button>
                    </div>
                    <div className="flex-1 flex">
                      <Button
                        type="button"
                        className="flex-1"
                        onClick={() => {
                          modal.closeAll();
                          resolve('schedule');
                        }}
                      >
                        {t('reschedule_post', 'Reschedule the post')}
                      </Button>
                    </div>
                  </div>
                </div>
              ),
              onClose: () => resolve('cancel'),
            });
          }
        );

        if (whatToDo === 'cancel') {
          return;
        }
        action = whatToDo;
      }

      if (!item.interval) {
        changeDate(item.id, getDate);
      }
      const { status } = await fetch(`/posts/${item.id}/date`, {
        method: 'PUT',
        body: JSON.stringify({
          date: getDate.utc().format('YYYY-MM-DDTHH:mm:ss'),
          action,
          // published posts always confirm via the modal before reaching here;
          // for QUEUE posts the flag is a no-op on the server
          ...(action === 'schedule' ? { republish: true } : {}),
        }),
      });
      if (status !== 500) {
        if (item.interval || action === 'schedule') {
          reloadCalendarView();
          return;
        }
        return;
      }
    },
    collect: (monitor) => ({
      canDrop: isBeforeNow ? false : !!monitor.canDrop() && !!monitor.isOver(),
    }),
  }), [posts]);

  const addModal = useCallback(async () => {
    if (isBeforeNow) {
      return;
    }
    const set: any = !sets.length
      ? undefined
      : await new Promise((resolve) => {
          modal.openModal({
            title: t('select_set', 'Select a Set'),
            closeOnClickOutside: true,
            askClose: false,
            closeOnEscape: true,
            withCloseButton: true,
            classNames: { modal: 'po-set-modal' },
            onClose: () => resolve('exit'),
            children: (
              <SetSelectionModal
                sets={sets}
                onSelect={(selectedSet) => {
                  resolve(selectedSet);
                  modal.closeAll();
                }}
                onContinueWithoutSet={() => {
                  resolve(undefined);
                  modal.closeAll();
                }}
              />
            ),
          });
        });

    if (set === 'exit') return;

    modal.openModal({
      id: 'add-edit-modal',
      closeOnClickOutside: false,
      removeLayout: true,
      closeOnEscape: false,
      withCloseButton: false,
      askClose: true,
      fullScreen: true,
      classNames: {
        modal: 'w-[100%] max-w-[1400px] text-textColor',
      },
      children: (
        <AddEditModal
          allIntegrations={integrations.map((p) => ({
            ...p,
          }))}
          integrations={integrations.slice(0).map((p) => ({
            ...p,
          }))}
          mutate={reloadCalendarView}
          {...(signature?.id && !set
            ? {
                onlyValues: [
                  {
                    content: '\n' + signature.content,
                  },
                ],
              }
            : {})}
          date={
            randomHour
              ? getDate.hour(Math.floor(Math.random() * 24))
              : getDate.format('YYYY-MM-DDTHH:mm:ss') ===
                displayNow().startOf('hour').format('YYYY-MM-DDTHH:mm:ss')
              ? displayNow().add(10, 'minute')
              : getDate
          }
          {...(set?.content ? { set: JSON.parse(set.content) } : {})}
          reopenModal={() => ({})}
        />
      ),
      size: '80%',
    });
  }, [integrations, getDate, sets, signature, isBeforeNow]);

  const addProvider = useAddProvider();
  return (
    <div
      className={clsx(
        'cal-col flex flex-col w-full relative transition-colors',
        display === 'month' ? 'min-h-[max(70px,100%)]' : 'min-h-full',
        display === 'week' || display === 'month' ? 'cal-col-week' : 'rounded-[12px]',
        isBeforeNow && 'is-past repeated-strip',
        loading && 'animate-pulse',
        display !== 'week' &&
          display !== 'month' &&
          (isBeforeNow
            ? 'cursor-not-allowed opacity-70'
            : 'border border-[#2a2a2a]/80 bg-[#121212]/40 hover:border-[#3a3a3a] hover:bg-[#161616]/80')
      )}
      ref={drop as any}
    >
      {display === 'month' && (
        <div
          className={clsx(
            'pt-[8px] pb-[2px] text-[13px] font-[600]',
            getDate.format('YYYY-MM-DD') === displayNow().format('YYYY-MM-DD')
              ? 'text-c8-schedule'
              : 'text-c8-muted'
          )}
        >
          {getDate.date()}
        </div>
      )}
      <div
        className={clsx(
          'relative flex flex-col flex-1 text-c8-ink rounded-[12px]',
          display === 'month' ? 'min-h-[70px]' : 'min-h-0',
          canDrop && 'ring-1 ring-c8-schedule border border-c8-schedule'
        )}
      >
        <div
          className={clsx(
            'flex-col text-[12px] pointer w-full flex scrollbar scrollbar-thumb-tableBorder scrollbar-track-secondary',
            isBeforeNow ? 'flex-1' : 'cursor-pointer',
            isBeforeNow && postList.length === 0 && 'col-calendar'
          )}
        >
          {loading && (
            <div className="h-full w-full p-[5px] animate-pulse absolute left-0 top-0 z-[50]">
              <div className="h-full w-full bg-newSettings rounded-[10px]" />
            </div>
          )}
          {list.map((post) => (
            <div
              key={post.id}
              className={clsx(
                'text-textColor p-[2.5px] relative flex flex-col justify-center items-center'
              )}
            >
              <div className="relative w-full flex flex-col items-center p-[2.5px]">
                <CalendarItem
                  display={display as 'day' | 'week' | 'month'}
                  isBeforeNow={isBeforeNow}
                  date={getDate}
                  state={post.state}
                  statistics={openStatistics(post.id)}
                  missingRelease={openMissingRelease(post.id)}
                  editPost={editPost(post, false)}
                  duplicatePost={editPost(post, true)}
                  copyDebugJson={user?.isSuperAdmin ? copyDebugJson(post) : undefined}
                  post={post}
                  integrations={integrations}
                  deletePost={deletePost(post)}
                />
              </div>
            </div>
          ))}
          {!showAll && postList.length > 3 && (
            <div
              className="text-center hover:underline py-[5px] text-textColor"
              onClick={showAllFunc}
            >
              {t('show_more', '+ Show more')} ({postList.length - 3})
            </div>
          )}
          {showAll && postList.length > 3 && (
            <div
              className="text-center hover:underline py-[5px]"
              onClick={showLessFunc}
            >
              {t('show_less', '- Show less')}
            </div>
          )}
        </div>
        {!isBeforeNow && (
          <div
            className="pb-[2.5px] px-[5px] flex-1 flex"
            onClick={integrations.length ? addModal : addProvider}
          >
            <div
              className={clsx(
                display === ('month' as any)
                  ? 'flex-1 min-h-[40px] w-full'
                  : !postList.length
                  ? 'min-h-full w-full p-[5px]'
                  : 'min-h-[40px] w-full',
                'flex items-center justify-center cursor-pointer pb-[2.5px]'
              )}
            >
              {display !== 'day' && (
                <div
                  className={clsx(
                    'group hover:before:h-[30px] w-full h-full rounded-[10px] flex justify-center items-center text-white'
                  )}
                >
                  <div
                    className={`group-hover:before:content-["+"] pb-[5px] flex justify-center items-center rounded-full transition-all group-hover:bg-c8-ink group-hover:text-c8-on-ink w-full h-full max-w-[36px] max-h-[36px]`}
                  />
                </div>
              )}
              {display === 'day' && (
                <div
                  className={`w-full h-full rounded-[10px] py-[10px] flex-wrap hover:border hover:border-seventh flex justify-center items-center gap-[20px] opacity-30 grayscale hover:grayscale-0 hover:opacity-100`}
                >
                  {integrations.map((selectedIntegrations) => (
                    <div
                      className="relative"
                      key={selectedIntegrations.identifier}
                    >
                      <div
                        className={clsx(
                          'relative w-[34px] h-[34px] rounded-[8px] flex justify-center items-center filter transition-all duration-500'
                        )}
                      >
                        <SafeImage
                          src={
                            selectedIntegrations.picture || '/no-picture.jpg'
                          }
                          className="rounded-[8px]"
                          alt={selectedIntegrations.identifier}
                          width={32}
                          height={32}
                        />
                        {selectedIntegrations.identifier === 'youtube' ? (
                          <img
                            src="/icons/platforms/youtube.svg"
                            className="absolute z-10 -bottom-[5px] -end-[5px]"
                            width={20}
                          />
                        ) : (
                          <SafeImage
                            src={`/icons/platforms/${selectedIntegrations.identifier}.png`}
                            className="rounded-[8px] absolute z-10 -bottom-[5px] -end-[5px] border border-fifth"
                            alt={selectedIntegrations.identifier}
                            width={20}
                            height={20}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
function listStatusClass(state: State) {
  if (state === 'DRAFT') return 'is-draft';
  if (state === 'ERROR') return 'is-error';
  if (state === 'PUBLISHED') return 'is-published';
  return 'is-scheduled';
}

const CalendarItem: FC<{
  date: dayjs.Dayjs;
  isBeforeNow: boolean;
  editPost: () => void;
  duplicatePost: () => void;
  copyDebugJson?: () => void;
  deletePost: () => void;
  statistics: () => void;
  missingRelease?: () => void;
  integrations: Integrations[];
  state: State;
  display: 'day' | 'week' | 'month';
  showTime?: boolean;
  post: Post & {
    integration: Integration;
    tags: {
      tag: Tags;
    }[];
  };
}> = memo((props) => {
  const t = useT();
  const {
    editPost,
    statistics,
    duplicatePost,
    copyDebugJson,
    post,
    date,
    isBeforeNow,
    state,
    display,
    deletePost,
    showTime,
    missingRelease,
  } = props;
  const { disableXAnalytics } = useVariables();
  const user = useUser();
  const showCreationMethodBadge =
    user?.impersonate &&
    post.creationMethod &&
    post.creationMethod !== 'UNKNOWN';
  const [actionsOpen, setActionsOpen] = useState(false);
  const preview = useCallback(() => {
    window.open(`/p/` + post.id + '?share=true', '_blank');
  }, [post]);
  const [{ opacity }, dragRef] = useDrag(
    () => ({
      type: 'post',
      item: {
        id: post.id,
        interval: !!post.intervalInDays,
        date,
      },
      collect: (monitor) => ({
        opacity: monitor.isDragging() ? 0 : 1,
      }),
    }),
    []
  );
  return (
    <div
      // @ts-ignore
      ref={dragRef}
      className={clsx(
        'cal-post w-full flex h-full flex-1 flex-col group',
        'relative',
        actionsOpen && 'is-open',
        state === 'DRAFT' && 'is-draft',
        state === 'ERROR' && 'rounded-[10px] ring-2 ring-red-500'
      )}
      style={{
        opacity,
      }}
    >
      {state === 'ERROR' && (
        <div
          className="absolute -top-[6px] -left-[6px] z-20 w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center text-white text-[11px] font-bold cursor-pointer"
          data-tooltip-id="tooltip"
          data-tooltip-content={post.error || 'An error occurred while publishing this post'}
        >
          !
        </div>
      )}
      {showCreationMethodBadge && (
        <div className="absolute -bottom-[4px] -right-[4px] z-10">
          <CreationMethodBadge
            creationMethod={post.creationMethod}
            ringColor="var(--new-bgColor)"
          />
        </div>
      )}
      <div className="cal-post-bar">
        <div
          className={clsx(
            post?.tags?.[0]?.tag?.color ? 'mix-blend-difference' : '',
            'group-hover:hidden cursor-pointer'
          )}
        >
          {post.tags.map((p) => p.tag.name).join(', ')}
        </div>
        {copyDebugJson && (
          <div className="cal-post-action" onClick={copyDebugJson}>
            <CopyDebug />
            <span>{t('copy_debug_json', 'Copy Debug JSON')}</span>
          </div>
        )}
        <div className="cal-post-action" onClick={duplicatePost}>
          <Duplicate />
          <span>{t('duplicate_post', 'Duplicate Post')}</span>
        </div>
        <div className="cal-post-action" onClick={preview}>
          <Preview />
          <span>{t('preview_post', 'Preview Post')}</span>
        </div>{' '}
        {((post.integration.providerIdentifier === 'x' && disableXAnalytics) || !post.releaseId) ? (
          <></>
        ) : post.releaseId === 'missing' && missingRelease ? (
          <div className="cal-post-action" onClick={missingRelease}>
            <Statistics />
            <span>{t('post_statistics', 'Post Statistics')}</span>
          </div>
        ) : post.releaseId !== 'missing' ? (
          <div className="cal-post-action" onClick={statistics}>
            <Statistics />
            <span>{t('post_statistics', 'Post Statistics')}</span>
          </div>
        ) : (
          <></>
        )}{' '}
        <div className="cal-post-action is-danger" onClick={deletePost}>
          <DeletePost />
          <span>{t('delete_post', 'Delete Post')}</span>
        </div>
      </div>
      <div
        onClick={editPost}
        className="cal-post-body gap-[6px] w-full flex h-full flex-1 p-[6px] text-[13px] relative"
      >
        <div className="cal-post-icon relative min-w-[20px]">
          <img
            className="cal-post-avatar w-[20px] h-[20px] rounded-[6px]"
            src={post.integration.picture! || '/no-picture.jpg'}
            alt=""
          />
          <img
            className="cal-post-mark"
            src={`/icons/platforms/${post.integration?.providerIdentifier}.png`}
            alt=""
          />
        </div>
        {!showTime ? (
          <span className="cal-chip-when">
            {dayjs
              .utc(post.publishDate)
              .tz(getTimezone())
              .format('h:mm')}
          </span>
        ) : null}
        <div className="w-full flex-1 min-w-0">
            <div className="w-full text-ellipsis break-words line-clamp-2 text-start leading-[1.3]">
            {state === 'DRAFT' ? (
              <span className="cal-draft-prefix text-textItemBlur">{t('draft', 'Draft')}: </span>
            ) : null}
            {stripHtmlValidation('none', post.content, false, true, false) ||
              t('no_content', 'no content')}
          </div>
          {showTime && (
            <div className="cal-list-when">
              {dayjs
                .utc(post.publishDate)
                .tz(getTimezone())
                .format(isUSCitizen() ? 'ddd, MMM D · h:mm A' : 'ddd, D MMM · HH:mm')}
            </div>
          )}
        </div>
        {showTime && (
          <span className={clsx('cal-list-status', listStatusClass(state))}>
            {state === 'DRAFT'
              ? t('draft', 'Draft')
              : state === 'ERROR'
              ? t('error', 'Error')
              : state === 'PUBLISHED'
              ? t('published', 'Published')
              : t('scheduled', 'Scheduled')}
          </span>
        )}
        <button
          type="button"
          className="cal-post-more"
          aria-label={t('post', 'Post')}
          onClick={(event) => {
            event.stopPropagation();
            setActionsOpen((open) => !open);
          }}
        >
          ···
        </button>
      </div>
    </div>
  );
});
const DebugJsonModal: FC<{ post: any }> = ({ post }) => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { closeCurrent } = useModals();

  const copyPostId = useCallback(() => {
    copy(post.id);
    toaster.show(
      t('post_id_copied', 'Post ID copied to clipboard'),
      'success'
    );
    closeCurrent();
  }, [post, toaster, t, closeCurrent]);

  const copyJson = useCallback(async () => {
    try {
      const data = await (
        await fetch(`/posts/group/${post.group}/debug-export`)
      ).json();
      copy(JSON.stringify(data, null, 2));
      toaster.show(
        t('debug_json_copied', 'Debug JSON copied to clipboard'),
        'success'
      );
      closeCurrent();
    } catch {
      toaster.show(
        t('debug_json_copy_failed', 'Failed to copy debug data'),
        'warning'
      );
    }
  }, [fetch, post, toaster, t, closeCurrent]);

  return (
    <div className="flex flex-col gap-[16px] p-[16px]">
      <div className="text-textColor text-[14px]">
        {t('debug_choose_copy', 'Choose what you want to copy')}
      </div>
      <div className="flex gap-[10px]">
        <Button onClick={copyPostId}>
          {t('copy_post_id', 'Copy post id')}
        </Button>
        <Button secondary onClick={copyJson}>
          {t('copy_debug_json', 'Copy Debug JSON')}
        </Button>
      </div>
    </div>
  );
};
const CopyDebug = () => {
  const t = useT();
  return (
    <span
      className="inline-flex"
      data-tooltip-id="tooltip"
      data-tooltip-content={t('copy_debug_json', 'Copy Debug JSON')}
    >
      <HugeIcon name="copy" size={16} />
    </span>
  );
};
const Duplicate = () => {
  const t = useT();
  return (
    <span
      className="inline-flex"
      data-tooltip-id="tooltip"
      data-tooltip-content={t('duplicate_post', 'Duplicate Post')}
    >
      <HugeIcon name="copy" size={16} />
    </span>
  );
};
const Preview = () => {
  const t = useT();
  return (
    <span
      className="inline-flex"
      data-tooltip-id="tooltip"
      data-tooltip-content={t('preview_post', 'Preview Post')}
    >
      <HugeIcon name="eye" size={16} />
    </span>
  );
};
export const Statistics = () => {
  const t = useT();
  return (
    <span
      className="inline-flex"
      data-tooltip-id="tooltip"
      data-tooltip-content={t('post_statistics', 'Post Statistics')}
    >
      <HugeIcon name="analytics-bars" size={16} />
    </span>
  );
};

export const DeletePost = () => {
  const t = useT();
  return (
    <span
      className="inline-flex"
      data-tooltip-id="tooltip"
      data-tooltip-content={t('delete_post', 'Delete Post')}
    >
      <HugeIcon name="trash" size={16} />
    </span>
  );
};

export const SetSelectionModal: FC<{
  sets: any[];
  onSelect: (set: any) => void;
  onContinueWithoutSet: () => void;
}> = ({ sets, onSelect, onContinueWithoutSet }) => {
  const t = useT();

  return (
    <div className="po-sets flex flex-col gap-[12px]">
      <div className="text-[15px] font-[500] text-textItemBlur">
        {t('choose_set_or_continue', 'Choose a set or continue without one')}
      </div>

      <div className="flex flex-col gap-[8px] max-h-[360px] overflow-y-auto">
        {sets.map((set) => (
          <div
            key={set.id}
            onClick={() => onSelect(set)}
            className="po-set-card p-[14px] border border-newBorder rounded-[18px] cursor-pointer bg-newBgColorInner"
          >
            <div className="font-[600] text-[15px]">{set.name}</div>
            {set.description && (
              <div className="text-[13px] text-textItemBlur mt-[4px]">
                {set.description}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onContinueWithoutSet}
        className="h-[44px] px-[16px] rounded-[18px] border border-newBorder bg-newBgColorInner text-[14px] font-[600]"
      >
        {t('continue_without_set', 'Continue without set')}
      </button>
    </div>
  );
};
