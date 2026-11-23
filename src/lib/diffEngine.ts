import { diffArrays, diffChars, diffWords, diffWordsWithSpace } from 'diff';
import type { Change } from 'diff';
import type { DiffModel, DiffOptions, DiffRow, Span } from './types.ts';

const INLINE_CHAR_LIMIT = 8_000;

/**
 * Split text into lines the way a diff viewer should:
 * CRLF and CR become LF, and a single trailing newline does not invent an extra blank line.
 */
export function splitLines(text: string): string[] {
  if (text.length === 0) return [];
  const normalized = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  const lines = normalized.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function normalizeNewlines(text: string): string {
  return text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

function comparisonKey(line: string, options: DiffOptions): string {
  let value = line;
  if (options.ignoreWhitespace) {
    value = value.replace(/\s+/g, ' ').trim();
  }
  if (options.ignoreCase) {
    value = value.toLocaleLowerCase();
  }
  return value;
}

function mergeSpans(spans: Span[]): Span[] {
  const merged: Span[] = [];
  for (const span of spans) {
    if (span.text.length === 0) continue;
    const previous = merged[merged.length - 1];
    if (previous && previous.kind === span.kind) previous.text += span.text;
    else merged.push({ text: span.text, kind: span.kind });
  }
  return merged;
}

function spansFromParts(parts: Change[]): { left: Span[]; right: Span[] } {
  const left: Span[] = [];
  const right: Span[] = [];
  for (const part of parts) {
    if (part.added) right.push({ text: part.value, kind: 'insert' });
    else if (part.removed) left.push({ text: part.value, kind: 'delete' });
    else {
      left.push({ text: part.value, kind: 'equal' });
      right.push({ text: part.value, kind: 'equal' });
    }
  }
  return { left: mergeSpans(left), right: mergeSpans(right) };
}

/**
 * Highlight inside a changed line while keeping each side's own characters.
 * jsdiff reports the "new" text for tokens that compared equal under ignoreCase,
 * so we walk the original strings by length and fall back if a tokenizer drifts.
 */
function inlineSpans(
  left: string,
  right: string,
  options: DiffOptions,
): { left: Span[]; right: Span[] } {
  if (
    options.granularity === 'line' ||
    left.length > INLINE_CHAR_LIMIT ||
    right.length > INLINE_CHAR_LIMIT
  ) {
    return {
      left: left.length ? [{ text: left, kind: 'delete' }] : [],
      right: right.length ? [{ text: right, kind: 'insert' }] : [],
    };
  }

  const parts =
    options.granularity === 'character'
      ? diffChars(left, right, { ignoreCase: options.ignoreCase })
      : options.ignoreWhitespace
        ? diffWords(left, right, { ignoreCase: options.ignoreCase })
        : diffWordsWithSpace(left, right, { ignoreCase: options.ignoreCase });

  const leftSpans: Span[] = [];
  const rightSpans: Span[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  for (const part of parts) {
    const length = part.value.length;
    if (part.added) {
      rightSpans.push({ text: right.slice(rightIndex, rightIndex + length), kind: 'insert' });
      rightIndex += length;
    } else if (part.removed) {
      leftSpans.push({ text: left.slice(leftIndex, leftIndex + length), kind: 'delete' });
      leftIndex += length;
    } else {
      leftSpans.push({ text: left.slice(leftIndex, leftIndex + length), kind: 'equal' });
      rightSpans.push({ text: right.slice(rightIndex, rightIndex + length), kind: 'equal' });
      leftIndex += length;
      rightIndex += length;
    }
  }

  if (leftIndex !== left.length || rightIndex !== right.length) {
    return spansFromParts(parts);
  }

  return { left: mergeSpans(leftSpans), right: mergeSpans(rightSpans) };
}

function spanText(spans: Span[]): string {
  let text = '';
  for (const span of spans) text += span.text;
  return text;
}

/**
 * Meld / git --ignore-blank-lines: a hunk made only of blank lines is not a change.
 * The lines stay on screen so alignment is honest, but they are not highlighted or counted.
 */
function neutralizeBlankHunks(rows: DiffRow[]): DiffRow[] {
  const next = rows.slice();
  let index = 0;
  while (index < next.length) {
    const current = next[index];
    if (!current?.isChange) {
      index += 1;
      continue;
    }
    let end = index;
    while (end < next.length && next[end]?.isChange) end += 1;
    let onlyBlank = true;
    for (let cursor = index; cursor < end; cursor += 1) {
      const row = next[cursor];
      if (!row) continue;
      if (spanText(row.left).trim() !== '' || spanText(row.right).trim() !== '') {
        onlyBlank = false;
        break;
      }
    }
    if (onlyBlank) {
      for (let cursor = index; cursor < end; cursor += 1) {
        const row = next[cursor];
        if (!row) continue;
        const leftText = spanText(row.left);
        const rightText = spanText(row.right);
        next[cursor] = {
          ...row,
          kind: 'equal',
          isChange: false,
          left: leftText.length ? [{ text: leftText, kind: 'equal' }] : [],
          right: rightText.length ? [{ text: rightText, kind: 'equal' }] : [],
        };
      }
    }
    index = end;
  }
  return next;
}

function statsOf(rows: DiffRow[]): DiffModel['stats'] {
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const row of rows) {
    if (!row.isChange) continue;
    if (row.kind === 'insert') added += 1;
    else if (row.kind === 'delete') removed += 1;
    else if (row.kind === 'change') changed += 1;
  }
  return { added, removed, changed };
}

export function computeDiff(original: string, changed: string, options: DiffOptions): DiffModel {
  const oldLines = splitLines(original);
  const newLines = splitLines(changed);
  const oldRefs = oldLines.map((text) => ({ key: comparisonKey(text, options) }));
  const newRefs = newLines.map((text) => ({ key: comparisonKey(text, options) }));

  const parts = diffArrays(oldRefs, newRefs, {
    comparator: (left, right) => left.key === right.key,
    timeout: 15_000,
  });

  if (!parts) {
    return { rows: [], stats: { added: 0, removed: 0, changed: 0 }, timedOut: true };
  }

  const rows: DiffRow[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  let oldNumber = 1;
  let newNumber = 1;

  for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
    const part = parts[partIndex];
    if (!part) continue;

    if (!part.added && !part.removed) {
      for (let step = 0; step < part.count; step += 1) {
        const left = oldLines[oldIndex] ?? '';
        const right = newLines[newIndex] ?? '';
        oldIndex += 1;
        newIndex += 1;
        rows.push({
          kind: 'equal',
          oldNumber: oldNumber,
          newNumber: newNumber,
          left: [{ text: left, kind: 'equal' }],
          right: [{ text: right, kind: 'equal' }],
          isChange: false,
        });
        oldNumber += 1;
        newNumber += 1;
      }
      continue;
    }

    if (part.removed) {
      const next = parts[partIndex + 1];
      const addedCount = next?.added ? next.count : 0;
      const paired = Math.min(part.count, addedCount);

      for (let step = 0; step < paired; step += 1) {
        const leftText = oldLines[oldIndex] ?? '';
        const rightText = newLines[newIndex] ?? '';
        oldIndex += 1;
        newIndex += 1;
        const inline = inlineSpans(leftText, rightText, options);
        rows.push({
          kind: 'change',
          oldNumber: oldNumber,
          newNumber: newNumber,
          left: inline.left,
          right: inline.right,
          isChange: true,
        });
        oldNumber += 1;
        newNumber += 1;
      }

      for (let step = paired; step < part.count; step += 1) {
        const leftText = oldLines[oldIndex] ?? '';
        oldIndex += 1;
        rows.push({
          kind: 'delete',
          oldNumber: oldNumber,
          newNumber: null,
          left: leftText.length ? [{ text: leftText, kind: 'delete' }] : [],
          right: [],
          isChange: true,
        });
        oldNumber += 1;
      }

      for (let step = paired; step < addedCount; step += 1) {
        const rightText = newLines[newIndex] ?? '';
        newIndex += 1;
        rows.push({
          kind: 'insert',
          oldNumber: null,
          newNumber: newNumber,
          left: [],
          right: rightText.length ? [{ text: rightText, kind: 'insert' }] : [],
          isChange: true,
        });
        newNumber += 1;
      }

      if (addedCount > 0) partIndex += 1;
      continue;
    }

    for (let step = 0; step < part.count; step += 1) {
      const rightText = newLines[newIndex] ?? '';
      newIndex += 1;
      rows.push({
        kind: 'insert',
        oldNumber: null,
        newNumber: newNumber,
        left: [],
        right: rightText.length ? [{ text: rightText, kind: 'insert' }] : [],
        isChange: true,
      });
      newNumber += 1;
    }
  }

  const visible = options.ignoreBlankLines ? neutralizeBlankHunks(rows) : rows;
  return { rows: visible, stats: statsOf(visible), timedOut: false };
}
