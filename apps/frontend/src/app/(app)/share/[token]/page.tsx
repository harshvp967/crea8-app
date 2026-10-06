import { StalkerShare } from '@gitroom/frontend/components/stalker/stalker.share';

export const dynamic = 'force-dynamic';

export default async function StalkerSharePage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  return <StalkerShare token={token} />;
}
