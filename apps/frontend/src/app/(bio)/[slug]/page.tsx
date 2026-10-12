import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { slugProblem } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';
import { loadPublicLink, presentPublicLink } from '@gitroom/frontend/components/link-in-bio/link.load';
import { LinkLive } from '@gitroom/frontend/components/link-in-bio/link.live';

export const revalidate = 60;

async function load(slug: string) {
  return loadPublicLink(`/public/link/${encodeURIComponent(slug)}`, 60);
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  if (slugProblem(slug)) {
    return { title: 'Page', robots: { index: false, follow: false } };
  }
  const page = await load(slug.toLowerCase());
  if (!page) {
    return { title: 'Page not found', robots: { index: false, follow: false } };
  }
  const hidden = !page.isPublic || page.sensitive;
  const title = page.seoTitle || page.name || page.slug;
  const description = page.seoDescription || page.bio || '';
  return {
    title,
    description,
    robots: hidden ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default async function PublicLinkPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const lower = slug.toLowerCase();
  if (slug !== lower) {
    redirect(`/${lower}`);
  }
  if (slugProblem(lower)) {
    notFound();
  }
  const page = await load(lower);
  if (!page) {
    notFound();
  }
  const { gated, initial } = presentPublicLink(page);
  return <LinkLive initial={initial} gated={gated} />;
}
