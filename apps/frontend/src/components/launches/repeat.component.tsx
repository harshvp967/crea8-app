'use client';

import { FC, useMemo, useRef, useState } from 'react';
import { Select } from '@gitroom/react/form/select';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useClickOutside } from '@mantine/hooks';
import { isUSCitizen } from '@gitroom/frontend/components/launches/helpers/isuscitizen.utils';
import clsx from 'clsx';
import { RepeatIcon, DropdownArrowIcon, CheckmarkIcon, CloseIcon } from '@gitroom/frontend/components/ui/icons';
import { useGrabToClose } from '@gitroom/frontend/components/launches/helpers/grab.to.close';
const getList = (t: (key: string, fallback: string) => string) => [
  {
    value: 1,
    label: t('every_day', 'Every day'),
  },
  {
    value: 2,
    label: t('every_2_days', 'Every 2 days'),
  },
  {
    value: 3,
    label: t('every_3_days', 'Every 3 days'),
  },
  {
    value: 4,
    label: t('every_4_days', 'Every 4 days'),
  },
  {
    value: 5,
    label: t('every_5_days', 'Every 5 days'),
  },
  {
    value: 6,
    label: t('every_6_days', 'Every 6 days'),
  },
  {
    value: 7,
    label: t('every_week', 'Every week'),
  },
  {
    value: 14,
    label: t('every_2_weeks', 'Every 2 weeks'),
  },
  {
    value: 30,
    label: t('every_month', 'Every month'),
  },
  {
    value: null,
    label: t('cancel', 'Cancel'),
  },
];
export const RepeatComponent: FC<{
  repeat: number | null;
  onChange: (newVal: number) => void;
}> = (props) => {
  const { repeat } = props;
  const t = useT();
  const list = getList(t);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = () => setIsOpen(false);
  useGrabToClose(menuRef, isOpen, close);

  const ref = useClickOutside(() => {
    if (!isOpen) {
      return;
    }
    setIsOpen(false);
  });

  const everyLabel = useMemo(() => {
    if (!repeat) {
      return '';
    }
    return list.find((p) => p.value === repeat)?.label;
  }, [repeat, list]);

  return (
    <div
      ref={ref}
      className={clsx(
        'po-repeat border rounded-[8px] justify-center flex items-center relative h-[44px] text-[15px] font-[600] select-none',
        isOpen ? 'border-[#00D9FF] bg-[#00D9FF]/10' : 'border-newTextColor/10',
      )}
    >
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-[16px] justify-center flex gap-[8px] items-center h-full select-none flex-1 min-w-0"
      >
        <div className="cursor-pointer">
          <RepeatIcon />
        </div>
        <div className="cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis">
          {repeat
            ? everyLabel
            : t('repeat', 'Repeat')}
        </div>
        <div className="cursor-pointer">
          <DropdownArrowIcon rotated={isOpen} />
        </div>
      </div>
      {isOpen && (
        <div ref={menuRef} className="po-repeat-menu z-[300] absolute start-0 bottom-[calc(100%+8px)] flex flex-col">
          <div className="arc-grab" aria-hidden />
          <div className="po-menu-title">
            {t('repeat', 'Repeat')}
          </div>
          {list.map((p) => {
            const selected = p.value != null && p.value === repeat;
            const isCancel = p.value == null;
            return (
              <div
                onClick={() => {
                  props.onChange(Number(p.value));
                  setIsOpen(false);
                }}
                key={p.label}
                className={clsx(
                  'po-menu-row',
                  selected && 'is-on',
                  isCancel && 'is-cancel'
                )}
              >
                {isCancel && <CloseIcon className="text-textItemBlur" />}
                <span className="min-w-0 flex-1">{p.label}</span>
                {selected && <CheckmarkIcon className="text-[#00D9FF]" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
