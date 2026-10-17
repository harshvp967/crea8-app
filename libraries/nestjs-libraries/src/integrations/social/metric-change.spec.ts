import {
  percentageChangeFromSeries,
  splitMetricHalves,
  xMetricChange,
} from '@gitroom/nestjs-libraries/integrations/social/metric-change';

const point = (date: string, total?: number | string | null) => ({
  date,
  total,
});

describe('metric change', () => {
  it('keeps the X whole-number rule, including an empty earlier half', () => {
    expect(xMetricChange(0, 10)).toBe(0);
    expect(xMetricChange(2, 4)).toBe(100);
    expect(xMetricChange(4, 2)).toBe(-50);
    expect(xMetricChange(3, 4)).toBe(33);
  });

  it('splits a series at the midpoint between the first and last date', () => {
    expect(
      splitMetricHalves([
        point('2024-01-04', 8),
        point('2024-01-01', 1),
        point('2024-01-03', 4),
        point('2024-01-02', 2),
      ])
    ).toEqual({ earlier: 3, later: 12 });

    // The middle day of an odd daily series belongs to the later half.
    expect(
      splitMetricHalves([
        point('2024-01-01', 10),
        point('2024-01-02', 20),
        point('2024-01-03', 30),
      ])
    ).toEqual({ earlier: 10, later: 50 });
  });

  it('rounds a real comparison to one decimal', () => {
    expect(xMetricChange(3, 4, 1)).toBe(33.3);
    expect(percentageChangeFromSeries([
      point('2024-01-01', 3),
      point('2024-01-02', 4),
    ])).toBe(33.3);
    expect(xMetricChange(200, 201, 1)).toBe(0.5);
  });

  it('returns 0 for an empty series', () => {
    expect(splitMetricHalves([])).toEqual({ earlier: 0, later: 0 });
    expect(splitMetricHalves(undefined)).toEqual({ earlier: 0, later: 0 });
    expect(percentageChangeFromSeries([])).toBe(0);
    expect(percentageChangeFromSeries(undefined)).toBe(0);
  });

  it('returns 0 for a single point, including a total dated today', () => {
    const today = [{ total: 12, date: '2024-06-01' }];
    expect(splitMetricHalves(today)).toEqual({ earlier: 0, later: 0 });
    expect(percentageChangeFromSeries(today)).toBe(0);
  });

  it('returns 0 when the earlier half is zero', () => {
    expect(xMetricChange(0, 25, 1)).toBe(0);
    expect(
      percentageChangeFromSeries([
        point('2024-01-01', 0),
        point('2024-01-02', 25),
      ])
    ).toBe(0);
  });

  it('returns a negative change when the later half is smaller', () => {
    expect(xMetricChange(4, 2, 1)).toBe(-50);
    expect(
      percentageChangeFromSeries([
        point('2024-01-01', 4),
        point('2024-01-02', 1),
        point('2024-01-03', 1),
      ])
    ).toBe(-50);
  });

  it('returns 0 when every value is zero, missing, or the dates do not span', () => {
    expect(
      percentageChangeFromSeries([
        point('2024-01-01', 0),
        point('2024-01-02', 0),
      ])
    ).toBe(0);
    expect(
      percentageChangeFromSeries([
        point('2024-01-01'),
        point('2024-01-02', null),
      ])
    ).toBe(0);
    expect(
      percentageChangeFromSeries([
        point('2024-01-01', 5),
        point('2024-01-01', 9),
      ])
    ).toBe(0);
    expect(xMetricChange(1, Number.POSITIVE_INFINITY, 1)).toBe(0);
    expect(xMetricChange(Number.NaN, 4, 1)).toBe(0);
    expect(
      percentageChangeFromSeries([
        point('2024-01-01', Number.POSITIVE_INFINITY),
        point('2024-01-02', 4),
      ])
    ).toBe(0);
  });
});
