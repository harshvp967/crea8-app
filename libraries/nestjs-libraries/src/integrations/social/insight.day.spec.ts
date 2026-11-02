import { insightDay } from '@gitroom/nestjs-libraries/integrations/social/insight.day';

describe('insight day', () => {
  it('labels a midnight end_time as the day it closes, not the next day', () => {
    expect(insightDay('2026-11-03T00:00:00Z')).toBe('2026-11-02');
    expect(insightDay('2026-11-03T00:00:00+00:00')).toBe('2026-11-02');
  });

  it('keeps a midday stamp on that same day', () => {
    expect(insightDay('2024-01-01T12:00:00Z')).toBe('2024-01-01');
  });
});
