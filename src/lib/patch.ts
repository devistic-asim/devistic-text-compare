import { createTwoFilesPatch } from 'diff';
import { normalizeNewlines } from './diffEngine.ts';

function safeName(name: string, fallback: string): string {
  const cleaned = name.replaceAll(/[\r\n]/g, '').trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Build a unified diff that reproduces the changed text exactly.
 * Ignore options affect the on-screen highlight, not this patch, so it can be applied with `patch`.
 */
export function buildUnifiedDiff(
  original: string,
  changed: string,
  originalName: string,
  changedName: string,
): string {
  const oldName = safeName(originalName, 'original.txt');
  const newName = safeName(changedName, 'changed.txt');
  const patch = createTwoFilesPatch(
    oldName,
    newName,
    normalizeNewlines(original),
    normalizeNewlines(changed),
    '',
    '',
    { context: 3, stripTrailingCr: true },
  );
  return patch.endsWith('\n') ? patch : `${patch}\n`;
}

/** Same applicable diff, with a git-style header so it reads as a .patch file. */
export function buildGitPatch(
  original: string,
  changed: string,
  originalName: string,
  changedName: string,
): string {
  const oldName = safeName(originalName, 'original.txt');
  const newName = safeName(changedName, 'changed.txt');
  const body = buildUnifiedDiff(original, changed, oldName, newName);
  return `diff --git a/${oldName} b/${newName}\n${body}`;
}
