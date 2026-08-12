import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type CollectionReference,
} from 'firebase/firestore';
import { db } from '../firebase';
import { dateStringDaysAgo } from './firestore';
import { logAdminAction } from './auditLog';

export interface DailyUsagePoint {
  date: string;
  count: number;
}

export interface AdminAccount {
  code: string;
  // The real Firebase Auth email this account was registered with - login
  // looks this up and signs in with it internally (the user never types
  // it), so it must never be edited without also actually changing the
  // Firebase Auth account's email, which isn't possible from the client
  // without the Admin SDK. Immutable from the admin panel for that reason.
  authEmail: string;
  // Admin-editable contact email shown/edited in the UI. Falls back to
  // authEmail until an admin sets one explicitly.
  contactEmail: string;
  uid: string;
}

export async function listAccounts(): Promise<AdminAccount[]> {
  const snap = await getDocs(collection(db, 'storeCodes'));
  return snap.docs
    .map((d) => {
      const data = d.data();
      const authEmail = data.email as string;
      return {
        code: d.id,
        authEmail,
        contactEmail: typeof data.contactEmail === 'string' ? data.contactEmail : authEmail,
        uid: data.uid as string,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

// Moves a store's login to a new code without ever touching its real
// Firebase Auth password (not possible from the client for any account but
// your own) - it carries forward whatever code that password was actually
// derived from, so login keeps working under the new code.
export async function resetStoreCode(oldCode: string, newCode: string): Promise<void> {
  const oldRef = doc(db, 'storeCodes', oldCode);
  const oldSnap = await getDoc(oldRef);
  if (!oldSnap.exists()) throw new Error('Original store code not found.');
  const data = oldSnap.data();

  const newRef = doc(db, 'storeCodes', newCode);
  const newSnap = await getDoc(newRef);
  if (newSnap.exists()) throw new Error('That store code is already taken.');

  const authSecret = typeof data.authSecret === 'string' ? data.authSecret : oldCode;
  const newDoc: Record<string, unknown> = { email: data.email, uid: data.uid, authSecret, createdAt: serverTimestamp() };
  if (typeof data.contactEmail === 'string') newDoc.contactEmail = data.contactEmail;
  await setDoc(newRef, newDoc);
  await deleteDoc(oldRef);
  await logAdminAction('Reset Code', `${oldCode} -> ${newCode}`, newCode);
}

// Updates only the contact email on file for a store code - shown in the
// admin panel for reference, e.g. who to call about a given store. This
// cannot change the account's real Firebase Auth email (that requires the
// Admin SDK, which isn't available here), so it's kept in a separate field
// from the one login actually signs in with - overwriting that one instead
// would silently break the store's ability to log in, since Firebase Auth's
// real record never moves with it.
export async function changeAccountEmailOnFile(code: string, newContactEmail: string): Promise<void> {
  await updateDoc(doc(db, 'storeCodes', code), { contactEmail: newContactEmail });
  await logAdminAction('Edit Email', `Set contact email to ${newContactEmail}`, code);
}

// One store's total items tallied per day over the last `days` days
// (oldest first), zero-filled for days with no activity so the chart has a
// continuous x-axis. Only reads a store's tallies when its usage chart is
// actually opened in the admin panel, not eagerly for the whole account
// list, since a wide range can touch a lot of documents.
export async function fetchDailyTotalsForAccount(uid: string, days: number): Promise<DailyUsagePoint[]> {
  const startDate = dateStringDaysAgo(days - 1);
  const endDate = dateStringDaysAgo(0);
  const q = query(
    collection(db, 'users', uid, 'tallies'),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
  );
  const snap = await getDocs(q);

  const totals = new Map<string, number>();
  snap.docs.forEach((d) => {
    const data = d.data();
    const date = data.date as string;
    const count = typeof data.count === 'number' ? data.count : 0;
    totals.set(date, (totals.get(date) ?? 0) + count);
  });

  const result: DailyUsagePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = dateStringDaysAgo(i);
    result.push({ date, count: totals.get(date) ?? 0 });
  }
  return result;
}

// Firestore batches cap at 500 writes, so a store with more tally history
// than that needs its deletes split across multiple batches.
async function deleteAllDocs(colRef: CollectionReference): Promise<void> {
  const snap = await getDocs(colRef);
  const refs = snap.docs.map((d) => d.ref);
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

// Wipes a store's categories, items, and tally history, then frees up its
// code so it can be reassigned. The underlying Firebase Auth account isn't
// deleted - that isn't possible from the client without the Admin SDK - but
// with no code pointing to it anymore, it's inert: nothing in the app can
// look it up or derive its password from a code again.
export async function deleteAccount(code: string, uid: string): Promise<void> {
  await deleteAllDocs(collection(db, 'users', uid, 'categories'));
  await deleteAllDocs(collection(db, 'users', uid, 'items'));
  await deleteAllDocs(collection(db, 'users', uid, 'tallies'));
  await deleteDoc(doc(db, 'storeCodes', code));
  await logAdminAction('Delete Store', `Erased store ${code} (uid ${uid})`, code);
}
