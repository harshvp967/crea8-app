import { HttpException, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  PaymentPlatform,
  PaymentProviderAbstract,
} from '@gitroom/nestjs-libraries/services/payment/payment.provider.interface';
import { isBillingFlagOn } from '@gitroom/helpers/utils/billing.enabled';
import { DODO_PROVIDER } from '@gitroom/nestjs-libraries/services/payment/payment.providers';

@Injectable()
export class PaymentProviderManager {
  constructor(private _moduleRef: ModuleRef) {}

  private metadata(): { target: any; provider: string }[] {
    return (
      Reflect.getMetadata('payment-provider', PaymentProviderAbstract) || []
    );
  }

  getProvider(provider: string): PaymentProviderAbstract {
    const found = this.metadata().find((m) => m.provider === provider);

    if (!found) {
      throw new HttpException(`Payment provider ${provider} not found`, 400);
    }

    return this._moduleRef.get(found.target, { strict: false });
  }

  getProviders(): { name: string; provider: PaymentProviderAbstract }[] {
    return this.metadata().map((m) => ({
      name: m.provider,
      provider: this._moduleRef.get(m.target, { strict: false }),
    }));
  }

  // First registered provider of a platform is the one new subscriptions use.
  // While billing is off this stays Stripe. PAYMENT_PROVIDER_WEB or the billing
  // flag selects Dodo without removing the Stripe provider.
  getDefaultProvider(platform: PaymentPlatform) {
    const providers = this.getProviders().filter(
      (p) => p.provider.platform === platform
    );
    const preferred =
      platform === 'web' ? process.env.PAYMENT_PROVIDER_WEB : undefined;
    const named = preferred
      ? providers.find((p) => p.name === preferred)
      : undefined;
    const dodo =
      platform === 'web' && isBillingFlagOn()
        ? providers.find((p) => p.name === DODO_PROVIDER)
        : undefined;
    const found = named || dodo || providers[0];

    if (!found) {
      throw new Error(`No payment provider registered for ${platform}`);
    }

    return found;
  }
}
