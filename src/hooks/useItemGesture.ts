import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

interface Point {
  x: number;
  y: number;
}

interface UseItemGestureOptions {
  onTap: () => void;
  onLongPress: (point: Point) => void;
  onSwipeDown?: () => void;
  thresholdMs?: number;
  moveTolerancePx?: number;
  swipeThresholdPx?: number;
}

// A press resolves three ways: released quickly with little movement is a
// tap; held past the threshold is a long-press (opens the radial menu);
// released after moving mostly downward past the swipe threshold fires
// onSwipeDown. Any other release (e.g. a mostly-horizontal drag, used to
// swipe between grid pages) does nothing - it's neither a tap nor a swipe.
export function useItemGesture({
  onTap,
  onLongPress,
  onSwipeDown,
  thresholdMs = 450,
  moveTolerancePx = 12,
  swipeThresholdPx = 40,
}: UseItemGestureOptions) {
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<Point | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      firedRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      clear();
      // Touch input implicitly keeps delivering move/up events to the
      // element a gesture started on even once the finger moves outside
      // its bounds; a mouse has no such implicit capture, so without this
      // a downward swipe fires pointerleave (and used to cancel the whole
      // gesture there) the moment the cursor exits a button that's often
      // barely taller than the swipe threshold itself.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Gesture still resolves via normal bubbling if capture isn't
        // available for this pointer.
      }
      timerRef.current = window.setTimeout(() => {
        firedRef.current = true;
        if (startRef.current) onLongPress(startRef.current);
      }, thresholdMs);
    },
    [clear, onLongPress, thresholdMs],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!startRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      if (Math.hypot(dx, dy) > moveTolerancePx) {
        clear();
      }
    },
    [clear, moveTolerancePx],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      clear();
      const start = startRef.current;
      startRef.current = null;
      if (firedRef.current || !start) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const distance = Math.hypot(dx, dy);

      if (distance <= moveTolerancePx) {
        onTap();
      } else if (onSwipeDown && dy > swipeThresholdPx && dy > Math.abs(dx)) {
        onSwipeDown();
      }
    },
    [clear, onTap, onSwipeDown, moveTolerancePx, swipeThresholdPx],
  );

  // Only a genuine cancel (e.g. the OS interrupting the gesture) resets
  // state here - not onPointerLeave. With capture in place, pointerup still
  // reaches this element wherever the pointer is released, and a plain
  // "the pointer's position moved outside my box" shouldn't throw away an
  // in-progress swipe.
  const onPointerCancel = useCallback(() => {
    clear();
    startRef.current = null;
  }, [clear]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}
