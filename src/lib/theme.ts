const STORAGE_KEY = 'cfa-waste-dark-mode';

// No stored preference means "auto" (follow the OS), matching the
// darkMode:'auto' default this app shipped with - a manual toggle switches
// to an explicit light/dark choice that overrides the OS setting until the
// user taps it again.
export function getStoredDarkMode(): boolean | 'auto' {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  return 'auto';
}

export function setStoredDarkMode(isDark: boolean): void {
  localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
}
