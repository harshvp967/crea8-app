'use client';

import { useCallback, useEffect } from 'react';
import useCookie from 'react-use-cookie';
import EventEmitter from 'events';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { SegmentedControl } from '@gitroom/frontend/components/ui/segmented-control';
export const modeEmitter = new EventEmitter();

const ModeComponent = ({
  applyOnly = false,
  control = 'icon',
}: {
  applyOnly?: boolean;
  /** Account appearance uses the same pill control as Settings. The header keeps the icon. */
  control?: 'icon' | 'segmented';
}) => {
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

  if (applyOnly) return null;

  if (control === 'segmented') {
    return (
      <SegmentedControl
        variant="pill"
        className="settings-seg"
        aria-label="Theme"
        value={mode === 'dark' ? 'dark' : 'light'}
        onValueChange={(value) => changeMode(value === 'dark')}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />
    );
  }

  return (
    <button
      type="button"
      className="arc-icon-btn header-theme"
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => changeMode(mode !== 'dark')}
    >
      {mode === 'dark' ? <HugeIcon name="sun" size={18} /> : <HugeIcon name="moon" size={18} />}
    </button>
  );
};
export default ModeComponent;
