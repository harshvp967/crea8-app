import { createHmac, timingSafeEqual } from 'crypto';

export type MediaAccess = 'private' | 'public';

export type MediaAccessEnv = {
  bucketUrl: string;
  bucketName: string;
  frontendUrl: string;
  storage: string;
  privateTtl: number;
  publicTtl: number;
  urlSecret: string;
};

export type StoredMedia =
  | { kind: 'empty' }
  | { kind: 'external'; url: string }
  | { kind: 'r2'; key: string }
  | { kind: 'local'; relative: string };

export type MediaReadPlan =
  | { kind: 'as-is'; url: string }
  | { kind: 'sign'; key: string; expiresIn: number; canonical: string }
  | { kind: 'local'; url: string };

const PUBLIC_PREFIX = 'public/';

function trimSlash(value: string) {
  return (value || '').trim().replace(/\/+$/, '');
}

function boundedTtl(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 60 || value > 7 * 24 * 3600) {
    return fallback;
  }
  return Math.floor(value);
}

export function mediaAccessEnv(
  source: NodeJS.ProcessEnv = process.env
): MediaAccessEnv {
  return {
    bucketUrl: trimSlash(source.CLOUDFLARE_BUCKET_URL || ''),
    bucketName: (source.CLOUDFLARE_BUCKETNAME || '').trim(),
    frontendUrl: trimSlash(source.FRONTEND_URL || ''),
    storage: source.STORAGE_PROVIDER || 'local',
    privateTtl: boundedTtl(source.MEDIA_SIGNED_URL_TTL_SECONDS, 900),
    publicTtl: boundedTtl(source.MEDIA_PUBLIC_URL_TTL_SECONDS, 7 * 24 * 3600),
    urlSecret: (source.MEDIA_URL_SECRET || source.JWT_SECRET || '').trim(),
  };
}

function hostOf(value: string) {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return '';
  }
}

function safeKey(value: string) {
  const key = value.replace(/^\/+/, '');
  if (!key || key.includes('..') || key.includes('\\') || key.includes('?')) {
    return '';
  }
  return key;
}

// Local objects are dated folders plus a random name. R2 keys are a random
// name at the bucket root. Both are specific enough for an ownership lookup.
export function isSafeUploadRelative(relative: string) {
  if (!relative || relative.includes('..') || relative.includes('\\')) {
    return false;
  }
  return /^(\d{4}\/\d{2}\/\d{2}\/)?[a-zA-Z0-9._-]{1,180}$/.test(relative);
}

// A stored URL or JSON blob mentions this file only when the relative path is
// its own segment. `contains` would let `a.png` match `nota.png`.
export function mentionsUploadRelative(
  stored: string | null | undefined,
  relative: string
) {
  if (!stored || !isSafeUploadRelative(relative)) {
    return false;
  }
  if (stored === relative) {
    return true;
  }
  const needle = `/${relative}`;
  let from = 0;
  while (from < stored.length) {
    const at = stored.indexOf(needle, from);
    if (at === -1) {
      return false;
    }
    const next = stored.charAt(at + needle.length);
    if (
      next === '' ||
      next === '"' ||
      next === "'" ||
      next === '?' ||
      next === '#' ||
      next === '\\' ||
      next === ' ' ||
      next === '<' ||
      next === '&'
    ) {
      return true;
    }
    from = at + needle.length;
  }
  return false;
}

export function describeStoredMedia(
  stored: string,
  env: MediaAccessEnv = mediaAccessEnv()
): StoredMedia {
  const value = (stored || '').trim();
  if (!value) {
    return { kind: 'empty' };
  }
  if (value.startsWith('/uploads/')) {
    const relative = safeKey(value.slice('/uploads/'.length).replace(/^public\//, ''));
    if (relative && isSafeUploadRelative(relative)) {
      return { kind: 'local', relative };
    }
    return { kind: 'external', url: value };
  }
  if (/^https?:\/\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return { kind: 'external', url: value };
    }
    const host = url.host.toLowerCase();
    const path = url.pathname.replace(/^\/+/, '');
    if (env.bucketUrl && host === hostOf(env.bucketUrl)) {
      const key = safeKey(path);
      return key ? { kind: 'r2', key } : { kind: 'external', url: value };
    }
    if (host.endsWith('.r2.cloudflarestorage.com')) {
      let keyPath = path;
      const bucket = env.bucketName;
      if (bucket && keyPath.startsWith(`${bucket}/`)) {
        keyPath = keyPath.slice(bucket.length + 1);
      } else if (bucket && host.startsWith(`${bucket.toLowerCase()}.`)) {
        keyPath = path;
      } else if (!host.startsWith(`${(bucket || ' ').toLowerCase()}.`) && keyPath.includes('/')) {
        keyPath = keyPath.split('/').slice(1).join('/');
      }
      const key = safeKey(keyPath);
      return key ? { kind: 'r2', key } : { kind: 'external', url: value };
    }
    const uploadsAt = url.pathname.indexOf('/uploads/');
    if (uploadsAt !== -1 && (!env.frontendUrl || host === hostOf(env.frontendUrl))) {
      const relative = safeKey(
        url.pathname.slice(uploadsAt + '/uploads/'.length).replace(/^public\//, '')
      );
      if (relative && isSafeUploadRelative(relative)) {
        return { kind: 'local', relative };
      }
    }
    return { kind: 'external', url: value };
  }
  if (env.storage === 'cloudflare') {
    const key = safeKey(value);
    if (key && isSafeUploadRelative(key.replace(/^public\//, ''))) {
      return { kind: 'r2', key };
    }
  }
  return { kind: 'external', url: value };
}

export function canonicalizeStoredMedia(
  stored: string,
  env: MediaAccessEnv = mediaAccessEnv()
) {
  const described = describeStoredMedia(stored, env);
  if (described.kind === 'r2') {
    return env.bucketUrl ? `${env.bucketUrl}/${described.key}` : described.key;
  }
  if (described.kind === 'local') {
    return env.frontendUrl
      ? `${env.frontendUrl}/uploads/${described.relative}`
      : `/uploads/${described.relative}`;
  }
  if (described.kind === 'external') {
    return described.url;
  }
  return '';
}

export function localPublicSignature(
  relative: string,
  exp: number,
  secret: string
) {
  return createHmac('sha256', secret).update(`${relative}.${exp}`).digest('hex');
}

export function localPublicUrl(
  relative: string,
  env: MediaAccessEnv = mediaAccessEnv(),
  now = Date.now()
) {
  const base = env.frontendUrl || '';
  const path = `/uploads/public/${relative}`;
  if (!env.urlSecret) {
    return `${base}${path}`;
  }
  const exp = Math.floor(now / 1000) + env.publicTtl;
  const sig = localPublicSignature(relative, exp, env.urlSecret);
  return `${base}${path}?exp=${exp}&sig=${sig}`;
}

export function localPublicSignatureOk(
  relative: string,
  exp: string,
  sig: string,
  secret: string,
  now = Date.now()
) {
  if (!secret || !isSafeUploadRelative(relative) || !/^\d+$/.test(exp || '') || !sig) {
    return false;
  }
  const expiry = Number(exp);
  if (!Number.isFinite(expiry) || expiry < Math.floor(now / 1000)) {
    return false;
  }
  const expected = localPublicSignature(relative, expiry, secret);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function planMediaRead(
  stored: string,
  access: MediaAccess,
  env: MediaAccessEnv = mediaAccessEnv()
): MediaReadPlan {
  const described = describeStoredMedia(stored, env);
  if (described.kind === 'empty') {
    return { kind: 'as-is', url: '' };
  }
  if (described.kind === 'external') {
    return { kind: 'as-is', url: described.url };
  }
  if (described.kind === 'r2') {
    const canonical = env.bucketUrl
      ? `${env.bucketUrl}/${described.key}`
      : described.key;
    if (described.key.startsWith(PUBLIC_PREFIX)) {
      return { kind: 'as-is', url: canonical };
    }
    return {
      kind: 'sign',
      key: described.key,
      expiresIn: access === 'public' ? env.publicTtl : env.privateTtl,
      canonical,
    };
  }
  if (access === 'public') {
    return { kind: 'local', url: localPublicUrl(described.relative, env) };
  }
  const privateUrl = env.frontendUrl
    ? `${env.frontendUrl}/uploads/${described.relative}`
    : `/uploads/${described.relative}`;
  return { kind: 'local', url: privateUrl };
}

export function canonicalizeImageList(value: unknown, env: MediaAccessEnv = mediaAccessEnv()) {
  if (!Array.isArray(value)) {
    return value;
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      return item;
    }
    const row = { ...(item as Record<string, unknown>) };
    for (const field of ['path', 'url', 'thumbnail']) {
      if (typeof row[field] === 'string') {
        row[field] = canonicalizeStoredMedia(row[field] as string, env);
      }
    }
    return row;
  });
}

// First path segment `public` is the anonymous path. Everything else is a
// private object and the route must check the session.
export function localUploadTarget(parts: string[] | undefined) {
  const list = (parts || []).filter(Boolean);
  if (list.some((part) => part === '..' || part.includes('\\'))) {
    return { ok: false as const, status: 404 as const };
  }
  const mode = list[0] === 'public' ? 'public' : 'private';
  const relative = (mode === 'public' ? list.slice(1) : list).join('/');
  if (!isSafeUploadRelative(relative)) {
    return { ok: false as const, status: 404 as const };
  }
  return { ok: true as const, mode, relative };
}
