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
      {/*
        Asset is 300×104 with internal padding. Render tall enough so the
        cyan mark + wordmark read at ~30–34px visual height inside a ~60px header.
      */}
      <img
        src="/crea8one-logo.png"
        alt="Crea8one"
        width={300}
        height={104}
        className="h-[52px] w-auto max-w-[220px] object-contain object-left"
      />
    </Link>
  );
};
