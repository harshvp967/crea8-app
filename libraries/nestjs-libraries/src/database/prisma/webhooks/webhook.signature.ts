import { timingSafeEqual } from 'crypto';
import { hmacSha256Hex, signedWebhookPayload } from '@gitroom/nestjs-libraries/security/csrf';

export const POST_WEBHOOK_SIGNATURE_HEADER = 'X-Crea8-Signature';
export const POST_WEBHOOK_TIMESTAMP_HEADER = 'X-Crea8-Timestamp';

// One root secret on the worker. Each webhook gets its own key so a receiver
// cannot forge deliveries for a different webhook id.
export function postWebhookSecret(
  webhookId: string,
  root = process.env.POST_WEBHOOK_SECRET
) {
  const key = (root || '').trim();
  const id = (webhookId || '').trim();
  if (!key || !id) {
    return '';
  }
  return hmacSha256Hex(key, id);
}

export function signPostWebhook(
  payload: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000)
) {
  const ts = String(timestamp);
  const signature = hmacSha256Hex(secret, signedWebhookPayload(ts, payload));
  return {
    timestamp: ts,
    signature: `sha256=${signature}`,
  };
}

export function postWebhookHeaders(
  payload: string,
  webhookId: string,
  now = Date.now()
): Record<string, string> {
  const secret = postWebhookSecret(webhookId);
  if (!secret) {
    return {};
  }
  const signed = signPostWebhook(payload, secret, Math.floor(now / 1000));
  return {
    [POST_WEBHOOK_SIGNATURE_HEADER]: signed.signature,
    [POST_WEBHOOK_TIMESTAMP_HEADER]: signed.timestamp,
  };
}

export function verifyPostWebhook(
  payload: string,
  secret: string,
  timestamp: string,
  signature: string,
  now = Date.now(),
  toleranceSeconds = 300
) {
  const ts = (timestamp || '').trim();
  const header = (signature || '').trim();
  const key = (secret || '').trim();
  if (!key || !/^\d+$/.test(ts) || !header.startsWith('sha256=')) {
    return false;
  }
  const sent = header.slice('sha256='.length);
  const age = Math.abs(Math.floor(now / 1000) - Number(ts));
  if (!Number.isFinite(age) || age > toleranceSeconds) {
    return false;
  }
  const expected = hmacSha256Hex(key, signedWebhookPayload(ts, payload));
  const left = Buffer.from(sent);
  const right = Buffer.from(expected);
  if (left.length !== right.length || left.length === 0) {
    return false;
  }
  return timingSafeEqual(left, right);
}
