export function Footer({ onClearData }: { onClearData: () => void }) {
  return (
    <footer className="footer">
      <p>Free, and only in your browser.</p>
      <a href="https://github.com/devistic-asim" target="_blank" rel="noopener noreferrer">
        github.com/devistic-asim
      </a>
      <a
        href="https://github.com/devistic-asim/devistic-text-compare"
        target="_blank"
        rel="noopener noreferrer"
      >
        Star or contribute
      </a>
      <button type="button" className="text-button" onClick={onClearData}>
        Clear my local data
      </button>
    </footer>
  );
}
