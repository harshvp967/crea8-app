function idList(raw?: string) {
  return new Set(
    (raw || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

export function isBillingFlagOn() {
  const value = (process.env.BILLING_ENABLED || '').trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

export function isTestOrg(organizationId?: string | null) {
  if (!organizationId) {
    return false;
  }
  return idList(process.env.BILLING_TEST_ORG_IDS).has(organizationId);
}

export function isGrandfatheredOrg(organizationId?: string | null) {
  if (!organizationId) {
    return false;
  }
  return idList(process.env.BILLING_GRANDFATHERED_ORG_IDS).has(organizationId);
}

// The flag stays off until launch. Orgs in BILLING_TEST_ORG_IDS are the
// exception, so the owner can exercise billing before everyone else is gated.
export function isBillingEnforced(organizationId?: string | null) {
  if (isBillingFlagOn()) {
    return true;
  }
  return isTestOrg(organizationId);
}
