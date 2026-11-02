import { channelCountLabel } from '@gitroom/frontend/components/launches/customer.filter';
import { friendlyNotification } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.text';
import {
  blockOffersCopyLink,
  blockRemovalFeedback,
  qrApi,
  qrImageSrc,
  svgQrSrc,
} from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';
import {
  SignatureRepository,
  signatureWriteWhere,
} from '@gitroom/nestjs-libraries/database/prisma/signatures/signature.repository';

const RAW_BLUESKY =
  'An error occurred while posting on bluesky: Could not prepare the post for Bluesky, nothing was published: error:1C800064:Provider routines::bad decrypt';

describe('AI panel channel count', () => {
  it('does not render 0 channels before channels load', () => {
    expect(channelCountLabel(false, 0)).toBeNull();
    expect(channelCountLabel(false, 4)).toBeNull();
    expect(channelCountLabel(true, 0)).toBe(0);
    expect(channelCountLabel(true, 4)).toBe(4);
  });
});

describe('notification errors', () => {
  it('turns a provider decrypt failure into a friendly message', () => {
    expect(friendlyNotification(RAW_BLUESKY)).toBe(
      'An error occurred while posting on Bluesky. Nothing was published.'
    );
    expect(friendlyNotification(friendlyNotification(RAW_BLUESKY))).toBe(
      'An error occurred while posting on Bluesky. Nothing was published.'
    );
  });

  it('leaves an ordinary notification alone', () => {
    const posted = 'Your post is live on Bluesky.';
    expect(friendlyNotification(posted)).toBe(posted);
  });
});

describe('signature delete', () => {
  it('removes the signature from the returned list', async () => {
    type Row = {
      id: string;
      organizationId: string;
      content: string;
      autoAdd: boolean;
      deletedAt: Date | null;
    };
    const rows: Row[] = [
      { id: 'keep', organizationId: 'org', content: 'keep', autoAdd: true, deletedAt: null },
      { id: 'gone', organizationId: 'org', content: 'QA test', autoAdd: false, deletedAt: null },
      { id: 'other', organizationId: 'else', content: 'other', autoAdd: false, deletedAt: null },
    ];
    const match = (row: Row, where: Record<string, unknown>) => {
      if (where.id && row.id !== where.id) return false;
      if (where.organizationId && row.organizationId !== where.organizationId) return false;
      if (where.deletedAt === null && row.deletedAt) return false;
      return true;
    };
    const api = {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        rows.filter((row) => match(row, where)),
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        rows.find((row) => match(row, where)) || null,
      update: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<Row>;
      }) => {
        if (Object.prototype.hasOwnProperty.call(where, 'organizationId')) {
          throw new Error('Unknown argument organizationId');
        }
        const row = rows.find((item) => item.id === where.id);
        if (!row) {
          throw new Error('not found');
        }
        Object.assign(row, data);
        return row;
      },
    };
    const repo = new SignatureRepository({ model: { signatures: api } } as never);

    expect(signatureWriteWhere('gone')).toEqual({ id: 'gone' });
    const list = await repo.deleteSignature('org', 'gone');
    expect(list?.map((row) => row.id)).toEqual(['keep']);
    expect(await repo.deleteSignature('org', 'other')).toBeNull();
    expect(rows.find((row) => row.id === 'other')?.deletedAt).toBeNull();
  });
});

describe('link block menu', () => {
  it('does not offer copy link on a header block', () => {
    expect(blockOffersCopyLink('HEADING')).toBe(false);
    expect(blockOffersCopyLink('LINK')).toBe(true);
  });

  it('emits one undo signal and no banner', () => {
    const feedback = blockRemovalFeedback();
    expect(feedback.banner).toBe(false);
    expect(feedback.signal).toBe('undo');
    expect([feedback.signal]).toHaveLength(1);
  });
});

describe('link QR source', () => {
  it('uses the encoder whether it sits on the module or on default', () => {
    const direct = { toDataURL: async () => 'data:image/png;base64,abc' };
    expect(qrApi(direct)).toBe(direct);
    const inner = { toBuffer: async () => new Uint8Array() };
    expect(qrApi({ default: inner })).toBe(inner);
  });

  it('does not treat an empty or non-image body as a QR', () => {
    expect(qrImageSrc('')).toBe('');
    expect(qrImageSrc('blob:https://crea8.one/empty')).toBe('');
    expect(qrImageSrc('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    expect(svgQrSrc('')).toBe('');
    expect(svgQrSrc('<html>not a qr</html>')).toBe('');
    expect(svgQrSrc('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toContain('data:image/svg+xml');
  });
});
