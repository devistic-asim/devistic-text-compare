import { describe, expect, it } from 'vitest';
import { computeDiff } from './diffEngine.ts';
import { describeStats, type DiffOptions } from './types.ts';

const base: DiffOptions = {
  ignoreWhitespace: false,
  ignoreCase: false,
  ignoreBlankLines: false,
  granularity: 'word',
};

describe('computeDiff', () => {
  it('reports no differences for identical text, including line endings', () => {
    const model = computeDiff('alpha\r\nbeta\r\n', 'alpha\nbeta\n', base);
    expect(model.timedOut).toBe(false);
    expect(model.stats).toEqual({ added: 0, removed: 0, changed: 0 });
    expect(model.rows.every((row) => !row.isChange)).toBe(true);
    expect(describeStats(model.stats)).toBe('No differences');
  });

  it('counts an added line, a removed line, and a changed line separately', () => {
    const model = computeDiff('keep\ngone\nmiddle\nedit\n', 'keep\nmiddle\nedit me\nextra\n', base);
    expect(model.stats).toEqual({ added: 1, removed: 1, changed: 1 });
    expect(describeStats(model.stats)).toBe('1 added, 1 removed, 1 changed');
  });

  it('highlights only the changed word', () => {
    const model = computeDiff('hello world\n', 'hello there\n', base);
    const row = model.rows[0];
    expect(row?.kind).toBe('change');
    expect(row?.left.some((span) => span.kind === 'equal' && span.text.includes('hello'))).toBe(true);
    expect(row?.left.some((span) => span.kind === 'delete' && span.text.includes('world'))).toBe(true);
    expect(row?.right.some((span) => span.kind === 'insert' && span.text.includes('there'))).toBe(true);
  });

  it('highlights the changed character and keeps the shared prefix', () => {
    const model = computeDiff('cat\n', 'car\n', { ...base, granularity: 'character' });
    const row = model.rows[0];
    expect(row?.left.map((span) => [span.kind, span.text])).toEqual([
      ['equal', 'ca'],
      ['delete', 't'],
    ]);
    expect(row?.right.map((span) => [span.kind, span.text])).toEqual([
      ['equal', 'ca'],
      ['insert', 'r'],
    ]);
  });

  it('marks the whole line when granularity is line', () => {
    const model = computeDiff('cat\n', 'car\n', { ...base, granularity: 'line' });
    expect(model.rows[0]?.left).toEqual([{ text: 'cat', kind: 'delete' }]);
    expect(model.rows[0]?.right).toEqual([{ text: 'car', kind: 'insert' }]);
  });

  it('ignores case without losing the original characters on each side', () => {
    const ignored = computeDiff('Hello World\n', 'hello world\n', { ...base, ignoreCase: true });
    expect(ignored.stats.changed).toBe(0);
    expect(ignored.rows[0]?.left[0]?.text).toBe('Hello World');
    expect(ignored.rows[0]?.right[0]?.text).toBe('hello world');

    const visible = computeDiff('Hello\n', 'hello\n', base);
    expect(visible.stats.changed).toBe(1);
  });

  it('ignores whitespace-only changes and still shows a real edit', () => {
    const spaces = computeDiff('alpha    beta\n', 'alpha beta\n', { ...base, ignoreWhitespace: true });
    expect(spaces.stats).toEqual({ added: 0, removed: 0, changed: 0 });

    const edited = computeDiff('alpha   beta\n', 'alpha gamma\n', { ...base, ignoreWhitespace: true });
    expect(edited.stats.changed).toBe(1);
  });

  it('does not count inserted or deleted blank lines when that option is on', () => {
    const ignored = computeDiff('a\n\nb\n', 'a\nb\n', { ...base, ignoreBlankLines: true });
    expect(ignored.stats).toEqual({ added: 0, removed: 0, changed: 0 });
    expect(ignored.rows).toHaveLength(3);
    expect(ignored.rows[1]?.isChange).toBe(false);
    expect(ignored.rows[1]?.left.every((span) => span.text.trim() === '')).toBe(true);

    const counted = computeDiff('a\n\nb\n', 'a\nb\n', base);
    expect(counted.stats.removed).toBe(1);
  });

  it('keeps a real edit that sits beside a blank line', () => {
    const model = computeDiff('a\n\nb\n', 'a\nx\nb\n', { ...base, ignoreBlankLines: true });
    expect(model.stats.changed + model.stats.added + model.stats.removed).toBeGreaterThan(0);
    expect(model.rows.some((row) => row.right.some((span) => span.text.includes('x')))).toBe(true);
  });

  it('treats an empty side as a pure insert', () => {
    const model = computeDiff('', 'only\n', base);
    expect(model.stats).toEqual({ added: 1, removed: 0, changed: 0 });
    expect(model.rows[0]?.oldNumber).toBeNull();
    expect(model.rows[0]?.newNumber).toBe(1);
  });

  it('finds one edit inside a longer document', () => {
    const prefix = Array.from({ length: 400 }, (_, index) => `line ${index}`).join('\n');
    const original = `${prefix}\nneedle\n${prefix}\n`;
    const changed = `${prefix}\npinned\n${prefix}\n`;
    const model = computeDiff(original, changed, base);
    expect(model.stats).toEqual({ added: 0, removed: 0, changed: 1 });
    const change = model.rows.find((row) => row.isChange);
    expect(change?.right.some((span) => span.text.includes('pinned'))).toBe(true);
  });
});
