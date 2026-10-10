import { internalFetch } from '@gitroom/helpers/utils/internal.fetch';
import { sanitizePostContent } from '@gitroom/helpers/utils/sanitize.post.content';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { Crea8oneWordmark } from '@gitroom/frontend/components/ui/logo-text.component';
import Link from 'next/link';
import { CommentsComponents } from '@gitroom/frontend/components/preview/comments.components';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { VideoOrImage } from '@gitroom/react/helpers/video.or.image';
import { CopyClient } from '@gitroom/frontend/components/preview/copy.client';
import { getT } from '@gitroom/react/translation/get.translation.service.backend';
import { RenderPreviewDateClient } from '@gitroom/frontend/components/preview/render.preview.date.client';
import { CreationMethodBadge } from '@gitroom/frontend/components/launches/creation.method.badge';
import {
  SITE_IMAGE,
  SITE_NAME,
} from '@gitroom/frontend/components/layout/site.metadata';

dayjs.extend(utc);

async function loadPublicPost(id: string) {
  try {
    const response = await internalFetch(`/public/posts/${id}`);
    if (!response.ok) {
      return null;
    }
    const post = await response.json();
    if (!Array.isArray(post) || !post.length) {
      return null;
    }
    return post;
  } catch {
    return null;
  }
}

function plainText(value: unknown) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function shareImage(post: { image?: string }) {
  try {
    const images = JSON.parse(post.image || '[]');
    const path = images.find(
      (item: { path?: string }) =>
        typeof item?.path === 'string' && item.path.startsWith('https://')
    )?.path;
    return path || SITE_IMAGE;
  } catch {
    return SITE_IMAGE;
  }
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await props.params;
  const post = await loadPublicPost(id);
  if (!post) {
    return {
      title: 'Post not found',
      robots: { index: false, follow: false },
    };
  }
  const title = plainText(post[0].content).slice(0, 70) || `${SITE_NAME} post`;
  const description =
    plainText(post[0].content) || `A post shared from ${SITE_NAME}`;
  const image = shareImage(post[0]);
  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      type: 'article',
      images: [{ url: image, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function Auth(
  props: {
    params: Promise<{
      id: string;
    }>;
    searchParams?: Promise<{
      share?: string;
    }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;

  const {
    id
  } = params;

  const post = await loadPublicPost(id);
  const t = await getT();
  if (!post) {
    return (
      <div className="text-white fixed start-0 top-0 w-full h-full flex justify-center items-center text-[20px]">
        {t('post_not_found', 'Post not found')}
      </div>
    );
  }
  return (
    <div>
      <div className="mx-auto w-full max-w-[1346px] py-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="min-w-[55px]">
                <Link
                  href="/"
                  className="text-2xl flex items-center justify-center gap-[10px] text-textColor order-1"
                  title="Crea8one"
                >
                  <Crea8oneWordmark className="h-[40px] w-auto object-contain object-left" />
                </Link>
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-400 flex items-center gap-[20px]">
            {!!searchParams?.share && (
              <div>
                <CopyClient />
              </div>
            )}
            <div className="flex-1">
              {t('publication_date', 'Publication Date:')}{' '}
              <RenderPreviewDateClient date={post[0].publishDate} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row text-white w-full max-w-[1346px] mx-auto">
        <div className="flex-1">
          <div className="gap-[20px] flex flex-col">
            {post.map((p: any, index: number) => (
              <div
                key={String(p.id)}
                className="relative px-4 py-4 bg-third border border-tableBorder"
              >
                <div className="flex space-x-3">
                  <div>
                    <div className="flex shrink-0 rounded-full h-30 w-30 relative">
                      <div className="w-[50px] h-[50px] z-[20]">
                        <img
                          className="w-full h-full relative z-[20] bg-black aspect-square rounded-full border-tableBorder"
                          alt={post[0].integration.name}
                          src={post[0].integration.picture}
                        />
                      </div>
                      <div className="absolute -end-[5px] -bottom-[5px] w-[30px] h-[30px] z-[20]">
                        <img
                          className="w-full h-full bg-black aspect-square rounded-full border-tableBorder"
                          alt={post[0].integration.providerIdentifier}
                          src={`/icons/platforms/${post[0].integration.providerIdentifier}.png`}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center space-x-2">
                      <h2 className="text-sm font-semibold">
                        {post[0].integration.name}
                      </h2>
                      <span className="text-sm text-gray-500">
                        @{post[0].integration.profile}
                      </span>
                      {index === 0 && (
                        <CreationMethodBadge
                          creationMethod={p.creationMethod}
                          size="md"
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-[20px]">
                      <div
                        className="text-sm whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: sanitizePostContent(p.content),
                        }}
                      />
                      <div className="flex w-full gap-[10px]">
                        {JSON.parse(p?.image || '[]').map((p: any) => (
                          <div
                            key={p.name}
                            className="flex-1 rounded-[10px] max-h-[500px] overflow-hidden"
                          >
                            <VideoOrImage
                              isContain={true}
                              src={p.path}
                              autoplay={true}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="w-full lg:w-96 lg:flex-shrink-0">
          <div className="p-4 pt-0">
            <CommentsComponents postId={id} />
          </div>
        </div>
      </div>
    </div>
  );
}
