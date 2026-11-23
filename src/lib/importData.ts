import type { DiffOptions, DiffViewMode, LocalData } from './types.ts';
import { sanitizeData, sanitizeOptions } from './storage.ts';

export type ImportResult =
  | {
      type: 'comparison';
      original: string;
      changed: string;
      originalName: string;
      changedName: string;
      options?: DiffOptions;
      view?: DiffViewMode;
    }
  | { type: 'data'; data: LocalData }
  | { type: 'error'; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textOf(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (isRecord(value) && typeof value.text === 'string') return value.text;
  return null;
}

function nameOf(value: unknown, fallback: string): string {
  if (isRecord(value) && typeof value.name === 'string' && value.name.trim()) return value.name.slice(0, 180);
  return fallback;
}

export function parseImport(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { type: 'error', message: 'That file is not valid JSON.' };
  }
  if (!isRecord(parsed)) {
    return { type: 'error', message: 'That JSON file is not a Devistic comparison or backup.' };
  }

  if (parsed.format === 'devistic-text-compare-data') {
    return { type: 'data', data: sanitizeData(parsed) };
  }

  if (parsed.format === 'devistic-text-compare') {
    const original = textOf(parsed.original);
    const changed = textOf(parsed.changed);
    if (original === null || changed === null) {
      return { type: 'error', message: 'This comparison file is missing the original or changed text.' };
    }
    const view = parsed.view === 'unified' || parsed.view === 'side-by-side' ? parsed.view : undefined;
    return {
      type: 'comparison',
      original,
      changed,
      originalName: nameOf(parsed.original, 'original.txt'),
      changedName: nameOf(parsed.changed, 'changed.txt'),
      options: parsed.options ? sanitizeOptions(parsed.options) : undefined,
      view,
    };
  }

  return {
    type: 'error',
    message: 'Unrecognized file. Import a comparison JSON or a local-data backup from this app.',
  };
}

export function comparisonDocument(input: {
  original: string;
  changed: string;
  originalName: string;
  changedName: string;
  options: DiffOptions;
  view: DiffViewMode;
  stats: { added: number; removed: number; changed: number };
}): string {
  return JSON.stringify(
    {
      format: 'devistic-text-compare',
      version: 1,
      exportedAt: new Date().toISOString(),
      original: { name: input.originalName, text: input.original },
      changed: { name: input.changedName, text: input.changed },
      options: input.options,
      view: input.view,
      stats: input.stats,
    },
    null,
    2,
  );
}

export function dataDocument(data: LocalData): string {
  return JSON.stringify(
    {
      format: 'devistic-text-compare-data',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: data.settings,
      recent: data.recent,
    },
    null,
    2,
  );
}
