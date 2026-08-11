import { useState } from 'react';
import type { DailyUsagePoint } from '../lib/admin';

interface UsageChartProps {
  data: DailyUsagePoint[];
}

const WIDTH = 600;
const HEIGHT = 140;
const PADDING_TOP = 10;
const BASELINE_Y = HEIGHT - 4;
const BAR_GAP = 3;
const MIN_BAR_HEIGHT = 3;
const RADIUS = 3;

// A day with 0 tallies still gets a small flat nub anchored to the baseline
// rather than disappearing entirely, so the timeline reads as continuous -
// every day is represented, not just the ones with activity.
function barHeight(count: number, max: number): number {
  if (max <= 0) return MIN_BAR_HEIGHT;
  const usable = HEIGHT - PADDING_TOP - 4;
  const h = (count / max) * usable;
  return Math.max(MIN_BAR_HEIGHT, h);
}

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export default function UsageChart({ data }: UsageChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const max = Math.max(0, ...data.map((p) => p.count));
  const total = data.reduce((sum, p) => sum + p.count, 0);
  const barWidth = data.length > 0 ? (WIDTH - BAR_GAP * (data.length - 1)) / data.length : 0;
  const todayIndex = data.length - 1;
  const active = activeIndex !== null ? data[activeIndex] : null;

  return (
    <div className="usage-chart">
      <div className="usage-chart-header">
        <span>
          Last {data.length} days &middot; <strong>{total}</strong> total
        </span>
        {active && (
          <span className="usage-chart-tooltip">
            {formatDateLabel(active.date)}: <strong>{active.count}</strong>
          </span>
        )}
      </div>
      <svg
        className="usage-chart-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Daily tally totals for the last ${data.length} days, ${total} items total`}
      >
        {data.map((point, i) => {
          const h = barHeight(point.count, max);
          const x = i * (barWidth + BAR_GAP);
          const y = BASELINE_Y - h;
          const isToday = i === todayIndex;
          const isActive = activeIndex === i;
          return (
            <rect
              key={point.date}
              x={x}
              y={y}
              width={barWidth}
              height={h}
              rx={RADIUS}
              className={`usage-chart-bar${isToday ? ' usage-chart-bar-today' : ''}${isActive ? ' usage-chart-bar-active' : ''}`}
              onClick={() => setActiveIndex((prev) => (prev === i ? null : i))}
            >
              <title>
                {formatDateLabel(point.date)}: {point.count}
              </title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}
