import dayjs from 'dayjs';

export type MetricPoint = {
  total?: number | string | null;
  date?: string | null;
};

// 0 when the earlier half has no baseline: there is nothing to turn into a percent.
// The default is whole numbers, which is what X analytics already shows.
// Daily-series callers pass digits = 1.
export const xMetricChange = (
  earlier: number,
  later: number,
  digits = 0
) => {
  if (!earlier) {
    return 0;
  }
  const change = ((later - earlier) / earlier) * 100;
  if (!digits) {
    return Math.round(change);
  }
  if (!Number.isFinite(change)) {
    return 0;
  }
  const places = Math.max(0, Math.trunc(digits));
  const factor = 10 ** places;
  const rounded = Math.round(change * factor) / factor;
  return rounded === 0 ? 0 : rounded;
};

const pointTotal = (total: MetricPoint['total']) => {
  if (typeof total === 'number') {
    return Number.isFinite(total) ? total : 0;
  }
  if (typeof total === 'string' && total.trim() !== '') {
    const value = Number(total);
    return Number.isFinite(value) ? value : 0;
  }
  return 0;
};

const pointTime = (date?: string | null) => {
  if (!date) {
    return Number.NaN;
  }
  const time = dayjs(date).valueOf();
  return Number.isFinite(time) ? time : Number.NaN;
};

// Sort the selected range by date and cut it at the midpoint between the first
// and last point. A point on the midpoint belongs to the later half, same as X
// (`created < half`). Fewer than two dated points, one shared date, or a series
// whose values are all zero or missing is not a comparison.
export const splitMetricHalves = (points?: MetricPoint[] | null) => {
  const dated = (Array.isArray(points) ? points : [])
    .map((point) => ({
      total: pointTotal(point?.total),
      time: pointTime(point?.date),
    }))
    .filter((point) => Number.isFinite(point.time))
    .sort((a, b) => a.time - b.time);

  if (dated.length < 2 || dated.every((point) => point.total === 0)) {
    return { earlier: 0, later: 0 };
  }

  const start = dated[0].time;
  const end = dated[dated.length - 1].time;
  if (start === end) {
    return { earlier: 0, later: 0 };
  }

  const half = start + (end - start) / 2;
  let earlier = 0;
  let later = 0;
  for (const point of dated) {
    if (point.time < half) {
      earlier += point.total;
    } else {
      later += point.total;
    }
  }

  if (!Number.isFinite(earlier) || !Number.isFinite(later)) {
    return { earlier: 0, later: 0 };
  }

  return { earlier, later };
};

// One decimal. 0 hides the Analytics trend pill (TrendIndicator).
export const percentageChangeFromSeries = (points?: MetricPoint[] | null) => {
  const { earlier, later } = splitMetricHalves(points);
  return xMetricChange(earlier, later, 1);
};
