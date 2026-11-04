export const accountSections = [
  { id: 'account', label: 'Account' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'billing', label: 'Billing' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'developers', label: 'Developers' },
] as const;

export type AccountSectionId = (typeof accountSections)[number]['id'];

// Tabs that used to have their own page. The address bar is rewritten to the merged tab.
const legacySections: Record<string, AccountSectionId> = {
  profile: 'account',
  security: 'account',
  delete: 'account',
  appearance: 'workspace',
  date: 'workspace',
  date_metrics: 'workspace',
  webhooks: 'developers',
  approved_apps: 'developers',
};

export const isLegacyAccountSection = (
  value: string | null | undefined
): boolean =>
  !!value && Object.prototype.hasOwnProperty.call(legacySections, value);

export const accountSectionFrom = (
  value: string | null | undefined
): AccountSectionId => {
  if (value && accountSections.some((item) => item.id === value)) {
    return value as AccountSectionId;
  }
  if (value && legacySections[value]) {
    return legacySections[value];
  }
  return 'account';
};

export const accountSectionQuery = (id: AccountSectionId) => id;

export const accountSectionHref = (id: AccountSectionId) =>
  `/account?section=${accountSectionQuery(id)}`;
