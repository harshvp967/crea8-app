import {
  postWebhookHeaders,
  postWebhookSecret,
  signPostWebhook,
  verifyPostWebhook,
} from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhook.signature';

describe('post webhook signature', () => {
  const previous = process.env.POST_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.POST_WEBHOOK_SECRET = 'root-secret';
  });

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.POST_WEBHOOK_SECRET;
    } else {
      process.env.POST_WEBHOOK_SECRET = previous;
    }
  });

  it('derives a different secret per webhook and signs timestamp plus body', () => {
    const one = postWebhookSecret('hook-1');
    const two = postWebhookSecret('hook-2');
    expect(one).toMatch(/^[a-f0-9]{64}$/);
    expect(one).not.toBe(two);
    expect(postWebhookSecret('hook-1', '')).toBe('');

    const body = JSON.stringify({ id: 'post-1' });
    const signed = signPostWebhook(body, one, 1_700_000_000);
    expect(signed.timestamp).toBe('1700000000');
    expect(signed.signature.startsWith('sha256=')).toBe(true);
    expect(
      verifyPostWebhook(body, one, signed.timestamp, signed.signature, 1_700_000_000 * 1000)
    ).toBe(true);
    expect(
      verifyPostWebhook(body, two, signed.timestamp, signed.signature, 1_700_000_000 * 1000)
    ).toBe(false);
    expect(
      verifyPostWebhook(body, one, signed.timestamp, signed.signature, (1_700_000_000 + 301) * 1000)
    ).toBe(false);
    expect(verifyPostWebhook('{}', one, signed.timestamp, signed.signature, 1_700_000_000 * 1000)).toBe(
      false
    );
  });

  it('omits signature headers until POST_WEBHOOK_SECRET is set', () => {
    const body = '{"ok":true}';
    expect(postWebhookHeaders(body, 'hook-1', 1_700_000_000_000)).toEqual({
      'X-Crea8-Signature': expect.stringMatching(/^sha256=[a-f0-9]{64}$/),
      'X-Crea8-Timestamp': '1700000000',
    });
    delete process.env.POST_WEBHOOK_SECRET;
    expect(postWebhookHeaders(body, 'hook-1')).toEqual({});
  });
});
