export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface Item {
  id: string;
  name: string;
  imageUrl: string;
  color: string;
  categoryId: string;
  price: number;
  // Position within its category's grid, left-to-right top-to-bottom.
  order: number;
  // Absent/true means active. Edited or deleted items are archived
  // (set to false) rather than removed, so historical tallies that
  // reference them can still resolve a name/price in reports.
  active?: boolean;
}

export interface DailyTally {
  id: string;
  date: string;
  itemId: string;
  categoryId: string;
  count: number;
}
