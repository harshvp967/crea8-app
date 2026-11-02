const internalError = (value: string) =>
  /error:[0-9a-fA-F]{6,}:|Provider routines|bad decrypt|OPENSSL_/i.test(value);

// Stored post failures include provider and OpenSSL text. Readers should see
// one sentence. A message without that internal text is returned unchanged.
export function friendlyNotification(content: string) {
  const text = String(content ?? '');
  if (!text || !internalError(text)) {
    return text;
  }
  const flat = text.replace(/\s+/g, ' ').trim();
  const posting = flat.match(
    /an error occurred while posting( comments)? on\s+([^:.\n]+)/i
  );
  if (posting) {
    const comments = posting[1] ? ' comments' : '';
    const rawName = posting[2].trim();
    const name = rawName
      ? rawName.charAt(0).toUpperCase() + rawName.slice(1)
      : 'that channel';
    const unpublished = /nothing was published/i.test(flat);
    return `An error occurred while posting${comments} on ${name}.${
      unpublished ? ' Nothing was published.' : ''
    }`;
  }
  const stripped = flat
    .replace(/error:[0-9a-fA-F]{6,}:[^]*/i, '')
    .replace(/[:\s]+$/g, '')
    .trim();
  return stripped || 'Something went wrong.';
}
