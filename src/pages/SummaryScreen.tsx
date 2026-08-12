import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Popup,
  Page,
  Navbar,
  NavRight,
  Link,
  Block,
  BlockTitle,
  List,
  ListItem,
  AccordionContent,
  Button,
  Preloader,
  f7,
} from 'framework7-react';
import { fetchTalliesInRange, todayDateString, dateStringDaysAgo, enumerateDateRange } from '../lib/firestore';
import { publishTemplate } from '../lib/templates';
import { exportSummaryCsv, exportSummaryPdf } from '../lib/exportReport';
import type { Category, Item, DailyTally } from '../types';
import EndOfDayReport from '../components/EndOfDayReport';
import ItemTrendChart from '../components/ItemTrendChart';

function pctChange(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? '0%' : '+∞%';
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`;
}

interface SummaryScreenProps {
  opened: boolean;
  onClose: () => void;
  categories: Category[];
  items: Item[];
  todaysTallies: DailyTally[];
  storeCode?: string | null;
}

export default function SummaryScreen({ opened, onClose, categories, items, todaysTallies, storeCode }: SummaryScreenProps) {
  const [start, setStart] = useState(todayDateString());
  const [end, setEnd] = useState(todayDateString());
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [tallies, setTallies] = useState<DailyTally[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [endOfDayOpen, setEndOfDayOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const requestIdRef = useRef(0);

  const [compareMode, setCompareMode] = useState<'off' | 'week' | 'month'>('off');
  const [compareTallies, setCompareTallies] = useState<{ current: DailyTally[]; previous: DailyTally[] } | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState('');
  const compareRequestIdRef = useRef(0);

  useEffect(() => {
    setSelectedCategoryIds(new Set(categories.map((c) => c.id)));
  }, [categories]);

  // A flaky mobile connection can leave a plain getDocs() hanging far
  // longer than feels like "loading" - race it against a timeout so the
  // user gets an explicit error + retry instead of a spinner that never
  // resolves. requestIdRef guards against a slow, now-superseded request
  // (e.g. from a date range the user already changed away from) landing
  // after a newer one and clobbering fresher data or flipping loading back
  // on/off out of order.
  const loadTallies = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setFetchError('');
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Taking longer than expected. Check your connection and try again.')), 12000);
    });
    Promise.race([fetchTalliesInRange(start, end), timeout])
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        setTallies(result);
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return;
        setFetchError(err instanceof Error ? err.message : 'Could not load summary data.');
      })
      .finally(() => {
        if (requestIdRef.current !== requestId) return;
        setLoading(false);
      });
  }, [start, end]);

  useEffect(() => {
    if (!opened) return;
    loadTallies();
  }, [opened, loadTallies]);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const filteredTallies = useMemo(
    () => tallies.filter((t) => selectedCategoryIds.has(t.categoryId)),
    [tallies, selectedCategoryIds],
  );

  const { grandCount, grandValue, byItem, byDay, perItemByDay } = useMemo(() => {
    let count = 0;
    let value = 0;
    const itemMap = new Map<string, { count: number; value: number }>();
    const dayMap = new Map<string, { count: number; value: number }>();
    const perItemDayMap = new Map<string, Map<string, { count: number; value: number }>>();

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

      let itemDayMap = perItemDayMap.get(t.itemId);
      if (!itemDayMap) {
        itemDayMap = new Map();
        perItemDayMap.set(t.itemId, itemDayMap);
      }
      const perDayEntry = itemDayMap.get(t.date) ?? { count: 0, value: 0 };
      perDayEntry.count += t.count;
      perDayEntry.value += rowValue;
      itemDayMap.set(t.date, perDayEntry);
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

    // Zero-filled, chronological per-item series for the trend chart/log in
    // each By Item row's dropdown.
    const allDates = enumerateDateRange(start, end);
    const perItemByDay = new Map<string, { date: string; count: number; value: number }[]>();
    for (const [itemId, dayMapForItem] of perItemDayMap) {
      perItemByDay.set(
        itemId,
        allDates.map((date) => {
          const entry = dayMapForItem.get(date);
          return { date, count: entry?.count ?? 0, value: entry?.value ?? 0 };
        }),
      );
    }

    return { grandCount: count, grandValue: value, byItem, byDay, perItemByDay };
  }, [filteredTallies, itemById, start, end]);

  // Rolling windows (last 7/30 days vs the 7/30 days immediately before
  // that) rather than calendar week/month boundaries - avoids uneven-month
  // edge cases and matches the Today/7 Days/30 Days presets already used
  // for the main date range above.
  const compareWindows = useMemo(() => {
    if (compareMode === 'week') {
      return {
        currentStart: dateStringDaysAgo(6),
        currentEnd: todayDateString(),
        previousStart: dateStringDaysAgo(13),
        previousEnd: dateStringDaysAgo(7),
        label: '7 Days',
      };
    }
    if (compareMode === 'month') {
      return {
        currentStart: dateStringDaysAgo(29),
        currentEnd: todayDateString(),
        previousStart: dateStringDaysAgo(59),
        previousEnd: dateStringDaysAgo(30),
        label: '30 Days',
      };
    }
    return null;
  }, [compareMode]);

  useEffect(() => {
    if (!opened || !compareWindows) {
      setCompareTallies(null);
      setCompareError('');
      return;
    }
    const requestId = ++compareRequestIdRef.current;
    setCompareLoading(true);
    setCompareError('');
    Promise.all([
      fetchTalliesInRange(compareWindows.currentStart, compareWindows.currentEnd),
      fetchTalliesInRange(compareWindows.previousStart, compareWindows.previousEnd),
    ])
      .then(([current, previous]) => {
        if (compareRequestIdRef.current !== requestId) return;
        setCompareTallies({ current, previous });
      })
      .catch((err) => {
        if (compareRequestIdRef.current !== requestId) return;
        setCompareError(err instanceof Error ? err.message : 'Could not load comparison data.');
      })
      .finally(() => {
        if (compareRequestIdRef.current !== requestId) return;
        setCompareLoading(false);
      });
  }, [opened, compareWindows]);

  const compareStats = useMemo(() => {
    if (!compareTallies) return null;

    const aggregate = (rows: DailyTally[]) => {
      let count = 0;
      let value = 0;
      const itemMap = new Map<string, { count: number; value: number }>();
      for (const t of rows) {
        if (!selectedCategoryIds.has(t.categoryId)) continue;
        const item = itemById.get(t.itemId);
        const price = item && typeof item.price === 'number' ? item.price : 0;
        const rowValue = t.count * price;
        count += t.count;
        value += rowValue;
        const entry = itemMap.get(t.itemId) ?? { count: 0, value: 0 };
        entry.count += t.count;
        entry.value += rowValue;
        itemMap.set(t.itemId, entry);
      }
      return { count, value, itemMap };
    };

    const current = aggregate(compareTallies.current);
    const previous = aggregate(compareTallies.previous);

    const itemIds = new Set([...current.itemMap.keys(), ...previous.itemMap.keys()]);
    const items = [...itemIds]
      .map((itemId) => {
        const curr = current.itemMap.get(itemId) ?? { count: 0, value: 0 };
        const prev = previous.itemMap.get(itemId) ?? { count: 0, value: 0 };
        return {
          itemId,
          name: itemById.get(itemId)?.name ?? 'Unknown item',
          currentCount: curr.count,
          currentValue: curr.value,
          previousCount: prev.count,
          previousValue: prev.value,
        };
      })
      .sort((a, b) => Math.abs(b.currentValue - b.previousValue) - Math.abs(a.currentValue - a.previousValue));

    return {
      currentCount: current.count,
      currentValue: current.value,
      previousCount: previous.count,
      previousValue: previous.value,
      items,
    };
  }, [compareTallies, selectedCategoryIds, itemById]);

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

  const exportData = () => ({
    storeCode,
    start,
    end,
    grandCount,
    grandValue,
    byItem: byItem.map((row) => ({ name: row.name, count: row.count, value: row.value })),
    byDay,
  });

  const handleExportCsv = () => exportSummaryCsv(exportData());
  const handleExportPdf = () => exportSummaryPdf(exportData());

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

        <BlockTitle>Compare</BlockTitle>
        <Block className="summary-preset-row">
          <Button small round fill={compareMode === 'off'} outline={compareMode !== 'off'} onClick={() => setCompareMode('off')}>
            Off
          </Button>
          <Button small round fill={compareMode === 'week'} outline={compareMode !== 'week'} onClick={() => setCompareMode('week')}>
            7d vs 7d
          </Button>
          <Button small round fill={compareMode === 'month'} outline={compareMode !== 'month'} onClick={() => setCompareMode('month')}>
            30d vs 30d
          </Button>
        </Block>

        {compareMode !== 'off' &&
          (compareLoading ? (
            <Block className="text-align-center">
              <Preloader />
            </Block>
          ) : compareError ? (
            <Block className="text-align-center">
              <p style={{ color: 'var(--f7-color-red)' }}>{compareError}</p>
            </Block>
          ) : (
            compareStats && (
              <>
                <Block strong inset className="summary-totals-card compare-totals-card">
                  <div>
                    <div className="summary-total-value">{compareStats.currentCount}</div>
                    <div className="summary-total-label">This {compareWindows?.label}</div>
                  </div>
                  <div>
                    <div className="summary-total-value">{compareStats.previousCount}</div>
                    <div className="summary-total-label">Prior {compareWindows?.label}</div>
                  </div>
                  <div>
                    <div className="summary-total-value">{pctChange(compareStats.currentValue, compareStats.previousValue)}</div>
                    <div className="summary-total-label">Value Change</div>
                  </div>
                </Block>
                <List strongIos outlineIos dividersIos insetIos>
                  {compareStats.items.length === 0 && <ListItem title="No data in either period." />}
                  {compareStats.items.map((row) => (
                    <ListItem
                      key={row.itemId}
                      title={row.name}
                      after={pctChange(row.currentValue, row.previousValue)}
                      subtitle={`${row.currentCount} vs ${row.previousCount} · $${row.currentValue.toFixed(2)} vs $${row.previousValue.toFixed(2)}`}
                    />
                  ))}
                </List>
              </>
            )
          ))}

        {loading ? (
          <Block className="text-align-center">
            <Preloader />
          </Block>
        ) : fetchError ? (
          <Block className="text-align-center">
            <p style={{ color: 'var(--f7-color-red)' }}>{fetchError}</p>
            <Button small outline round onClick={loadTallies}>
              Retry
            </Button>
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

            <Block className="summary-export-row">
              <Button small round outline onClick={handleExportCsv}>
                Export CSV
              </Button>
              <Button small round outline onClick={handleExportPdf}>
                Export PDF
              </Button>
            </Block>

            <BlockTitle>By Item</BlockTitle>
            <List strongIos outlineIos dividersIos insetIos accordionList>
              {byItem.length === 0 && <ListItem title="No data for this range." />}
              {byItem.map((row) => {
                const series = perItemByDay.get(row.itemId) ?? [];
                const nonZeroDays = series.filter((p) => p.count > 0);
                return (
                  <ListItem key={row.itemId} accordionItem title={row.name} after={`${row.count} · $${row.value.toFixed(2)}`}>
                    {row.imageUrl && <img slot="media" src={row.imageUrl} className="summary-item-thumb" alt="" />}
                    <AccordionContent>
                      <Block className="item-trend-block">
                        <ItemTrendChart data={series} />
                        {nonZeroDays.length === 0 ? (
                          <p className="item-trend-empty">No activity for this item in the selected range.</p>
                        ) : (
                          <List strongIos outlineIos dividersIos insetIos className="item-trend-log">
                            {nonZeroDays
                              .slice()
                              .sort((a, b) => (a.date < b.date ? 1 : -1))
                              .map((day) => (
                                <ListItem key={day.date} title={day.date} after={`${day.count} · $${day.value.toFixed(2)}`} />
                              ))}
                          </List>
                        )}
                      </Block>
                    </AccordionContent>
                  </ListItem>
                );
              })}
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
