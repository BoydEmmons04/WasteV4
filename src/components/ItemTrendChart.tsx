import { useState } from 'react';

export interface TrendPoint {
  date: string;
  count: number;
}

interface ItemTrendChartProps {
  data: TrendPoint[];
}

// Same bar-chart approach as UsageChart (zero-filled days, tap-to-inspect
// tooltip) but generalized to any date range the caller hands it, rather
// than a fixed "last N days ending today" window - this renders a single
// item's daily counts across whatever range the Summary screen has loaded.
const WIDTH = 600;
const HEIGHT = 110;
const PADDING_TOP = 10;
const BASELINE_Y = HEIGHT - 4;
const BAR_GAP = 3;
const MIN_BAR_HEIGHT = 3;
const RADIUS = 3;

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

export default function ItemTrendChart({ data }: ItemTrendChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const max = Math.max(0, ...data.map((p) => p.count));
  const total = data.reduce((sum, p) => sum + p.count, 0);
  const barWidth = data.length > 0 ? (WIDTH - BAR_GAP * (data.length - 1)) / data.length : 0;
  const active = activeIndex !== null ? data[activeIndex] : null;

  if (data.length === 0) return null;

  return (
    <div className="usage-chart item-trend-chart">
      <div className="usage-chart-header">
        <span>
          {data.length} day{data.length === 1 ? '' : 's'} &middot; <strong>{total}</strong> total
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
        aria-label={`Daily waste counts for this item, ${total} total`}
      >
        {data.map((point, i) => {
          const h = barHeight(point.count, max);
          const x = i * (barWidth + BAR_GAP);
          const y = BASELINE_Y - h;
          const isActive = activeIndex === i;
          return (
            <rect
              key={point.date}
              x={x}
              y={y}
              width={barWidth}
              height={h}
              rx={RADIUS}
              className={`usage-chart-bar${isActive ? ' usage-chart-bar-active' : ''}`}
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
