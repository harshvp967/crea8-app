export const dynamic = 'force-dynamic';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LaunchesComponent } from '@gitroom/frontend/components/launches/launches.component';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Crea8one Calendar' : 'Crea8one Launches'}`,
  description: '',
};
export default async function Index(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [cookieStore, params] = await Promise.all([cookies(), props.searchParams]);
  const loggedAuth = params?.loggedAuth;
  const hasLoggedAuth = Array.isArray(loggedAuth)
    ? loggedAuth.some(Boolean)
    : !!loggedAuth;
  // Proxy already redirects a missing cookie. This runs if that redirect did
  // not, so the calendar document is never sent to a signed-out browser.
  if (!cookieStore.get('auth')?.value && !hasLoggedAuth) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params || {})) {
      if (typeof value === 'string') {
        query.set(key, value);
      }
    }
    const suffix = query.toString();
    redirect(suffix ? `/auth?${suffix}` : '/auth');
  }
  return <LaunchesComponent />;
}
