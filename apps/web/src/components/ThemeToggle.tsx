import { useState, useEffect } from 'react';
import { Icon } from './Icon';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    let theme: string | null = document.documentElement.getAttribute('data-theme');
    try { theme = localStorage.getItem('tamas_theme'); } catch { /* The in-page theme still works without storage. */ }
    if (theme === 'dark') {
      setIsDark(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      setIsDark(false);
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('tamas_theme', 'light'); } catch { /* Storage may be blocked. */ }
      setIsDark(false);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('tamas_theme', 'dark'); } catch { /* Storage may be blocked. */ }
      setIsDark(true);
    }
  };

  return (
    <button
      type="button"
      className="btn ghost icon-only theme-toggle"
      onClick={toggleTheme}
      title={isDark ? 'تغییر به حالت روز' : 'تغییر به حالت شب'}
      aria-label={isDark ? 'تغییر به حالت روز' : 'تغییر به حالت شب'}
      aria-pressed={isDark}
    >
      <Icon name={isDark ? 'sun' : 'moon'} />
    </button>
  );
}
