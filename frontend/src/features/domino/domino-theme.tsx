'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

export type DominoTheme = 'light' | 'dark';

const THEME_KEY = 'domino_theme';

interface ThemeContextType {
  theme: DominoTheme;
  setTheme: (theme: DominoTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const themeListeners = new Set<() => void>();

function emitThemeChange() {
  themeListeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}

function applyTheme(theme: DominoTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
}

function readStoredTheme(): DominoTheme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* ignore */
  }
  return 'light';
}

function getSnapshot(): DominoTheme {
  return readStoredTheme();
}

function getServerSnapshot(): DominoTheme {
  return 'light';
}

export function DominoThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: DominoTheme) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
    applyTheme(next);
    emitThemeChange();
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useDominoTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useDominoTheme must be used within DominoThemeProvider');
  return ctx;
}
