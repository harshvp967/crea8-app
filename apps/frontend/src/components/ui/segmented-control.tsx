'use client';

// Ported from Tweenly Segmented Control
// (https://trytweenly.vercel.app/r/segmented-control.json).
// The active pill is a soft cyan wash with a 1px hairline. No outer glow.
import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import clsx from 'clsx';

export interface SegmentedControlOption {
  value: string;
  label: string;
  icon?: ReactNode;
  /** When set, the option is a link. Arrow keys route here as well. */
  href?: string;
}

export interface SegmentedControlProps {
  /** Options to choose from, in order. */
  options: SegmentedControlOption[];
  /** Controlled selected value. */
  value?: string;
  /** Initially selected value when uncontrolled. Default: first option */
  defaultValue?: string;
  /** Called with the chosen value, including a repeat click on the active option. */
  onValueChange?: (value: string) => void;
  /** Control size. Default: "md" */
  size?: 'sm' | 'md' | 'lg';
  /** Pill color (any CSS color). Default: a soft cyan tint */
  pillColor?: string;
  /** Spring stiffness of the sliding pill. Default: 400 */
  stiffness?: number;
  /** Spring damping of the sliding pill. Default: 32 */
  damping?: number;
  /** Accessible label for the group. */
  'aria-label'?: string;
  className?: string;
}

const sizes = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
};

const softPill = {
  background: 'color-mix(in srgb, #00D9FF 18%, var(--new-bgColorInner))',
  boxShadow: 'inset 0 0 0 1px color-mix(in srgb, #00D9FF 42%, transparent)',
};

export function SegmentedControl({
  options,
  value,
  defaultValue,
  onValueChange,
  size = 'md',
  pillColor,
  stiffness = 400,
  damping = 32,
  'aria-label': ariaLabel,
  className,
}: SegmentedControlProps) {
  const reduced = useReducedMotion();
  const id = useId();
  const router = useRouter();
  const [internal, setInternal] = useState(defaultValue ?? options[0]?.value);
  const selected = value ?? internal;
  const refs = useRef<(HTMLButtonElement | HTMLAnchorElement | null)[]>([]);

  const select = (next: string) => {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const delta = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    }[event.key];
    let next: number | undefined;
    if (delta) next = (index + delta + options.length) % options.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    const option = options[next];
    select(option.value);
    if (option.href) router.push(option.href);
    refs.current[next]?.focus();
  };

  const activeIndex = options.findIndex((option) => option.value === selected);

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={clsx(
        'relative inline-flex items-center rounded-full border border-newBorder bg-newBgColorInner p-1',
        className
      )}
    >
      {options.map((option, i) => {
        const active = option.value === selected;
        const itemClass = clsx(
          'relative inline-flex items-center justify-center whitespace-nowrap rounded-full font-[600] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#00D9FF]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-newBgColorInner',
          sizes[size],
          active
            ? 'text-newTextColor'
            : 'text-textItemBlur hover:text-newTextColor'
        );
        const inner = (
          <>
            {active && (
              <motion.span
                layoutId={`${id}-pill`}
                aria-hidden="true"
                className="absolute inset-0 rounded-full"
                style={pillColor ? { background: pillColor } : softPill}
                transition={
                  reduced ? { duration: 0 } : { type: 'spring', stiffness, damping }
                }
              />
            )}
            {option.icon && (
              <span
                aria-hidden="true"
                className="relative flex shrink-0 items-center [&_svg]:h-[1.15em] [&_svg]:w-auto"
              >
                {option.icon}
              </span>
            )}
            <span className="relative">{option.label}</span>
          </>
        );
        const shared = {
          role: 'radio' as const,
          'aria-checked': active,
          tabIndex: active || (activeIndex === -1 && i === 0) ? 0 : -1,
          onKeyDown: (event: KeyboardEvent) => onKeyDown(event, i),
          className: itemClass,
          ref: (el: HTMLButtonElement | HTMLAnchorElement | null) => {
            refs.current[i] = el;
          },
        };

        if (option.href) {
          return (
            <Link
              key={option.value}
              href={option.href}
              onClick={() => select(option.value)}
              {...shared}
            >
              {inner}
            </Link>
          );
        }

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => select(option.value)}
            {...shared}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
