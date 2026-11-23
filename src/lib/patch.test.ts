import { applyPatch } from 'diff';
import { describe, expect, it } from 'vitest';
import { normalizeNewlines } from './diffEngine.ts';
import { buildGitPatch, buildUnifiedDiff } from './patch.ts';

describe('patch export', () => {
  const original = 'alpha\nbeta\ngamma\n';
  const changed = 'alpha\nbeta!\ngamma\ndelta\n';

  it('builds a unified diff that applies back to the changed text', () => {
    const diff = buildUnifiedDiff(original, changed, 'release-2.4.txt', 'release-2.5.txt');
    expect(diff).toContain('--- release-2.4.txt');
    expect(diff).toContain('+++ release-2.5.txt');
    expect(diff).toContain('-beta');
    expect(diff).toContain('+beta!');
    expect(diff).toContain('+delta');
    const applied = applyPatch(normalizeNewlines(original), diff);
    expect(applied).toBe(normalizeNewlines(changed));
  });

  it('prefixes a git header on .patch output and still applies', () => {
    const patch = buildGitPatch('one\r\ntwo', 'one\r\nthree', 'a.txt', 'b.txt');
    expect(patch.startsWith('diff --git a/a.txt b/b.txt\n')).toBe(true);
    const body = patch.slice(patch.indexOf('---'));
    expect(applyPatch(normalizeNewlines('one\r\ntwo'), body)).toBe('one\nthree');
  });
});
