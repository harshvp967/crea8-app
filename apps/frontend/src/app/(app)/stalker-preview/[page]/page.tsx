import { Suspense } from 'react';
import { StalkerPreview } from '@gitroom/frontend/components/stalker/stalker.preview';

export const dynamic = 'force-dynamic';

export default async function StalkerPreviewPage(props: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await props.params;
  return (
    <Suspense>
      <StalkerPreview page={page} />
    </Suspense>
  );
}
