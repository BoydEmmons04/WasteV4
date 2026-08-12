import { disableNetwork, enableNetwork } from 'firebase/firestore';
import { db } from '../firebase';

// Mobile Safari (and other browsers) can freeze or fully suspend a
// backgrounded tab's network connections without ever surfacing an error to
// the app - Firestore's realtime listeners then just go quiet instead of
// erroring, so returning to the tab after a while shows stale/empty data
// with nothing for sessionGuard's onSnapshot error handler to catch. This
// forces the SDK to drop and re-establish its connection whenever the page
// resumes from that kind of suspension, which is the standard workaround.
const STALE_THRESHOLD_MS = 30_000;
let hiddenAt: number | null = null;
let reconnecting = false;

function forceReconnect() {
  if (reconnecting) return;
  reconnecting = true;
  disableNetwork(db)
    .then(() => enableNetwork(db))
    .catch(() => {})
    .finally(() => {
      reconnecting = false;
    });
}

export function setupReconnectGuard() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    if (hiddenAt !== null && Date.now() - hiddenAt > STALE_THRESHOLD_MS) {
      forceReconnect();
    }
    hiddenAt = null;
  });

  // A page restored from the back/forward cache was fully frozen, not just
  // backgrounded - always worth reconnecting regardless of how long it was
  // away, since its sockets are guaranteed stale rather than just possibly
  // stale.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) forceReconnect();
  });
}
