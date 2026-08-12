import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { getImpersonatedUid } from './adminSession';
import { handleFirestoreError } from './sessionGuard';
import type { Category, Item, DailyTally } from '../types';

// All app data lives under users/{uid}/... so each account's categories,
// items, and tallies are fully isolated from every other account. When the
// admin is viewing a store, every call here targets that store's uid
// instead of the signed-in admin's own uid.
function requireUid(): string {
  const impersonated = getImpersonatedUid();
  if (impersonated) return impersonated;
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

function categoriesCollection() {
  return collection(db, 'users', requireUid(), 'categories');
}

function itemsCollection() {
  return collection(db, 'users', requireUid(), 'items');
}

function talliesCollection() {
  return collection(db, 'users', requireUid(), 'tallies');
}

function itemDocRef(itemId: string) {
  return doc(db, 'users', requireUid(), 'items', itemId);
}

function categoryDocRef(categoryId: string) {
  return doc(db, 'users', requireUid(), 'categories', categoryId);
}

function tallyDocRef(tallyId: string) {
  return doc(db, 'users', requireUid(), 'tallies', tallyId);
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayDateString(): string {
  return toDateString(new Date());
}

export function dateStringDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toDateString(d);
}

// Every date string from start to end inclusive, so a per-day series can be
// zero-filled and read as a continuous timeline instead of only showing the
// days that happened to have activity.
export function enumerateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  while (cursor <= endDate) {
    dates.push(toDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function subscribeCategories(callback: (categories: Category[]) => void) {
  const q = query(categoriesCollection(), orderBy('order', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Category));
    },
    handleFirestoreError,
  );
}

export function subscribeItems(callback: (items: Item[]) => void) {
  return onSnapshot(
    itemsCollection(),
    (snapshot) => {
      callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Item));
    },
    handleFirestoreError,
  );
}

export function subscribeTalliesForDate(date: string, callback: (tallies: DailyTally[]) => void) {
  const q = query(talliesCollection(), where('date', '==', date));
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as DailyTally));
    },
    handleFirestoreError,
  );
}

export async function fetchTalliesInRange(startDate: string, endDate: string): Promise<DailyTally[]> {
  const q = query(talliesCollection(), where('date', '>=', startDate), where('date', '<=', endDate));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as DailyTally);
}

// storeCodes only maps code -> uid, not the reverse, so showing a store its
// own code means querying by uid instead. Uses requireUid() like everything
// else here, so while the admin is viewing a store this correctly resolves
// to that store's code rather than looking for one belonging to the admin
// account itself (which has none).
export async function fetchOwnStoreCode(): Promise<string | null> {
  const q = query(collection(db, 'storeCodes'), where('uid', '==', requireUid()));
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : snapshot.docs[0].id;
}

export async function addCategory(name: string) {
  await addDoc(categoriesCollection(), {
    name,
    order: Date.now(),
  });
}

export async function deleteCategory(categoryId: string) {
  await deleteDoc(categoryDocRef(categoryId));
}

export interface ItemFormData {
  name: string;
  color: string;
  categoryId: string;
  imageUrl: string;
  price: number;
}

export async function addItem(data: ItemFormData, order: number) {
  await addDoc(itemsCollection(), { ...data, order, active: true, createdAt: serverTimestamp() });
}

// Edits are never applied in place: the old item doc is archived (kept, but
// hidden from the live grid) so tallies already recorded against it keep
// resolving to the name/price/image that were true when they happened, and
// a new item doc carries the edited fields forward from now on. The new
// doc keeps the old item's grid position rather than jumping to the end.
export async function editItem(oldItem: Item, data: ItemFormData) {
  await updateDoc(itemDocRef(oldItem.id), { active: false });
  await addDoc(itemsCollection(), { ...data, order: oldItem.order, active: true, createdAt: serverTimestamp() });
}

// Soft-delete: archives the item instead of removing the Firestore doc, so
// past tallies against it keep resolving correctly in summary reports.
export async function archiveItem(itemId: string) {
  await updateDoc(itemDocRef(itemId), { active: false });
}

// Reactivates an archived item's original doc (rather than creating a new
// one) so historical tallies - which reference it by doc id - stay linked
// to the item that's reappearing. createdAt is bumped so a restored item
// reads as newly active rather than keeping its original creation date.
export async function restoreItem(itemId: string, order: number) {
  await updateDoc(itemDocRef(itemId), { active: true, order, createdAt: serverTimestamp() });
}

// Persists a new left-to-right, top-to-bottom order for a set of items
// (typically one category's worth) so drag-reordering stays in sync across
// every signed-in instance of the account.
export async function reorderItems(orderedItemIds: string[]) {
  const batch = writeBatch(db);
  orderedItemIds.forEach((id, index) => {
    batch.update(itemDocRef(id), { order: index });
  });
  await batch.commit();
}

// A plain increment() write applies to Firestore's local cache immediately
// (the UI updates before the network round-trip completes); a transaction
// cannot do that; it must contact the server for a consistent read before
// committing, which is what made every tap feel laggy. To still keep counts
// from going negative without paying for a transaction, the delta is
// clamped against the caller's already-known current count (from the same
// onSnapshot-driven state the grid renders from) before it's sent.
export async function adjustTally(itemId: string, categoryId: string, delta: number, currentCount: number) {
  const clampedDelta = Math.max(delta, -currentCount);
  if (clampedDelta === 0) return;

  const date = todayDateString();
  const tallyRef = tallyDocRef(`${date}_${itemId}`);
  await setDoc(
    tallyRef,
    {
      date,
      itemId,
      categoryId,
      count: increment(clampedDelta),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
