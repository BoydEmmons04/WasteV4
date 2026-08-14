import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

// Must match the .tally-grid gap/padding in index.css (including its
// 700px breakpoint) - single source of truth for the pixel math below.
function getGridSpacing(): number {
  return window.innerWidth >= 700 ? 28 : 16;
}

// Measures the actual space available for one page of the grid and works
// out the largest square cell that fits `columns` across AND `rows` down at
// once. .tally-button sizes itself from its own column width via
// aspect-ratio, with no way to know the row budget, so on a short viewport
// (e.g. tablet) that could size rows taller than the page actually has room
// for, pushing the last row behind the bottom toolbar. Feeding an explicit
// pixel size back into the grid's own columns/rows closes that gap.
export function useFittedCellSize(containerRef: RefObject<HTMLElement | null>, columns: number, rows: number) {
  const [cellSize, setCellSize] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const compute = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width === 0 || height === 0) return;
      const spacing = getGridSpacing();
      const availableWidth = width - 2 * spacing - (columns - 1) * spacing;
      const availableHeight = height - 2 * spacing - (rows - 1) * spacing;
      const size = Math.floor(Math.min(availableWidth / columns, availableHeight / rows));
      setCellSize(size > 0 ? size : null);
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef, columns, rows]);

  return cellSize;
}
