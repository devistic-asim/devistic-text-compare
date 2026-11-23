import { describe, expect, it } from 'vitest';
import {
  clearAppStorage,
  comparisonTitle,
  readDraft,
  readLocalData,
  upsertRecent,
  writeDraft,
  writeLocalData,
  type KeyValueStore,
} from './storage.ts';
import { DEFAULT_SETTINGS, type RecentComparison } from './types.ts';

function memory(): KeyValueStore & { dump: Map<string, string> } {
  const dump = new Map<string, string>();
  return {
    dump,
    getItem: (key) => (dump.has(key) ? dump.get(key)! : null),
    setItem: (key, value) => {
      dump.set(key, value);
    },
    removeItem: (key) => {
      dump.delete(key);
    },
  };
}

describe('storage', () => {
  it('round-trips settings and drops malformed recent items', () => {
    const store = memory();
    const saved = writeLocalData(store, {
      settings: { ...DEFAULT_SETTINGS, theme: 'dark', ignoreCase: true, privacyDismissed: true },
      recent: [
        {
          id: 'ok',
          title: 'Notes',
          savedAt: '2026-01-01T00:00:00.000Z',
          originalName: 'a.txt',
          changedName: 'b.txt',
          original: 'a',
          changed: 'b',
          options: { ...DEFAULT_SETTINGS, granularity: 'character' },
          view: 'unified',
        },
      ],
    });
    expect(saved).toBe(true);
    store.dump.set(
      'devistic-text-compare:v1',
      JSON.stringify({
        settings: { theme: 'dark', ignoreCase: true, privacyDismissed: true, granularity: 'nope' },
        recent: [{ id: 'ok', original: 'a', changed: 'b' }, { nope: true }, 'bad'],
      }),
    );
    const data = readLocalData(store);
    expect(data.settings.theme).toBe('dark');
    expect(data.settings.ignoreCase).toBe(true);
    expect(data.settings.granularity).toBe('word');
    expect(data.recent).toHaveLength(1);
    expect(data.recent[0]?.original).toBe('a');
  });

  it('prefers the theme key used by the anti-flash script', () => {
    const store = memory();
    store.setItem('devistic-text-compare:theme', 'light');
    store.setItem(
      'devistic-text-compare:v1',
      JSON.stringify({ settings: { theme: 'dark' }, recent: [] }),
    );
    expect(readLocalData(store).settings.theme).toBe('light');
  });

  it('returns defaults for corrupt JSON and stores a draft', () => {
    const store = memory();
    store.setItem('devistic-text-compare:v1', '{');
    expect(readLocalData(store).settings.theme).toBe('system');
    expect(writeDraft(store, { original: 'a', changed: 'b', originalName: 'a.txt', changedName: 'b.txt' })).toBe(
      true,
    );
    expect(readDraft(store)?.original).toBe('a');
  });

  it('clears local and session keys', () => {
    const local = memory();
    const session = memory();
    writeLocalData(local, { settings: DEFAULT_SETTINGS, recent: [] });
    writeDraft(session, { original: 'a', changed: '', originalName: 'original.txt', changedName: 'changed.txt' });
    session.setItem('devistic-text-compare:session', 'abc');
    clearAppStorage(local, session);
    expect(local.dump.size).toBe(0);
    expect(session.dump.size).toBe(0);
  });

  it('upserts by id and caps the list', () => {
    const seed = (id: string): RecentComparison => ({
      id,
      title: id,
      savedAt: '2026-01-01T00:00:00.000Z',
      originalName: 'original.txt',
      changedName: 'changed.txt',
      original: id,
      changed: '',
      options: DEFAULT_SETTINGS,
      view: 'side-by-side',
    });
    const existing = Array.from({ length: 12 }, (_, index) => seed(String(index)));
    const next = upsertRecent(existing, seed('0'));
    expect(next).toHaveLength(12);
    expect(next[0]?.id).toBe('0');
    expect(next.filter((item) => item.id === '0')).toHaveLength(1);
  });

  it('names a comparison from the file names or the first line', () => {
    expect(comparisonTitle('a.txt', 'b.txt', 'hello', 'there')).toBe('a.txt → b.txt');
    expect(comparisonTitle('original.txt', 'changed.txt', '\n\nSecond line wins', '')).toBe('Second line wins');
  });

  it('reports failure when the store throws', () => {
    const broken: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    expect(writeLocalData(broken, { settings: DEFAULT_SETTINGS, recent: [] })).toBe(false);
  });
});
