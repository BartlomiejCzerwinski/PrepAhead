import { useEffect, useState, type ReactNode } from 'react';

import {
  applyTheme,
  readThemeCookie,
  watchSystem,
  writeThemeCookie,
  type Theme,
} from '../../lib/theme/client';

const OPTIONS: { value: Theme; label: string; icon: ReactNode }[] = [
  {
    value: 'light',
    label: 'Light',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path
          strokeLinecap="round"
          d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"
        />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
      </svg>
    ),
  },
  {
    value: 'system',
    label: 'System',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path strokeLinecap="round" d="M8 20h8m-4-4v4" />
      </svg>
    ),
  },
];

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    setTheme(readThemeCookie());
  }, []);

  useEffect(() => {
    if (theme !== 'system') {
      return;
    }
    return watchSystem(() => applyTheme('system'));
  }, [theme]);

  function select(value: Theme) {
    setTheme(value);
    writeThemeCookie(value);
    applyTheme(value);

    void fetch('/api/settings/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: value }),
    }).catch(() => {
      // Best-effort: anonymous users get a 401, and a transient failure still
      // leaves the choice applied + persisted in the cookie on this device.
    });
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => select(option.value)}
            aria-pressed={active}
            title={option.label}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition [&_svg]:h-4 [&_svg]:w-4 ${
              active
                ? 'bg-[var(--surface-strong)] text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {option.icon}
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
