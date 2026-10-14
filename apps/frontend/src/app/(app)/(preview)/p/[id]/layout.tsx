import { ReactNode } from 'react';
import { PreviewWrapper } from '@gitroom/frontend/components/preview/preview.wrapper';
import '../../../../c8-calendar.scss';

export default async function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="c8-preview">
      <PreviewWrapper>{children}</PreviewWrapper>
    </div>
  );
}
