import { useEffect, useState } from 'react';
import { todayDateString } from '../lib/firestore';

// A kiosk-style tablet typically stays on one open tab for days at a time,
// so "today" has to be re-derived as the calendar rolls over rather than
// captured once at mount - otherwise the tally grid keeps listening to
// yesterday's date's tallies forever and never shows the fresh, empty day
// until someone manually reloads the page. Timers can be throttled or
// paused while a screen is asleep, so a periodic check alone isn't
// reliable - also re-check immediately whenever the tab/screen wakes up.
export function useTodayDateString(): string {
  const [today, setToday] = useState(todayDateString());

  useEffect(() => {
    const check = () => {
      const current = todayDateString();
      setToday((prev) => (prev === current ? prev : current));
    };

    const interval = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  return today;
}
