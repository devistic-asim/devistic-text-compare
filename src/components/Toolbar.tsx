import { useRef } from 'react';
import type { DiffStats, DiffViewMode, Granularity, Settings } from '../lib/types.ts';

export type ExportKind = 'diff' | 'patch' | 'html' | 'json' | 'data';

function hintFor(settings: Settings): string {
  const view =
    settings.view === 'side-by-side'
      ? 'Side by side keeps both versions aligned and scrolls them together.'
      : 'Unified view reads like a Git diff, in a single column.';
  const grain =
    settings.granularity === 'line'
      ? 'Line highlighting marks the whole line.'
      : settings.granularity === 'word'
        ? 'Word highlighting marks only the tokens that changed.'
        : 'Character highlighting marks the exact characters that changed.';
  return `${view} ${grain} Use Alt+Down and Alt+Up to move between changes. Windows and Unix line endings are treated as the same.`;
}

export function Toolbar({
  settings,
  onSettings,
  stats,
  computing,
  cursor,
  changeCount,
  onPrev,
  onNext,
  onSwap,
  onClear,
  onCopy,
  onExport,
  onImport,
  onSave,
  onRecent,
  onExample,
  onHelp,
  editorsHidden,
  onToggleEditors,
  recentCount,
  status,
}: {
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => void;
  stats: DiffStats;
  computing: boolean;
  cursor: number;
  changeCount: number;
  onPrev: () => void;
  onNext: () => void;
  onSwap: () => void;
  onClear: () => void;
  onCopy: () => void;
  onExport: (kind: ExportKind) => void;
  onImport: () => void;
  onSave: () => void;
  onRecent: () => void;
  onExample: () => void;
  onHelp: () => void;
  editorsHidden: boolean;
  onToggleEditors: () => void;
  recentCount: number;
  status: string;
}) {
  const exportRef = useRef<HTMLDetailsElement>(null);

  function chooseExport(kind: ExportKind) {
    onExport(kind);
    if (exportRef.current) exportRef.current.open = false;
  }

  const position = changeCount === 0 ? 'No changes' : `Change ${cursor + 1} of ${changeCount}`;

  return (
    <div className="toolbar">
      <div className="toolbar-row">
        <div className="segmented" role="group" aria-label="Diff view">
          <button
            type="button"
            aria-pressed={settings.view === 'side-by-side'}
            title="Original on the left, changed on the right. Both sides scroll together."
            onClick={() => onSettings({ view: 'side-by-side' satisfies DiffViewMode })}
          >
            Side by side
          </button>
          <button
            type="button"
            aria-pressed={settings.view === 'unified'}
            title="One column, the same shape as a Git diff."
            onClick={() => onSettings({ view: 'unified' satisfies DiffViewMode })}
          >
            Unified
          </button>
        </div>
        <div className="segmented" role="group" aria-label="Highlight granularity">
          {(
            [
              ['line', 'Line', 'Highlight the entire changed line.'],
              ['word', 'Word', 'Highlight only the words that changed inside a line.'],
              ['character', 'Character', 'Highlight the exact characters that changed.'],
            ] as const
          ).map(([id, label, title]) => (
            <button
              key={id}
              type="button"
              aria-pressed={settings.granularity === id}
              title={title}
              onClick={() => onSettings({ granularity: id satisfies Granularity })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="checks">
        <label title="Spaces, tabs, and indentation differences are not highlighted or counted.">
          <input
            type="checkbox"
            checked={settings.ignoreWhitespace}
            onChange={(event) => onSettings({ ignoreWhitespace: event.target.checked })}
          />
          Ignore whitespace
        </label>
        <label title="Uppercase and lowercase letters compare as the same.">
          <input
            type="checkbox"
            checked={settings.ignoreCase}
            onChange={(event) => onSettings({ ignoreCase: event.target.checked })}
          />
          Ignore case
        </label>
        <label title="Inserting or deleting blank lines is not counted. The lines stay visible.">
          <input
            type="checkbox"
            checked={settings.ignoreBlankLines}
            onChange={(event) => onSettings({ ignoreBlankLines: event.target.checked })}
          />
          Ignore blank lines
        </label>
        <label title="Wrap long lines in the diff. Very large comparisons stay on one line so scrolling stays smooth.">
          <input
            type="checkbox"
            checked={settings.wrap}
            onChange={(event) => onSettings({ wrap: event.target.checked })}
          />
          Wrap lines
        </label>
        <label title="Collapse long stretches that did not change. You can open them again.">
          <input
            type="checkbox"
            checked={settings.hideUnchanged}
            onChange={(event) => onSettings({ hideUnchanged: event.target.checked })}
          />
          Hide unchanged
        </label>
      </div>
      <div className="toolbar-row actions">
        <button type="button" className="button ghost" title="Exchange the two sides" onClick={onSwap}>
          Swap
        </button>
        <button type="button" className="button ghost" title="Clear both editors" onClick={onClear}>
          Clear
        </button>
        <button type="button" className="button ghost" title="Copy a unified diff to the clipboard" onClick={onCopy}>
          Copy diff
        </button>
        <details className="menu" ref={exportRef}>
          <summary className="button ghost" title="Download this comparison">
            Export
          </summary>
          <div className="menu-panel" role="menu">
            <button type="button" role="menuitem" onClick={() => chooseExport('diff')}>
              Unified diff (.diff)
            </button>
            <button type="button" role="menuitem" onClick={() => chooseExport('patch')}>
              Git patch (.patch)
            </button>
            <button type="button" role="menuitem" onClick={() => chooseExport('html')}>
              HTML report
            </button>
            <button type="button" role="menuitem" onClick={() => chooseExport('json')}>
              Comparison JSON
            </button>
            <button type="button" role="menuitem" onClick={() => chooseExport('data')}>
              Settings and saved comparisons
            </button>
          </div>
        </details>
        <button type="button" className="button ghost" title="Open a comparison JSON or a local-data backup" onClick={onImport}>
          Import
        </button>
        <button type="button" className="button ghost" title="Keep this comparison in Recent on this device" onClick={onSave}>
          Save
        </button>
        <button type="button" className="button ghost" title="Open comparisons saved in this browser" onClick={onRecent}>
          Recent{recentCount > 0 ? ` (${recentCount})` : ''}
        </button>
        <button type="button" className="button ghost" title="Load a short example so you can see highlighting" onClick={onExample}>
          Example
        </button>
        <button
          type="button"
          className="button ghost"
          title={editorsHidden ? 'Show the editors' : 'Give the diff the whole page'}
          onClick={onToggleEditors}
        >
          {editorsHidden ? 'Show editors' : 'Hide editors'}
        </button>
        <button type="button" className="button ghost" title="Keyboard shortcuts" onClick={onHelp}>
          Shortcuts
        </button>
      </div>
      <div className="toolbar-row stats-row">
        <p className="stats" aria-label="Change statistics">
          <span className="chip add">+ {stats.added} added</span>
          <span className="chip del">− {stats.removed} removed</span>
          <span className="chip changed">~ {stats.changed} changed</span>
          {computing ? <span className="computing">Comparing…</span> : null}
        </p>
        <div className="nav-changes">
          <button type="button" className="button ghost" onClick={onPrev} disabled={changeCount === 0 || cursor <= 0} aria-keyshortcuts="Alt+ArrowUp">
            Previous
          </button>
          <span className="nav-position">{position}</span>
          <button
            type="button"
            className="button ghost"
            onClick={onNext}
            disabled={changeCount === 0 || cursor >= changeCount - 1}
            aria-keyshortcuts="Alt+ArrowDown"
          >
            Next
          </button>
        </div>
      </div>
      <p className="hint" id="diff-hint">
        {hintFor(settings)}
      </p>
      <p className="status" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
