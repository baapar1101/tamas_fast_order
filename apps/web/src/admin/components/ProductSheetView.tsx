import { useEffect, useMemo, useState } from 'react';
import type { BrandDTO, CategoryDTO, ProductDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { previewProductUrl } from './ProductLinks';
import { AnimatedDropdown } from './AnimatedDropdown';
import {
  DEFAULT_SHEET_COLUMNS,
  SHEET_COLUMNS,
  sheetCellValue,
  type SheetColumn,
  type SheetColumnKey,
  type SheetDrafts,
  type SheetEditableKey,
} from './productSheetModel';
import './product-sheet.css';

interface Props {
  items: ProductDTO[];
  page: number;
  perPage: number;
  storageId: string;
  selected: Set<number>;
  allOnPageSelected: boolean;
  onToggle: (id: number) => void;
  onToggleAll: (checked: boolean) => void;
  drafts: SheetDrafts;
  onChange: (product: ProductDTO, key: SheetEditableKey, value: string | boolean) => void;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
  categories: CategoryDTO[];
  brands: BrandDTO[];
  onEdit: (product: ProductDTO) => void;
}

function initialColumns(storageId: string): SheetColumnKey[] {
  try {
    const saved = JSON.parse(localStorage.getItem(`product-sheet-columns:${storageId}`) ?? 'null');
    if (Array.isArray(saved)) {
      const valid = SHEET_COLUMNS.map((column) => column.key).filter((key) => saved.includes(key));
      if (valid.length) return valid;
    }
  } catch { /* Keep defaults if storage is unavailable or malformed. */ }
  return DEFAULT_SHEET_COLUMNS;
}

function CellEditor({
  product, column, value, changed, disabled, categories, brands, onChange, onSave,
}: {
  product: ProductDTO;
  column: SheetColumn;
  value: string | boolean;
  changed: boolean;
  disabled: boolean;
  categories: CategoryDTO[];
  brands: BrandDTO[];
  onChange: (key: SheetEditableKey, value: string | boolean) => void;
  onSave: () => void;
}) {
  const key = column.key as SheetEditableKey;
  const label = `${column.label}، ${product.productId}`;
  if (column.kind === 'read') {
    if (column.key === 'imageUrl') {
      const source = String(value || '');
      const src = source ? (source.startsWith('/') || source.startsWith('http') ? source : `/uploads/${source}`) : '/logo.png';
      return <img className="product-sheet__thumb" src={src} alt="" loading="lazy" onError={(event) => { event.currentTarget.src = '/logo.png'; }} />;
    }
    return <span className={`product-sheet__readonly${column.key === 'sku' ? ' product-sheet__mono' : ''}`}>{value || '—'}</span>;
  }
  if (column.kind === 'toggle') {
    return (
      <label className="product-sheet__toggle">
        <input type="checkbox" aria-label={label} checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(key, event.target.checked)} />
        <span>{value ? 'بله' : 'خیر'}</span>
      </label>
    );
  }
  if (column.kind === 'select') {
    const choices = column.key === 'status'
      ? [{ value: 'active', label: 'فعال' }, { value: 'inactive', label: 'غیرفعال' }]
      : column.key === 'categoryName'
        ? categories.map((category) => ({ value: category.name, label: category.faName || category.name }))
        : brands.map((brand) => ({ value: brand.name, label: brand.faName || brand.name }));
    const current = String(value);
    const allChoices = [
      ...(column.key !== 'status' ? [{ value: '', label: '—' }] : []),
      ...(current && !choices.some((choice) => choice.value === current) ? [{ value: current, label: current }] : []),
      ...choices,
    ];
    if (allChoices.length > 5) return (
      <AnimatedDropdown
        options={allChoices}
        value={current}
        onChange={(next) => onChange(key, next)}
        onSaveShortcut={onSave}
        disabled={disabled}
        ariaLabel={label}
        buttonClassName="product-sheet__input product-sheet__select product-sheet__dropdown-button"
      />
    );
    return (
      <select
        className="product-sheet__input product-sheet__select"
        aria-label={label}
        value={current}
        disabled={disabled}
        onChange={(event) => onChange(key, event.target.value)}
        onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') onSave(); }}
      >
        {column.key !== 'status' && <option value="">—</option>}
        {current && !choices.some((choice) => choice.value === current) && <option value={current}>{current}</option>}
        {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      </select>
    );
  }
  return (
    <input
      className={`product-sheet__input${column.kind === 'number' ? ' product-sheet__number' : ''}`}
      type="text"
      inputMode={column.kind === 'number' ? 'numeric' : 'text'}
      dir={column.kind === 'number' ? 'ltr' : 'auto'}
      aria-label={label}
      value={String(value)}
      disabled={disabled}
      onChange={(event) => onChange(key, event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && changed) {
          onChange(key, sheetCellValue(product, column.key));
          event.currentTarget.blur();
        } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') onSave();
      }}
    />
  );
}

export function ProductSheetView({
  items, page, perPage, storageId, selected, allOnPageSelected, onToggle, onToggleAll,
  drafts, onChange, onSave, onDiscard, saving, categories, brands, onEdit,
}: Props) {
  const [visibleKeys, setVisibleKeys] = useState<SheetColumnKey[]>(() => initialColumns(storageId));
  const [columnSearch, setColumnSearch] = useState('');
  useEffect(() => {
    try { localStorage.setItem(`product-sheet-columns:${storageId}`, JSON.stringify(visibleKeys)); } catch { /* Browsing still works. */ }
  }, [storageId, visibleKeys]);

  const visibleColumns = useMemo(() => SHEET_COLUMNS.filter((column) => visibleKeys.includes(column.key)), [visibleKeys]);
  const editedRows = Object.keys(drafts).length;
  const editedCells = Object.values(drafts).reduce((sum, draft) => sum + Object.keys(draft).length, 0);

  function toggleColumn(key: SheetColumnKey) {
    setVisibleKeys((current) => current.includes(key)
      ? current.length > 1 ? current.filter((item) => item !== key) : current
      : [...current, key]);
  }

  return (
    <div className="product-sheet" dir="rtl">
      <div className="product-sheet__toolbar">
        <div className="product-sheet__intro">
          <span className="product-sheet__icon" aria-hidden="true">▦</span>
          <div>
            <strong>نمای صفحه‌گسترده</strong>
            <span>هر ردیف یک محصول یا تنوع · ویرایش سلول‌ها، سپس ذخیره</span>
          </div>
        </div>
        <div className="product-sheet__actions">
          <details className="product-sheet__columns">
            <summary className="a-btn a-btn--secondary">ستون‌ها <span className="product-sheet__count">{formatNumber(visibleColumns.length)}</span></summary>
            <div className="product-sheet__column-panel">
              <div className="product-sheet__panel-head">
                <strong>انتخاب ستون‌ها</strong>
                <button type="button" onClick={() => setVisibleKeys(DEFAULT_SHEET_COLUMNS)}>پیش‌فرض</button>
              </div>
              {SHEET_COLUMNS.length > 5 && <input
                className="product-sheet__column-search"
                type="search"
                value={columnSearch}
                onChange={(event) => setColumnSearch(event.target.value)}
                placeholder="جستجوی ستون..."
                aria-label="جستجوی ستون‌ها"
              />}
              {(['کالا', 'قیمت و موجودی', 'نمایش'] as const).map((group) => (
                <div className="product-sheet__column-group" key={group}>
                  <span>{group}</span>
                  {SHEET_COLUMNS.filter((column) => column.group === group && column.label.includes(columnSearch.trim())).map((column) => (
                    <label key={column.key}>
                      <input type="checkbox" checked={visibleKeys.includes(column.key)} disabled={visibleKeys.length === 1 && visibleKeys.includes(column.key)} onChange={() => toggleColumn(column.key)} />
                      {column.label}
                      {column.kind === 'read' && <small>فقط نمایش</small>}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </details>
          {editedRows > 0 && <button type="button" className="a-btn a-btn--secondary" onClick={onDiscard} disabled={saving}>لغو تغییرات</button>}
          <button type="button" className="a-btn a-btn--primary" disabled={!editedRows || saving} onClick={onSave}>
            {saving ? 'در حال ذخیره…' : `ذخیره تغییرات${editedRows ? ` (${formatNumber(editedRows)})` : ''}`}
          </button>
        </div>
      </div>

      <div className={`product-sheet__notice${editedRows ? ' product-sheet__notice--dirty' : ''}`} role="status">
        {editedRows
          ? `${formatNumber(editedCells)} سلول در ${formatNumber(editedRows)} محصول تغییر کرده و هنوز ذخیره نشده است. کلید Esc سلول را برمی‌گرداند؛ Ctrl+Enter ذخیره می‌کند.`
          : 'روی هر سلول کلیک کنید و مقدار را تغییر دهید. کد محصول و تاریخ‌ها فقط خواندنی‌اند؛ برای ویرایش کامل از دکمهٔ کنار کد استفاده کنید. در گوشی، جدول را افقی بکشید.'}
      </div>

      <div className="product-sheet__scroll" role="region" aria-label="جدول ویرایش سریع محصولات" tabIndex={0}>
        <table className="product-sheet__table">
          <thead>
            <tr>
              <th className="product-sheet__identity" scope="col">
                <div className="product-sheet__idhead">
                  <input type="checkbox" aria-label="انتخاب همه محصولات این صفحه" checked={allOnPageSelected} onChange={(event) => onToggleAll(event.target.checked)} />
                  <span># / کد محصول</span>
                </div>
              </th>
              {visibleColumns.map((column) => <th key={column.key} scope="col" style={{ minWidth: column.width }} title={column.hint}>{column.label}{column.kind === 'read' && <span className="product-sheet__lock" aria-label="فقط نمایش">◌</span>}</th>)}
            </tr>
          </thead>
          <tbody>
            {items.map((product, index) => (
              <tr key={product.id} className={drafts[product.id] ? 'product-sheet__row--dirty' : undefined}>
                <th className="product-sheet__identity" scope="row">
                  <div className="product-sheet__idcell">
                    <input type="checkbox" aria-label={`انتخاب ${product.productId}`} checked={selected.has(product.id)} onChange={() => onToggle(product.id)} />
                    <span className="product-sheet__rownum">{formatNumber((page - 1) * perPage + index + 1)}</span>
                    <a href={previewProductUrl(product.productId)} target="_blank" rel="noopener noreferrer" title="پیش‌نمایش محصول" className="product-sheet__code">{product.productId}</a>
                    <button type="button" className="product-sheet__edit" title="ویرایش کامل محصول" aria-label={`ویرایش کامل ${product.productId}`} onClick={() => onEdit(product)}>✎</button>
                  </div>
                </th>
                {visibleColumns.map((column) => {
                  const draft = drafts[product.id];
                  const changed = draft && column.key in draft;
                  const value = changed ? draft[column.key as SheetEditableKey]! : sheetCellValue(product, column.key);
                  return (
                    <td key={column.key} className={changed ? 'product-sheet__cell--dirty' : undefined} style={{ minWidth: column.width }}>
                      <CellEditor
                        product={product}
                        column={column}
                        value={value}
                        changed={Boolean(changed)}
                        disabled={saving}
                        categories={categories}
                        brands={brands}
                        onChange={(key, next) => onChange(product, key, next)}
                        onSave={onSave}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="product-sheet__foot">نمایش {formatNumber(items.length)} ردیف در این صفحه · ستون‌ها برای مرورگر شما ذخیره می‌شوند</div>
    </div>
  );
}
