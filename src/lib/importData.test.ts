import { describe, expect, it } from 'vitest';
import { comparisonDocument, dataDocument, parseImport } from './importData.ts';
import { DEFAULT_SETTINGS } from './types.ts';

describe('import and export documents', () => {
  it('round-trips a comparison JSON', () => {
    const raw = comparisonDocument({
      original: 'before',
      changed: 'after',
      originalName: 'old.txt',
      changedName: 'new.txt',
      options: { ...DEFAULT_SETTINGS, ignoreCase: true, granularity: 'character' },
      view: 'unified',
      stats: { added: 0, removed: 0, changed: 1 },
    });
    const parsed = parseImport(raw);
    expect(parsed.type).toBe('comparison');
    if (parsed.type !== 'comparison') return;
    expect(parsed.original).toBe('before');
    expect(parsed.changed).toBe('after');
    expect(parsed.originalName).toBe('old.txt');
    expect(parsed.options?.ignoreCase).toBe(true);
    expect(parsed.options?.granularity).toBe('character');
    expect(parsed.view).toBe('unified');
  });

  it('round-trips a local-data backup and ignores junk settings', () => {
    const raw = dataDocument({
      settings: { ...DEFAULT_SETTINGS, theme: 'dark', privacyDismissed: true },
      recent: [],
    });
    const parsed = parseImport(raw);
    expect(parsed.type).toBe('data');
    if (parsed.type !== 'data') return;
    expect(parsed.data.settings.theme).toBe('dark');
    expect(parsed.data.settings.privacyDismissed).toBe(true);
  });

  it('explains invalid and unrecognized files', () => {
    const invalid = parseImport('{');
    const unknown = parseImport('{"format":"other"}');
    const missing = parseImport('{"format":"devistic-text-compare"}');
    expect(invalid.type === 'error' && invalid.message).toMatch(/not valid JSON/i);
    expect(unknown.type === 'error' && unknown.message).toMatch(/Unrecognized file/);
    expect(missing.type === 'error' && missing.message).toMatch(/missing/i);
  });
});
