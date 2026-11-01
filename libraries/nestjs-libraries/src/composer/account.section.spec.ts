import {
  accountSectionFrom,
  accountSectionHref,
  accountSectionQuery,
  accountSections,
} from '@gitroom/frontend/components/settings/account.section';

describe('account section links', () => {
  it('opens date_metrics on the date format tab and keeps that query key', () => {
    expect(accountSectionFrom('date_metrics')).toBe('date_metrics');
    expect(accountSectionFrom('date')).toBe('date_metrics');
    expect(accountSectionQuery('date_metrics')).toBe('date_metrics');
    expect(accountSectionHref('date_metrics')).toBe('/account?section=date_metrics');
    expect(accountSections.find((item) => item.id === 'date_metrics')?.label).toBe(
      'Date format'
    );
  });

  it('maps every tab to its own query and falls back unknown values to profile', () => {
    for (const item of accountSections) {
      expect(accountSectionFrom(item.id)).toBe(item.id);
      expect(accountSectionHref(item.id)).toBe(`/account?section=${item.id}`);
    }
    expect(accountSectionFrom(null)).toBe('profile');
    expect(accountSectionFrom('not-a-tab')).toBe('profile');
  });
});
