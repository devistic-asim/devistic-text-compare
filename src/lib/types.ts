export type ThemeChoice = 'light' | 'dark' | 'system';
export type DiffViewMode = 'side-by-side' | 'unified';
export type Granularity = 'line' | 'word' | 'character';

export interface DiffOptions {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  ignoreBlankLines: boolean;
  granularity: Granularity;
}

export interface Settings extends DiffOptions {
  theme: ThemeChoice;
  view: DiffViewMode;
  wrap: boolean;
  hideUnchanged: boolean;
  privacyDismissed: boolean;
}

export interface Span {
  text: string;
  kind: 'equal' | 'delete' | 'insert';
}

export interface DiffRow {
  kind: 'equal' | 'delete' | 'insert' | 'change';
  oldNumber: number | null;
  newNumber: number | null;
  left: Span[];
  right: Span[];
  /** Counted in the stats and reachable with next/previous. */
  isChange: boolean;
}

export interface DiffStats {
  added: number;
  removed: number;
  changed: number;
}

export interface DiffModel {
  rows: DiffRow[];
  stats: DiffStats;
  timedOut: boolean;
  error?: string;
}

export interface RecentComparison {
  id: string;
  title: string;
  savedAt: string;
  originalName: string;
  changedName: string;
  original: string;
  changed: string;
  options: DiffOptions;
  view: DiffViewMode;
}

export interface LocalData {
  settings: Settings;
  recent: RecentComparison[];
}

export interface Draft {
  original: string;
  changed: string;
  originalName: string;
  changedName: string;
}

export const THEME_KEY = 'devistic-text-compare:theme';
export const DATA_KEY = 'devistic-text-compare:v1';
export const DRAFT_KEY = 'devistic-text-compare:draft';
export const SESSION_KEY = 'devistic-text-compare:session';

export const MAX_RECENT = 12;
export const MAX_STORED_CHARS = 350_000;

export const DEFAULT_OPTIONS: DiffOptions = {
  ignoreWhitespace: false,
  ignoreCase: false,
  ignoreBlankLines: false,
  granularity: 'word',
};

export const DEFAULT_SETTINGS: Settings = {
  ...DEFAULT_OPTIONS,
  theme: 'system',
  view: 'side-by-side',
  wrap: true,
  hideUnchanged: false,
  privacyDismissed: false,
};

export function pickOptions(settings: Settings): DiffOptions {
  return {
    ignoreWhitespace: settings.ignoreWhitespace,
    ignoreCase: settings.ignoreCase,
    ignoreBlankLines: settings.ignoreBlankLines,
    granularity: settings.granularity,
  };
}

export function emptyModel(): DiffModel {
  return { rows: [], stats: { added: 0, removed: 0, changed: 0 }, timedOut: false };
}

export function describeStats(stats: DiffStats): string {
  if (stats.added === 0 && stats.removed === 0 && stats.changed === 0) {
    return 'No differences';
  }
  const parts = [
    `${stats.added} added`,
    `${stats.removed} removed`,
    `${stats.changed} changed`,
  ];
  return parts.join(', ');
}
