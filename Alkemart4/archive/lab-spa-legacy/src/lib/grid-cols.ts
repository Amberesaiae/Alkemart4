/**
 * Canonical mapping from a column count to a Tailwind grid-template-columns
 * class. Prefer this over inline `style={{ gridTemplateColumns: ... }}` so
 * layouts stay token-driven and inspectable in devtools/Tailwind IntelliSense.
 * Falls back to an inline style only for counts outside the common range.
 */
const GRID_COLS_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
  8: "grid-cols-8",
};

export function gridColsClass(columns: number): string | undefined {
  return GRID_COLS_CLASS[columns];
}

export function gridColsStyle(columns: number): React.CSSProperties | undefined {
  return GRID_COLS_CLASS[columns] ? undefined : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
}
