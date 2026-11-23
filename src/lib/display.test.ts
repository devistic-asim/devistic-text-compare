import { describe, expect, it } from 'vitest';
import { buildDisplay } from './display.ts';

function rows(pattern: string): { isChange: boolean }[] {
  return [...pattern].map((mark) => ({ isChange: mark === 'x' }));
}

describe('buildDisplay', () => {
  it('returns every row when hiding is off or nothing changed', () => {
    expect(buildDisplay(rows('---'), false, new Set())).toHaveLength(3);
    expect(buildDisplay(rows('---'), true, new Set())).toHaveLength(3);
  });

  it('folds a long unchanged stretch and keeps context around a change', () => {
    const items = buildDisplay(rows('----------x-----'), true, new Set(), 2);
    const fold = items.find((item) => item.type === 'fold');
    expect(fold).toMatchObject({ type: 'fold', count: 8 });
    expect(items.some((item) => item.type === 'row' && item.index === 10)).toBe(true);
  });

  it('expands a fold the user opened', () => {
    const hidden = buildDisplay(rows('----------x'), true, new Set(), 1);
    const fold = hidden.find((item) => item.type === 'fold');
    expect(fold?.type).toBe('fold');
    if (fold?.type !== 'fold') return;
    const opened = buildDisplay(rows('----------x'), true, new Set([`${fold.start}:${fold.end}`]), 1);
    expect(opened.some((item) => item.type === 'fold')).toBe(false);
    expect(opened.filter((item) => item.type === 'row')).toHaveLength(11);
  });
});
