import { useEffect, useMemo, useRef, useState } from 'react';
import { buildDisplay, foldId } from '../lib/display.ts';
import type { DiffModel, DiffRow, DiffViewMode, Span } from '../lib/types.ts';

const ROW_HEIGHT = 28;
const VIRTUAL_AT = 600;
const NO_FOLDS = new Set<string>();

type Visual =
  | { type: 'fold'; key: string; start: number; end: number; count: number }
  | { type: 'side'; key: string; rowIndex: number; row: DiffRow; active: boolean }
  | {
      type: 'uni';
      key: string;
      rowIndex: number;
      active: boolean;
      oldNumber: number | null;
      newNumber: number | null;
      marker: string;
      label: string;
      tone: 'equal' | 'delete' | 'insert';
      spans: Span[];
    };

function LineText({ spans, wrap }: { spans: Span[]; wrap: boolean }) {
  if (spans.length === 0) return <div className={`line-text ${wrap ? 'wrap' : 'nowrap'}`}>&nbsp;</div>;
  const partial = spans.some((span) => span.kind === 'equal') && spans.some((span) => span.kind !== 'equal');
  return (
    <div className={`line-text ${wrap ? 'wrap' : 'nowrap'}`}>
      {spans.map((span, index) => (
        <span key={index} className={partial && span.kind !== 'equal' ? `token token-${span.kind}` : undefined}>
          {span.text.length > 0 ? span.text : '\u00a0'}
        </span>
      ))}
    </div>
  );
}

function visualsFor(
  model: DiffModel,
  view: DiffViewMode,
  hideUnchanged: boolean,
  expanded: ReadonlySet<string>,
  activeRow: number | undefined,
): Visual[] {
  const entries = buildDisplay(model.rows, hideUnchanged, expanded);
  const visuals: Visual[] = [];
  for (const entry of entries) {
    if (entry.type === 'fold') {
      visuals.push({ type: 'fold', key: `fold-${entry.start}`, start: entry.start, end: entry.end, count: entry.count });
      continue;
    }
    const row = model.rows[entry.index];
    if (!row) continue;
    const active = entry.index === activeRow;
    if (view === 'side-by-side') {
      visuals.push({ type: 'side', key: `side-${entry.index}`, rowIndex: entry.index, row, active });
      continue;
    }
    if (row.kind === 'change') {
      visuals.push({
        type: 'uni',
        key: `uni-${entry.index}-old`,
        rowIndex: entry.index,
        active,
        oldNumber: row.oldNumber,
        newNumber: null,
        marker: '−',
        label: 'Removed text',
        tone: 'delete',
        spans: row.left,
      });
      visuals.push({
        type: 'uni',
        key: `uni-${entry.index}-new`,
        rowIndex: entry.index,
        active,
        oldNumber: null,
        newNumber: row.newNumber,
        marker: '+',
        label: 'Added text',
        tone: 'insert',
        spans: row.right,
      });
      continue;
    }
    const insert = row.kind === 'insert';
    visuals.push({
      type: 'uni',
      key: `uni-${entry.index}`,
      rowIndex: entry.index,
      active,
      oldNumber: row.oldNumber,
      newNumber: row.newNumber,
      marker: row.kind === 'delete' ? '−' : insert ? '+' : '',
      label: row.kind === 'delete' ? 'Removed line' : insert ? 'Added line' : '',
      tone: row.kind === 'delete' ? 'delete' : insert ? 'insert' : 'equal',
      spans: insert ? row.right : row.left,
    });
  }
  return visuals;
}

export function DiffView({
  model,
  view,
  wrap,
  hideUnchanged,
  originalName,
  changedName,
  hasText,
  computing,
  activeRow,
  navToken,
}: {
  model: DiffModel;
  view: DiffViewMode;
  wrap: boolean;
  hideUnchanged: boolean;
  originalName: string;
  changedName: string;
  hasText: boolean;
  computing: boolean;
  activeRow: number | undefined;
  navToken: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const expandKey = `${view}:${hideUnchanged ? 'hide' : 'show'}`;
  const [expandedState, setExpandedState] = useState<{ key: string; folds: Set<string> }>({
    key: expandKey,
    folds: new Set(),
  });
  const expanded = expandedState.key === expandKey ? expandedState.folds : NO_FOLDS;
  const [windowRange, setWindowRange] = useState({ start: 0, end: 80 });

  const visuals = useMemo(
    () => visualsFor(model, view, hideUnchanged, expanded, activeRow),
    [model, view, hideUnchanged, expanded, activeRow],
  );

  const virtual = visuals.length >= VIRTUAL_AT;
  const effectiveWrap = wrap && !virtual;

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !virtual) return;
    const update = () => {
      const start = Math.max(0, Math.floor(element.scrollTop / ROW_HEIGHT) - 20);
      const count = Math.ceil(element.clientHeight / ROW_HEIGHT) + 40;
      setWindowRange({ start, end: Math.min(visuals.length, start + count) });
    };
    element.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [virtual, visuals.length]);

  useEffect(() => {
    if (navToken === 0 || activeRow === undefined) return;
    const element = scrollRef.current;
    if (!element) return;
    const index = visuals.findIndex((item) => item.type !== 'fold' && item.rowIndex === activeRow);
    if (index < 0) return;
    if (virtual) {
      element.scrollTop = Math.max(0, index * ROW_HEIGHT - element.clientHeight / 2);
      return;
    }
    const row = element.querySelector(`[data-row="${activeRow}"]`);
    if (!(row instanceof HTMLElement)) return;
    const rowRect = row.getBoundingClientRect();
    const boxRect = element.getBoundingClientRect();
    element.scrollTop += rowRect.top - boxRect.top - element.clientHeight / 2 + rowRect.height / 2;
  }, [navToken, activeRow, virtual, visuals]);

  function toggleFold(start: number, end: number) {
    const id = foldId(start, end);
    setExpandedState((current) => {
      const folds = new Set(current.key === expandKey ? current.folds : []);
      if (folds.has(id)) folds.delete(id);
      else folds.add(id);
      return { key: expandKey, folds };
    });
  }

  const slice = virtual ? visuals.slice(windowRange.start, windowRange.end) : visuals;
  const offset = virtual ? windowRange.start * ROW_HEIGHT : 0;

  return (
    <section className="diff-card" id="comparison" aria-label="Differences" aria-describedby="diff-hint">
      <div className="diff-head">
        <h2>Differences</h2>
        <p>
          {view === 'side-by-side'
            ? `${originalName} and ${changedName} stay aligned on one scroll.`
            : 'Removals and additions in one column.'}
          {virtual ? ' Line wrap is paused so this large diff stays responsive.' : ''}
        </p>
      </div>
      {!hasText ? (
        <div className="empty-diff">
          <p>Paste into both panes, drop a text file, or load the example.</p>
          <p>Differences show up here as you type. Nothing is sent to a server.</p>
        </div>
      ) : model.timedOut ? (
        <div className="empty-diff">
          <p>This comparison is too large to finish. Try a shorter excerpt.</p>
        </div>
      ) : model.error ? (
        <div className="empty-diff">
          <p>{model.error}</p>
        </div>
      ) : (
        <div className={`diff-scroll ${virtual ? 'is-virtual' : ''}`} ref={scrollRef} tabIndex={0}>
          {model.stats.added === 0 && model.stats.removed === 0 && model.stats.changed === 0 && !computing ? (
            <p className="match-banner">No differences. These texts match with the options you have on.</p>
          ) : null}
          <div
            className={`diff-table ${view}`}
            style={virtual ? { height: visuals.length * ROW_HEIGHT } : undefined}
          >
            <div style={virtual ? { transform: `translateY(${offset}px)` } : undefined}>
              {slice.map((item) =>
                item.type === 'fold' ? (
                  <button
                    key={item.key}
                    type="button"
                    className="fold"
                    onClick={() => toggleFold(item.start, item.end)}
                  >
                    Show {item.count} unchanged lines
                  </button>
                ) : item.type === 'side' ? (
                  <SideRow key={item.key} row={item.row} rowIndex={item.rowIndex} active={item.active} wrap={effectiveWrap} />
                ) : (
                  <div key={item.key} className={`diff-row uni tone-${item.tone} ${item.active ? 'is-active' : ''}`} data-row={item.rowIndex}>
                    <Mark symbol={item.marker} label={item.label} tone={item.tone} />
                    <div className="line-no" aria-hidden="true">{item.oldNumber ?? ''}</div>
                    <div className="line-no" aria-hidden="true">{item.newNumber ?? ''}</div>
                    <div className={`line-cell ${item.tone === 'equal' ? '' : 'touched'}`}>
                      <LineText spans={item.spans} wrap={effectiveWrap} />
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SideRow({
  row,
  rowIndex,
  active,
  wrap,
}: {
  row: DiffRow;
  rowIndex: number;
  active: boolean;
  wrap: boolean;
}) {
  const leftTone = row.kind === 'delete' || row.kind === 'change' ? 'delete' : 'equal';
  const rightTone = row.kind === 'insert' || row.kind === 'change' ? 'insert' : 'equal';
  return (
    <div className={`diff-row side ${active ? 'is-active' : ''}`} data-row={rowIndex}>
      <Mark
        symbol={leftTone === 'delete' ? '−' : ''}
        label={row.isChange ? 'Removed or changed on the left' : ''}
        tone={leftTone}
      />
      <div className="line-no" aria-hidden="true">
        {row.oldNumber ?? ''}
      </div>
      <div className={`line-cell tone-${leftTone}`}>
        <LineText spans={row.left} wrap={wrap} />
      </div>
      <Mark
        symbol={rightTone === 'insert' ? '+' : ''}
        label={row.isChange ? 'Added or changed on the right' : ''}
        tone={rightTone}
      />
      <div className="line-no" aria-hidden="true">
        {row.newNumber ?? ''}
      </div>
      <div className={`line-cell tone-${rightTone}`}>
        <LineText spans={row.right} wrap={wrap} />
      </div>
    </div>
  );
}

function Mark({ symbol, label, tone }: { symbol: string; label: string; tone: string }) {
  return (
    <div className={`mark tone-${tone}`}>
      <span aria-hidden="true">{symbol || '\u00a0'}</span>
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}
