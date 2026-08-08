import { Popup, Page, Navbar, NavRight, Link, List, ListItem, Block } from 'framework7-react';
import type { Item, DailyTally } from '../types';

interface EndOfDayReportProps {
  opened: boolean;
  onClose: () => void;
  items: Item[];
  tallies: DailyTally[];
}

export default function EndOfDayReport({ opened, onClose, items, tallies }: EndOfDayReportProps) {
  const itemById = new Map(items.map((i) => [i.id, i]));

  const rows = tallies
    .map((t) => {
      const item = itemById.get(t.itemId);
      const price = item && typeof item.price === 'number' ? item.price : 0;
      return {
        itemId: t.itemId,
        name: item?.name ?? 'Unknown item',
        imageUrl: item?.imageUrl ?? '',
        count: t.count,
        value: t.count * price,
      };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.value - a.value);

  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <Popup opened={opened} onPopupClosed={onClose} tabletFullscreen>
      <Page>
        <Navbar title="End of Day">
          <NavRight>
            <Link popupClose>Close</Link>
          </NavRight>
        </Navbar>

        <Block className="end-of-day-total">
          <div className="end-of-day-total-value">${total.toFixed(2)}</div>
          <div className="end-of-day-total-label">Total Waste Today</div>
        </Block>

        <List strongIos outlineIos dividersIos insetIos>
          {rows.length === 0 && <ListItem title="No tallies recorded today." />}
          {rows.map((row) => (
            <ListItem key={row.itemId} title={row.name} after={`${row.count} · $${row.value.toFixed(2)}`}>
              {row.imageUrl && <img slot="media" src={row.imageUrl} className="summary-item-thumb" alt="" />}
            </ListItem>
          ))}
        </List>
      </Page>
    </Popup>
  );
}
