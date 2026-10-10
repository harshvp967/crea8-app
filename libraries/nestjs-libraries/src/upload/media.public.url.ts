// Public origin of uploaded files. CLOUDFLARE_BUCKET_URL is that origin
// (custom domain or the bucket's public URL). The S3 API host
// (*.r2.cloudflarestorage.com) is built from CLOUDFLARE_ACCOUNT_ID and is
// not a media URL.
export function mediaPublicBaseUrl() {
  const value = (process.env.CLOUDFLARE_BUCKET_URL || '')
    .trim()
    .replace(/\/+$/, '');

  if (!value) {
    throw new Error(
      'CLOUDFLARE_BUCKET_URL is not set. Set it to the public media origin, such as a custom domain attached to the R2 bucket. Do not hardcode a domain.'
    );
  }

  return value;
}

export function mediaPublicUrl(fileName: string) {
  const name = (fileName || '').replace(/^\/+/, '');
  return `${mediaPublicBaseUrl()}/${name}`;
}
