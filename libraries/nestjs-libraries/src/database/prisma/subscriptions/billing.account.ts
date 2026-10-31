import { isGrandfatheredOrg } from '@gitroom/helpers/utils/billing.enabled';

export type AccountSubscription = {
  organizationId: string;
  subscriptionTier: string;
  status: string;
  period?: string | null;
  cancelAt?: Date | null;
  currentPeriodEnd?: Date | null;
  pendingTier?: string | null;
  pendingPeriod?: string | null;
  isLifetime?: boolean;
  provider?: string | null;
  identifier?: string | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type OwnedOrganization = {
  id: string;
  isTrailing: boolean;
  allowTrial: boolean;
  paymentId: string | null;
  subscription: AccountSubscription | null;
};

export type BillingAccount = {
  organizationId: string;
  billingOrganizationId: string;
  organizationIds: string[];
  subscription: AccountSubscription | null;
  latest: AccountSubscription | null;
  isTrailing: boolean;
  allowTrial: boolean;
  paymentId: string | null;
  isLifetime: boolean;
  grandfathered: boolean;
};

const CLOSED = new Set(['failed', 'pending', 'trial_ended', 'expired']);

export function subscriptionGrantsAccess(
  subscription: AccountSubscription | null | undefined,
  now = new Date()
) {
  if (!subscription) {
    return false;
  }
  const status = (subscription.status || 'active').toLowerCase();
  if (CLOSED.has(status)) {
    return false;
  }
  if (!subscription.deletedAt) {
    return true;
  }
  if (status !== 'cancelled' && status !== 'cancel_scheduled') {
    return false;
  }
  const end = subscription.cancelAt || subscription.currentPeriodEnd;
  return !!end && end.getTime() > now.getTime();
}

function rank(subscription: AccountSubscription | null) {
  const status = (subscription?.status || '').toLowerCase();
  if (status === 'active') return 0;
  if (status === 'trialing') return 1;
  if (status === 'cancel_scheduled') return 2;
  if (status === 'past_due' || status === 'on_hold') return 3;
  if (status === 'cancelled') return 4;
  return 5;
}

export function pickBillingOrganization(
  currentOrganizationId: string,
  owned: OwnedOrganization[],
  now = new Date()
) {
  const rows = owned.filter((org) => org?.id);
  const current = rows.find((org) => org.id === currentOrganizationId) || rows[0];
  const granting = rows.filter((org) =>
    subscriptionGrantsAccess(org.subscription, now)
  );
  if (!granting.length) {
    return current;
  }
  return [...granting].sort((left, right) => {
    const byStatus = rank(left.subscription) - rank(right.subscription);
    if (byStatus !== 0) return byStatus;
    const leftAt = left.subscription?.updatedAt?.getTime() || 0;
    const rightAt = right.subscription?.updatedAt?.getTime() || 0;
    return rightAt - leftAt;
  })[0];
}

function accountFrom(
  organizationId: string,
  owned: OwnedOrganization[],
  now: Date
): BillingAccount {
  const rows = owned.filter((org) => org?.id);
  const billing = pickBillingOrganization(organizationId, rows, now);
  const subscription = billing?.subscription && subscriptionGrantsAccess(billing.subscription, now)
    ? billing.subscription
    : null;
  const latest =
    [...rows]
      .map((org) => org.subscription)
      .filter((row): row is AccountSubscription => !!row)
      .sort(
        (left, right) =>
          (right.updatedAt?.getTime() || 0) - (left.updatedAt?.getTime() || 0)
      )[0] || null;
  const organizationIds = [...new Set(rows.map((org) => org.id))];
  if (!organizationIds.includes(organizationId)) {
    organizationIds.push(organizationId);
  }
  return {
    organizationId,
    billingOrganizationId: billing?.id || organizationId,
    organizationIds,
    subscription,
    latest: subscription || latest,
    isTrailing:
      !!subscription &&
      ((subscription.status || '').toLowerCase() === 'trialing' || !!billing?.isTrailing),
    allowTrial: billing ? !!billing.allowTrial : false,
    paymentId: billing?.paymentId || null,
    isLifetime: !!subscription?.isLifetime,
    grandfathered: organizationIds.some((id) => isGrandfatheredOrg(id)),
  };
}

const orgSelect = {
  id: true,
  isTrailing: true,
  allowTrial: true,
  paymentId: true,
  subscription: true,
};

export async function loadBillingAccount(
  db: any,
  organizationId: string,
  now = new Date()
): Promise<BillingAccount> {
  const owner = await db.userOrganization.findFirst({
    where: { organizationId, role: 'SUPERADMIN', disabled: false },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  });
  if (!owner) {
    const self = await db.organization.findUnique({
      where: { id: organizationId },
      select: orgSelect,
    });
    return accountFrom(organizationId, self ? [self] : [], now);
  }
  const owned = await db.userOrganization.findMany({
    where: {
      userId: owner.userId,
      role: 'SUPERADMIN',
      disabled: false,
      organization: { deletedAt: null },
    },
    select: { organization: { select: orgSelect } },
  });
  const rows = (owned as Array<{ organization: OwnedOrganization | null }>)
    .map((row) => row.organization)
    .filter((org): org is OwnedOrganization => !!org);
  if (!rows.some((org) => org.id === organizationId)) {
    const self = await db.organization.findUnique({
      where: { id: organizationId },
      select: orgSelect,
    });
    if (self) {
      rows.push(self);
    }
  }
  return accountFrom(organizationId, rows, now);
}
