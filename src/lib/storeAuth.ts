import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Firebase requires passwords to be at least 6 characters, but store codes
// are only 5 digits. This deterministically expands a code into something
// Firebase will accept, without the user ever seeing or typing it - it
// isn't meant to add security on its own; the store code itself IS the
// credential, by explicit design (no sensitive data lives in this app).
export function codeToAuthPassword(code: string): string {
  return `wa-store-${code}`;
}

function storeCodeRef(code: string) {
  return doc(db, 'storeCodes', code);
}

export async function isStoreCodeTaken(code: string): Promise<boolean> {
  const snap = await getDoc(storeCodeRef(code));
  return snap.exists();
}

// authSecret records which code string the account's real Firebase Auth
// password was actually derived from at signup. It starts out equal to the
// code itself, but stays fixed even if an admin later moves this account to
// a different code - that's what lets a store code be reset without ever
// having to touch the underlying Firebase Auth password (which nothing but
// the account owner, or nobody at all without the Admin SDK, could do).
export async function claimStoreCode(code: string, email: string, uid: string): Promise<void> {
  await setDoc(storeCodeRef(code), { email, uid, authSecret: code, createdAt: serverTimestamp() });
}

export interface StoreCodeLookup {
  email: string;
  // The code string to feed into codeToAuthPassword - not necessarily the
  // code that was looked up, if this account's code has since been reset.
  passwordCode: string;
}

export async function lookupEmailByStoreCode(code: string): Promise<StoreCodeLookup | null> {
  const snap = await getDoc(storeCodeRef(code));
  if (!snap.exists()) return null;
  const data = snap.data();
  const email = typeof data.email === 'string' ? data.email : null;
  if (!email) return null;
  // Accounts created before authSecret existed have no such field; their
  // real password is (and always will be) derived from their own code.
  const passwordCode = typeof data.authSecret === 'string' ? data.authSecret : code;
  return { email, passwordCode };
}
