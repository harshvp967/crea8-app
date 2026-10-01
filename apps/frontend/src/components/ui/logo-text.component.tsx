'use client';

import { useLayoutEffect, useState } from 'react';
import { modeEmitter } from '@gitroom/frontend/components/layout/mode.component';

const DARK_SRC = '/crea8one-logo-horizontal-color-on-dark.svg';
const LIGHT_SRC = '/crea8one-logo-horizontal-color.svg';

function readMode(): 'dark' | 'light' {
  if (typeof document === 'undefined') {
    return 'dark';
  }
  if (document.body.classList.contains('light')) {
    return 'light';
  }
  if (document.body.classList.contains('dark')) {
    return 'dark';
  }
  const cookie = document.cookie
    .split('; ')
    .find((part) => part.startsWith('mode='));
  return cookie && decodeURIComponent(cookie.slice(5)) === 'light'
    ? 'light'
    : 'dark';
}

export const Crea8oneWordmark = ({
  className,
}: {
  className: string;
}) => {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');

  useLayoutEffect(() => {
    const apply = (value: string) => {
      setMode(value === 'light' ? 'light' : 'dark');
    };
    apply(readMode());
    const onMode = (value: string) => apply(value);
    modeEmitter.on('mode', onMode);
    const observer = new MutationObserver(() => apply(readMode()));
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => {
      modeEmitter.removeListener('mode', onMode);
      observer.disconnect();
    };
  }, []);

  return (
    <img
      src={mode === 'light' ? LIGHT_SRC : DARK_SRC}
      alt="Crea8one"
      width={877}
      height={263}
      className={className}
    />
  );
};

export const LogoTextComponent = () => {
  return (
    <Crea8oneWordmark className="h-[48px] w-auto max-w-[200px] object-contain object-left" />
  );
};
