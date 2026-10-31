import { MediaLayoutComponent } from '@gitroom/frontend/components/new-layout/layout.media.component';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: `crea8.one Media`,
  description: '',
};

export default async function Page() {
  return <MediaLayoutComponent />
}
