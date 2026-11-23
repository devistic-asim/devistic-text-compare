import { describe, expect, it } from 'vitest';
import { computeDiff } from './diffEngine.ts';
import { escapeHtml, renderHtmlExport } from './htmlExport.ts';
import type { DiffOptions } from './types.ts';

const options: DiffOptions = {
  ignoreWhitespace: false,
  ignoreCase: false,
  ignoreBlankLines: false,
  granularity: 'word',
};

describe('html export', () => {
  it('escapes markup so a comparison cannot embed a script', () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
    const model = computeDiff('<script>alert(1)</script>\n', 'safe\n', options);
    const html = renderHtmlExport({
      originalName: 'a.txt',
      changedName: 'b.txt',
      model,
      view: 'side-by-side',
      options,
    });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Devistic Text Compare');
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
  });
});
