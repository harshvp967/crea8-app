import { HTMLAttributes } from 'react';
import clsx from 'clsx';

export function C8Card({
  featured = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { featured?: boolean }) {
  return (
    <div
      {...props}
      className={clsx(
        'flex flex-col gap-3 rounded-c8-card bg-c8-surface p-5',
        featured ? 'border-c8-sticker border-c8-hard' : 'border border-c8-line',
        className
      )}
    />
  );
}
