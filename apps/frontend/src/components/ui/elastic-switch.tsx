'use client';

// Ported from Tweenly Elastic Switch
// (https://trytweenly.vercel.app/r/elastic-switch.json).
// The on-track is a soft cyan mix with a hairline and glow, not a solid fill.
import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import clsx from 'clsx';

export interface ElasticSwitchProps {
  /** Controlled state. */
  checked?: boolean;
  /** Initial state when uncontrolled. Default: false */
  defaultChecked?: boolean;
  /** Called with the new state when toggled. */
  onCheckedChange?: (checked: boolean) => void;
  /** Switch size. Default: "md" */
  size?: 'sm' | 'md' | 'lg';
  /** Track color when on (any CSS color). Default: a soft cyan mix */
  onColor?: string;
  /** Track color when off (any CSS color). Default: the theme surface */
  offColor?: string;
  /** Show a sun / moon icon inside the knob. Default: false */
  icons?: boolean;
  /** Visible label next to the switch. */
  label?: string;
  /** Disable interaction. Default: false */
  disabled?: boolean;
  /** Accessible label when no visible `label` is given. */
  'aria-label'?: string;
  className?: string;
}

const sizes = {
  sm: { w: 36, h: 20, knob: 16, pad: 2, icon: 10 },
  md: { w: 50, h: 28, knob: 22, pad: 3, icon: 13 },
  lg: { w: 64, h: 36, knob: 30, pad: 3, icon: 17 },
};

const SOFT_ON = 'color-mix(in srgb, #00D9FF 42%, var(--new-col-color))';

const Sun = ({ size }: { size: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.4}
    strokeLinecap="round"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const Moon = ({ size }: { size: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </svg>
);

export function ElasticSwitch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  size = 'md',
  onColor = SOFT_ON,
  offColor,
  icons = false,
  label,
  disabled = false,
  'aria-label': ariaLabel,
  className,
}: ElasticSwitchProps) {
  const reduced = useReducedMotion();
  const id = useId();
  const [internal, setInternal] = useState(defaultChecked);
  const [pressed, setPressed] = useState(false);
  const on = checked ?? internal;
  const s = sizes[size];

  const toggle = () => {
    if (disabled) return;
    if (checked === undefined) setInternal(!on);
    onCheckedChange?.(!on);
  };

  const knobW = pressed && !reduced ? s.knob * 1.35 : s.knob;
  const x = on ? s.w - s.pad * 2 - knobW : 0;
  const spring = reduced
    ? { duration: 0 }
    : {
        type: 'spring' as const,
        stiffness: 520,
        damping: pressed ? 30 : 17,
        mass: 0.8,
      };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-3',
        disabled && 'opacity-50',
        className
      )}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label ? undefined : ariaLabel}
        disabled={disabled}
        onClick={toggle}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        onKeyDown={(event) => event.key === ' ' && setPressed(true)}
        onKeyUp={() => setPressed(false)}
        onBlur={() => setPressed(false)}
        className="relative shrink-0 cursor-pointer overflow-hidden rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#00D9FF]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-newBgColorInner disabled:cursor-not-allowed"
        style={{
          width: s.w,
          height: s.h,
          padding: s.pad,
          background: offColor ?? 'var(--new-col-color)',
          boxShadow: on
            ? '0 0 14px color-mix(in srgb, #00D9FF 40%, transparent), inset 0 0 0 1px color-mix(in srgb, #00D9FF 68%, transparent)'
            : 'inset 0 0 0 1px var(--new-border)',
        }}
      >
        <motion.span
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: onColor }}
          initial={false}
          animate={{ opacity: on ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
        />
        <motion.span
          aria-hidden="true"
          className="relative grid place-items-center overflow-hidden rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.28)]"
          style={{ height: s.knob }}
          initial={false}
          animate={{ x, width: knobW }}
          transition={spring}
        >
          {icons && (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={on ? 'moon' : 'sun'}
                className="grid place-items-center"
                style={{ color: on ? '#06788F' : '#8a8a8a' }}
                initial={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, rotate: -90, scale: 0.4 }
                }
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, rotate: 90, scale: 0.4 }
                }
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 400, damping: 22 }
                }
              >
                {on ? <Moon size={s.icon} /> : <Sun size={s.icon} />}
              </motion.span>
            </AnimatePresence>
          )}
        </motion.span>
      </button>
      {label && (
        <label
          htmlFor={id}
          className={clsx(
            'select-none text-sm font-medium text-newTextColor',
            !disabled && 'cursor-pointer'
          )}
        >
          {label}
        </label>
      )}
    </span>
  );
}
