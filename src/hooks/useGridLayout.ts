import { useEffect, useState } from 'react';

interface GridLayout {
  columns: number;
  rows: number;
}

// Tablet is a fixed 12-cell budget either way (3x4 portrait, 4x3 landscape) -
// same button count and size, just re-flowed to fit the screen's own
// proportions instead of forcing a tall 3-wide grid into a wide short
// viewport (which is what made landscape buttons look stretched/tiny).
function computeLayout(width: number, height: number): GridLayout {
  if (width >= 1100) return { columns: 5, rows: 4 };
  if (width >= 700) {
    const isLandscape = width > height;
    return isLandscape ? { columns: 4, rows: 3 } : { columns: 3, rows: 4 };
  }
  return { columns: 2, rows: 4 };
}

export function useGridLayout() {
  const [layout, setLayout] = useState<GridLayout>(() => computeLayout(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const onResize = () => setLayout(computeLayout(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return { ...layout, itemsPerPage: layout.columns * layout.rows };
}
