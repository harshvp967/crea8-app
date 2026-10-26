import { Suspense } from 'react';
import {
  AppShellSkeleton,
  LayoutComponent,
} from '@gitroom/frontend/components/new-layout/layout.component';

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <LayoutComponent>{children}</LayoutComponent>
    </Suspense>
  );
}
