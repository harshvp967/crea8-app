import {
  accountSectionFrom,
  accountSectionHref,
  accountSectionQuery,
  accountSections,
  isLegacyAccountSection,
} from '@gitroom/frontend/components/settings/account.section';

describe('account section links', () => {
  it('shows the five merged tabs', () => {
    expect(accountSections.map((item) => item.label)).toEqual([
      'Account',
      'Workspace',
      'Billing',
      'Notifications',
      'Developers',
    ]);
  });

  it('sends retired tabs to the merged tab and leaves billing and notifications', () => {
    expect(accountSectionFrom('profile')).toBe('account');
    expect(accountSectionFrom('security')).toBe('account');
    expect(accountSectionFrom('delete')).toBe('account');
    expect(accountSectionFrom('appearance')).toBe('workspace');
    expect(accountSectionFrom('date')).toBe('workspace');
    expect(accountSectionFrom('date_metrics')).toBe('workspace');
    expect(accountSectionFrom('webhooks')).toBe('developers');
    expect(accountSectionFrom('approved_apps')).toBe('developers');
    expect(accountSectionFrom('billing')).toBe('billing');
    expect(accountSectionFrom('notifications')).toBe('notifications');
    expect(isLegacyAccountSection('date_metrics')).toBe(true);
    expect(isLegacyAccountSection('billing')).toBe(false);
    expect(isLegacyAccountSection('notifications')).toBe(false);
  });

  it('maps every visible tab to its own query and falls back unknown values to account', () => {
    for (const item of accountSections) {
      expect(accountSectionFrom(item.id)).toBe(item.id);
      expect(accountSectionQuery(item.id)).toBe(item.id);
      expect(accountSectionHref(item.id)).toBe(`/account?section=${item.id}`);
      expect(isLegacyAccountSection(item.id)).toBe(false);
    }
    expect(accountSectionFrom(null)).toBe('account');
    expect(accountSectionFrom('not-a-tab')).toBe('account');
    expect(isLegacyAccountSection(null)).toBe(false);
    expect(isLegacyAccountSection('not-a-tab')).toBe(false);
  });
});
