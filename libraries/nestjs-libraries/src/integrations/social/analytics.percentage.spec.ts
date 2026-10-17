import dayjs from 'dayjs';
import { FacebookProvider } from '@gitroom/nestjs-libraries/integrations/social/facebook.provider';
import { InstagramProvider } from '@gitroom/nestjs-libraries/integrations/social/instagram.provider';
import { ThreadsProvider } from '@gitroom/nestjs-libraries/integrations/social/threads.provider';
import { LinkedinPageProvider } from '@gitroom/nestjs-libraries/integrations/social/linkedin.page.provider';

const json = (body: unknown) =>
  Promise.resolve({
    json: async () => body,
  });

describe('analytics percentage change', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('maps a Facebook daily series and leaves the points unchanged', async () => {
    const values = [
      { value: { organic: 1, paid: 2 }, end_time: '2024-01-01T12:00:00Z' },
      { value: { organic: 0, paid: 0 }, end_time: '2024-01-02T12:00:00Z' },
      { value: 4, end_time: '2024-01-03T12:00:00Z' },
      { value: 4, end_time: '2024-01-04T12:00:00Z' },
    ];
    global.fetch = jest.fn().mockImplementation((url: string) => {
      expect(url).toContain(
        'metric=page_total_media_view_unique,page_media_view,page_post_engagements,page_daily_follows'
      );
      expect(url).toContain('period=day');
      return json({
        data: [{ name: 'page_media_view', values }],
      });
    });

    const [row] = await new FacebookProvider().analytics('page', 'token', 7);

    expect(row.label).toBe('Media views');
    // Sums are 3, 0, 4, 4. Earlier half is 3, so the change is (8 - 3) / 3.
    expect(row.percentageChange).toBe(166.7);
    expect(row.data).toEqual(
      values.map((value) => ({
        total:
          value.value && typeof value.value === 'object'
            ? value.value.organic + value.value.paid
            : value.value,
        date: dayjs(value.end_time).format('YYYY-MM-DD'),
      }))
    );
  });

  it('maps Instagram daily insights and hides a one-point total', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (String(url).includes('metric_type=total_value')) {
        expect(url).toContain('metric=likes,views,comments,shares,saves,replies');
        return json({
          data: [{ name: 'likes', total_value: { value: 50 } }],
        });
      }
      expect(url).toContain('metric=follower_count,reach');
      expect(url).toContain('period=day');
      return json({
        data: [
          {
            name: 'reach',
            values: [
              { value: 4, end_time: '2024-01-01T12:00:00Z' },
              { value: 2, end_time: '2024-01-02T12:00:00Z' },
            ],
          },
        ],
      });
    });

    const rows = await new InstagramProvider().analytics(
      'ig-user',
      'access___user',
      7
    );
    const reach = rows.find((row) => row.label === 'Reach');
    const likes = rows.find((row) => row.label === 'Likes');

    expect(reach?.percentageChange).toBe(-50);
    expect(reach?.data).toEqual([
      { total: 4, date: '2024-01-01' },
      { total: 2, date: '2024-01-02' },
    ]);
    expect(likes?.percentageChange).toBe(0);
    expect(likes?.data).toEqual([
      { total: 50, date: dayjs().format('YYYY-MM-DD') },
    ]);
  });

  it('maps a Threads daily series and hides a total_value metric', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      expect(url).toContain('metric=views,likes,replies,reposts,quotes');
      expect(url).toContain('period=day');
      return json({
        data: [
          {
            name: 'views',
            values: [
              { value: 3, end_time: '2024-01-01T12:00:00Z' },
              { value: 4, end_time: '2024-01-02T12:00:00Z' },
            ],
          },
          { name: 'likes', total_value: { value: 9 } },
        ],
      });
    });

    const rows = await new ThreadsProvider().analytics('threads-user', 'token', 7);
    const views = rows.find((row) => row.label === 'Views');
    const likes = rows.find((row) => row.label === 'Likes');

    expect(views?.percentageChange).toBe(33.3);
    expect(views?.data).toEqual([
      { total: 3, date: '2024-01-01' },
      { total: 4, date: '2024-01-02' },
    ]);
    expect(likes?.percentageChange).toBe(0);
    expect(likes?.data).toEqual([
      { total: 9, date: dayjs().format('YYYY-MM-DD') },
    ]);
  });

  it('maps LinkedIn Page daily buckets and leaves empty metrics at 0', async () => {
    const start = dayjs('2024-01-01T00:00:00Z').valueOf();
    const end = dayjs('2024-01-04T00:00:00Z').valueOf();
    global.fetch = jest.fn().mockImplementation((url: string) => {
      const href = String(url);
      expect(href).toContain('timeGranularityType:DAY');
      if (href.includes('organizationPageStatistics')) {
        return json({
          elements: [
            {
              timeRange: { start },
              totalPageStatistics: {
                views: { allPageViews: { pageViews: 10 } },
              },
            },
            {
              timeRange: { start: end },
              totalPageStatistics: {
                views: { allPageViews: { pageViews: 40 } },
              },
            },
          ],
        });
      }
      return json({ elements: [] });
    });

    const rows = await new LinkedinPageProvider().analytics('org', 'token', 7);
    const views = rows.find((row) => row.label === 'Page Views');
    const clicks = rows.find((row) => row.label === 'Clicks');

    expect(views?.percentageChange).toBe(300);
    expect(views?.data).toEqual([
      { total: 10, date: '2024-01-01' },
      { total: 40, date: '2024-01-04' },
    ]);
    expect(clicks?.percentageChange).toBe(0);
    expect(clicks?.data).toEqual([]);
    expect(rows.map((row) => row.label)).toEqual([
      'Page Views',
      'Clicks',
      'Shares',
      'Engagement',
      'Comments',
      'Organic Followers',
      'Paid Followers',
    ]);
  });
});
