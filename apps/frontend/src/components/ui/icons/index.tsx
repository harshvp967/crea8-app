import { FC, SVGProps } from 'react';
import clsx from 'clsx';
import { HugeIcon, type HugeIconName } from '@gitroom/frontend/components/icons/hugeicons';

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  size?: number;
};

const glyph =
  (icon: HugeIconName, fallback = 20): FC<IconProps> =>
  ({ size = fallback, className, ...props }) => (
    <HugeIcon {...props} name={icon} size={size} className={className} />
  );

export const SettingsIcon = glyph('settings', 20);
export const ChevronUpIcon = glyph('chevron-up', 20);
export const CloseIcon = glyph('close', 20);
export const CloseIconSmall = glyph('close', 16);
export const TrashIcon = glyph('trash', 20);
export const DelayIcon = glyph('clock', 20);
export const LinkIcon = glyph('link', 20);
export const StalkerIcon = glyph('eye', 20);
export const RepeatIcon = glyph('repeat', 20);
export const PlusIcon = glyph('plus', 16);
export const GlobalIcon = glyph('globe', 20);
export const UserIcon = glyph('user', 20);
export const ExpandIcon = glyph('expand', 20);
export const CollapseIcon = glyph('collapse', 20);
export const LockIcon = glyph('lock', 32);
export const ResetIcon = glyph('refresh', 16);
export const EmojiIcon = glyph('smile', 16);
export const ChevronLeftIcon = glyph('chevron-left', 24);
export const ChevronRightIcon = glyph('chevron-right', 24);
export const DeleteCircleIcon = glyph('close-circle', 18);
export const CloseCircleIcon = glyph('close-circle', 16);
export const DragHandleIcon = glyph('drag', 16);
export const MediaSettingsIcon = glyph('settings', 40);
export const InsertMediaIcon = glyph('image-add', 16);
export const DesignMediaIcon = glyph('pencil', 16);
export const DayCalendarIcon = glyph('calendar-day', 16);
export const WeekCalendarIcon = glyph('calendar-week', 16);
export const MonthCalendarIcon = glyph('calendar', 16);
export const ListCalendarIcon = glyph('list', 16);

export const ChevronDownIcon: FC<IconProps & { rotated?: boolean }> = ({
  size = 20,
  className,
  rotated,
  ...props
}) => (
  <HugeIcon
    {...props}
    name="chevron-down"
    size={size}
    className={clsx(rotated && 'rotate-180', 'transition-transform', className)}
  />
);

export const DropdownArrowIcon: FC<IconProps & { rotated?: boolean }> = ({
  size = 20,
  className,
  rotated,
  ...props
}) => (
  <HugeIcon
    {...props}
    name="chevron-down"
    size={size}
    className={clsx(rotated && 'rotate-180', 'transition-transform', className)}
  />
);

export const DropdownArrowSmallIcon: FC<IconProps & { rotated?: boolean }> = ({
  className,
  rotated,
  ...props
}) => (
  <HugeIcon
    {...props}
    name="chevron-down"
    size={12}
    className={clsx(rotated && 'rotate-180', 'transition-transform', className)}
  />
);

export const CalendarIcon: FC<IconProps> = ({ className, ...props }) => (
  <HugeIcon {...props} name="calendar" size={20} className={className} />
);

export const TagIcon: FC<IconProps> = ({ className, ...props }) => (
  <HugeIcon {...props} name="tag" size={16} className={className} />
);

export const CheckmarkIcon: FC<IconProps> = ({ className, ...props }) => (
  <HugeIcon {...props} name="check" size={16} className={className} />
);

/** Thread connector. Not a glyph — kept as a hairline so the thread layout stays put. */
export const ConnectionLineIcon: FC<IconProps> = ({ className, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="87"
    viewBox="0 0 18 87"
    fill="none"
    className={className}
    aria-hidden
    {...props}
  >
    <path
      d="M0.75 0.75V79.75C0.75 83.0637 3.43629 85.75 6.75 85.75H16.75"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

/** Toolbar divider. Not a glyph. */
export const VerticalDividerIcon: FC<IconProps> = ({ className, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="2"
    height="17"
    viewBox="0 0 2 17"
    fill="none"
    className={className}
    aria-hidden
    {...props}
  >
    <path
      d="M0.75 0.75V16"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const NoMediaIcon: FC = () => (
  <HugeIcon name="image-off" size={24} />
);
