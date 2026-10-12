import { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { loadPublicLink, presentPublicLink } from '@gitroom/frontend/components/link-in-bio/link.load';
import { LinkLive } from '@gitroom/frontend/components/link-in-bio/link.live';

export const dynamic = 'force-dynamic';

async function hostName() {
  const headerList = await headers();
  return (headerList.get('x-forwarded-host') || headerList.get('host') || '').split(',')[0].trim().split(':')[0].toLowerCase();
}

async function load() {
  const host = await hostName();
  if (!host) {
    return null;
  }
  return loadPublicLink(`/public/link/host/${encodeURIComponent(host)}`);
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await load();
  if (!page) {
    return { title: 'Page not found', robots: { index: false, follow: false } };
  }
  const hidden = !page.isPublic || page.sensitive;
  return {
    title: page.seoTitle || page.name || page.slug,
    description: page.seoDescription || page.bio || '',
    robots: hidden ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default async function BioHostPage() {
  const page = await load();
  if (!page) {
    notFound();
  }
  const { gated, initial } = presentPublicLink(page);
  return <LinkLive initial={initial} gated={gated} />;
}
