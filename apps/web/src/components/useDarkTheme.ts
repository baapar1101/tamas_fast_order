import { useEffect, useState } from 'react';

function readDarkTheme(): boolean {
  return typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
}

/** Follow the same <html data-theme> attribute controlled by ThemeToggle. */
export function useDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(readDarkTheme);

  useEffect(() => {
    const html = document.documentElement;
    const sync = () => setIsDark(readDarkTheme());
    const observer = new MutationObserver(sync);
    observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    // ThemeToggle may have restored the saved preference before this effect ran.
    sync();
    return () => observer.disconnect();
  }, []);

  return isDark;
}
