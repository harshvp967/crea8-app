'use client';

import { ReactNode, useEffect, useMemo } from 'react';
import { PreviewWrapper } from '@gitroom/frontend/components/preview/preview.wrapper';
import { usePathname } from 'next/navigation';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
export const AppLayout = ({ children }: { children: ReactNode }) => {
  const params = usePathname();
  const style = useMemo(() => {
    const all = params.split('/');
    all.pop();
    return all.pop();
  }, [params]);
  useEffect(() => {
    if (style !== 'dark' && style !== 'light') {
      return;
    }
    document.body.classList.remove('dark', 'light');
    document.body.classList.add(style);
  }, [style]);
  return (
    <div
      className={`hideCopilot ${style} h-[100vh] w-full text-textColor flex flex-1 flex-col !bg-none`}
    >
      <style>
        {`
          #add-edit-modal, .hideCopilot {
            background: transparent !important;
          }
          html body.dark, html body.light, html {
            background: transparent !important;
          }
        `}
      </style>
      <PreviewWrapper>{children}</PreviewWrapper>
    </div>
  );
};
