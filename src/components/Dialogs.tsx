import { useEffect, useRef, type ReactNode } from 'react';
import type { RecentComparison } from '../lib/types.ts';

export function Modal({
  open,
  title,
  labelledBy,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={labelledBy}
      onClose={onClose}
    >
      <div className="modal-head">
        <h2 id={labelledBy}>{title}</h2>
        <button type="button" className="button ghost" onClick={onClose}>
          Close
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="Shortcuts and how to read the diff" labelledBy="help-title" onClose={onClose}>
      <ul className="help-list">
        <li>
          <kbd>Alt</kbd> + <kbd>↓</kbd> / <kbd>↑</kbd> next or previous change, even while typing.
        </li>
        <li>
          <kbd>N</kbd> or <kbd>J</kbd>, and <kbd>P</kbd> or <kbd>K</kbd>, do the same when you are not in a text field.
        </li>
        <li>
          <kbd>?</kbd> opens this list.
        </li>
        <li>Red is removed. Green is added. Yellow marks a changed line in the summary.</li>
        <li>A patch download is an exact transform. Ignore options change the highlight, not the patch.</li>
        <li>Saved comparisons and settings stay in local storage on this device.</li>
      </ul>
    </Modal>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  titleId,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  titleId: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} labelledBy={titleId} onClose={onClose}>
      <p>{body}</p>
      <div className="modal-actions">
        <button type="button" className="button ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="button primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function RecentDialog({
  open,
  items,
  onClose,
  onOpen,
  onDelete,
}: {
  open: boolean;
  items: RecentComparison[];
  onClose: () => void;
  onOpen: (item: RecentComparison) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Modal open={open} title="Recent comparisons" labelledBy="recent-title" onClose={onClose}>
      {items.length === 0 ? (
        <p>Nothing saved yet. Use Save, or just keep typing — the latest comparison is kept on this device.</p>
      ) : (
        <ul className="recent-list">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p>
                  {new Date(item.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  {' · '}
                  {item.original.length + item.changed.length > 1024
                    ? `${((item.original.length + item.changed.length) / 1024).toFixed(1)} KB`
                    : `${item.original.length + item.changed.length} characters`}
                </p>
              </div>
              <div className="pane-tools">
                <button type="button" className="button primary" onClick={() => onOpen(item)}>
                  Open
                </button>
                <button type="button" className="button ghost" onClick={() => onDelete(item.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
