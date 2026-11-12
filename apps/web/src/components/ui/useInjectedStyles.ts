import { useLayoutEffect, useState } from 'react';

/**
 * Attach a stylesheet only while the calling page is mounted.
 *
 * The Tailwind utilities used by the new pages (`flex`, `hidden`, `text-xs`,
 * …) share names with legacy site classes. A normal CSS import would stay in
 * the document after navigating away and restyle the legacy pages, so these
 * sheets are inlined and removed again on unmount. Runs before paint, so the
 * page never shows unstyled.
 */
export function useInjectedStyles(name: string, css: string): boolean {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const style = document.createElement('style');
    style.dataset.injected = name;
    style.textContent = css;
    document.head.appendChild(style);
    setReady(true);
    return () => style.remove();
  }, [name, css]);
  return ready;
}
