// A kiosk-style tablet stays on one open tab for days at a time. Even with
// this app's own defensive measures (session-expiry handling in
// sessionGuard.ts, reconnect-on-wake in reconnectGuard.ts, the grid's own
// load-error retry UI), a single page instance running uninterrupted for
// days is still exposed to things outside this app's control - browser/
// WebView memory creep from long-lived sessions, stale internal SDK state,
// or an unrecoverable error sitting on ErrorBoundary's fallback screen with
// no one there to tap its Reload button overnight. A full page reload once
// a day, timed for local midnight - already the day boundary the tally
// grid itself resets on, and the quietest likely moment for a store - is
// cheap, standard practice for unattended kiosk displays, and clears all of
// that for free.
function nextMidnight(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0).getTime();
}

export function scheduleMidnightRefresh(): void {
  const target = nextMidnight();
  let fired = false;

  const reload = () => {
    if (fired) return;
    fired = true;
    window.location.reload();
  };

  window.setTimeout(reload, target - Date.now());

  // Backgrounded/asleep-screen timers can be throttled or paused by the OS
  // (most relevant on iOS), so the setTimeout above isn't fully trustworthy
  // on its own - re-check whenever the tab/screen wakes up and catch up
  // immediately if the scheduled moment has already passed. Same
  // belt-and-suspenders pattern useTodayDateString uses for date rollover.
  const checkIfDue = () => {
    if (Date.now() >= target) reload();
  };
  document.addEventListener('visibilitychange', checkIfDue);
  window.addEventListener('focus', checkIfDue);
}
