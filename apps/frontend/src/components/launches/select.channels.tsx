'use client';

import React, { FC, useCallback, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useClickOutside } from '@mantine/hooks';
import { useCalendar } from '@gitroom/frontend/components/launches/calendar.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Checkbox } from '@gitroom/react/form/checkbox';

export const SelectChannels: FC = () => {
  const { integrations, customer, selectedChannels, setSelectedChannels } =
    useCalendar();
  const t = useT();
  const [pos, setPos] = useState<any>({});
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => {
    if (open) {
      setOpen(false);
    }
  });

  const channels = useMemo(
    () =>
      integrations.filter((i) => !customer || i.customer?.id === customer),
    [integrations, customer]
  );

  const selectedIds = selectedChannels ?? channels.map((c) => c.id);
  const allSelected = channels.every((c) => selectedIds.includes(c.id));

  const openClose = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }

    const { x, y, height } = ref.current?.getBoundingClientRect();
    setPos({ top: y + height, left: Math.min(x, window.innerWidth - 270) });
    setOpen(true);
  }, [open]);

  const toggleAll = useCallback(() => {
    setSelectedChannels(allSelected ? [] : null);
  }, [allSelected, setSelectedChannels]);

  const toggle = useCallback(
    (id: string) => () => {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((s) => s !== id)
        : [...selectedIds, id];
      setSelectedChannels(next.length === channels.length ? null : next);
    },
    [selectedIds, channels, setSelectedChannels]
  );

  if (channels.length <= 1) {
    return null;
  }

  return (
    <div className="c8-channel-filter relative select-none z-[500]" ref={ref}>
      <button
        type="button"
        className={clsx('c8-inline-chip', !allSelected && 'is-filtered')}
        onClick={openClose}
      >
        {allSelected
          ? t('channels', 'Channels')
          : `${t('channels', 'Channels')} · ${selectedIds.length}`}
      </button>
      {open && (
        <div
          style={pos}
          className="flex flex-col fixed py-[8px] bg-newBgColorInner menu-shadow min-w-[250px] max-h-[320px] overflow-y-auto rounded-[16px] border border-newBorder z-[500]"
        >
          <div className="px-[12px] py-[8px] text-[14px] font-[600] flex items-center">
            <Checkbox
              disableForm={true}
              checked={allSelected}
              onChange={toggleAll}
              label={t('select_all', 'Select all')}
            />
          </div>
          {channels.map((p) => (
            <div
              key={p.id}
              className="px-[12px] py-[8px] text-[14px] font-[500] flex items-center gap-[10px]"
            >
              <Checkbox
                disableForm={true}
                checked={selectedIds.includes(p.id)}
                onChange={toggle(p.id)}
              />
              <img
                className="w-[24px] h-[24px] rounded-[8px]"
                src={p.picture || '/no-picture.jpg'}
                alt=""
              />
              <div className="truncate">{p.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
