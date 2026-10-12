import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Confirm email',
  robots: { index: false, follow: false },
};

async function confirm(token: string) {
  const base = (process.env.BACKEND_INTERNAL_URL || '').replace(/\/$/, '');
  if (!base) {
    return null;
  }
  try {
    const response = await fetch(`${base}/public/link/confirm/${encodeURIComponent(token)}`, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    if (!data?.slug) {
      return null;
    }
    return data as { slug: string; name: string };
  } catch {
    return null;
  }
}

export default async function ConfirmSubscriptionPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const result = await confirm(token);
  return (
    <main className="lib-public" data-theme="midnight">
      <div className="lib-stack">
        <h1 className="lib-name">{result ? 'Email confirmed' : 'This link has expired'}</h1>
        <p className="lib-bio">
          {result
            ? `You're subscribed to ${result.name || result.slug}.`
            : 'Ask the page owner to send a new confirmation.'}
        </p>
        {result ? (
          <a className="lib-link priority" href={`/${result.slug}`}>
            Open page
          </a>
        ) : null}
        <a className="lib-made" href="https://crea8.one">
          made with crea8.one
        </a>
      </div>
    </main>
  );
}
