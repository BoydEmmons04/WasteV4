import { useEffect, useMemo, useRef, useState } from 'react';
import { Page, Navbar, NavLeft, NavRight, Link, Icon, Toolbar, Block, f7 } from 'framework7-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import {
  subscribeCategories,
  subscribeItems,
  subscribeTalliesForDate,
  fetchOwnStoreCode,
  adjustTally,
  archiveItem,
  reorderItems,
} from '../lib/firestore';
import { useTodayDateString } from '../hooks/useTodayDateString';
import type { Category, Item, DailyTally } from '../types';
import CategoryBar from '../components/CategoryBar';
import TallyGridPager from '../components/TallyGridPager';
import TallyGridReorder from '../components/TallyGridReorder';
import RadialMenu from '../components/RadialMenu';
import ItemFormSheet from '../components/ItemFormSheet';
import SummaryScreen from './SummaryScreen';

interface RadialState {
  item: Item;
  center: { x: number; y: number };
}

interface MainScreenProps {
  // Present only when the admin is viewing this store's grid from the admin
  // panel. Swaps out Sign Out (which would end the admin's own session) for
  // a Back link that just stops impersonating and returns to the account
  // list - everything else about this screen behaves identically either way.
  onExitImpersonation?: () => void;
}

export default function MainScreen({ onExitImpersonation }: MainScreenProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [tallies, setTallies] = useState<DailyTally[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [radial, setRadial] = useState<RadialState | null>(null);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const pendingOrderRef = useRef<string[]>([]);
  const today = useTodayDateString();
  const [storeCode, setStoreCode] = useState<string | null>(null);

  useEffect(() => {
    const unsubCategories = subscribeCategories(setCategories);
    const unsubItems = subscribeItems(setItems);
    return () => {
      unsubCategories();
      unsubItems();
    };
  }, []);

  // One-time lookup, not a live subscription - a store's own code practically
  // never changes on its own (only an admin reset moves it), so this doesn't
  // need to track updates the way categories/items/tallies do.
  useEffect(() => {
    fetchOwnStoreCode()
      .then(setStoreCode)
      .catch(() => setStoreCode(null));
  }, []);

  // Re-subscribes whenever the calendar day rolls over (see
  // useTodayDateString) so a tablet left open overnight starts showing the
  // new day's - empty - tallies instead of yesterday's counts frozen in
  // place.
  useEffect(() => {
    const unsubTallies = subscribeTalliesForDate(today, setTallies);
    return () => unsubTallies();
  }, [today]);

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const tallyByItemId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tally of tallies) map[tally.itemId] = tally.count;
    return map;
  }, [tallies]);

  const visibleItems = useMemo(
    () =>
      items
        .filter((item) => item.categoryId === selectedCategoryId && item.active !== false)
        .sort((a, b) => (typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER) - (typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER)),
    [items, selectedCategoryId],
  );

  const openAddItem = () => {
    setEditingItem(null);
    setItemFormOpen(true);
  };

  const openEditItem = (item: Item) => {
    setEditingItem(item);
    setItemFormOpen(true);
  };

  const handleDelete = (item: Item) => {
    f7.dialog.confirm(`Remove "${item.name}" from the grid?`, 'Delete Item', () => {
      archiveItem(item.id);
    });
  };

  const handleGestureHelp = () => {
    f7.dialog.alert(
      '<b>Tap</b> an item to add 1 to its tally.<br><br>' +
        '<b>Swipe down</b> on an item to remove 1.<br><br>' +
        '<b>Press and hold</b> an item to open the menu for custom amounts, editing, or deleting it.',
      'Gestures',
    );
  };

  const handleReorderToggle = async () => {
    if (savingOrder) return;
    if (!reorderMode) {
      pendingOrderRef.current = visibleItems.map((item) => item.id);
      setReorderMode(true);
      return;
    }
    setSavingOrder(true);
    try {
      await reorderItems(pendingOrderRef.current);
    } finally {
      setSavingOrder(false);
      setReorderMode(false);
    }
  };

  return (
    <Page>
      <Navbar>
        <NavLeft>
          {onExitImpersonation ? (
            <Link className="back-link" onClick={onExitImpersonation}>
              <Icon f7="chevron_left" />
              Back
            </Link>
          ) : (
            <Link className="text-color-red sign-out-link" onClick={() => signOut(auth)}>
              Sign Out
            </Link>
          )}
        </NavLeft>
        <NavRight>
          <Link onClick={handleReorderToggle} className={reorderMode ? 'text-color-green' : undefined}>
            <Icon f7={reorderMode ? 'checkmark_alt_circle_fill' : 'arrow_up_arrow_down'} />
          </Link>
          {!reorderMode && (
            <>
              <Link onClick={() => setSummaryOpen(true)}>
                <Icon f7="chart_bar" />
              </Link>
              <Link onClick={openAddItem} className="add-item-link">
                +
              </Link>
            </>
          )}
          <Link onClick={handleGestureHelp} className="info-link">
            <Icon f7="info_circle" />
          </Link>
        </NavRight>
      </Navbar>

      <div className="main-content-area">
        {storeCode && (
          <div className="store-code-banner">
            Store Code <span>{storeCode}</span>
          </div>
        )}

        <div className="main-grid-area">
          {categories.length === 0 ? (
            <Block className="text-align-center">
              <p>No categories yet.</p>
            </Block>
          ) : reorderMode ? (
            <TallyGridReorder
              key={selectedCategoryId}
              items={visibleItems}
              tallyByItemId={tallyByItemId}
              onOrderChange={(ids) => {
                pendingOrderRef.current = ids;
              }}
            />
          ) : (
            <TallyGridPager
              key={selectedCategoryId}
              items={visibleItems}
              tallyByItemId={tallyByItemId}
              onTap={(item) => adjustTally(item.id, item.categoryId, 1, tallyByItemId[item.id] ?? 0)}
              onLongPress={(item, center) => setRadial({ item, center })}
              onSwipeDown={(item) => adjustTally(item.id, item.categoryId, -1, tallyByItemId[item.id] ?? 0)}
            />
          )}
        </div>
      </div>

      <Toolbar bottom>
        <CategoryBar categories={categories} selectedId={selectedCategoryId} onSelect={setSelectedCategoryId} />
      </Toolbar>

      {radial && (
        <RadialMenu
          center={radial.center}
          itemName={radial.item.name}
          onSelect={(delta) => {
            adjustTally(radial.item.id, radial.item.categoryId, delta, tallyByItemId[radial.item.id] ?? 0);
            setRadial(null);
          }}
          onDelete={() => {
            handleDelete(radial.item);
            setRadial(null);
          }}
          onEdit={() => {
            openEditItem(radial.item);
            setRadial(null);
          }}
          onClose={() => setRadial(null)}
        />
      )}

      <ItemFormSheet
        opened={itemFormOpen}
        onClose={() => setItemFormOpen(false)}
        categories={categories}
        items={items}
        defaultCategoryId={selectedCategoryId}
        editingItem={editingItem}
      />

      <SummaryScreen
        opened={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        categories={categories}
        items={items}
        todaysTallies={tallies}
      />
    </Page>
  );
}
