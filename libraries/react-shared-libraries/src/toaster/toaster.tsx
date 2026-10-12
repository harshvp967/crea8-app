'use client';

import { useCallback, useEffect, useState } from 'react';
import EventEmitter from 'events';
import clsx from 'clsx';
const toaster = new EventEmitter();
export const Toaster = () => {
  const [showToaster, setShowToaster] = useState(false);
  const [toasterText, setToasterText] = useState('');
  const [toasterType, setToasterType] = useState<'success' | 'warning' | 'error' | ''>(
    ''
  );
  useEffect(() => {
    toaster.on(
      'show',
      (params: { text: string; type?: 'success' | 'warning' | 'error' }) => {
        const { text, type } = params;
        setToasterText(text);
        setToasterType(type || 'success');
        setShowToaster(true);
        setTimeout(() => {
          setShowToaster(false);
        }, 4200);
      }
    );
    return () => {
      toaster.removeAllListeners();
    };
  }, []);
  if (!showToaster) {
    return <></>;
  }
  return (
    <div
      className={clsx(
        'app-toast animate-fadeDown rounded-[26px] gap-[12px] flex items-start overflow-hidden border border-newBorder bg-newBgColorInner p-[14px] min-w-[280px] max-w-[min(400px,calc(100vw-32px))] fixed z-[900] min-h-[56px]',
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ) : toasterType === 'warning' ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 4.2 21 19.2H3L12 4.2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M12 10v4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="16.6" r="0.8" fill="currentColor" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M7 12.5 10.2 16 17 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div className="app-toast-text flex-1 text-[14px] text-textColor">{toasterText}</div>
      <button type="button" className="app-toast-close" aria-label="Close" onClick={() => setShowToaster(false)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
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
