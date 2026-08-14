import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGridLayout } from '../hooks/useGridLayout';
import { useFittedCellSize } from '../hooks/useFittedCellSize';
import { shimmerColumnDelay } from '../lib/shimmer';
import type { Item } from '../types';

interface TallyGridReorderProps {
  items: Item[];
  tallyByItemId: Record<string, number>;
  onOrderChange: (orderedIds: string[]) => void;
}

const SWAP_ANIMATION_MS = 150;
// How close to the visible page's edge the pointer has to get to trigger an
// auto page-switch, and how long to lock out re-triggering while that
// switch's scroll animation settles.
const EDGE_ZONE = 48;
const PAGE_SWITCH_COOLDOWN_MS = 380;

interface DragInfo {
  id: string;
  rect: DOMRect;
  grabOffset: { x: number; y: number };
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

// Same FLIP + fixed-position drag-overlay pattern used elsewhere, laid out
// as the same fixed-size "pages" as the normal browsing grid, arranged side
// by side with a faint divider at each seam.
//
// Pointer capture is taken on the outer scroll container (pagesScrollRef),
// not on the individual dragged cell: pages are separate React parents, so
// moving an item across a page boundary unmounts its cell from one
// .tally-grid and mounts a fresh one in another. If capture were on the
// cell itself, that would silently drop it mid-drag. Capturing on the
// stable outer container means the drag survives cross-page moves.
//
// Target cell/page is recomputed from scratch on every pointer move (grid
// geometry + which page is currently scrolled into view) rather than cached
// once at drag start, since which page is "current" now changes mid-drag.
export default function TallyGridReorder({ items, tallyByItemId, onOrderChange }: TallyGridReorderProps) {
  const { itemsPerPage, columns, rows } = useGridLayout();
  const [orderedIds, setOrderedIds] = useState<string[]>(() => items.map((i) => i.id));
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);

  const pagesScrollRef = useRef<HTMLDivElement>(null);
  const cellSize = useFittedCellSize(pagesScrollRef, columns, rows);
  // See the matching comment in TallyGridPager.tsx - gridTemplateRows has
  // to be set explicitly (not left to grid-auto-rows) to actually override
  // .tally-grid's own fixed grid-template-rows: repeat(4, 1fr).
  const gridStyle = cellSize
    ? { gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`, gridTemplateRows: `repeat(${rows}, ${cellSize}px)` }
    : undefined;

  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const dragRef = useRef<{ id: string; pointerId: number; grabOffset: { x: number; y: number } } | null>(null);
  const pageSwitchLockedRef = useRef(false);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const pages = useMemo(() => {
    const chunks: string[][] = [];
    for (let i = 0; i < orderedIds.length; i += itemsPerPage) {
      chunks.push(orderedIds.slice(i, i + itemsPerPage));
    }
    return chunks.length > 0 ? chunks : [[]];
  }, [orderedIds, itemsPerPage]);

  useEffect(() => {
    onOrderChange(orderedIds);
  }, [orderedIds, onOrderChange]);

  useLayoutEffect(() => {
    const newRects = new Map<string, DOMRect>();
    cellRefs.current.forEach((el, id) => newRects.set(id, el.getBoundingClientRect()));

    newRects.forEach((newRect, id) => {
      const prevRect = prevRectsRef.current.get(id);
      const el = cellRefs.current.get(id);
      if (!el || !prevRect) return;
      const dx = prevRect.left - newRect.left;
      const dy = prevRect.top - newRect.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      void el.offsetHeight;
      el.style.transition = `transform ${SWAP_ANIMATION_MS}ms ease-out`;
      el.style.transform = '';
    });

    prevRectsRef.current = newRects;
  }, [orderedIds]);

  const handlePointerDown = (id: string, e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      pagesScrollRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Dragging still works via normal event bubbling if capture isn't
      // available for this pointer.
    }
    const cellEl = cellRefs.current.get(id);
    if (!cellEl) return;
    const rect = cellEl.getBoundingClientRect();
    const grabOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    dragRef.current = { id, pointerId: e.pointerId, grabOffset };
    setDragInfo({ id, rect, grabOffset });
    setDragPoint({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const dragging = dragRef.current;
    const scrollEl = pagesScrollRef.current;
    if (!dragging || !scrollEl || e.pointerId !== dragging.pointerId || !cellSize) return;
    setDragPoint({ x: e.clientX, y: e.clientY });

    if (pageSwitchLockedRef.current) return;

    const scrollRect = scrollEl.getBoundingClientRect();
    const currentPageIndex = Math.round(scrollEl.scrollLeft / scrollEl.clientWidth);

    const nearLeftEdge = e.clientX < scrollRect.left + EDGE_ZONE && currentPageIndex > 0;
    const nearRightEdge = e.clientX > scrollRect.right - EDGE_ZONE && currentPageIndex < pages.length - 1;
    if (nearLeftEdge || nearRightEdge) {
      pageSwitchLockedRef.current = true;
      const targetPage = currentPageIndex + (nearLeftEdge ? -1 : 1);
      scrollEl.scrollTo({ left: targetPage * scrollEl.clientWidth, behavior: 'smooth' });
      window.setTimeout(() => {
        pageSwitchLockedRef.current = false;
      }, PAGE_SWITCH_COOLDOWN_MS);
      return;
    }

    const pageEl = scrollEl.children[currentPageIndex] as HTMLElement | undefined;
    const gridEl = pageEl?.querySelector<HTMLElement>('.tally-grid');
    if (!gridEl) return;
    const gridComputedStyle = getComputedStyle(gridEl);
    const gap = parseFloat(gridComputedStyle.columnGap || '0') || 0;
    const paddingLeft = parseFloat(gridComputedStyle.paddingLeft) || 0;
    const paddingTop = parseFloat(gridComputedStyle.paddingTop) || 0;
    const gridRect = gridEl.getBoundingClientRect();
    const originX = gridRect.left + paddingLeft;
    const originY = gridRect.top + paddingTop;
    const stride = cellSize + gap;

    const centerX = e.clientX - dragging.grabOffset.x + cellSize / 2;
    const centerY = e.clientY - dragging.grabOffset.y + cellSize / 2;

    const col = clamp(Math.round((centerX - originX - cellSize / 2) / stride), 0, columns - 1);
    const row = Math.max(0, Math.round((centerY - originY - cellSize / 2) / stride));
    const pageItemCount = pages[currentPageIndex]?.length ?? 0;
    const localIndex = clamp(row * columns + col, 0, Math.max(pageItemCount - 1, 0));
    const rawTargetIndex = currentPageIndex * itemsPerPage + localIndex;

    setOrderedIds((prev) => {
      const fromIdx = prev.indexOf(dragging.id);
      if (fromIdx === -1) return prev;
      const targetIndex = clamp(rawTargetIndex, 0, prev.length - 1);
      if (fromIdx === targetIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const dragging = dragRef.current;
    if (!dragging || e.pointerId !== dragging.pointerId) return;
    dragRef.current = null;
    pageSwitchLockedRef.current = false;
    setDragInfo(null);
    setDragPoint(null);
  };

  const draggedItem = dragInfo ? itemById.get(dragInfo.id) : null;
  const draggedCount = draggedItem ? (tallyByItemId[draggedItem.id] ?? 0) : 0;

  return (
    <>
      <div
        className="reorder-pages-scroll"
        ref={pagesScrollRef}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {pages.map((pageIds, pageIndex) => (
          <div key={pageIndex} className="reorder-page">
            <div className="tally-grid" style={gridStyle}>
              {pageIds.map((id, localIndex) => {
                const item = itemById.get(id);
                if (!item) return null;
                const isDragging = dragInfo?.id === id;
                const count = tallyByItemId[id] ?? 0;
                const total = (typeof item.price === 'number' ? item.price : 0) * count;
                const shimmerDelay = shimmerColumnDelay(localIndex % columns);
                return (
                  <div
                    key={id}
                    ref={(el) => {
                      if (el) cellRefs.current.set(id, el);
                      else cellRefs.current.delete(id);
                    }}
                    className="reorder-cell"
                    onPointerDown={(e) => handlePointerDown(id, e)}
                  >
                    <div
                      className={
                        isDragging
                          ? 'tally-button reorder-cell-lifted'
                          : `tally-button reorder-jiggle${localIndex % 2 ? ' reorder-jiggle-alt' : ''}`
                      }
                    >
                      <span
                        className="tally-badge"
                        style={{
                          backgroundColor: item.color,
                          animationDelay: shimmerDelay,
                          visibility: count > 0 ? 'visible' : 'hidden',
                        }}
                      >
                        {count}
                      </span>
                      <div className="tally-button-image">
                        {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
                        <div className="tally-button-title">
                          <div className="tally-button-name">{item.name}</div>
                          <div className="tally-button-price">${total.toFixed(2)}</div>
                        </div>
                      </div>
                      <span
                        className="tally-accent-bar"
                        style={{ backgroundColor: item.color, animationDelay: shimmerDelay }}
                      />
                    </div>
                  </div>
                );
              })}
              {pageIds.length === 0 && (
                <div className="text-align-center" style={{ gridColumn: '1 / -1', padding: 24 }}>
                  <p>No items in this category.</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {dragInfo &&
        dragPoint &&
        draggedItem &&
        createPortal(
          <div
            className="tally-button reorder-overlay"
            style={{
              width: dragInfo.rect.width,
              height: dragInfo.rect.height,
              left: dragPoint.x - dragInfo.grabOffset.x,
              top: dragPoint.y - dragInfo.grabOffset.y,
            }}
          >
            {draggedCount > 0 && (
              <span className="tally-badge" style={{ backgroundColor: draggedItem.color }}>
                {draggedCount}
              </span>
            )}
            <div className="tally-button-image">
              {draggedItem.imageUrl ? <img src={draggedItem.imageUrl} alt="" /> : null}
              <div className="tally-button-title">
                <div className="tally-button-name">{draggedItem.name}</div>
                <div className="tally-button-price">
                  ${((typeof draggedItem.price === 'number' ? draggedItem.price : 0) * draggedCount).toFixed(2)}
                </div>
              </div>
            </div>
            <span className="tally-accent-bar" style={{ backgroundColor: draggedItem.color }} />
          </div>,
          document.body,
        )}
    </>
  );
}
