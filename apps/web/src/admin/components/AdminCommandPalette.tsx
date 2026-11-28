import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import './admin-command-palette.css';

export interface PaletteItem {
  to: string;
  label: string;
  group: string;
  icon?: ReactNode;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: PaletteItem[];
}

/** Persian/Arabic letter variants and spacing collapse to one form for matching. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌\s]+/g, ' ')
    .trim();
}

/**
 * «جستجو در پنل» (Ctrl+K): finds an admin section by name or group and opens it.
 * Arrow keys move, Enter opens, Escape closes.
 */
export function AdminCommandPalette({ open, onClose, items }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setIndex(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const results = useMemo(() => {
    const q = fold(query);
    if (!q) return items;
    return items.filter((item) => fold(`${item.label} ${item.group}`).includes(q));
  }, [items, query]);

  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open) return null;

  const go = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    navigate(item.to);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[index]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="admin-palette-backdrop" onMouseDown={onClose}>
      <div
        className="admin-palette"
        role="dialog"
        aria-modal="true"
        aria-label="جستجو در پنل"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="admin-palette__field">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="نام بخش را بنویسید؛ مثلاً «سفارش» یا «پیامک»…"
            aria-label="جستجو در بخش‌های پنل"
            role="combobox"
            aria-expanded="true"
            aria-controls="admin-palette-results"
            aria-activedescendant={results[index] ? `admin-palette-${index}` : undefined}
          />
          <kbd>Esc</kbd>
        </div>
        {results.length === 0 ? (
          <p className="admin-palette__empty" role="status">بخشی با این نام نیست.</p>
        ) : (
          <ul id="admin-palette-results" ref={listRef} className="admin-palette__list" role="listbox" aria-label="بخش‌ها">
            {results.map((item, i) => (
              <li
                key={item.to}
                id={`admin-palette-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === index}
                className={`admin-palette__item${i === index ? ' is-active' : ''}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => go(item)}
              >
                <span className="admin-palette__icon" aria-hidden="true">{item.icon}</span>
                <span className="admin-palette__label">{item.label}</span>
                <span className="admin-palette__group">{item.group}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="admin-palette__hint" aria-hidden="true">↑ ↓ برای حرکت · Enter برای باز کردن</p>
      </div>
    </div>
  );
}
