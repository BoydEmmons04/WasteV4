import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from 'framework7-react';
import { useGridLayout } from '../hooks/useGridLayout';
import { useFittedCellSize } from '../hooks/useFittedCellSize';
import TallyButton from './TallyButton';
import type { Item } from '../types';

interface TallyGridPagerProps {
  items: Item[];
  tallyByItemId: Record<string, number>;
  onTap: (item: Item) => void;
  onLongPress: (item: Item, center: { x: number; y: number }) => void;
  onSwipeDown: (item: Item) => void;
}

export default function TallyGridPager({ items, tallyByItemId, onTap, onLongPress, onSwipeDown }: TallyGridPagerProps) {
  const { itemsPerPage, columns, rows } = useGridLayout();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const cellSize = useFittedCellSize(scrollRef, columns, rows);
  const gridStyle = cellSize
    ? { gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`, gridAutoRows: `${cellSize}px` }
    : undefined;

  const pages = useMemo(() => {
    const chunks: Item[][] = [];
    for (let i = 0; i < items.length; i += itemsPerPage) {
      chunks.push(items.slice(i, i + itemsPerPage));
    }
    return chunks.length > 0 ? chunks : [[]];
  }, [items, itemsPerPage]);

  useEffect(() => {
    setPageIndex(0);
    scrollRef.current?.scrollTo({ left: 0 });
  }, [itemsPerPage]);

  const goToPage = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(index, pages.length - 1));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    setPageIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const hasMultiplePages = pages.length > 1;

  return (
    <div className="tally-pager">
      {hasMultiplePages && (
        <button
          type="button"
          className="tally-pager-arrow tally-pager-arrow-left"
          onClick={() => goToPage(pageIndex - 1)}
          disabled={pageIndex === 0}
        >
          <Icon f7="chevron_left" />
        </button>
      )}

      <div className="tally-pager-scroll" ref={scrollRef} onScroll={handleScroll}>
        {pages.map((pageItems, i) => (
          <div className="tally-pager-page" key={i}>
            <div className="tally-grid" style={gridStyle}>
              {pageItems.map((item) => (
                <TallyButton
                  key={item.id}
                  item={item}
                  count={tallyByItemId[item.id] ?? 0}
                  onTap={() => onTap(item)}
                  onLongPress={(center) => onLongPress(item, center)}
                  onSwipeDown={() => onSwipeDown(item)}
                />
              ))}
              {pageItems.length === 0 && (
                <div className="text-align-center" style={{ gridColumn: '1 / -1', padding: 24 }}>
                  <p>No items in this category yet.</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMultiplePages && (
        <button
          type="button"
          className="tally-pager-arrow tally-pager-arrow-right"
          onClick={() => goToPage(pageIndex + 1)}
          disabled={pageIndex === pages.length - 1}
        >
          <Icon f7="chevron_right" />
        </button>
      )}
    </div>
  );
}
