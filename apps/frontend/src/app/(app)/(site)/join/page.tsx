import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Could not join',
  description: '',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.error;
  const message =
    (Array.isArray(raw) ? raw[0] : raw) || 'This invite could not be used.';

  return (
    <main className="join-screen">
      <h1>Could not join</h1>
      <p className="join-error">{message}</p>
    </main>
  );
}
