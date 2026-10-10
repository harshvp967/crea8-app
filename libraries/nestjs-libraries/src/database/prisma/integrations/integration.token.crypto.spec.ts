import {
  decryptIntegrationTree,
  encryptStoredIntegrationTokens,
  INTEGRATION_TOKEN_KEY_MESSAGE,
  openIntegrationSecret,
  sealIntegrationSecret,
  sealIntegrationWriteArgs,
} from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.token.crypto';

const KEY = Buffer.alloc(32, 7).toString('base64');

describe('integration token crypto', () => {
  const previous = {
    key: process.env.INTEGRATION_TOKEN_KEY,
    node: process.env.NODE_ENV,
    railway: process.env.RAILWAY_ENVIRONMENT,
  };

  beforeEach(() => {
    process.env.INTEGRATION_TOKEN_KEY = KEY;
    delete process.env.NODE_ENV;
    delete process.env.RAILWAY_ENVIRONMENT;
  });

  afterAll(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    };
    restore('INTEGRATION_TOKEN_KEY', previous.key);
    restore('NODE_ENV', previous.node);
    restore('RAILWAY_ENVIRONMENT', previous.railway);
  });

  it('round-trips a secret and keeps plaintext readable', () => {
    const sealed = sealIntegrationSecret('access:secret');
    expect(sealed.startsWith('enc1:')).toBe(true);
    expect(sealed).not.toContain('access:secret');
    expect(openIntegrationSecret(sealed)).toBe('access:secret');
    expect(openIntegrationSecret('already-plain')).toBe('already-plain');
  });

  it('seals a value only once', () => {
    const sealed = sealIntegrationSecret('access:secret');
    expect(sealIntegrationSecret(sealed)).toBe(sealed);
    expect(sealIntegrationSecret('')).toBe('');
  });

  it('rejects a tampered ciphertext', () => {
    const sealed = sealIntegrationSecret('access:secret');
    const broken = sealed.slice(0, -2) + (sealed.endsWith('A') ? 'B' : 'A');
    expect(() => openIntegrationSecret(broken)).toThrow(
      'Unable to read integration token'
    );
  });

  it('decrypts nested integration tokens and leaves other token fields', () => {
    const sealed = sealIntegrationSecret('access:secret');
    const tree = decryptIntegrationTree({
      integration: { token: sealed, refreshToken: null, name: 'channel' },
      github: { token: 'gh-plain' },
    });
    expect(tree.integration.token).toBe('access:secret');
    expect(tree.github.token).toBe('gh-plain');
  });

  it('seals write payloads including Prisma set objects', () => {
    const args = {
      data: { token: 'plain-token', refreshToken: { set: 'plain-refresh' } },
    };
    sealIntegrationWriteArgs('update', args);
    expect(String(args.data.token).startsWith('enc1:')).toBe(true);
    expect(args.data.refreshToken.set.startsWith('enc1:')).toBe(true);
    expect(openIntegrationSecret(args.data.token)).toBe('plain-token');
  });

  it('stores plaintext outside production when the key is missing', () => {
    delete process.env.INTEGRATION_TOKEN_KEY;
    expect(sealIntegrationSecret('plain-token')).toBe('plain-token');
  });

  it('fails in production when the key is missing', () => {
    delete process.env.INTEGRATION_TOKEN_KEY;
    process.env.NODE_ENV = 'production';
    expect(() => sealIntegrationSecret('plain-token')).toThrow(
      INTEGRATION_TOKEN_KEY_MESSAGE
    );
  });

  it('refuses to open ciphertext without a key', () => {
    const sealed = sealIntegrationSecret('access:secret');
    delete process.env.INTEGRATION_TOKEN_KEY;
    expect(() => openIntegrationSecret(sealed)).toThrow(
      'INTEGRATION_TOKEN_KEY is required to read encrypted integration tokens'
    );
  });

  it('encrypts stored rows once', async () => {
    const rows = [
      { id: '1', token: 'plain', refreshToken: 'refresh' },
      { id: '2', token: sealIntegrationSecret('kept'), refreshToken: null },
    ];
    const updates: string[] = [];
    const db = {
      integration: {
        findMany: async () => rows.map((row) => ({ ...row })),
        update: async (args: { where: { id: string } }) => {
          updates.push(args.where.id);
        },
      },
    };
    const first = await encryptStoredIntegrationTokens(db);
    expect(first).toEqual({ scanned: 2, updated: 1 });
    expect(updates).toEqual(['1']);

    const stored = rows.map((row) =>
      row.id === '1'
        ? {
            ...row,
            token: sealIntegrationSecret('plain'),
            refreshToken: sealIntegrationSecret('refresh'),
          }
        : row
    );
    const second = await encryptStoredIntegrationTokens({
      integration: {
        findMany: async () => stored.map((row) => ({ ...row })),
        update: async () => {
          throw new Error('second run should not write');
        },
      },
    });
    expect(second).toEqual({ scanned: 2, updated: 0 });
  });
});
