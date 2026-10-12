'use client';

import React, {
  DetailedHTMLProps,
  FC,
  InputHTMLAttributes,
  useCallback,
  useMemo,
} from 'react';
import { clsx } from 'clsx';
import { useFormContext } from 'react-hook-form';
import dayjs from 'dayjs';
import { useShowPostSelector } from '../../../../apps/frontend/src/components/post-url-selector/post.url.selector';
import { TranslatedLabel } from '../translation/translated-label';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

export const Canonical: FC<
  DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> & {
    error?: any;
    date: dayjs.Dayjs;
    disableForm?: boolean;
    label: string;
    name: string;
    translationKey?: string;
    translationParams?: Record<string, string | number>;
  }
> = (props) => {
  const {
    label,
    date,
    className,
    disableForm,
    error,
    translationKey,
    translationParams,
    ...rest
  } = props;
  const form = useFormContext();
  const err = useMemo(() => {
    if (error) return error;
    if (!form || !form.formState.errors[props?.name!]) return;
    return form?.formState?.errors?.[props?.name!]?.message! as string;
  }, [form?.formState?.errors?.[props?.name!]?.message, error]);
  const postSelector = useShowPostSelector(date);
  const onPostSelector = useCallback(async () => {
    const id = await postSelector();
    if (disableForm) {
      // @ts-ignore
      return rest.onChange({
        // @ts-ignore
        target: {
          value: id,
          name: props.name,
        },
      });
    }
    return form.setValue(props.name, id);
  }, [form]);
  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex items-center gap-[3px]">
        <div className={`text-[14px]`}>
          <TranslatedLabel
            label={label}
            translationKey={translationKey}
            translationParams={translationParams}
          />
        </div>
        <div>
          <HugeIcon
            name="flash"
            size={16}
            onClick={onPostSelector}
            className="cursor-pointer text-white"
          />
        </div>
      </div>
      <input
        {...(disableForm ? {} : form.register(props.name))}
        className={clsx(
          'bg-input h-[44px] px-[16px] outline-none border-fifth border rounded-[4px] text-inputText placeholder-inputText',
          className
        )}
        {...rest}
      />
      <div className="text-red-400 text-[12px]">{err || <>&nbsp;</>}</div>
    </div>
  );
};
