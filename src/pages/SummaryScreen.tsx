import { useEffect, useMemo, useState } from 'react';
import { Popup, Page, Navbar, NavRight, Link, Block, BlockTitle, List, ListItem, Button, Preloader, f7 } from 'framework7-react';
import { fetchTalliesInRange, todayDateString, dateStringDaysAgo } from '../lib/firestore';
import { publishTemplate } from '../lib/templates';
import type { Category, Item, DailyTally } from '../types';
import EndOfDayReport from '../components/EndOfDayReport';

interface SummaryScreenProps {
  opened: boolean;
  onClose: () => void;
  categories: Category[];
  items: Item[];
  todaysTallies: DailyTally[];
}

export default function SummaryScreen({ opened, onClose, categories, items, todaysTallies }: SummaryScreenProps) {
  const [start, setStart] = useState(todayDateString());
  const [end, setEnd] = useState(todayDateString());
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [tallies, setTallies] = useState<DailyTally[]>([]);
  const [loading, setLoading] = useState(false);
  const [endOfDayOpen, setEndOfDayOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    setSelectedCategoryIds(new Set(categories.map((c) => c.id)));
  }, [categories]);

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    fetchTalliesInRange(start, end)
      .then(setTallies)
      .finally(() => setLoading(false));
  }, [opened, start, end]);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const filteredTallies = useMemo(
    () => tallies.filter((t) => selectedCategoryIds.has(t.categoryId)),
    [tallies, selectedCategoryIds],
  );

  const { grandCount, grandValue, byItem, byDay } = useMemo(() => {
    let count = 0;
    let value = 0;
    const itemMap = new Map<string, { count: number; value: number }>();
    const dayMap = new Map<string, { count: number; value: number }>();

    for (const t of filteredTallies) {
      const item = itemById.get(t.itemId);
      const price = item && typeof item.price === 'number' ? item.price : 0;
      const rowValue = t.count * price;
      count += t.count;
      value += rowValue;

      const itemEntry = itemMap.get(t.itemId) ?? { count: 0, value: 0 };
      itemEntry.count += t.count;
      itemEntry.value += rowValue;
      itemMap.set(t.itemId, itemEntry);

      const dayEntry = dayMap.get(t.date) ?? { count: 0, value: 0 };
      dayEntry.count += t.count;
      dayEntry.value += rowValue;
      dayMap.set(t.date, dayEntry);
    }

    const byItem = [...itemMap.entries()]
      .map(([itemId, agg]) => ({
        itemId,
        name: itemById.get(itemId)?.name ?? 'Unknown item',
        imageUrl: itemById.get(itemId)?.imageUrl ?? '',
        ...agg,
      }))
      .sort((a, b) => b.value - a.value);

    const byDay = [...dayMap.entries()]
      .map(([date, agg]) => ({ date, ...agg }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    return { grandCount: count, grandValue: value, byItem, byDay };
  }, [filteredTallies, itemById]);

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setPreset = (days: number) => {
    setStart(dateStringDaysAgo(days - 1));
    setEnd(todayDateString());
  };

  const handlePublish = () => {
    f7.dialog.prompt(
      'Name this template (shown to other users at sign-up)',
      'Publish Items & Categories',
      async (label) => {
        const trimmed = label.trim();
        if (!trimmed) return;
        setPublishing(true);
        try {
          await publishTemplate(trimmed);
          f7.dialog.alert('New accounts can now copy your items and categories when they sign up.', 'Published');
        } catch (err) {
          f7.dialog.alert(err instanceof Error ? err.message : 'Could not publish.', 'Error');
        } finally {
          setPublishing(false);
        }
      },
    );
  };

  return (
    <Popup opened={opened} onPopupClosed={onClose} tabletFullscreen>
      <Page>
        <Navbar title="Summary">
          <NavRight>
            <Link popupClose>Close</Link>
          </NavRight>
        </Navbar>

        <Block>
          <Button large fill round onClick={() => setEndOfDayOpen(true)}>
            Generate Daily Report
          </Button>
        </Block>
        <Block>
          <Button large outline round disabled={publishing} onClick={handlePublish}>
            {publishing ? <Preloader /> : 'Publish Items & Categories'}
          </Button>
        </Block>

        <BlockTitle>Date Range</BlockTitle>
        <Block className="summary-date-row">
          <input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} />
          <span>to</span>
          <input type="date" value={end} min={start} max={todayDateString()} onChange={(e) => setEnd(e.target.value)} />
        </Block>
        <Block className="summary-preset-row">
          <Button small round outline onClick={() => setPreset(1)}>
            Today
          </Button>
          <Button small round outline onClick={() => setPreset(7)}>
            7 Days
          </Button>
          <Button small round outline onClick={() => setPreset(30)}>
            30 Days
          </Button>
        </Block>

        <BlockTitle>Categories</BlockTitle>
        <div className="category-bar-cell summary-category-row">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`category-chip${selectedCategoryIds.has(cat.id) ? ' category-chip-active' : ''}`}
              onClick={() => toggleCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {loading ? (
          <Block className="text-align-center">
            <Preloader />
          </Block>
        ) : (
          <>
            <Block strong inset className="summary-totals-card">
              <div>
                <div className="summary-total-value">{grandCount}</div>
                <div className="summary-total-label">Items Wasted</div>
              </div>
              <div>
                <div className="summary-total-value">${grandValue.toFixed(2)}</div>
                <div className="summary-total-label">Total Value</div>
              </div>
            </Block>

            <BlockTitle>By Item</BlockTitle>
            <List strongIos outlineIos dividersIos insetIos>
              {byItem.length === 0 && <ListItem title="No data for this range." />}
              {byItem.map((row) => (
                <ListItem key={row.itemId} title={row.name} after={`${row.count} · $${row.value.toFixed(2)}`}>
                  {row.imageUrl && <img slot="media" src={row.imageUrl} className="summary-item-thumb" alt="" />}
                </ListItem>
              ))}
            </List>

            <BlockTitle>By Day</BlockTitle>
            <List strongIos outlineIos dividersIos insetIos>
              {byDay.length === 0 && <ListItem title="No data for this range." />}
              {byDay.map((row) => (
                <ListItem key={row.date} title={row.date} after={`${row.count} · $${row.value.toFixed(2)}`} />
              ))}
            </List>
          </>
        )}
      </Page>

      <EndOfDayReport opened={endOfDayOpen} onClose={() => setEndOfDayOpen(false)} items={items} tallies={todaysTallies} />
    </Popup>
  );
}
