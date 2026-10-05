'use client';

import { useCallback, useEffect } from 'react';
import useCookie from 'react-use-cookie';
import EventEmitter from 'events';
import { ElasticSwitch } from '@gitroom/frontend/components/ui/elastic-switch';

export const modeEmitter = new EventEmitter();

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
    <ElasticSwitch
      size="sm"
      icons
      checked={mode === 'dark'}
      onCheckedChange={changeMode}
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    />
  );
};
export default ModeComponent;
