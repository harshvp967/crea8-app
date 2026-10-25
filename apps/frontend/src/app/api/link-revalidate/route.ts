import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { PUBLIC_LINK_CACHE_TAG } from '@gitroom/frontend/components/link-in-bio/link.load';

export async function POST() {
  const auth = (await cookies()).get('auth')?.value;
  if (!auth) {
    return Response.json({ ok: false }, { status: 401 });
  }
  revalidateTag(PUBLIC_LINK_CACHE_TAG, { expire: 0 });
  return Response.json({ ok: true });
}
