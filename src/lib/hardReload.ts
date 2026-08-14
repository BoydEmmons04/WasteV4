// Home-screen "installed" web apps on iOS are notoriously sticky about
// picking up a new deployment - a plain location.reload() can just
// re-render whatever's already sitting in the browser's HTTP cache instead
// of actually fetching the current index.html (and, through it, whatever
// currently-hashed JS/CSS bundle a fresh deploy produced). Appending a
// unique query param makes this a genuinely different URL, which forces a
// real network fetch of index.html regardless of any cache headers -
// replace() (not assigning href) so the daily/error-recovery reload doesn't
// pile up browser history over a kiosk's many days of uptime.
export function hardReload(): void {
  const url = new URL(window.location.href);
  url.searchParams.set('_r', Date.now().toString());
  window.location.replace(url.toString());
}
