import { f7 } from 'framework7-react';
import { addCategory, deleteCategory } from '../lib/firestore';
import { useItemGesture } from '../hooks/useItemGesture';
import type { Category } from '../types';

const MAX_CATEGORIES = 7;

interface CategoryBarProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface CategoryChipProps {
  category: Category;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function CategoryChip({ category, active, onSelect, onDelete }: CategoryChipProps) {
  const gesture = useItemGesture({ onTap: onSelect, onLongPress: onDelete });

  return (
    <button
      type="button"
      className={`category-chip${active ? ' category-chip-active' : ''}`}
      {...gesture}
    >
      {category.name}
    </button>
  );
}

export default function CategoryBar({ categories, selectedId, onSelect }: CategoryBarProps) {
  const handleAddCategory = () => {
    if (categories.length >= MAX_CATEGORIES) {
      f7.dialog.alert(`You can only have up to ${MAX_CATEGORIES} categories.`, 'Limit Reached');
      return;
    }
    f7.dialog.prompt('New category name', 'Add Category', (name) => {
      const trimmed = name.trim();
      if (trimmed) addCategory(trimmed);
    });
  };

  const handleDeleteCategory = (category: Category) => {
    f7.dialog.confirm(
      `Delete "${category.name}"? Its items will no longer appear on the grid.`,
      'Delete Category',
      () => {
        deleteCategory(category.id);
        if (category.id === selectedId) {
          const remaining = categories.filter((c) => c.id !== category.id);
          if (remaining.length > 0) onSelect(remaining[0].id);
        }
      },
    );
  };

  return (
    <div className="category-bar-row">
      <div className="category-bar-cell">
        {categories.map((category) => (
          <CategoryChip
            key={category.id}
            category={category}
            active={category.id === selectedId}
            onSelect={() => onSelect(category.id)}
            onDelete={() => handleDeleteCategory(category)}
          />
        ))}
      </div>
      <button type="button" className="category-chip-add" onClick={handleAddCategory}>
        +
      </button>
    </div>
  );
}
