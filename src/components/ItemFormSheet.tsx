import { useEffect, useRef, useState } from 'react';
import { Popup, Page, Navbar, NavRight, Link, List, ListInput, Block, BlockTitle, Button, Preloader } from 'framework7-react';
import { compressImageToDataUrl } from '../lib/image';
import { addItem, editItem } from '../lib/firestore';
import RestoreItemsPopup from './RestoreItemsPopup';
import type { Category, Item } from '../types';

const COLORS = [
  '#ff3b30',
  '#ff9500',
  '#ffcc00',
  '#34c759',
  '#00c7be',
  '#30b0c7',
  '#007aff',
  '#5856d6',
  '#af52de',
  '#ff2d55',
];

interface ItemFormSheetProps {
  opened: boolean;
  onClose: () => void;
  categories: Category[];
  items: Item[];
  defaultCategoryId: string | null;
  editingItem?: Item | null;
}

export default function ItemFormSheet({ opened, onClose, categories, items, defaultCategoryId, editingItem }: ItemFormSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(defaultCategoryId);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [restoreOpen, setRestoreOpen] = useState(false);

  const isEditing = !!editingItem;
  const hasArchivedItems = items.some((i) => i.active === false);

  useEffect(() => {
    if (!opened) return;
    if (editingItem) {
      setName(editingItem.name);
      setPrice(typeof editingItem.price === 'number' ? String(editingItem.price) : '');
      setColor(editingItem.color);
      setCategoryId(editingItem.categoryId);
      setImageDataUrl(editingItem.imageUrl || null);
    } else {
      setName('');
      setPrice('');
      setColor(null);
      setCategoryId(defaultCategoryId);
      setImageDataUrl(null);
    }
    setError('');
    setCompressing(false);
  }, [opened, editingItem, defaultCategoryId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected) return;
    setError('');
    setCompressing(true);
    try {
      // Compress immediately and only ever hold/render the small downscaled
      // copy - rendering a raw multi-megapixel phone photo in the preview
      // can exhaust memory and crash the page on mobile browsers.
      const dataUrl = await compressImageToDataUrl(selected);
      setImageDataUrl(dataUrl);
    } catch {
      setError('Could not process that photo. Try a different one.');
    } finally {
      setCompressing(false);
    }
  };

  const canSubmit = name.trim() && color && categoryId && imageDataUrl && !saving && !compressing;

  const handleSubmit = async () => {
    if (!canSubmit || !imageDataUrl || !color || !categoryId) return;
    setSaving(true);
    setError('');
    try {
      const parsedPrice = Number.parseFloat(price);
      const data = {
        name: name.trim(),
        color,
        categoryId,
        imageUrl: imageDataUrl,
        price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
      };
      if (editingItem) {
        await editItem(editingItem, data);
      } else {
        // New items always land at the end of their category's order.
        const maxOrder = items
          .filter((i) => i.categoryId === categoryId)
          .reduce((max, i) => Math.max(max, typeof i.order === 'number' ? i.order : -1), -1);
        await addItem(data, maxOrder + 1);
      }
      // Closing the popup while a text input is still focused (mobile
      // keyboard still up) can leave the page mis-rendered until reload -
      // dismiss focus first so the popup closes from a settled layout.
      // Deferring the actual close to the next frame gives that blur's own
      // DOM work (F7's ListInput does some internal cleanup on blur) a
      // clean tick to finish before the popup-close/grid-update commit
      // starts, instead of both racing to touch the DOM in the same tick.
      (document.activeElement as HTMLElement | null)?.blur();
      requestAnimationFrame(() => onClose());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popup opened={opened} onPopupClosed={onClose} tabletFullscreen>
      <Page>
        <Navbar title={isEditing ? 'Edit Item' : 'Add Item'}>
          <NavRight>
            <Link popupClose>Cancel</Link>
          </NavRight>
        </Navbar>

        {!isEditing && hasArchivedItems && (
          <Block className="text-align-center">
            <Button outline round onClick={() => setRestoreOpen(true)}>
              Restore an Archived Item
            </Button>
          </Block>
        )}

        <Block className="text-align-center">
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          <div className="add-item-image-picker" onClick={() => fileInputRef.current?.click()}>
            {compressing ? <Preloader /> : imageDataUrl ? <img src={imageDataUrl} alt="" /> : <span>Add Photo</span>}
          </div>
        </Block>

        <List strongIos outlineIos dividersIos insetIos>
          <ListInput label="Name" type="text" placeholder="Item name" value={name} onInput={(e) => setName(e.target.value)} />
          <ListInput
            label="Price"
            type="number"
            inputmode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={price}
            onInput={(e) => setPrice(e.target.value)}
          />
        </List>

        <BlockTitle>Category</BlockTitle>
        <div className="category-bar-cell add-item-picker-row">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`category-chip${cat.id === categoryId ? ' category-chip-active' : ''}`}
              onClick={() => setCategoryId(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <BlockTitle>Color</BlockTitle>
        <Block className="add-item-color-row">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`add-item-swatch${c === color ? ' add-item-swatch-active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
          <label
            className={`add-item-swatch add-item-swatch-custom${color && !COLORS.includes(color) ? ' add-item-swatch-active' : ''}`}
            style={color && !COLORS.includes(color) ? { backgroundColor: color } : undefined}
          >
            {!color || COLORS.includes(color) ? '+' : ''}
            <input type="color" value={color ?? '#888888'} onChange={(e) => setColor(e.target.value)} />
          </label>
        </Block>

        {error && (
          <Block className="text-align-center" style={{ color: 'var(--f7-color-red)' }}>
            {error}
          </Block>
        )}

        <Block>
          <Button large fill round disabled={!canSubmit} onClick={handleSubmit}>
            {saving ? <Preloader color="white" /> : isEditing ? 'Save Changes' : 'Add Item'}
          </Button>
        </Block>
      </Page>

      {!isEditing && (
        <RestoreItemsPopup
          opened={restoreOpen}
          onClose={() => setRestoreOpen(false)}
          items={items}
          categories={categories}
          onRestored={() => {
            setRestoreOpen(false);
            requestAnimationFrame(() => onClose());
          }}
        />
      )}
    </Popup>
  );
}
