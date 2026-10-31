import { Plugs } from '@gitroom/frontend/components/plugs/plugs';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
export const metadata: Metadata = {
  title: `crea8.one Plugs`,
  description: '',
};
export default async function Index() {
  return <Plugs />;
}
