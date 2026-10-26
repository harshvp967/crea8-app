import { defaultPlanTier } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/default.plan';

describe('defaultPlanTier', () => {
  const previous = process.env.STRIPE_PUBLISHABLE_KEY;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.STRIPE_PUBLISHABLE_KEY;
    } else {
      process.env.STRIPE_PUBLISHABLE_KEY = previous;
    }
  });

  it('uses ULTIMATE when Stripe is not configured and FREE when it is', () => {
    delete process.env.STRIPE_PUBLISHABLE_KEY;
    expect(defaultPlanTier()).toBe('ULTIMATE');

    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test';
    expect(defaultPlanTier()).toBe('FREE');
  });
});
