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
    'transition-colors font-[600] select-none',
    variant === 'horizontal' &&
      clsx(
        'inline-flex items-center gap-[8px] whitespace-nowrap rounded-full px-[18px] py-[10px] text-[14px] border',
        isActive
          ? 'bg-[#00D9FF] text-[#0a0a0a] border-[#00D9FF] shadow-[0_0_0_1px_rgba(0,217,255,0.25)]'
          : 'bg-[#1a1a1a] text-[#b0b0b0] border-[#2a2a2a] hover:bg-[#00D9FF] hover:text-[#0a0a0a] hover:border-[#00D9FF]'
      ),
    variant === 'utility' &&
      clsx(
        'inline-flex items-center gap-[6px] whitespace-nowrap rounded-full px-[12px] py-[8px] text-[12px] border border-transparent',
        isActive
          ? 'bg-[#00D9FF]/15 text-[#00D9FF] border-[#00D9FF]/30'
          : 'text-[#8a8a8a] hover:text-white hover:bg-[#1c1c1c] hover:border-[#2a2a2a]'
      ),
    variant === 'sidebar' &&
      clsx(
        'w-full flex items-center gap-[10px] rounded-full px-[14px] py-[11px] text-[13px] border',
        isActive
          ? 'bg-[#00D9FF] text-[#0a0a0a] border-[#00D9FF]'
          : 'bg-transparent text-[#8a8a8a] border-[#2a2a2a] hover:text-white hover:border-[#3a3a3a] hover:bg-[#1c1c1c]'
      ),
    variant === 'vertical' &&
      clsx(
        'group w-full minCustom:h-[54px] custom:h-[44px] py-[8px] px-[6px] minCustom:gap-[4px] custom:gap-[2px] flex flex-col font-[600] items-center justify-center rounded-[12px] hover:text-textItemFocused hover:bg-boxFocused',
        isActive ? 'text-textItemFocused bg-boxFocused' : 'text-textItemBlur'
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
