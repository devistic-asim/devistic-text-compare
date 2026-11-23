export type DisplayItem =
  | { type: 'row'; index: number }
  | { type: 'fold'; start: number; end: number; count: number };

/**
 * Hide long unchanged stretches, keeping a few lines of context around each change.
 * Tiny gaps stay expanded so the diff does not flicker open and shut.
 */
export function buildDisplay(
  rows: readonly { isChange: boolean }[],
  hideUnchanged: boolean,
  expanded: ReadonlySet<string>,
  context = 3,
): DisplayItem[] {
  if (!hideUnchanged || !rows.some((row) => row.isChange)) {
    return rows.map((_, index) => ({ type: 'row', index }));
  }

  const visible = rows.map(() => false);
  rows.forEach((row, index) => {
    if (!row.isChange) return;
    const from = Math.max(0, index - context);
    const to = Math.min(rows.length - 1, index + context);
    for (let cursor = from; cursor <= to; cursor += 1) visible[cursor] = true;
  });

  const items: DisplayItem[] = [];
  let index = 0;
  while (index < rows.length) {
    if (visible[index]) {
      items.push({ type: 'row', index });
      index += 1;
      continue;
    }
    const start = index;
    while (index < rows.length && !visible[index]) index += 1;
    const count = index - start;
    const end = index - 1;
    const id = `${start}:${end}`;
    if (count < 2 || expanded.has(id)) {
      for (let cursor = start; cursor <= end; cursor += 1) items.push({ type: 'row', index: cursor });
    } else {
      items.push({ type: 'fold', start, end, count });
    }
  }
  return items;
}

export function foldId(start: number, end: number): string {
  return `${start}:${end}`;
}
