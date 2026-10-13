import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, statSync } from 'fs';
import { resolve, sep } from 'path';
import {
  localPublicSignatureOk,
  localUploadTarget,
} from '@gitroom/nestjs-libraries/upload/media.access';
// @ts-ignore
import mime from 'mime';

async function orgCanRead(request: NextRequest, relative: string) {
  const auth = request.cookies.get('auth')?.value;
  if (!auth) {
    return false;
  }
  const backend = (
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    ''
  ).replace(/\/$/, '');
  if (!backend) {
    return false;
  }
  const showorg = request.cookies.get('showorg')?.value;
  const response = await fetch(
    `${backend}/media/authorize-local?path=${encodeURIComponent(relative)}`,
    {
      headers: {
        cookie: `auth=${auth}${showorg ? `; showorg=${showorg}` : ''}`,
      },
      cache: 'no-store',
    }
  );
  return response.ok;
}
async function* nodeStreamToIterator(stream: any) {
  for await (const chunk of stream) {
    yield chunk;
  }
}
function iteratorToStream(iterator: any) {
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(new Uint8Array(value));
      }
    },
  });
}
export const GET = async (
  request: NextRequest,
  context: {
    params: Promise<{
      path?: string[];
    }>;
  }
) => {
  const { path } = await context.params;
  const target = localUploadTarget(path);
  if (!target.ok) {
    return new NextResponse('Not found', { status: 404 });
  }
  if (target.mode === 'public') {
    const secret = (process.env.MEDIA_URL_SECRET || process.env.JWT_SECRET || '').trim();
    const allowed = localPublicSignatureOk(
      target.relative,
      request.nextUrl.searchParams.get('exp') || '',
      request.nextUrl.searchParams.get('sig') || '',
      secret
    );
    if (!allowed) {
      return new NextResponse('Not found', { status: 404 });
    }
  } else if (!(await orgCanRead(request, target.relative))) {
    return new NextResponse('Not found', { status: 404 });
  }
  const base = resolve(process.env.UPLOAD_DIRECTORY!);
  const filePath = resolve(base, target.relative);
  // Confine reads to UPLOAD_DIRECTORY. resolve() collapses any `..` segments
  // (including URL-decoded ones), so this blocks every path-traversal variant.
  if (filePath !== base && !filePath.startsWith(base + sep)) {
    return new NextResponse('Not found', { status: 404 });
  }
  let fileStats;
  try {
    fileStats = statSync(filePath);
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
  const response = createReadStream(filePath);
  const contentType = mime.getType(filePath) || 'application/octet-stream';
  const iterator = nodeStreamToIterator(response);
  const webStream = iteratorToStream(iterator);
  return new Response(webStream, {
    headers: {
      'Content-Type': contentType,
      // Set the appropriate content-type header
      'Content-Length': fileStats.size.toString(),
      // Set the content-length header
      'Last-Modified': fileStats.mtime.toUTCString(),
      // Set the last-modified header
      'Cache-Control': 'public, max-age=31536000, immutable', // Example cache-control header
    },
  });
};
