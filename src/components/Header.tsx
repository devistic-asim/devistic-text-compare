import type { ThemeChoice } from '../lib/types.ts';

const themes: { id: ThemeChoice; label: string; hint: string }[] = [
  { id: 'light', label: 'Light', hint: 'Light background' },
  { id: 'dark', label: 'Dark', hint: 'Dark background' },
  { id: 'system', label: 'System', hint: 'Match this device' },
];

export function Header({
  theme,
  onTheme,
}: {
  theme: ThemeChoice;
  onTheme: (theme: ThemeChoice) => void;
}) {
  return (
    <header className="topbar">
      <a className="skip-link" href="#comparison">
        Skip to comparison
      </a>
      <div className="brand">
        <a
          className="brand-mark"
          href="https://github.com/devistic-asim"
          target="_blank"
          rel="noopener noreferrer"
          title="Devistic on GitHub"
        >
          <img src={`${import.meta.env.BASE_URL}devistic-logo.jpg`} alt="Devistic" width="44" height="44" />
        </a>
        <div>
          <p className="brand-name">Devistic Text Compare</p>
          <p className="brand-tag">Private diff. Your text stays on this device.</p>
        </div>
      </div>
      <div className="theme-switch" role="group" aria-label="Color theme">
        {themes.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={theme === item.id}
            title={item.hint}
            onClick={() => onTheme(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
}
