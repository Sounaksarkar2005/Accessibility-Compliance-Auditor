'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';

export type Theme = 'light' | 'dark' | 'system';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (currentTheme: Theme) => {
      if (currentTheme === 'dark') {
        root.classList.add('dark');
      } else if (currentTheme === 'light') {
        root.classList.remove('dark');
      } else {
        if (mediaQuery.matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    applyTheme(theme);

    const handleMediaChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, [theme, mounted]);

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  if (!mounted) {
    return (
      <div className="w-24 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 animate-pulse" />
    );
  }

  return (
    <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 p-1 rounded-lg border border-neutral-200 dark:border-neutral-800">
      <button
        onClick={() => updateTheme('light')}
        aria-label="Light mode"
        title="Light mode"
        className={`p-1.5 rounded-md transition-all ${
          theme === 'light'
            ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
            : 'text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white'
        }`}
      >
        <Sun className="w-4 h-4" />
      </button>
      <button
        onClick={() => updateTheme('dark')}
        aria-label="Dark mode"
        title="Dark mode"
        className={`p-1.5 rounded-md transition-all ${
          theme === 'dark'
            ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
            : 'text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white'
        }`}
      >
        <Moon className="w-4 h-4" />
      </button>
      <button
        onClick={() => updateTheme('system')}
        aria-label="System preference"
        title="System preference"
        className={`p-1.5 rounded-md transition-all ${
          theme === 'system'
            ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
            : 'text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white'
        }`}
      >
        <Laptop className="w-4 h-4" />
      </button>
    </div>
  );
}
