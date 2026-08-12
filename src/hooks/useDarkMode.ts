import { useEffect, useState } from 'react';
import { f7 } from 'framework7-react';
import { setStoredDarkMode } from '../lib/theme';

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => f7.darkMode);

  // f7.darkMode also flips on its own when darkMode:'auto' is active and
  // the OS theme changes - listening for that keeps the toggle icon in
  // sync instead of only reacting to taps on it.
  useEffect(() => {
    const handler = (dark: boolean) => setIsDark(dark);
    f7.on('darkModeChange', handler);
    return () => {
      f7.off('darkModeChange', handler);
    };
  }, []);

  const toggle = () => {
    const next = !f7.darkMode;
    setStoredDarkMode(next);
    f7.setDarkMode(next);
  };

  return { isDark, toggle };
}
