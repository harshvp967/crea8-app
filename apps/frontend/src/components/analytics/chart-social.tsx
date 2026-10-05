'use client';

import { FC, useMemo } from 'react';
import dayjs from 'dayjs';
import { TotalList } from '@gitroom/frontend/components/analytics/stars.and.forks.interface';
import { ChartLine } from '@gitroom/frontend/components/analytics/chart-line';

function formatDateLabel(date: string) {
  if (date.includes(' - ')) {
    return date;
  }
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.format('MMM D') : date;
}

export const ChartSocial: FC<{
  data: TotalList[];
  color?: 'purple' | 'green' | 'blue';
  label?: string;
}> = ({ data, label = 'Total' }) => {
  const rows = useMemo(() => {
    const points = (data || []).map((point) => ({
      date: formatDateLabel(point.date),
      total: Number(point.total) || 0,
    }));
    if (points.length === 1) {
      return [points[0], { ...points[0] }];
    }
    return points;
  }, [data]);

  if (!rows.length) {
    return null;
  }

  return (
    <ChartLine
      bare
      surface="dark"
      accent="#00D9FF"
      data={rows}
      index="date"
      series={[{ key: 'total', label }]}
      fill="gradient"
      animate
      height={112}
      strokeWidth={2}
      showXAxis={false}
      showYAxis={false}
      showGrid={false}
      showLegend={false}
      showTooltip
      showPoints="last"
      total="none"
      yTicks={3}
    />
  );
};
