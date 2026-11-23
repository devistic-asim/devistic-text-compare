import type {
  DiffOptions,
  DiffViewMode,
  Draft,
  Granularity,
  LocalData,
  RecentComparison,
  Settings,
  ThemeChoice,
} from './types.ts';
import {
  DATA_KEY,
  DEFAULT_SETTINGS,
  DRAFT_KEY,
  MAX_RECENT,
  SESSION_KEY,
  THEME_KEY,
} from './types.ts';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTheme(value: unknown): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system';
}

function isView(value: unknown): value is DiffViewMode {
  return value === 'side-by-side' || value === 'unified';
}

function isGranularity(value: unknown): value is Granularity {
  return value === 'line' || value === 'word' || value === 'character';
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function sanitizeOptions(value: unknown, fallback: DiffOptions = DEFAULT_SETTINGS): DiffOptions {
  const record = isRecord(value) ? value : {};
  return {
    ignoreWhitespace: bool(record.ignoreWhitespace, fallback.ignoreWhitespace),
    ignoreCase: bool(record.ignoreCase, fallback.ignoreCase),
    ignoreBlankLines: bool(record.ignoreBlankLines, fallback.ignoreBlankLines),
    granularity: isGranularity(record.granularity) ? record.granularity : fallback.granularity,
  };
}

export function sanitizeSettings(value: unknown): Settings {
  const record = isRecord(value) ? value : {};
  return {
    ...sanitizeOptions(record),
    theme: isTheme(record.theme) ? record.theme : DEFAULT_SETTINGS.theme,
    view: isView(record.view) ? record.view : DEFAULT_SETTINGS.view,
    wrap: bool(record.wrap, DEFAULT_SETTINGS.wrap),
    hideUnchanged: bool(record.hideUnchanged, DEFAULT_SETTINGS.hideUnchanged),
    privacyDismissed: bool(record.privacyDismissed, DEFAULT_SETTINGS.privacyDismissed),
  };
}

function sanitizeRecent(value: unknown): RecentComparison[] {
  if (!Array.isArray(value)) return [];
  const items: RecentComparison[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (typeof entry.id !== 'string' || typeof entry.original !== 'string' || typeof entry.changed !== 'string') {
      continue;
    }
    items.push({
      id: entry.id,
      title: typeof entry.title === 'string' && entry.title.trim() ? entry.title.slice(0, 120) : 'Comparison',
      savedAt: typeof entry.savedAt === 'string' ? entry.savedAt : new Date(0).toISOString(),
      originalName: typeof entry.originalName === 'string' ? entry.originalName.slice(0, 180) : 'original.txt',
      changedName: typeof entry.changedName === 'string' ? entry.changedName.slice(0, 180) : 'changed.txt',
      original: entry.original,
      changed: entry.changed,
      options: sanitizeOptions(entry.options),
      view: isView(entry.view) ? entry.view : 'side-by-side',
    });
    if (items.length >= MAX_RECENT) break;
  }
  return items;
}

export function sanitizeData(value: unknown): LocalData {
  const record = isRecord(value) ? value : {};
  return {
    settings: sanitizeSettings(record.settings),
    recent: sanitizeRecent(record.recent),
  };
}

export function readLocalData(storage: KeyValueStore): LocalData {
  const themeRaw = storage.getItem(THEME_KEY);
  const theme = isTheme(themeRaw) ? themeRaw : undefined;
  const raw = storage.getItem(DATA_KEY);
  if (!raw) {
    return { settings: { ...DEFAULT_SETTINGS, theme: theme ?? DEFAULT_SETTINGS.theme }, recent: [] };
  }
  try {
    const data = sanitizeData(JSON.parse(raw) as unknown);
    if (theme) data.settings.theme = theme;
    return data;
  } catch {
    return { settings: { ...DEFAULT_SETTINGS, theme: theme ?? 'system' }, recent: [] };
  }
}

export function writeLocalData(storage: KeyValueStore, data: LocalData): boolean {
  try {
    storage.setItem(DATA_KEY, JSON.stringify(data));
    storage.setItem(THEME_KEY, data.settings.theme);
    return true;
  } catch {
    return false;
  }
}

export function readDraft(storage: KeyValueStore): Draft | null {
  const raw = storage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    if (typeof parsed.original !== 'string' || typeof parsed.changed !== 'string') return null;
    return {
      original: parsed.original,
      changed: parsed.changed,
      originalName: typeof parsed.originalName === 'string' ? parsed.originalName : 'original.txt',
      changedName: typeof parsed.changedName === 'string' ? parsed.changedName : 'changed.txt',
    };
  } catch {
    return null;
  }
}

export function writeDraft(storage: KeyValueStore, draft: Draft): boolean {
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearAppStorage(local: KeyValueStore, session: KeyValueStore): void {
  local.removeItem(DATA_KEY);
  local.removeItem(THEME_KEY);
  session.removeItem(DRAFT_KEY);
  session.removeItem(SESSION_KEY);
}

export function upsertRecent(recent: RecentComparison[], item: RecentComparison): RecentComparison[] {
  return [item, ...recent.filter((entry) => entry.id !== item.id)].slice(0, MAX_RECENT);
}

export function comparisonTitle(
  originalName: string,
  changedName: string,
  original: string,
  changed: string,
): string {
  if (originalName !== 'original.txt' || changedName !== 'changed.txt') {
    return `${originalName} → ${changedName}`.slice(0, 80);
  }
  const source = original.trim().length > 0 ? original : changed;
  const line = source.split('\n').find((entry) => entry.trim().length > 0);
  return (line?.trim() || 'Comparison').slice(0, 80);
}
