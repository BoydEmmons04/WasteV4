import { signOut } from 'firebase/auth';
import { f7 } from 'framework7-react';
import { auth } from '../firebase';

// onSnapshot listeners (and one-shot getDocs calls) silently stop delivering
// updates on a permission error - with no error handler at all, a store
// whose session has gone stale (revoked, or the admin deleted/reset its
// account out from under it) just sees the grid freeze with no explanation.
// This is the one shared place that turns that into a visible "please sign
// back in" instead of a silent hang. Other error codes (offline, etc.) are
// left alone - only unauthenticated/permission-denied indicate the session
// itself is the problem.
let handling = false;

export function handleFirestoreError(error: unknown): void {
  const code = (error as { code?: string } | null)?.code;
  if (code !== 'permission-denied' && code !== 'unauthenticated') return;
  if (handling) return;
  handling = true;
  f7.dialog.alert('Your session has expired. Please sign in again.', 'Session Expired', () => {
    signOut(auth).finally(() => {
      handling = false;
    });
  });
}
