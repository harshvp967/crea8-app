import { postsListQuery } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.repository';
import {
  listPostsSearch,
  startOfTodayUtc,
} from '@gitroom/frontend/components/launches/list.query';

const now = new Date('2026-10-15T15:00:00.000Z');
const customer = 'cust-9';

function search(state: 'all' | 'scheduled' | 'draft' | 'published', zone = 'UTC') {
  return new URLSearchParams(
    listPostsSearch({
      page: 0,
      customer,
      state,
      timezone: zone,
      now,
    })
  );
}

describe('list All tab', () => {
  it('starts at midnight in the user timezone and has no end', () => {
    expect(startOfTodayUtc('UTC', now)).toBe('2026-10-15T00:00:00.000Z');
    // 03:30Z is still the 14th in New York (EDT, UTC-4).
    expect(startOfTodayUtc('America/New_York', new Date('2026-10-15T03:30:00.000Z'))).toBe(
      '2026-10-14T04:00:00.000Z'
    );
    // 19:00Z is already the 16th in Kolkata (UTC+5:30).
    expect(startOfTodayUtc('Asia/Kolkata', new Date('2026-10-15T19:00:00.000Z'))).toBe(
      '2026-10-15T18:30:00.000Z'
    );
    // 06:30Z is still the 14th in Los Angeles (PDT, UTC-7).
    expect(
      startOfTodayUtc('America/Los_Angeles', new Date('2026-10-15T06:30:00.000Z'))
    ).toBe('2026-10-14T07:00:00.000Z');
  });

  it('asks for published, scheduled, and draft posts from that midnight on', () => {
    const params = search('all', 'America/New_York');
    const from = '2026-10-15T04:00:00.000Z';
    expect(params.get('state')).toBe('all');
    expect(params.get('customer')).toBe(customer);
    expect(params.get('from')).toBe(from);
    expect(params.get('to')).toBeNull();
    expect(params.get('end')).toBeNull();
    expect(params.get('endDate')).toBeNull();

    const { where, orderDirection } = postsListQuery(
      'org-1',
      { state: 'all', from, customer },
      now
    );
    expect(where.state).toEqual({
      in: ['QUEUE', 'DRAFT', 'PUBLISHED', 'ERROR'],
    });
    expect(where.publishDate).toEqual({ gte: new Date(from) });
    expect(where.publishDate).not.toHaveProperty('lte');
    expect(orderDirection).toBe('asc');
    expect(where.integration).toMatchObject({
      organizationId: 'org-1',
      customerId: customer,
      deletedAt: null,
    });
    expect(where.deletedAt).toBeNull();
    expect(where.parentPostId).toBeNull();
  });

  it('keeps the customer filter when no customer is selected', () => {
    const params = new URLSearchParams(
      listPostsSearch({
        page: 1,
        customer: null,
        state: 'all',
        timezone: 'UTC',
        now,
      })
    );
    expect(params.get('customer')).toBe('');
    expect(params.get('page')).toBe('1');

    const { where } = postsListQuery('org-1', {
      state: 'all',
      from: '2026-10-15T00:00:00.000Z',
      customer: '',
    });
    expect(where.integration).not.toHaveProperty('customerId');
  });
});

describe('list Scheduled, Published, and Drafts tabs', () => {
  it('keeps scheduled upcoming and published unbounded, and does not date-bound drafts', () => {
    expect(search('scheduled').toString()).toBe(
      'page=0&limit=100&customer=cust-9&state=scheduled'
    );
    expect(search('published').toString()).toBe(
      'page=0&limit=100&customer=cust-9&state=published'
    );
    expect(search('draft').toString()).toBe(
      'page=0&limit=100&customer=cust-9&state=draft'
    );

    const from = '2020-01-01T00:00:00.000Z';
    const scheduled = postsListQuery(
      'org-1',
      { state: 'scheduled', from, customer },
      now
    );
    expect(scheduled.where.state).toBe('QUEUE');
    expect(scheduled.where.publishDate).toEqual({ gte: now });
    expect(scheduled.orderDirection).toBe('asc');
    expect(scheduled.where.integration).toMatchObject({ customerId: customer });

    const draft = postsListQuery('org-1', { state: 'draft', from, customer }, now);
    expect(draft.where.state).toBe('DRAFT');
    expect(draft.where).not.toHaveProperty('publishDate');
    expect(draft.orderDirection).toBe('asc');
    expect(draft.where.integration).toMatchObject({ customerId: customer });

    const published = postsListQuery(
      'org-1',
      { state: 'published', from, customer },
      now
    );
    expect(published.where.state).toBe('PUBLISHED');
    expect(published.where).not.toHaveProperty('publishDate');
    expect(published.orderDirection).toBe('desc');
    expect(published.where.integration).toMatchObject({ customerId: customer });
  });

  it('includes a draft from earlier today, which All already shows, and older drafts too', () => {
    const from = '2026-10-15T00:00:00.000Z';
    const earlierToday = new Date('2026-10-15T08:00:00.000Z');
    expect(earlierToday.getTime()).toBeGreaterThanOrEqual(new Date(from).getTime());
    expect(earlierToday.getTime()).toBeLessThan(now.getTime());

    const draft = postsListQuery('org-1', { state: 'draft', from }, now);
    expect(draft.where.state).toBe('DRAFT');
    expect(draft.where).not.toHaveProperty('publishDate');
    expect(draft.where.deletedAt).toBeNull();
    expect(draft.where.parentPostId).toBeNull();

    const all = postsListQuery('org-1', { state: 'all', from }, now);
    expect(all.where.state).toEqual({
      in: ['QUEUE', 'DRAFT', 'PUBLISHED', 'ERROR'],
    });
    expect(all.where.publishDate).toEqual({ gte: new Date(from) });
    expect(earlierToday.getTime()).toBeGreaterThanOrEqual(
      (all.where.publishDate as { gte: Date }).gte.getTime()
    );

    const lastYear = postsListQuery(
      'org-1',
      { state: 'draft', from: '2025-01-01T00:00:00.000Z' },
      now
    );
    expect(lastYear.where.state).toBe('DRAFT');
    expect(lastYear.where).not.toHaveProperty('publishDate');

    expect(search('draft').has('from')).toBe(false);
  });

  it('keeps the All cache key free of the day bound', () => {
    expect(
      listPostsSearch({
        page: 0,
        customer: '',
        state: 'all',
        includeFrom: false,
      })
    ).toBe('page=0&limit=100&customer=&state=all');
  });
});
