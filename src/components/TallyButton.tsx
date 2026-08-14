import { useItemGesture } from '../hooks/useItemGesture';
import { shimmerColumnDelay } from '../lib/shimmer';
import type { Item } from '../types';

interface TallyButtonProps {
  item: Item;
  count: number;
  columnIndex: number;
  onTap: () => void;
  onLongPress: (center: { x: number; y: number }) => void;
  onSwipeDown: () => void;
}

export default function TallyButton({ item, count, columnIndex, onTap, onLongPress, onSwipeDown }: TallyButtonProps) {
  const gesture = useItemGesture({ onTap, onLongPress, onSwipeDown });
  const total = (typeof item.price === 'number' ? item.price : 0) * count;
  const shimmerDelay = shimmerColumnDelay(columnIndex);

  return (
    <button type="button" className="tally-button" {...gesture}>
      {/* Always mounted (visibility toggled, not conditionally rendered) so
          its shimmer animation clock keeps running in the background while
          hidden at count 0 - a conditionally-mounted badge would otherwise
          restart its animation from 0s every time it reappears, drifting
          out of sync with the accent bar below it, which never unmounts. */}
      <span
        className="tally-badge"
        style={{ backgroundColor: item.color, animationDelay: shimmerDelay, visibility: count > 0 ? 'visible' : 'hidden' }}
      >
        {count}
      </span>
      <div className="tally-button-image">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" draggable={false} onDragStart={(e) => e.preventDefault()} />
        ) : null}
        <div className="tally-button-title">
          <div className="tally-button-name">{item.name}</div>
          <div className="tally-button-price">${total.toFixed(2)}</div>
        </div>
      </div>
      <span className="tally-accent-bar" style={{ backgroundColor: item.color, animationDelay: shimmerDelay }} />
    </button>
  );
}
