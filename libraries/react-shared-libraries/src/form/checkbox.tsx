'use client';

import { FC, forwardRef, useCallback, useState } from 'react';
import clsx from 'clsx';
import { useFormContext, useWatch } from 'react-hook-form';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
export const Checkbox = forwardRef<
  null,
  {
    checked?: boolean;
    disableForm?: boolean;
    name?: string;
    className?: string;
    label?: string;
    onChange?: (event: {
      target: {
        name?: string;
        value: boolean;
      };
    }) => void;
    variant?: 'default' | 'hollow';
  }
>((props, ref: any) => {
  const { checked, className, label, disableForm, variant } = props;
  const form = useFormContext();
  const register = disableForm ? {} : form.register(props.name!);
  const watch = disableForm ? false : form.watch(props.name!);
  const val = watch || checked;

  const changeStatus = useCallback(() => {
    props?.onChange?.({
      target: {
        name: props.name!,
        value: !val,
      },
    });
    if (!disableForm) {
      // @ts-ignore
      register?.onChange?.({
        target: {
          name: props.name!,
          value: !val,
        },
      });
    }
  }, [val]);
  return (
    <div className="flex gap-[10px]">
      <div
        ref={ref}
        {...disableForm ? {} : form.register(props.name!)}
        onClick={changeStatus}
        className={clsx(
          'cursor-pointer rounded-[4px] select-none w-[24px] h-[24px] justify-center items-center flex text-white',
          variant === 'default' || !variant
            ? 'bg-forth'
            : 'border-customColor1 border-2 bg-customColor2',
          className
        )}
      >
        {val && (
          <div>
            <HugeIcon name="check" size={16} />
          </div>
        )}
      </div>
      {!!label && <div>{label}</div>}
    </div>
  );
});
