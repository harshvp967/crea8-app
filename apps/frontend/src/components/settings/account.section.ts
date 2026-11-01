export const accountSections = [
  { id: 'profile', label: 'Profile' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'billing', label: 'Billing' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'date_metrics', label: 'Date format' },
  { id: 'developers', label: 'Developers' },
  { id: 'approved_apps', label: 'Approved Apps' },
  { id: 'security', label: 'Security' },
  { id: 'delete', label: 'Delete account' },
] as const;

export type AccountSectionId = (typeof accountSections)[number]['id'];

// Older links used `date`. The query key that stays in the address bar is date_metrics.
const sectionAliases: Record<string, AccountSectionId> = {
  date: 'date_metrics',
};

export const accountSectionFrom = (
  value: string | null | undefined
): AccountSectionId => {
  if (value && accountSections.some((item) => item.id === value)) {
    return value as AccountSectionId;
  }
  if (value && sectionAliases[value]) {
    return sectionAliases[value];
  }
  return 'profile';
};

export const accountSectionQuery = (id: AccountSectionId) => id;

export const accountSectionHref = (id: AccountSectionId) =>
  `/account?section=${accountSectionQuery(id)}`;
