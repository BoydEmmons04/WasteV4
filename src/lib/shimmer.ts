// Column-synced shimmer delay: every button (and its badge) in the same
// grid column shares one delay, so they glint at the same moment; each
// column is offset slightly from the one before it so the sweep reads as a
// single wave moving left to right across the grid rather than each button
// glinting independently. columnIndex is the item's actual position modulo
// the grid's current column count (see useGridLayout), so the wave stays
// correct across breakpoints without any CSS media-query duplication.
const COLUMN_STEP_SECONDS = 0.35;

export function shimmerColumnDelay(columnIndex: number): string {
  return `${columnIndex * COLUMN_STEP_SECONDS}s`;
}
