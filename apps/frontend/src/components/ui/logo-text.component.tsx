'use client';

import Image from 'next/image';

const DARK_SRC = '/crea8one-logo-horizontal-color-on-dark.svg';
const LIGHT_SRC = '/crea8one-logo-horizontal-color.svg';

export const Crea8oneWordmark = ({
  className,
}: {
  className: string;
}) => {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <Image
        src={LIGHT_SRC}
        alt="Crea8one"
        width={877}
        height={263}
        unoptimized
        className="h-full w-auto max-w-full object-contain object-left dark:hidden"
      />
      <Image
        src={DARK_SRC}
        alt=""
        aria-hidden
        width={877}
        height={263}
        unoptimized
        className="hidden h-full w-auto max-w-full object-contain object-left dark:block"
      />
    </span>
  );
};

export const LogoTextComponent = () => {
  return (
    <Crea8oneWordmark className="h-[48px] w-auto max-w-[200px] object-contain object-left" />
  );
};
