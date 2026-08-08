import { useItemGesture } from '../hooks/useItemGesture';
import type { Item } from '../types';

interface TallyButtonProps {
  item: Item;
  count: number;
  onTap: () => void;
  onLongPress: (center: { x: number; y: number }) => void;
  onSwipeDown: () => void;
}

export default function TallyButton({ item, count, onTap, onLongPress, onSwipeDown }: TallyButtonProps) {
  const gesture = useItemGesture({ onTap, onLongPress, onSwipeDown });
  const total = (typeof item.price === 'number' ? item.price : 0) * count;

  return (
    <button type="button" className="tally-button" style={{ borderBottomColor: item.color }} {...gesture}>
      {count > 0 && (
        <span className="tally-badge" style={{ backgroundColor: item.color }}>
          {count}
        </span>
      )}
      <div className="tally-button-image">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" draggable={false} onDragStart={(e) => e.preventDefault()} />
        ) : null}
        <div className="tally-button-title">
          <div className="tally-button-name">{item.name}</div>
          <div className="tally-button-price">${total.toFixed(2)}</div>
        </div>
      </div>
    </button>
  );
}
