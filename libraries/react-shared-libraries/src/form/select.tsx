'use client';

import {
  Children,
  DetailedHTMLProps,
  FC,
  forwardRef,
  isValidElement,
  ReactNode,
  SelectHTMLAttributes,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { clsx } from 'clsx';
import { useFormContext } from 'react-hook-form';
import { RegisterOptions } from 'react-hook-form/dist/types/validator';
import { TranslatedLabel } from '../translation/translated-label';

export const Select: FC<
  DetailedHTMLProps<
    SelectHTMLAttributes<HTMLSelectElement>,
    HTMLSelectElement
  > & {
    error?: any;
    extraForm?: RegisterOptions<any>;
    disableForm?: boolean;
    label: string;
    name: string;
    hideErrors?: boolean;
    translationKey?: string;
    translationParams?: Record<string, string | number>;
  }
> = forwardRef((props, ref) => {
  const {
    label,
    className,
    hideErrors,
    disableForm,
    error,
    extraForm,
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
  const nativeRef = useRef<HTMLSelectElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const registered = disableForm || !form ? null : form.register(props.name, extraForm);
  const watched = form ? form.watch(props.name) : rest.value;
  const options = useMemo(
    () =>
      Children.toArray(rest.children).flatMap((child) => {
        if (!isValidElement(child)) {
          return [];
        }
        const option = child.props as { value?: string | number; children?: ReactNode };
        if (child.type !== 'option') {
          return [];
        }
        return [
          {
            value: String(option.value ?? ''),
            label: option.children,
          },
        ];
      }),
    [rest.children]
  );
  const current = String(watched ?? '');
  const currentLabel =
    options.find((option) => option.value === current)?.label ||
    options[0]?.label ||
    '';
  const { ref: fieldRef, ...field } = registered || {};
  const setNative = (node: HTMLSelectElement | null) => {
    nativeRef.current = node;
    if (typeof fieldRef === 'function') {
      fieldRef(node);
    }
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      (ref as { current: HTMLSelectElement | null }).current = node;
    }
  };
  const choose = (value: string) => {
    const el = nativeRef.current;
    if (!el) {
      return;
    }
    const setter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      'value'
    )?.set;
    setter?.call(el, value);
    const event = { target: el, currentTarget: el, type: 'change' };
    registered?.onChange?.(event);
    rest.onChange?.(event as any);
    setMenuOpen(false);
  };
  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);
  return (
    <div className={clsx('c8-field-select flex flex-col', label ? 'gap-[6px]' : '')}>
      <div className={`text-[14px]`}>
        <TranslatedLabel
          label={label}
          translationKey={translationKey}
          translationParams={translationParams}
        />
      </div>
      <div className="c8-select-wrap" ref={menuRef}>
        <select
          ref={setNative}
          {...field}
          className={clsx(
            'c8-native-select h-[44px] bg-newBgColorInner px-[16px] outline-none border-newBorder border rounded-[18px] text-[14px] text-textColor focus:border-[color:var(--arc-focus)]',
            className
          )}
          {...rest}
        />
        <div className="c8-select-ui">
          <button
            type="button"
            className="c8-select-face"
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span>{currentLabel}</span>
          </button>
          {menuOpen && (
            <div className="c8-select-menu" role="listbox">
              {options.map((option) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === current}
                  key={option.value}
                  className={clsx(option.value === current && 'is-on')}
                  onClick={() => choose(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {!hideErrors && (
        <div className="text-red-400 text-[12px]">{err || <>&nbsp;</>}</div>
      )}
    </div>
  );
});
