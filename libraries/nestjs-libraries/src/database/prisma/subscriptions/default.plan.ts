// One default for every caller. Self-hosted (no Stripe key) is ULTIMATE.
// A configured Stripe key with no subscription row is FREE.
// Permissions used to say PRO in the self-hosted case and the user payload
// said ULTIMATE. Both now call this.
export function defaultPlanTier(): 'FREE' | 'ULTIMATE' {
  return process.env.STRIPE_PUBLISHABLE_KEY ? 'FREE' : 'ULTIMATE';
}
