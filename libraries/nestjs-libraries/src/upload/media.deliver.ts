import { IUploadProvider } from '@gitroom/nestjs-libraries/upload/upload.interface';
import {
  MediaAccess,
  MediaAccessEnv,
  mediaAccessEnv,
  planMediaRead,
} from '@gitroom/nestjs-libraries/upload/media.access';

let storage: IUploadProvider | null = null;

async function storageClient() {
  if (!storage) {
    // First sign only. A static import pulls in the ESM-only file-type package
    // and breaks Jest suites that merely construct a caller.
    const { UploadFactory } = await import(
      '@gitroom/nestjs-libraries/upload/upload.factory'
    );
    storage = UploadFactory.createStorage();
  }
  return storage;
}

export async function deliverStoredMedia(
  stored: string,
  access: MediaAccess,
  env: MediaAccessEnv = mediaAccessEnv(),
  signer?: (key: string, expiresIn: number) => Promise<string>
) {
  const plan = planMediaRead(stored, access, env);
  if (plan.kind !== 'sign') {
    return plan.url;
  }
  const sign =
    signer ||
    (async (key: string, expiresIn: number) => {
      const client = await storageClient();
      if (!client.signDownloadUrl) {
        throw new Error('Storage cannot sign download URLs');
      }
      return client.signDownloadUrl(key, expiresIn);
    });
  try {
    return await sign(plan.key, plan.expiresIn);
  } catch (err) {
    // Private responses must not fall back to the public bucket URL.
    if (access === 'private') {
      const wrapped = new Error('Could not sign a private media URL');
      wrapped.name = 'PrivateMediaSignError';
      throw wrapped;
    }
    return plan.canonical;
  }
}

export async function presentMediaRecord<T extends { path?: string | null; thumbnail?: string | null }>(
  row: T,
  access: MediaAccess = 'private'
): Promise<T> {
  if (!row) {
    return row;
  }
  const next = { ...row };
  if (typeof next.path === 'string' && next.path) {
    next.path = await deliverStoredMedia(next.path, access);
  }
  if (typeof next.thumbnail === 'string' && next.thumbnail) {
    next.thumbnail = await deliverStoredMedia(next.thumbnail, access);
  }
  return next;
}
