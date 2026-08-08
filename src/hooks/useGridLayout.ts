import { useEffect, useState } from 'react';

interface GridLayout {
  columns: number;
  rows: number;
}

function computeLayout(width: number): GridLayout {
  if (width >= 1100) return { columns: 5, rows: 4 };
  if (width >= 700) return { columns: 3, rows: 4 };
  return { columns: 2, rows: 4 };
}

export function useGridLayout() {
  const [layout, setLayout] = useState<GridLayout>(() => computeLayout(window.innerWidth));

  useEffect(() => {
    const onResize = () => setLayout(computeLayout(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return { ...layout, itemsPerPage: layout.columns * layout.rows };
}
