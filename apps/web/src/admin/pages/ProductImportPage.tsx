import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_IMPORT_KEYS,
  MAX_PRODUCT_IMPORT_ROWS,
  PRODUCT_IMPORT_FIELDS,
  PRODUCT_IMPORT_GROUPS,
  PRODUCT_IMPORT_STATUS_LABELS,
  formatNumber,
  type BrandDTO,
  type CategoryDTO,
  type ProductImportFieldKey,
  type ProductImportRowResult,
  type ProductImportStatus,
} from '@tamas/shared';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import {
  buildResultWorkbook,
  buildTemplateWorkbook,
  importFieldLabel,
  parseImportWorkbook,
  type ParsedImportFile,
} from '../components/productImportExcel';
import './product-import.css';

const FIELDS_KEY = 'tamas_product_import_fields';
const BATCH_SIZE = 50;

type ResultFilter = 'all' | ProductImportStatus;

const STATUS_BADGE: Record<ProductImportStatus, string> = {
  created: 'a-badge a-badge--success',
  duplicate: 'a-badge a-badge--warning',
  error: 'a-badge a-badge--danger',
};

function loadSelection(): Set<ProductImportFieldKey> {
  try {
    const saved = JSON.parse(localStorage.getItem(FIELDS_KEY) ?? 'null') as string[] | null;
    const known = new Set(PRODUCT_IMPORT_FIELDS.map((field) => field.key));
    if (Array.isArray(saved)) return new Set(saved.filter((key): key is ProductImportFieldKey => known.has(key as ProductImportFieldKey)));
  } catch {
    // A missing or blocked store just means the default columns.
  }
  return new Set(DEFAULT_IMPORT_KEYS);
}

function saveSelection(keys: Set<ProductImportFieldKey>): void {
  try {
    localStorage.setItem(FIELDS_KEY, JSON.stringify([...keys]));
  } catch {
    // Remembering the choice is a convenience only.
  }
}

function download(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

const today = () => new Date().toISOString().slice(0, 10);
const loadXlsx = () => import('@e965/xlsx');

export function ProductImportPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<Set<ProductImportFieldKey>>(loadSelection);
  const [building, setBuilding] = useState(false);

  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedImportFile | null>(null);
  const [parseError, setParseError] = useState('');
  const [createMissingTaxonomy, setCreateMissingTaxonomy] = useState(false);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ProductImportRowResult[] | null>(null);
  const [filter, setFilter] = useState<ResultFilter>('all');

  const taxonomy = useQuery({
    queryKey: ['admin', 'taxonomy'],
    queryFn: () => api.get<{ categories: CategoryDTO[]; brands: BrandDTO[] }>('/admin/taxonomy'),
    staleTime: 5 * 60_000,
  });

  const toggle = (key: ProductImportFieldKey) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveSelection(next);
      return next;
    });
  };

  const setAll = (keys: ProductImportFieldKey[]) => {
    const next = new Set(keys);
    saveSelection(next);
    setSelected(next);
  };

  const selectedCount = PRODUCT_IMPORT_FIELDS.filter((field) => field.required || selected.has(field.key)).length;

  const downloadTemplate = async () => {
    setBuilding(true);
    try {
      const XLSX = await loadXlsx();
      const data = taxonomy.data ?? (await queryClient.fetchQuery({
        queryKey: ['admin', 'taxonomy'],
        queryFn: () => api.get<{ categories: CategoryDTO[]; brands: BrandDTO[] }>('/admin/taxonomy'),
      }));
      download(buildTemplateWorkbook(XLSX, selected, { categories: data?.categories ?? [], brands: data?.brands ?? [] }), `نمونه-ایمپورت-کالا-${today()}.xlsx`);
      toast.ok(`فایل نمونه با ${formatNumber(selectedCount)} ستون ساخته شد.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ساخت فایل نمونه ناموفق بود.');
    } finally {
      setBuilding(false);
    }
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setParsed(null);
    setResults(null);
    setParseError('');
    setFileName(file.name);
    try {
      const XLSX = await loadXlsx();
      const result = parseImportWorkbook(XLSX, await file.arrayBuffer());
      if (!result.rows.length) throw new Error('هیچ ردیف کالایی زیر سطر عنوان‌ها پیدا نشد.');
      setParsed(result);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'خواندن فایل ناموفق بود.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const runImport = async () => {
    if (!parsed || running) return;
    setRunning(true);
    setProgress(0);
    setFilter('all');
    const collected: ProductImportRowResult[] = [];
    setResults([]);
    for (let start = 0; start < parsed.rows.length; start += BATCH_SIZE) {
      const batch = parsed.rows.slice(start, start + BATCH_SIZE);
      try {
        const response = await api.post<{ results: ProductImportRowResult[] }>('/admin/products/import', {
          rows: batch.map((row) => ({ rowNumber: row.rowNumber, values: row.values })),
          createMissingTaxonomy,
        });
        collected.push(...response.results);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'ارسال این بخش ناموفق بود.';
        collected.push(...batch.map((row) => ({
          rowNumber: row.rowNumber,
          status: 'error' as const,
          productId: String(row.values.productId ?? ''),
          title: String(row.values.title ?? ''),
          message: `ارسال به سرور ناموفق بود: ${message}`,
        })));
      }
      setResults([...collected]);
      setProgress(Math.min(parsed.rows.length, start + batch.length));
    }
    setRunning(false);
    const created = collected.filter((row) => row.status === 'created').length;
    if (created) {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'taxonomy'] });
    }
    toast.ok(`ایمپورت تمام شد: ${formatNumber(created)} کالا ساخته شد.`);
  };

  const exportResults = async () => {
    if (!parsed || !results) return;
    const XLSX = await loadXlsx();
    download(buildResultWorkbook(XLSX, parsed, results), `نتیجه-ایمپورت-کالا-${today()}.xlsx`);
  };

  const counts = useMemo(() => {
    const base = { created: 0, duplicate: 0, error: 0 };
    for (const row of results ?? []) base[row.status]++;
    return base;
  }, [results]);

  const visible = (results ?? []).filter((row) => filter === 'all' || row.status === filter);
  const blocked = Boolean(parsed?.match.missingRequired.length);

  return (
    <div className="a-page a-fade product-import-page">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">ایمپورت کالای جدید با اکسل</h2>
          <p className="a-subtitle">ستون‌های لازم را انتخاب کنید، فایل نمونه را پر کنید و برگردانید؛ نتیجهٔ هر ردیف نمایش داده می‌شود.</p>
        </div>
        <div className="a-page-actions">
          <Link to="/admin/products" className="a-btn a-btn--secondary">بازگشت به محصولات</Link>
        </div>
      </section>

      {/* Step 1: template */}
      <section className="a-card">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title"><span className="pi-step">۱</span>ساخت فایل نمونه</h3>
            <p className="a-card-desc">تیک ستون‌هایی را بزنید که می‌خواهید وارد کنید. ستون‌های اجباری همیشه در فایل هستند.</p>
          </div>
          <div className="pi-actions">
            <button type="button" className="a-btn a-btn--secondary a-btn--xs" onClick={() => setAll(PRODUCT_IMPORT_FIELDS.map((field) => field.key))}>انتخاب همه</button>
            <button type="button" className="a-btn a-btn--secondary a-btn--xs" onClick={() => setAll(DEFAULT_IMPORT_KEYS)}>ستون‌های پیش‌فرض</button>
            <button type="button" className="a-btn a-btn--secondary a-btn--xs" onClick={() => setAll([])}>فقط اجباری‌ها</button>
          </div>
        </div>
        <div className="pi-groups">
          {PRODUCT_IMPORT_GROUPS.map((group) => (
            <fieldset key={group.id} className="pi-group">
              <legend>{group.label}</legend>
              {PRODUCT_IMPORT_FIELDS.filter((field) => field.group === group.id).map((field) => (
                <label key={field.key} className={`pi-field${field.required ? ' is-required' : ''}`} title={field.hint}>
                  <input
                    type="checkbox"
                    checked={field.required || selected.has(field.key)}
                    disabled={field.required}
                    onChange={() => toggle(field.key)}
                  />
                  <span className="pi-field-copy">
                    <span className="pi-field-label">{field.label}{field.required && <span className="pi-required">اجباری</span>}</span>
                    <span className="pi-field-hint">{field.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <div className="pi-footer">
          <span>{formatNumber(selectedCount)} ستون انتخاب شده · فایل شامل برگه‌های راهنما، دسته‌بندی‌ها و برندهای فعلی سایت است.</span>
          <button type="button" className="a-btn a-btn--primary" onClick={() => void downloadTemplate()} disabled={building}>
            {building ? 'در حال ساخت…' : 'دانلود فایل نمونه'}
          </button>
        </div>
      </section>

      {/* Step 2: upload */}
      <section className="a-card">
        <div className="a-card-head">
          <div>
            <h3 className="a-card-title"><span className="pi-step">۲</span>ایمپورت فایل</h3>
            <p className="a-card-desc">
              فایل پرشده را انتخاب کنید (حداکثر {formatNumber(MAX_PRODUCT_IMPORT_ROWS)} ردیف). فقط کالای جدید ساخته می‌شود؛ کالاهای موجود تغییری نمی‌کنند.
            </p>
          </div>
        </div>
        <div className="pi-body">
          <label
            className={`a-dropzone${dragOver ? ' a-dropzone--over' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => { event.preventDefault(); setDragOver(false); void readFile(event.dataTransfer.files[0]); }}
          >
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={running}
              onChange={(event) => void readFile(event.target.files?.[0])}
            />
            <span className="a-dropzone-icon" aria-hidden="true">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
            </span>
            <strong>{fileName || 'فایل اکسل را اینجا بکشید یا کلیک کنید'}</strong>
            <span className="a-note">xlsx، xls یا csv</span>
          </label>

          {parseError && <div className="a-alert a-alert--error">{parseError}</div>}

          {parsed && (
            <div className="pi-preview">
              <div className="pi-preview-line">
                <strong>{formatNumber(parsed.rows.length)}</strong> ردیف کالا در برگهٔ «{parsed.sheetName}» پیدا شد.
                {parsed.skippedOverLimit > 0 && ` ${formatNumber(parsed.skippedOverLimit)} ردیف بیشتر از سقف ${formatNumber(MAX_PRODUCT_IMPORT_ROWS)} است و وارد نمی‌شود.`}
              </div>
              <div className="pi-chips">
                <span className="pi-chips-title">ستون‌های شناخته‌شده:</span>
                {parsed.match.columns.map((column) => <span key={column.key} className="a-badge a-badge--brand">{importFieldLabel(column.key)}</span>)}
              </div>
              {parsed.match.ignored.length > 0 && (
                <div className="pi-chips">
                  <span className="pi-chips-title">نادیده گرفته می‌شوند:</span>
                  {parsed.match.ignored.map((header) => <span key={header} className="a-badge a-badge--neutral">{header}</span>)}
                </div>
              )}
              {parsed.match.duplicates.length > 0 && (
                <div className="a-alert a-alert--error">این ستون‌ها دو بار آمده‌اند و فقط اولی خوانده می‌شود: {parsed.match.duplicates.join('، ')}</div>
              )}
              {blocked && (
                <div className="a-alert a-alert--error">
                  ستون اجباری در فایل نیست: {parsed.match.missingRequired.map(importFieldLabel).join('، ')}. فایل نمونه را دوباره بسازید.
                </div>
              )}
              <label className="pi-option">
                <input type="checkbox" checked={createMissingTaxonomy} disabled={running} onChange={(event) => setCreateMissingTaxonomy(event.target.checked)} />
                <span>
                  دسته‌بندی یا برندی که در سایت نیست ساخته شود
                  <span className="pi-field-hint">خاموش (پیشنهادی): ردیفی که نام دسته یا برندش اشتباه است خطا می‌گیرد تا دسته‌بندی تکراری ساخته نشود.</span>
                </span>
              </label>
              <div className="pi-footer pi-footer--flush">
                {running ? (
                  <div className="pi-progress" role="progressbar" aria-valuemin={0} aria-valuemax={parsed.rows.length} aria-valuenow={progress}>
                    <span style={{ width: `${(progress / parsed.rows.length) * 100}%` }} />
                    <em>{formatNumber(progress)} از {formatNumber(parsed.rows.length)} ردیف</em>
                  </div>
                ) : <span />}
                <button type="button" className="a-btn a-btn--primary" disabled={running || blocked} onClick={() => void runImport()}>
                  {running ? 'در حال ایمپورت…' : `ایمپورت ${formatNumber(parsed.rows.length)} ردیف`}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Step 3: results */}
      {results && (
        <section className="a-card">
          <div className="a-card-head a-card-head--split">
            <div>
              <h3 className="a-card-title"><span className="pi-step">۳</span>نتیجهٔ ایمپورت</h3>
              <p className="a-card-desc">در فایل خروجی کنار هر ردیف نتیجه و دلیل آمده است؛ ردیف‌های خطادار را اصلاح کنید و همان فایل را دوباره ایمپورت کنید.</p>
            </div>
            <button type="button" className="a-btn a-btn--primary" disabled={running || !results.length} onClick={() => void exportResults()}>
              خروجی اکسل نتیجه
            </button>
          </div>
          <div className="pi-stats">
            <div className="pi-stat"><span>کل ردیف‌ها</span><strong>{formatNumber(parsed?.rows.length ?? 0)}</strong></div>
            <div className="pi-stat is-created"><span>{PRODUCT_IMPORT_STATUS_LABELS.created}</span><strong>{formatNumber(counts.created)}</strong></div>
            <div className="pi-stat is-duplicate"><span>تکراری</span><strong>{formatNumber(counts.duplicate)}</strong></div>
            <div className="pi-stat is-error"><span>{PRODUCT_IMPORT_STATUS_LABELS.error}</span><strong>{formatNumber(counts.error)}</strong></div>
          </div>
          <nav className="a-segmented pi-filter" aria-label="فیلتر نتیجه">
            {([['all', 'همه'], ['created', 'ایجادشده'], ['duplicate', 'تکراری'], ['error', 'خطا']] as const).map(([id, label]) => (
              <button key={id} type="button" className={`a-seg${filter === id ? ' a-seg--on' : ''}`} onClick={() => setFilter(id)}>
                {label} ({formatNumber(id === 'all' ? results.length : counts[id])})
              </button>
            ))}
          </nav>
          {visible.length === 0 ? (
            <div className="a-empty">{running ? 'در حال پردازش…' : 'ردیفی در این بخش نیست.'}</div>
          ) : (
            <div className="a-table-wrap">
              <table className="a-table pi-table" data-export-title="نتیجه ایمپورت کالا">
                <thead>
                  <tr><th>ردیف</th><th>کد محصول</th><th>عنوان</th><th>نتیجه</th><th>توضیح</th></tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{formatNumber(row.rowNumber)}</td>
                      <td className="a-ltr">{row.productId || '—'}</td>
                      <td>{row.title || '—'}</td>
                      <td><span className={STATUS_BADGE[row.status]}>{PRODUCT_IMPORT_STATUS_LABELS[row.status]}</span></td>
                      <td className="pi-message">{row.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
