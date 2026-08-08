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

export async function claimStoreCode(code: string, email: string, uid: string): Promise<void> {
  await setDoc(storeCodeRef(code), { email, uid, createdAt: serverTimestamp() });
}

export async function lookupEmailByStoreCode(code: string): Promise<string | null> {
  const snap = await getDoc(storeCodeRef(code));
  if (!snap.exists()) return null;
  const email = snap.data().email;
  return typeof email === 'string' ? email : null;
}
