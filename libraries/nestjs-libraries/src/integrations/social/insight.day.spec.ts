import { insightDay, throughToday } from '@gitroom/nestjs-libraries/integrations/social/insight.day';

describe('insight day', () => {
  it('labels a midnight end_time as the day it closes, not the next day', () => {
    expect(insightDay('2026-11-03T00:00:00Z')).toBe('2026-11-02');
    expect(insightDay('2026-11-03T00:00:00+00:00')).toBe('2026-11-02');
  });

  it('keeps a midday stamp on that same day', () => {
    expect(insightDay('2024-01-01T12:00:00Z')).toBe('2024-01-01');
  });

  it('does not plot a day after today on a 7-day chart', () => {
    const today = '2026-11-02';
    const points = [
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ].map((date) => ({ date, total: 1 }));
    const plotted = throughToday(points, today);
    expect(plotted.map((point) => point.date)).not.toContain('2026-11-03');
    expect(plotted[plotted.length - 1].date).toBe(today);
    expect(plotted).toHaveLength(7);
  });
});
