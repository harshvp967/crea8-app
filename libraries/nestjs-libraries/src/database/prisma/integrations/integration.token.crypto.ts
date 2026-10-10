import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { isProductionRuntime } from '@gitroom/helpers/utils/is.production';

const PREFIX = 'enc1:';
const ALGORITHM = 'aes-256-gcm';

export const INTEGRATION_TOKEN_KEY_MESSAGE =
  'INTEGRATION_TOKEN_KEY is required in production so social integration tokens are encrypted at rest. Generate a 32-byte key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))" and set the same value on the backend and the orchestrator. Existing plaintext rows stay readable and are encrypted on their next write, or by the encrypt-integration-tokens command.';

let warned = false;

function warnMissingKey() {
  if (warned) {
    return;
  }
  warned = true;
  console.warn(
    'INTEGRATION_TOKEN_KEY is not set. Integration tokens are stored in plaintext outside production.'
  );
}

function decodeKey(raw: string) {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return Buffer.from(raw, 'base64');
}

export function integrationTokenKey() {
  const raw = (process.env.INTEGRATION_TOKEN_KEY || '').trim();
  if (!raw) {
    if (isProductionRuntime()) {
      throw new Error(INTEGRATION_TOKEN_KEY_MESSAGE);
    }
    warnMissingKey();
    return null;
  }

  const key = decodeKey(raw);
  if (key.length !== 32) {
    throw new Error(
      'INTEGRATION_TOKEN_KEY must decode to 32 bytes. Use base64 (openssl rand -base64 32) or 64 hex characters.'
    );
  }
  return key;
}

export function assertIntegrationTokenKey() {
  if (!isProductionRuntime()) {
    return;
  }
  integrationTokenKey();
}

export function isEncryptedIntegrationSecret(value: string) {
  return value.startsWith(PREFIX);
}

export function sealIntegrationSecret(value: string) {
  if (!value || isEncryptedIntegrationSecret(value)) {
    return value;
  }
  const key = integrationTokenKey();
  if (!key) {
    return value;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function openIntegrationSecret(value: string) {
  if (!value || !isEncryptedIntegrationSecret(value)) {
    return value;
  }
  const key = integrationTokenKey();
  if (!key) {
    throw new Error(
      'INTEGRATION_TOKEN_KEY is required to read encrypted integration tokens'
    );
  }
  const parts = value.slice(PREFIX.length).split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new Error('Unable to read integration token');
  }
  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(parts[0], 'base64')
    );
    decipher.setAuthTag(Buffer.from(parts[1], 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[2], 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error('Unable to read integration token');
  }
}

function sealField(value: unknown) {
  if (typeof value === 'string') {
    return sealIntegrationSecret(value);
  }
  if (
    value &&
    typeof value === 'object' &&
    'set' in value &&
    typeof (value as { set?: unknown }).set === 'string'
  ) {
    return {
      ...(value as object),
      set: sealIntegrationSecret((value as { set: string }).set),
    };
  }
  return value;
}

function sealData(data: unknown) {
  if (!data || typeof data !== 'object') {
    return;
  }
  if (Array.isArray(data)) {
    data.forEach(sealData);
    return;
  }
  const record = data as Record<string, unknown>;
  if ('token' in record) {
    record.token = sealField(record.token);
  }
  if ('refreshToken' in record) {
    record.refreshToken = sealField(record.refreshToken);
  }
}

const WRITE_OPS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
]);

export function sealIntegrationWriteArgs(
  operation: string,
  args: { data?: unknown; create?: unknown; update?: unknown } | undefined
) {
  if (!args || !WRITE_OPS.has(operation)) {
    return;
  }
  if (operation === 'upsert') {
    sealData(args.create);
    sealData(args.update);
    return;
  }
  sealData(args.data);
}

export function decryptIntegrationTree<T>(value: T): T {
  walk(value);
  return value;
}

function walk(value: unknown) {
  if (!value || typeof value !== 'object') {
    return;
  }
  if (value instanceof Date || Buffer.isBuffer(value)) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(walk);
    return;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.token === 'string') {
    record.token = openIntegrationSecret(record.token);
  }
  if (typeof record.refreshToken === 'string') {
    record.refreshToken = openIntegrationSecret(record.refreshToken);
  }
  for (const [key, child] of Object.entries(record)) {
    if (key === 'token' || key === 'refreshToken') {
      continue;
    }
    if (child && typeof child === 'object') {
      walk(child);
    }
  }
}

type TokenRow = {
  id: string;
  token: string;
  refreshToken: string | null;
};

// Uses a Prisma client that does not decrypt on read, so already-encrypted
// rows are left untouched. Safe to run more than once.
export async function encryptStoredIntegrationTokens(db: {
  integration: {
    findMany: (args: {
      select: { id: true; token: true; refreshToken: true };
    }) => Promise<TokenRow[]>;
    update: (args: {
      where: { id: string };
      data: { token: string; refreshToken: string | null };
    }) => Promise<unknown>;
  };
}) {
  const key = integrationTokenKey();
  if (!key) {
    throw new Error(INTEGRATION_TOKEN_KEY_MESSAGE);
  }
  const rows = await db.integration.findMany({
    select: { id: true, token: true, refreshToken: true },
  });
  let updated = 0;
  for (const row of rows) {
    const token = sealIntegrationSecret(row.token);
    const refreshToken =
      row.refreshToken == null
        ? null
        : sealIntegrationSecret(row.refreshToken);
    if (token === row.token && refreshToken === row.refreshToken) {
      continue;
    }
    await db.integration.update({
      where: { id: row.id },
      data: { token, refreshToken },
    });
    updated += 1;
  }
  return { scanned: rows.length, updated };
}
