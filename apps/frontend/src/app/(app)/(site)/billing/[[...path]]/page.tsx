import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Search = Record<string, string | string[] | undefined>;

function accountBillingHref(search: Search) {
  const query = new URLSearchParams();
  query.set('section', 'billing');
  for (const [key, value] of Object.entries(search)) {
    if (key === 'section' || value == null) {
      continue;
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      query.append(key, item);
    }
  }
  return `/account?${query.toString()}`;
}

export default async function BillingRedirect({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  redirect(accountBillingHref(await searchParams));
}
