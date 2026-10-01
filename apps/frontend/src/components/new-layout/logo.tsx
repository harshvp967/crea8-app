'use client';

import Link from 'next/link';

export const Logo = () => {
  return (
    <Link
      href="/launches"
      prefetch={true}
      className="flex items-center shrink-0 ps-[4px] pe-[8px]"
      title="Crea8one"
    >
      <img
        src="/crea8one-logo-horizontal-color.svg"
        alt="Crea8one"
        width={877}
        height={263}
        className="h-[52px] w-auto max-w-[220px] object-contain object-left dark:hidden"
      />
      <img
        src="/crea8one-logo-horizontal-color-on-dark.svg"
        alt=""
        width={877}
        height={263}
        className="hidden h-[52px] w-auto max-w-[220px] object-contain object-left dark:block"
      />
    </Link>
  );
};
