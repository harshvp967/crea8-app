'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import EventEmitter from 'events';
import clsx from 'clsx';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
const toaster = new EventEmitter();
export const Toaster = () => {
  const [showToaster, setShowToaster] = useState(false);
  const [toasterText, setToasterText] = useState('');
  const [toasterType, setToasterType] = useState<'success' | 'warning' | 'error' | ''>(
    ''
  );
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const onShow = (params: {
      text: string;
      type?: 'success' | 'warning' | 'error';
    }) => {
      const { text, type } = params;
      // Each toast owns the hide timer, so an older toast's timer can't
      // cut the new one short or leave it on screen.
      clearTimeout(hideTimer.current);
      setToasterText(text);
      setToasterType(type || 'success');
      setShowToaster(true);
      hideTimer.current = setTimeout(() => {
        setShowToaster(false);
      }, 4200);
    };
    toaster.on('show', onShow);
    return () => {
      clearTimeout(hideTimer.current);
      toaster.off('show', onShow);
    };
  }, []);
  if (!showToaster) {
    return <></>;
  }
  return (
    <div
      className={clsx(
        'app-toast c8-toast animate-fadeDown rounded-[26px] gap-[12px] flex items-start overflow-hidden border border-newBorder bg-newBgColorInner p-[14px] min-w-[280px] max-w-[min(400px,calc(100vw-32px))] fixed z-[900] min-h-[56px]',
        toasterType === 'warning' && 'is-warning',
        toasterType === 'error' && 'is-error',
        toasterType !== 'warning' && toasterType !== 'error' && 'is-success'
      )}
    >
      <div
        className={clsx(
          'app-toast-icon',
          toasterType === 'error' && 'is-bad',
          toasterType === 'warning' && 'is-warn',
          toasterType !== 'error' && toasterType !== 'warning' && 'is-ok'
        )}
      >
        {toasterType === 'error' ? (
          <HugeIcon name="close" size={16} />
        ) : toasterType === 'warning' ? (
          <HugeIcon name="alert" size={16} />
        ) : (
          <HugeIcon name="check" size={16} />
        )}
      </div>
      <div className="app-toast-text flex-1 text-[14px] text-textColor">{toasterText}</div>
      <button type="button" className="app-toast-close" aria-label="Close" onClick={() => setShowToaster(false)}>
        <HugeIcon name="close" size={14} />
      </button>
    </div>
  );
};
export const useToaster = () => {
  return {
    show: useCallback((text: string, type?: 'success' | 'warning' | 'error') => {
      toaster.emit('show', {
        text,
        type,
      });
    }, []),
  };
};
