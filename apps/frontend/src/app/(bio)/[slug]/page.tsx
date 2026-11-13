import { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { slugProblem } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';
import { bioParamDecision } from '@gitroom/helpers/paths/app.paths';
import { loadPublicLink, presentPublicLink, publicShareMetadata, visitorSearch } from '@gitroom/frontend/components/link-in-bio/link.load';
import { documentTitle } from '@gitroom/frontend/components/layout/site.metadata';
import { LinkLive } from '@gitroom/frontend/components/link-in-bio/link.live';

async function load(slug: string, personalized = false) {
  const query = personalized ? visitorSearch(await headers()) : '';
  return loadPublicLink(`/public/link/${encodeURIComponent(slug)}${query}`);
}

function bioName(param: string) {
  const decision = bioParamDecision(param);
  if (!decision) {
    return '';
  }
  return decision.action === 'render' ? decision.slug : decision.location.slice(2);
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const name = bioName(slug);
  if (!name || slugProblem(name)) {
    return { title: documentTitle('Page'), robots: { index: false, follow: false } };
  }
  const page = await load(name);
  if (!page) {
    return { title: documentTitle('Page not found'), robots: { index: false, follow: false } };
  }
  return publicShareMetadata(page);
}

export default async function PublicLinkPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const decision = bioParamDecision(slug);
  if (!decision) {
    notFound();
  }
  if (decision.action === 'redirect') {
    redirect(decision.location);
  }
  if (slugProblem(decision.slug)) {
    notFound();
  }
  const page = await load(decision.slug, true);
  if (!page) {
    notFound();
  }
  const { gated, initial } = presentPublicLink(page);
  return <LinkLive initial={initial} gated={gated} />;
}
