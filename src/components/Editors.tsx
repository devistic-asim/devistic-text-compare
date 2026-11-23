import { useRef, useState } from 'react';

const MAX_FILE_BYTES = 8_000_000;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readTextFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('That file is over 8 MB. Try a smaller text file.');
  }
  const text = await file.text();
  if (text.includes('\u0000')) {
    throw new Error('That file looks binary. Drop a plain text file.');
  }
  return text;
}

export function Editors({
  hidden,
  original,
  changed,
  originalName,
  changedName,
  onOriginal,
  onChanged,
  onOriginalName,
  onChangedName,
  onStatus,
}: {
  hidden: boolean;
  original: string;
  changed: string;
  originalName: string;
  changedName: string;
  onOriginal: (value: string) => void;
  onChanged: (value: string) => void;
  onOriginalName: (value: string) => void;
  onChangedName: (value: string) => void;
  onStatus: (message: string) => void;
}) {
  if (hidden) return null;
  return (
    <div className="editors">
      <Pane
        label="Original"
        hint="The starting text. Paste, or drop a file."
        value={original}
        name={originalName}
        onChange={onOriginal}
        onName={onOriginalName}
        onStatus={onStatus}
      />
      <Pane
        label="Changed"
        hint="The edited text. Paste, or drop a file."
        value={changed}
        name={changedName}
        onChange={onChanged}
        onName={onChangedName}
        onStatus={onStatus}
      />
    </div>
  );
}

function Pane({
  label,
  hint,
  value,
  name,
  onChange,
  onName,
  onStatus,
}: {
  label: string;
  hint: string;
  value: string;
  name: string;
  onChange: (value: string) => void;
  onName: (value: string) => void;
  onStatus: (message: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const inputId = `${label.toLowerCase()}-file`;
  const normalized = value.replaceAll(/\r\n|\r/g, '\n');
  const shownLines =
    normalized.length === 0 ? 0 : normalized.endsWith('\n') ? normalized.split('\n').length - 1 : normalized.split('\n').length;

  async function takeFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = await readTextFile(file);
      onChange(text);
      onName(file.name);
      onStatus(`Loaded ${file.name}.`);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'Could not read that file.');
    }
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text);
      onStatus(`Pasted into ${label}.`);
    } catch {
      onStatus('Clipboard permission was blocked. Click the editor and press Ctrl+V or Command+V.');
    }
  }

  return (
    <section
      className={`pane ${dragging ? 'dragging' : ''}`}
      aria-label={label}
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => {
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        void takeFile(event.dataTransfer.files[0]);
      }}
    >
      <div className="pane-head">
        <div>
          <h2>{label}</h2>
          <p>{hint}</p>
        </div>
        <div className="pane-tools">
          <button type="button" className="button ghost" onClick={() => void paste()} title={`Paste from the clipboard into ${label}`}>
            Paste
          </button>
          <label className="button ghost file-button" title={`Upload a text file into ${label}`}>
            Upload
            <input
              id={inputId}
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                void takeFile(file);
                event.target.value = '';
              }}
            />
          </label>
        </div>
      </div>
      <label className="name-field">
        <span className="sr-only">{label} file name</span>
        <input
          value={name}
          onChange={(event) => onName(event.target.value)}
          aria-label={`${label} file name`}
          spellCheck={false}
          maxLength={180}
        />
      </label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`${label} text`}
        placeholder="Paste text here, or drop a file"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />
      <p className="pane-meta">
        {shownLines} {shownLines === 1 ? 'line' : 'lines'} · {formatSize(new Blob([value]).size)}
        {shownLines > 2000 ? ' · large text is compared in the background' : ''}
      </p>
    </section>
  );
}
