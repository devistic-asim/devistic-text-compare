export function PrivacyNotice({ onDismiss, onClearData }: { onDismiss: () => void; onClearData: () => void }) {
  return (
    <div className="privacy" role="region" aria-label="Privacy">
      <p>
        We don't use cookies for tracking and we don't collect or store your data on any server.
        Everything stays in your browser on this device.
      </p>
      <div className="privacy-actions">
        <button type="button" className="button primary" onClick={onDismiss}>
          Dismiss
        </button>
        <button type="button" className="button ghost" onClick={onClearData}>
          Clear my local data
        </button>
      </div>
    </div>
  );
}
