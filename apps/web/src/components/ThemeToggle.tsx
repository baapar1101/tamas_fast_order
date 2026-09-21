import { useState, useEffect } from 'react';
import { Icon } from './Icon';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const theme = localStorage.getItem('tamas_theme');
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
      localStorage.setItem('tamas_theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('tamas_theme', 'dark');
      setIsDark(true);
    }
  };

  return (
    <button
      type="button"
      className="btn ghost icon-only theme-toggle"
      onClick={toggleTheme}
      title={isDark ? 'تغییر به حالت روز' : 'تغییر به حالت شب'}
    >
      <Icon name={isDark ? 'sun' : 'moon'} />
    </button>
  );
}
