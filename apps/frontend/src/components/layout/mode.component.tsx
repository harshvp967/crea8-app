'use client';

import { useCallback, useEffect } from 'react';
import useCookie from 'react-use-cookie';
import EventEmitter from 'events';
export const modeEmitter = new EventEmitter();

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </svg>
);

const ModeComponent = () => {
  const [mode, setMode] = useCookie('mode', 'dark');

  const changeMode = useCallback(
    (checked: boolean) => {
      const next = checked ? 'dark' : 'light';
      if (next === mode) return;
      modeEmitter.emit('mode', next);
      setMode(next);
    },
    [mode, setMode]
  );

  useEffect(() => {
    document.body.classList.remove('dark', 'light');
    document.body.classList.add(mode);
  }, [mode]);

  return (
    <button
      type="button"
      className="arc-icon-btn header-theme"
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => changeMode(mode !== 'dark')}
    >
      {mode === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
};
export default ModeComponent;
