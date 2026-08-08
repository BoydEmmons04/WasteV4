import { createPortal } from 'react-dom';
import { Icon } from 'framework7-react';

const SEGMENTS = [20, 50, 100, -100, -50, -20];
const RADIUS = 130;
const MARGIN_SIDE = RADIUS + 54;
const MARGIN_TOP = RADIUS + 54;
const ACTION_ROW_GAP = 70;
const ACTION_BTN_SIZE = 56;
const MARGIN_BOTTOM = RADIUS + ACTION_ROW_GAP + ACTION_BTN_SIZE / 2 + 20;

interface RadialMenuProps {
  center: { x: number; y: number };
  itemName: string;
  onSelect: (delta: number) => void;
  onDelete: () => void;
  onEdit: () => void;
  onClose: () => void;
}

export default function RadialMenu({ center, itemName, onSelect, onDelete, onEdit, onClose }: RadialMenuProps) {
  const cx = Math.min(Math.max(center.x, MARGIN_SIDE), window.innerWidth - MARGIN_SIDE);
  const cy = Math.min(Math.max(center.y, MARGIN_TOP), window.innerHeight - MARGIN_BOTTOM);
  const actionY = cy + RADIUS + ACTION_ROW_GAP;

  return createPortal(
    <div className="radial-backdrop" onClick={onClose} onContextMenu={(e) => e.preventDefault()}>
      <div className="radial-center" style={{ left: cx, top: cy }}>
        {itemName}
      </div>
      {SEGMENTS.map((delta, i) => {
        const theta = -Math.PI / 2 + i * ((2 * Math.PI) / SEGMENTS.length);
        const x = cx + RADIUS * Math.cos(theta);
        const y = cy + RADIUS * Math.sin(theta);
        return (
          <button
            key={delta}
            type="button"
            className={`radial-segment ${delta > 0 ? 'radial-positive' : 'radial-negative'}`}
            style={{ left: x, top: y }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(delta);
            }}
          >
            {delta > 0 ? `+${delta}` : delta}
          </button>
        );
      })}
      <button
        type="button"
        className="radial-action-btn radial-action-delete"
        style={{ left: cx - 45, top: actionY }}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Icon f7="trash" />
      </button>
      <button
        type="button"
        className="radial-action-btn radial-action-edit"
        style={{ left: cx + 45, top: actionY }}
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
      >
        <Icon f7="gear_alt_fill" />
      </button>
    </div>,
    document.body,
  );
}
