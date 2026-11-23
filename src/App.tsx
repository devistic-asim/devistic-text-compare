import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog, HelpDialog, RecentDialog } from './components/Dialogs.tsx';
import { DiffView } from './components/DiffView.tsx';
import { Editors } from './components/Editors.tsx';
import { Footer } from './components/Footer.tsx';
import { Header } from './components/Header.tsx';
import { PrivacyNotice } from './components/PrivacyNotice.tsx';
import { Toolbar, type ExportKind } from './components/Toolbar.tsx';
import { downloadText } from './download.ts';
import { useDiff } from './hooks/useDiff.ts';
import { renderHtmlExport } from './lib/htmlExport.ts';
import { comparisonDocument, dataDocument, parseImport } from './lib/importData.ts';
import { buildGitPatch, buildUnifiedDiff } from './lib/patch.ts';
import {
  SAMPLE_CHANGED,
  SAMPLE_CHANGED_NAME,
  SAMPLE_ORIGINAL,
  SAMPLE_ORIGINAL_NAME,
} from './lib/sample.ts';
import {
  clearAppStorage,
  comparisonTitle,
  readDraft,
  readLocalData,
  upsertRecent,
  writeDraft,
  writeLocalData,
} from './lib/storage.ts';
import {
  DEFAULT_SETTINGS,
  MAX_STORED_CHARS,
  SESSION_KEY,
  pickOptions,
  type LocalData,
  type RecentComparison,
  type Settings,
} from './lib/types.ts';
import { applyTheme } from './theme.ts';

function sessionId(): string {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

function initialDraft() {
  try {
    const draft = readDraft(sessionStorage);
    if (!draft || (draft.original.length === 0 && draft.changed.length === 0)) return null;
    return draft;
  } catch {
    return null;
  }
}

export default function App() {
  const [store, setStore] = useState<LocalData>(() => readLocalData(localStorage));
  const [original, setOriginal] = useState(() => initialDraft()?.original ?? '');
  const [changed, setChanged] = useState(() => initialDraft()?.changed ?? '');
  const [originalName, setOriginalName] = useState(() => initialDraft()?.originalName ?? 'original.txt');
  const [changedName, setChangedName] = useState(() => initialDraft()?.changedName ?? 'changed.txt');
  const [status, setStatus] = useState('');
  const [cursor, setCursor] = useState(0);
  const [navToken, setNavToken] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [confirming, setConfirming] = useState<'clear' | 'wipe' | null>(null);
  const [editorsHidden, setEditorsHidden] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const settings = store.settings;
  const options = useMemo(() => pickOptions(settings), [settings]);

  useEffect(() => {
    applyTheme(settings.theme);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (settings.theme === 'system') applyTheme('system');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [settings.theme]);

  useEffect(() => {
    writeLocalData(localStorage, store);
  }, [store]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      writeDraft(sessionStorage, { original, changed, originalName, changedName });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [original, changed, originalName, changedName]);

  useEffect(() => {
    if (original.length + changed.length === 0 || original.length + changed.length > MAX_STORED_CHARS) return;
    const timer = window.setTimeout(() => {
      const id = sessionId();
      setStore((current) => ({
        ...current,
        recent: upsertRecent(current.recent, {
          id,
          title: comparisonTitle(originalName, changedName, original, changed),
          savedAt: new Date().toISOString(),
          originalName,
          changedName,
          original,
          changed,
          options: pickOptions(current.settings),
          view: current.settings.view,
        }),
      }));
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [
    original,
    changed,
    originalName,
    changedName,
    settings.view,
    settings.granularity,
    settings.ignoreBlankLines,
    settings.ignoreCase,
    settings.ignoreWhitespace,
  ]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(''), 4800);
    return () => window.clearTimeout(timer);
  }, [status]);

  const { model, computing } = useDiff(original, changed, options);
  const changeRows = useMemo(() => {
    const indexes: number[] = [];
    model.rows.forEach((row, index) => {
      if (row.isChange) indexes.push(index);
    });
    return indexes;
  }, [model]);
  const safeCursor = changeRows.length === 0 ? 0 : Math.min(cursor, changeRows.length - 1);

  const move = useCallback(
    (delta: number) => {
      if (changeRows.length === 0) return;
      setCursor((current) => {
        const base = Math.min(Math.max(current, 0), changeRows.length - 1);
        return Math.min(changeRows.length - 1, Math.max(0, base + delta));
      });
      setNavToken((token) => token + 1);
    },
    [changeRows.length],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        Boolean(target.closest('textarea, input, select, [contenteditable="true"]'));
      if (event.altKey && event.key === 'ArrowDown') {
        event.preventDefault();
        move(1);
      } else if (event.altKey && event.key === 'ArrowUp') {
        event.preventDefault();
        move(-1);
      } else if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey && (event.key === 'n' || event.key === 'j')) {
        event.preventDefault();
        move(1);
      } else if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey && (event.key === 'p' || event.key === 'k')) {
        event.preventDefault();
        move(-1);
      } else if (!typing && event.key === '?') {
        event.preventDefault();
        setHelpOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  useEffect(() => {
    const prevent = (event: DragEvent) => event.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  function updateSettings(patch: Partial<Settings>) {
    setStore((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  }

  function loadRecent(item: RecentComparison) {
    setOriginal(item.original);
    setChanged(item.changed);
    setOriginalName(item.originalName);
    setChangedName(item.changedName);
    updateSettings({ ...item.options, view: item.view });
    setRecentOpen(false);
    setStatus('Opened a saved comparison.');
  }

  function savePinned() {
    if (original.length + changed.length === 0) {
      setStatus('Nothing to save yet.');
      return;
    }
    if (original.length + changed.length > MAX_STORED_CHARS) {
      setStatus('This comparison is too large to store here. Export it as JSON instead.');
      return;
    }
    const item: RecentComparison = {
      id: crypto.randomUUID(),
      title: comparisonTitle(originalName, changedName, original, changed),
      savedAt: new Date().toISOString(),
      originalName,
      changedName,
      original,
      changed,
      options,
      view: settings.view,
    };
    setStore((current) => ({ ...current, recent: upsertRecent(current.recent, item) }));
    setStatus('Saved on this device.');
  }

  async function copyDiff() {
    try {
      await navigator.clipboard.writeText(buildUnifiedDiff(original, changed, originalName, changedName));
      setStatus('Copied the unified diff.');
    } catch {
      setStatus('Could not copy. Your browser blocked the clipboard.');
    }
  }

  function exportAs(kind: ExportKind) {
    if (kind === 'data') {
      downloadText('devistic-text-compare-data.json', dataDocument(store), 'application/json');
      setStatus('Exported settings and saved comparisons.');
      return;
    }
    if (kind === 'diff') {
      downloadText('comparison.diff', buildUnifiedDiff(original, changed, originalName, changedName), 'text/x-diff');
    } else if (kind === 'patch') {
      downloadText('comparison.patch', buildGitPatch(original, changed, originalName, changedName), 'text/x-diff');
    } else if (kind === 'html') {
      downloadText(
        'comparison.html',
        renderHtmlExport({ originalName, changedName, model, view: settings.view, options }),
        'text/html',
      );
    } else {
      downloadText(
        'comparison.json',
        comparisonDocument({
          original,
          changed,
          originalName,
          changedName,
          options,
          view: settings.view,
          stats: model.stats,
        }),
        'application/json',
      );
    }
    setStatus('Download started. The file never leaves this device unless you share it.');
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      const result = parseImport(await file.text());
      if (result.type === 'error') {
        setStatus(result.message);
        return;
      }
      if (result.type === 'data') {
        setStore(result.data);
        applyTheme(result.data.settings.theme);
        setStatus('Imported settings and saved comparisons.');
        return;
      }
      setOriginal(result.original);
      setChanged(result.changed);
      setOriginalName(result.originalName);
      setChangedName(result.changedName);
      if (result.options || result.view) {
        updateSettings({
          ...(result.options ?? {}),
          ...(result.view ? { view: result.view } : {}),
        });
      }
      setStatus('Imported comparison.');
    } catch {
      setStatus('Could not read that file.');
    }
  }

  function wipe() {
    clearAppStorage(localStorage, sessionStorage);
    setStore({ settings: { ...DEFAULT_SETTINGS }, recent: [] });
    setOriginal('');
    setChanged('');
    setOriginalName('original.txt');
    setChangedName('changed.txt');
    applyTheme('system');
    setConfirming(null);
    setStatus('Local data cleared.');
  }

  return (
    <div className="app">
      <Header theme={settings.theme} onTheme={(theme) => updateSettings({ theme })} />
      {!settings.privacyDismissed ? (
        <PrivacyNotice
          onDismiss={() => updateSettings({ privacyDismissed: true })}
          onClearData={() => setConfirming('wipe')}
        />
      ) : null}
      <main className="workspace">
        <Toolbar
          settings={settings}
          onSettings={updateSettings}
          stats={model.stats}
          computing={computing}
          cursor={safeCursor}
          changeCount={changeRows.length}
          onPrev={() => move(-1)}
          onNext={() => move(1)}
          onSwap={() => {
            setOriginal(changed);
            setChanged(original);
            setOriginalName(changedName);
            setChangedName(originalName);
            setStatus('Swapped the two sides.');
          }}
          onClear={() => {
            if (original.length === 0 && changed.length === 0) return;
            setConfirming('clear');
          }}
          onCopy={() => void copyDiff()}
          onExport={exportAs}
          onImport={() => importRef.current?.click()}
          onSave={savePinned}
          onRecent={() => setRecentOpen(true)}
          onExample={() => {
            setOriginal(SAMPLE_ORIGINAL);
            setChanged(SAMPLE_CHANGED);
            setOriginalName(SAMPLE_ORIGINAL_NAME);
            setChangedName(SAMPLE_CHANGED_NAME);
            setStatus('Loaded the example. Edit either side and the diff updates.');
          }}
          onHelp={() => setHelpOpen(true)}
          editorsHidden={editorsHidden}
          onToggleEditors={() => setEditorsHidden((value) => !value)}
          recentCount={store.recent.length}
          status={status}
        />
        <Editors
          hidden={editorsHidden}
          original={original}
          changed={changed}
          originalName={originalName}
          changedName={changedName}
          onOriginal={setOriginal}
          onChanged={setChanged}
          onOriginalName={setOriginalName}
          onChangedName={setChangedName}
          onStatus={setStatus}
        />
        <DiffView
          model={model}
          view={settings.view}
          wrap={settings.wrap}
          hideUnchanged={settings.hideUnchanged}
          originalName={originalName}
          changedName={changedName}
          hasText={original.length > 0 || changed.length > 0}
          computing={computing}
          activeRow={changeRows[safeCursor]}
          navToken={navToken}
        />
      </main>
      <Footer onClearData={() => setConfirming('wipe')} />
      <input
        ref={importRef}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        aria-label="Import JSON"
        onChange={(event) => {
          void importFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <RecentDialog
        open={recentOpen}
        items={store.recent}
        onClose={() => setRecentOpen(false)}
        onOpen={loadRecent}
        onDelete={(id) => setStore((current) => ({ ...current, recent: current.recent.filter((item) => item.id !== id) }))}
      />
      <ConfirmDialog
        open={confirming === 'clear'}
        title="Clear both sides?"
        body="This removes the text in the editors. A copy may still be in Recent on this device."
        confirmLabel="Clear text"
        titleId="clear-title"
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          setOriginal('');
          setChanged('');
          setOriginalName('original.txt');
          setChangedName('changed.txt');
          setConfirming(null);
          setStatus('Cleared both sides.');
        }}
      />
      <ConfirmDialog
        open={confirming === 'wipe'}
        title="Clear local data?"
        body="This deletes saved comparisons, settings, and the draft stored in this browser. It does not affect anything else."
        confirmLabel="Clear my local data"
        titleId="wipe-title"
        onClose={() => setConfirming(null)}
        onConfirm={wipe}
      />
    </div>
  );
}
