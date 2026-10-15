'use client';

import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Integrations } from '@gitroom/frontend/components/launches/calendar.context';
import { namedCustomers } from '@gitroom/frontend/components/launches/customer.filter';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import clsx from 'clsx';
import { useClickOutside } from '@mantine/hooks';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useShallow } from 'zustand/react/shallow';
import { UserIcon, DropdownArrowIcon } from '@gitroom/frontend/components/ui/icons';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

export const SelectCustomer: FC<{
  onChange: (value: string) => void;
  integrations: Integrations[];
  customer?: string;
}> = (props) => {
  const { onChange, integrations, customer: currentCustomer } = props;
  const { setCurrent } = useLaunchStore(
    useShallow((state) => ({
      setCurrent: state.setCurrent,
    }))
  );
  const toaster = useToaster();
  const t = useT();
  const [customer, setCustomer] = useState(currentCustomer || '');
  useEffect(() => {
    setCustomer(currentCustomer || '');
  }, [currentCustomer]);
  const [pos, setPos] = useState<any>({});
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => {
    if (open) {
      setOpen(false);
    }
  });

  const openClose = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }

    const { x, y, width, height } = ref.current?.getBoundingClientRect();
    setPos({ top: y + height, left: x });
    setOpen(true);
  }, [open]);

  const customers = useMemo(() => namedCustomers(integrations), [integrations]);
  const choose = useCallback(
    (id: string) => {
      toaster.show(
        id
          ? t('customer_socials_selected', 'Customer socials selected')
          : t('all_customers_selected', 'All customers selected'),
        'success'
      );
      setCustomer(id);
      onChange(id);
      setOpen(false);
      setCurrent('global');
    },
    [onChange, setCurrent, t, toaster]
  );
  const selectedName =
    customers.find((item) => item?.customer?.id === customer)?.customer?.name ||
    t('all_customers', 'All customers');
  if (!customers.length) {
    return null;
  }

  return (
    <div className="select-customer relative select-none z-[500]" ref={ref}>
      <div
        data-tooltip-id="tooltip"
        data-tooltip-content={t('select_customer_tooltip', 'Select Customer')}
        onClick={openClose}
        className={clsx(
          'relative z-[20] cursor-pointer h-[42px] rounded-[8px] pl-[16px] pr-[12px] gap-[8px] border flex items-center',
          open ? 'border-[#00D9FF]' : 'border-newColColor'
        )}
      >
        <div>
          <UserIcon />
        </div>
        <span className="select-customer-label">
          {selectedName}
        </span>
        <div>
          <DropdownArrowIcon rotated={open} />
        </div>
      </div>
      {open && (
        <div
          style={pos}
          className="flex flex-col fixed pt-[12px] bg-newBgColorInner menu-shadow min-w-[250px]"
        >
          <div className="text-[14px] font-[600] px-[12px] mb-[5px]">
            {t('customers', 'Customers')}
          </div>
          <div
            onClick={() => choose('')}
            aria-selected={!customer}
            className="customer-option p-[12px] hover:bg-newBgColor text-[14px] font-[500] h-[32px] flex items-center"
          >
            <span>{t('all_customers', 'All customers')}</span>
            <span className="customer-option-check" aria-hidden="true">
              <HugeIcon name="check" size={16} />
            </span>
          </div>
          {customers.map((p) => (
              <div
                onClick={() => choose(p.customer?.id || '')}
                key={p.customer?.id}
                aria-selected={customer === p.customer?.id}
                className="customer-option p-[12px] hover:bg-newBgColor text-[14px] font-[500] h-[32px] flex items-center"
              >
                <span>{p.customer?.name}</span>
                <span className="customer-option-check" aria-hidden="true">
                  <HugeIcon name="check" size={16} />
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
