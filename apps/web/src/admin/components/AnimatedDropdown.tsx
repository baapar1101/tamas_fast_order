import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import './animated-dropdown.css';

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(...inputs));

export interface DropdownOption {
  value: string;
  label: ReactNode;
  searchText?: string;
}

export interface AnimatedDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
  placeholder?: string;
  id?: string;
  prefix?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  variant?: 'admin' | 'storefront';
}

export function normalizeDropdownSearch(value: string): string {
  return value.toLocaleLowerCase()
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064b-\u065f\u200c\u200d]/g, '')
    .replace(/[٠-٩۰-۹]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit) >= 0
      ? '٠١٢٣٤٥٦٧٨٩'.indexOf(digit) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .trim();
}

export function AnimatedDropdown({
  options, value, onChange, className, buttonClassName,
  placeholder = 'انتخاب کنید', id, prefix, ariaLabel, disabled = false, variant = 'admin',
}: AnimatedDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const searchable = options.length > 5;
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const needle = normalizeDropdownSearch(query);
    return options.filter((option) => normalizeDropdownSearch(
      `${option.searchText ?? (typeof option.label === 'string' ? option.label : '')} ${option.value}`,
    ).includes(needle));
  }, [options, query, searchable]);

  useEffect(() => { setActiveIndex(0); }, [query]);
  useEffect(() => { if (disabled) setIsOpen(false); }, [disabled]);

  useEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger?.isConnected) { setIsOpen(false); return; }
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(viewportWidth - 16, Math.max(rect.width, 240));
      const left = Math.max(8, Math.min(rect.right - width, viewportWidth - width - 8));
      const below = viewportHeight - rect.bottom - 10;
      const above = rect.top - 10;
      const wantedHeight = Math.min(320, options.length * 39 + (searchable ? 58 : 12));
      const openAbove = below < Math.min(wantedHeight, 180) && above > below;
      const availableHeight = Math.max(80, openAbove ? above : below);
      const maxHeight = Math.min(wantedHeight, availableHeight);
      setPanelStyle({ position: 'fixed', left, top: openAbove ? rect.top - maxHeight - 5 : rect.bottom + 5, width, maxHeight });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, options.length, searchable]);

  useEffect(() => {
    if (!isOpen) return;
    if (searchable) searchRef.current?.focus();
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setIsOpen(false);
    };
    const closeEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { setIsOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [isOpen, searchable]);

  function selectOption(option: DropdownOption) {
    onChange(option.value);
    setIsOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  }

  function handleListKeys(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, Math.min(filteredOptions.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
    } else if (event.key === 'Enter' && filteredOptions[activeIndex]) {
      event.preventDefault();
      selectOption(filteredOptions[activeIndex]);
    }
  }

  return (
    <div className={cn('searchable-select', `searchable-select--${variant}`, className)}>
      <button ref={triggerRef} id={id} type="button" disabled={disabled}
        className={cn(variant === 'admin' ? 'a-btn a-btn--secondary w-full justify-between' : 'searchable-select__storefront-button', buttonClassName)}
        aria-label={ariaLabel} aria-haspopup="listbox" aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen} onClick={() => { setQuery(''); setActiveIndex(0); setIsOpen((open) => !open); }}
        onKeyDown={(event) => { if (event.key === 'ArrowDown' && !isOpen) { event.preventDefault(); setIsOpen(true); } }}>
        <span className="searchable-select__value">
          {prefix && <span className="searchable-select__prefix">{prefix}</span>}
          <span className="searchable-select__label">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <ChevronDown className={cn('searchable-select__chevron', isOpen && 'searchable-select__chevron--open')} aria-hidden="true" />
      </button>
      {isOpen && createPortal(
        <div ref={panelRef} id={listboxId} role="listbox" aria-label={ariaLabel || placeholder}
          className={cn('searchable-select__panel', `searchable-select__panel--${variant}`)}
          style={panelStyle} dir="rtl" onKeyDown={handleListKeys}>
          {searchable && <div className="searchable-select__search-wrap">
            <Search size={16} aria-hidden="true" />
            <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="جستجو در گزینه‌ها..." aria-label="جستجو در گزینه‌ها" />
          </div>}
          <div className="searchable-select__options">
            {filteredOptions.length ? filteredOptions.map((option, index) => (
              <button key={`${option.value}-${index}`} type="button" role="option" aria-selected={value === option.value}
                className={cn('searchable-select__option', value === option.value && 'searchable-select__option--selected', index === activeIndex && 'searchable-select__option--active')}
                onMouseEnter={() => setActiveIndex(index)} onClick={() => selectOption(option)}>{option.label}</button>
            )) : <div className="searchable-select__empty">گزینه‌ای پیدا نشد</div>}
          </div>
        </div>, document.body,
      )}
    </div>
  );
}
