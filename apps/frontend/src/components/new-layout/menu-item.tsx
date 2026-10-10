'use client';
import { FC, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import Link from 'next/link';

export const MenuItem: FC<{
  label: string;
  icon: ReactNode;
  path: string;
  onClick?: () => void;
  variant?: 'horizontal' | 'vertical' | 'utility' | 'sidebar';
}> = ({ label, icon, path, onClick, variant = 'horizontal' }) => {
  const currentPath = usePathname();
  const isActive =
    path !== '#' && path.indexOf('http') !== 0 && currentPath.indexOf(path) === 0;

  const className = clsx(
    'transition-colors font-[500] select-none',
    variant === 'horizontal' &&
      clsx(
        'inline-flex items-center gap-[8px] whitespace-nowrap rounded-[18px] px-[14px] min-h-[36px] text-[14px] border',
        isActive
          ? 'arc-selected'
          : 'bg-transparent text-textItemBlur border-transparent hover:bg-newBoxHover hover:text-newTextColor hover:border-newBorder'
      ),
    variant === 'utility' &&
      clsx(
        'inline-flex items-center gap-[6px] whitespace-nowrap rounded-[18px] px-[12px] min-h-[36px] text-[14px] border border-transparent w-full',
        isActive
          ? 'arc-selected'
          : 'text-textItemBlur hover:text-newTextColor hover:bg-newBoxHover hover:border-newBorder'
      ),
    variant === 'sidebar' &&
      clsx(
        'w-full flex items-center gap-[10px] rounded-[18px] px-[14px] min-h-[44px] text-[14px] border',
        isActive
          ? 'arc-selected'
          : 'bg-transparent text-textItemBlur border-transparent hover:text-newTextColor hover:border-newBorder hover:bg-newBoxHover'
      ),
    variant === 'vertical' &&
      clsx(
        'group w-full minCustom:h-[54px] custom:h-[44px] py-[8px] px-[6px] minCustom:gap-[4px] custom:gap-[2px] flex flex-col font-[500] items-center justify-center rounded-[18px] hover:text-[color:var(--arc-accent-text)] hover:bg-[var(--arc-selected)]',
        isActive ? 'arc-selected' : 'text-textItemBlur'
      )
  );

  const iconClass =
    variant === 'horizontal'
      ? '[&_svg]:w-[16px] [&_svg]:h-[16px] shrink-0'
      : variant === 'utility' || variant === 'sidebar'
        ? '[&_svg]:w-[16px] [&_svg]:h-[16px] shrink-0'
        : 'custom:scale-90 transition-transform';

  const inner = (
    <>
      <div className={iconClass}>{icon}</div>
      {variant === 'vertical' ? (
        <div className="custom:text-[9px] minCustom:text-[10px] leading-[1.1] text-center">
          {label}
        </div>
      ) : (
        <span>{label}</span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} title={label} className={className} type="button">
        {inner}
      </button>
    );
  }

  return (
    <Link
      prefetch={true}
      href={path}
      title={label}
      {...(path.indexOf('http') === 0 && { target: '_blank' })}
      className={className}
    >
      {inner}
    </Link>
  );
};
