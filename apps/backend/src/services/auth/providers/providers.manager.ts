import { BadRequestException, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AuthProviderAbstract } from '@gitroom/backend/services/auth/providers.interface';

export function lookupAuthProvider(provider: string) {
  const normalized = (provider || '').trim().toUpperCase();
  const metadata =
    Reflect.getMetadata('auth-provider', AuthProviderAbstract) || [];
  const found = metadata.find((item: { provider: string }) => {
    return item.provider === normalized;
  });
  if (!found) {
    throw new BadRequestException('Unknown auth provider');
  }
  return found;
}

@Injectable()
export class AuthProviderManager {
  constructor(private _moduleRef: ModuleRef) {}

  getProvider(provider: string): AuthProviderAbstract {
    const found = lookupAuthProvider(provider);
    return this._moduleRef.get(found.target, { strict: false });
  }
}
