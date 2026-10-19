import { HttpException } from '@nestjs/common';
import { groupBy } from 'lodash';
import Stripe from 'stripe';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';

// Same switch as /user/self: no publishable key means billing is off. A missing
// secret is the `sk_nothing` placeholder, which Stripe rejects with 401.
export function stripeBillingEnabled() {
  const secret = process.env.STRIPE_SECRET_KEY;
  return (
    !!process.env.STRIPE_PUBLISHABLE_KEY && !!secret && secret !== 'sk_nothing'
  );
}

// Plans Stripe would list via the standard/pro lookup keys, without calling Stripe.
export function staticSubscriptionTiers() {
  const plans = ['STANDARD', 'PRO'] as const;
  return groupBy(
    plans.flatMap((name) => [
      {
        name,
        recurring: 'month',
        price: pricing[name].month_price,
      },
      {
        name,
        recurring: 'year',
        price: pricing[name].year_price,
      },
    ]),
    'recurring'
  );
}

// Blocks every Stripe request while billing is off. Resource methods keep the
// real client as `this`, so a configured key still uses the Stripe SDK as-is.
export function guardStripeClient(client: Stripe): Stripe {
  const wrap = (resource: object): any =>
    new Proxy(resource, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === 'function') {
          return (...args: unknown[]) => {
            if (!stripeBillingEnabled()) {
              throw new HttpException('Stripe is not configured', 400);
            }
            return value.apply(target, args);
          };
        }
        if (value !== null && typeof value === 'object') {
          return wrap(value);
        }
        return value;
      },
    });

  return wrap(client) as Stripe;
}
