import {
  canonicalizeImageList,
  canonicalizeStoredMedia,
  describeStoredMedia,
  localPublicSignatureOk,
  localPublicUrl,
  localUploadTarget,
  mediaAccessEnv,
  mentionsUploadRelative,
  planMediaRead,
} from '@gitroom/nestjs-libraries/upload/media.access';

const env = mediaAccessEnv({
  CLOUDFLARE_BUCKET_URL: 'https://media.example.com',
  CLOUDFLARE_BUCKETNAME: 'crea8-media',
  FRONTEND_URL: 'https://app.example.com',
  STORAGE_PROVIDER: 'cloudflare',
  MEDIA_URL_SECRET: 'media-secret',
  MEDIA_SIGNED_URL_TTL_SECONDS: '900',
  MEDIA_PUBLIC_URL_TTL_SECONDS: '3600',
} as NodeJS.ProcessEnv);

describe('stored media resolver', () => {
  it('keeps external URLs and turns signed or public bucket URLs back into the stored key', () => {
    expect(canonicalizeStoredMedia('https://images.example/pic.png', env)).toBe(
      'https://images.example/pic.png'
    );
    expect(
      canonicalizeStoredMedia('https://media.example.com/folder/file.png?x=1', env)
    ).toBe('https://media.example.com/folder/file.png');
    expect(
      describeStoredMedia(
        'https://account.r2.cloudflarestorage.com/crea8-media/abc123.png?X-Amz-Signature=dead',
        env
      )
    ).toEqual({ kind: 'r2', key: 'abc123.png' });
    expect(
      canonicalizeStoredMedia(
        'https://crea8-media.account.r2.cloudflarestorage.com/public/cover.png?X-Amz-Algorithm=AWS4-HMAC-SHA256',
        env
      )
    ).toBe('https://media.example.com/public/cover.png');
    expect(
      canonicalizeStoredMedia('https://app.example.com/uploads/2024/01/02/abcd.png', env)
    ).toBe('https://app.example.com/uploads/2024/01/02/abcd.png');
  });

  it('plans a short signature for private objects and a long one or public path for public objects', () => {
    expect(planMediaRead('https://media.example.com/abc123.png', 'private', env)).toEqual({
      kind: 'sign',
      key: 'abc123.png',
      expiresIn: 900,
      canonical: 'https://media.example.com/abc123.png',
    });
    expect(planMediaRead('https://media.example.com/abc123.png', 'public', env)).toMatchObject({
      kind: 'sign',
      key: 'abc123.png',
      expiresIn: 3600,
    });
    expect(planMediaRead('https://media.example.com/public/cover.png', 'private', env)).toEqual({
      kind: 'as-is',
      url: 'https://media.example.com/public/cover.png',
    });
  });

  it('sends local public reads down the explicit public path and rejects traversal', () => {
    const local = mediaAccessEnv({
      ...({
        FRONTEND_URL: 'https://app.example.com',
        STORAGE_PROVIDER: 'local',
        MEDIA_URL_SECRET: 'media-secret',
        MEDIA_PUBLIC_URL_TTL_SECONDS: '3600',
      } as NodeJS.ProcessEnv),
    });
    const url = localPublicUrl('2024/01/02/abcd.png', local, 1_700_000_000_000);
    expect(url.startsWith('https://app.example.com/uploads/public/2024/01/02/abcd.png?')).toBe(
      true
    );
    const parsed = new URL(url);
    expect(
      localPublicSignatureOk(
        '2024/01/02/abcd.png',
        parsed.searchParams.get('exp') || '',
        parsed.searchParams.get('sig') || '',
        'media-secret',
        1_700_000_000_000
      )
    ).toBe(true);
    expect(
      localPublicSignatureOk(
        '2024/01/02/abcd.png',
        parsed.searchParams.get('exp') || '',
        parsed.searchParams.get('sig') || '',
        'other',
        1_700_000_000_000
      )
    ).toBe(false);
    expect(planMediaRead('https://app.example.com/uploads/2024/01/02/abcd.png', 'private', local)).toEqual({
      kind: 'local',
      url: 'https://app.example.com/uploads/2024/01/02/abcd.png',
    });
    expect(localUploadTarget(['2024', '01', '02', 'abcd.png'])).toEqual({
      ok: true,
      mode: 'private',
      relative: '2024/01/02/abcd.png',
    });
    expect(localUploadTarget(['public', '2024', '01', '02', 'abcd.png'])).toEqual({
      ok: true,
      mode: 'public',
      relative: '2024/01/02/abcd.png',
    });
    expect(localUploadTarget(['..', 'etc', 'passwd']).ok).toBe(false);
    expect(localUploadTarget(['public', '..', 'secret.png']).ok).toBe(false);
    expect(
      mentionsUploadRelative('https://app.example.com/uploads/2024/01/02/abcd.png', '2024/01/02/abcd.png')
    ).toBe(true);
    expect(
      mentionsUploadRelative('https://app.example.com/uploads/2024/01/02/abcd.png.bak', '2024/01/02/abcd.png')
    ).toBe(false);
    expect(mentionsUploadRelative('nota.png', 'a.png')).toBe(false);
  });

  it('canonicalizes image lists so a signed URL is not what gets stored', () => {
    const images = canonicalizeImageList(
      [
        {
          path: 'https://account.r2.cloudflarestorage.com/crea8-media/abc123.png?X-Amz-Signature=1',
          url: 'https://cdn.example/not-ours.png',
        },
      ],
      env
    );
    expect(images).toEqual([
      {
        path: 'https://media.example.com/abc123.png',
        url: 'https://cdn.example/not-ours.png',
      },
    ]);
  });
});
