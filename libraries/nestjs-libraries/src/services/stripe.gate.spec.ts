import { HttpException } from '@nestjs/common';
import Stripe from 'stripe';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import {
  guardStripeClient,
  staticSubscriptionTiers,
  stripeBillingEnabled,
} from '@gitroom/nestjs-libraries/services/stripe.gate';

function recordingClient() {
  const calls: string[] = [];
  const httpClient: Stripe.HttpClient = {
    getClientName: () => 'test',
    makeRequest: async (_host, _port, path) => {
      calls.push(path);
      throw new Error('stop');
    },
  };
  return { calls, httpClient };
}

describe('stripe billing gate', () => {
  const previous = {
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('returns static tiers and does not call Stripe when no key is configured', () => {
    delete process.env.STRIPE_PUBLISHABLE_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    expect(stripeBillingEnabled()).toBe(false);

    const { calls, httpClient } = recordingClient();
    const client = guardStripeClient(new Stripe('sk_nothing', { httpClient }));
    let thrown: unknown;
    try {
      client.prices.list({ active: true });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(400);
    expect(calls).toEqual([]);
    expect(staticSubscriptionTiers()).toEqual({
      month: [
        {
          name: 'STANDARD',
          recurring: 'month',
          price: pricing.STANDARD.month_price,
        },
        { name: 'PRO', recurring: 'month', price: pricing.PRO.month_price },
      ],
      year: [
        {
          name: 'STANDARD',
          recurring: 'year',
          price: pricing.STANDARD.year_price,
        },
        { name: 'PRO', recurring: 'year', price: pricing.PRO.year_price },
      ],
    });
  });

  it('treats the sk_nothing placeholder as not configured', () => {
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
    process.env.STRIPE_SECRET_KEY = 'sk_nothing';
    expect(stripeBillingEnabled()).toBe(false);
    expect(() =>
      guardStripeClient(
        new Stripe('sk_nothing', { httpClient: recordingClient().httpClient })
      ).customers.retrieve('cus_123')
    ).toThrow(HttpException);
  });

  it('forwards the Stripe request when a real key is configured', async () => {
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    expect(stripeBillingEnabled()).toBe(true);

    const { calls, httpClient } = recordingClient();
    const client = guardStripeClient(
      new Stripe('sk_test_123', { httpClient, maxNetworkRetries: 0 })
    );
    await expect(client.prices.list({ active: true })).rejects.toBeTruthy();
    expect(calls).toEqual([expect.stringContaining('/prices')]);
  });
});
