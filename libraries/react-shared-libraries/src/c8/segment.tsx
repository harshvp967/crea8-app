'use client';

import { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import clsx from 'clsx';

export function C8Segment({
  options,
  value,
  onValueChange,
  'aria-label': ariaLabel,
  className,
}: {
  options: { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
  'aria-label'?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={clsx(
        'c8-segment inline-flex h-[38px] items-center gap-0.5 rounded-c8-pill bg-c8-soft p-1 max-[639px]:h-auto max-[639px]:flex-wrap max-[639px]:bg-transparent max-[639px]:p-0 max-[639px]:gap-1.5',
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onValueChange(option.value)}
            className={clsx(
              'relative inline-flex items-center justify-center whitespace-nowrap rounded-c8-pill px-3.5 py-[7px] font-c8-body text-c8-body-sm font-medium text-c8-muted',
              'max-[639px]:h-[34px] max-[639px]:border max-[639px]:px-3.5 max-[639px]:py-2',
              active && 'font-semibold text-c8-ink max-[639px]:border-c8-ink max-[639px]:bg-c8-ink max-[639px]:text-c8-on-ink',
              !active && 'max-[639px]:border-c8-line max-[639px]:bg-c8-surface max-[639px]:text-c8-ink'
            )}
          >
            {active ? (
              <motion.span
                layoutId={`${id}-pill`}
                aria-hidden
                className="absolute inset-0 rounded-c8-pill bg-c8-surface shadow-c8-hard-1 max-[639px]:hidden"
                transition={
                  reduced
                    ? { duration: 0.08 }
                    : { type: 'spring', stiffness: 100, damping: 15 }
                }
              />
            ) : null}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
