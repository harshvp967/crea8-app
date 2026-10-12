import { FC, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import { useFormContext } from 'react-hook-form';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
export const Total: FC<{
  name: string;
  customOnChange?: () => void;
}> = (props) => {
  const { name, customOnChange } = props;
  const form = useFormContext();
  const value = form.watch(props.name);
  const changeNumber = useCallback(
    (value: number) => () => {
      if (value === 0) {
        return;
      }
      form.setValue(name, value);
    },
    [value]
  );
  useEffect(() => {
    if (customOnChange) {
      customOnChange();
    }
  }, [value, customOnChange]);

  const t = useT();

  return (
    <div className="flex flex-col gap-[6px] relative w-[158px]">
      <div className={`text-[14px]`}>{t('total', 'Total')}</div>
      <div
        className={clsx(
          'bg-input h-[44px] border-fifth border rounded-[4px] text-inputText placeholder-inputText items-center justify-center flex'
        )}
      >
        <div className="flex-1 px-[16px] text-[14px] select-none flex gap-[8px] items-center">
          <div onClick={changeNumber(value - 1)}>
            <HugeIcon
              name="minus-circle"
              size={16}
              className={value === 1 ? 'text-[#64748B]' : 'text-white'}
            />
          </div>
          <div className="flex-1 text-white text-[14px] text-center">
            {value}
          </div>
          <div onClick={changeNumber(value + 1)}>
            <HugeIcon name="add-circle" size={16} className="text-white" />
          </div>
        </div>
      </div>
    </div>
  );
};
