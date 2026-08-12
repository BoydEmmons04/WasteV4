import { useMemo, useState } from 'react';
import { Popup, Page, Navbar, NavRight, Link, Block, Button, Preloader, f7 } from 'framework7-react';
import { restoreItem } from '../lib/firestore';
import type { Category, Item } from '../types';

interface RestoreItemsPopupProps {
  opened: boolean;
  onClose: () => void;
  items: Item[];
  categories: Category[];
  // Fires after a successful restore so the parent Add Item sheet can also
  // close - the item is already live on the grid at that point, so there's
  // nothing left for the add form to do.
  onRestored: () => void;
}

function createdAtMillis(item: Item): number {
  return item.createdAt ? item.createdAt.toMillis() : 0;
}

export default function RestoreItemsPopup({ opened, onClose, items, categories, onRestored }: RestoreItemsPopupProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  // Only the newest archived doc per name is shown - an item edited several
  // times before being archived would otherwise appear as several
  // near-duplicate rows reflecting its edit history.
  const restorable = useMemo(() => {
    const byName = new Map<string, Item>();
    for (const item of items) {
      if (item.active !== false) continue;
      const key = item.name.trim().toLowerCase();
      const existing = byName.get(key);
      if (!existing || createdAtMillis(item) > createdAtMillis(existing)) {
        byName.set(key, item);
      }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const handleRestore = async (item: Item) => {
    setBusyId(item.id);
    setError('');
    try {
      const maxOrder = items
        .filter((i) => i.categoryId === item.categoryId && i.active !== false)
        .reduce((max, i) => Math.max(max, typeof i.order === 'number' ? i.order : -1), -1);
      await restoreItem(item.id, maxOrder + 1);
      onRestored();
    } catch (err) {
      f7.dialog.alert(err instanceof Error ? err.message : 'Could not restore that item.', 'Error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Popup opened={opened} onPopupClosed={onClose} tabletFullscreen>
      <Page>
        <Navbar title="Restore Items">
          <NavRight>
            <Link popupClose>Close</Link>
          </NavRight>
        </Navbar>

        {restorable.length === 0 ? (
          <Block className="text-align-center">
            <p>No archived items to restore.</p>
          </Block>
        ) : (
          <Block>
            {restorable.map((item) => (
              <div key={item.id} className="template-card">
                <div className="restore-item-row">
                  {item.imageUrl && <img src={item.imageUrl} className="summary-item-thumb" alt="" />}
                  <div>
                    <div className="template-card-label">{item.name}</div>
                    <div className="template-card-meta">
                      {categoryNameById.get(item.categoryId) ?? 'Unknown category'} · ${(item.price ?? 0).toFixed(2)}
                    </div>
                  </div>
                </div>
                <Button small fill round disabled={busyId !== null} onClick={() => handleRestore(item)}>
                  {busyId === item.id ? <Preloader color="white" /> : 'Restore'}
                </Button>
              </div>
            ))}
          </Block>
        )}

        {error && (
          <Block className="text-align-center" style={{ color: 'var(--f7-color-red)' }}>
            {error}
          </Block>
        )}
      </Page>
    </Popup>
  );
}
