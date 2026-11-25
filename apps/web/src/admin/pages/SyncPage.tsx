import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SyncEntity, SyncStateDTO } from '@tamas/shared';
import { SYNC_ENTITIES, SYNC_ENTITY_LABELS, formatNumber } from '@tamas/shared';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { buildStockUpdateResultWorkbook, countStockRows, type StockUpdateReport } from '../components/stockUpdateExcel';
import { ExcelPreview } from '../components/ExcelPreview';
import { AdminState, TableState } from '../components/AdminState';
import './sync-page.css';

const loadXlsx = () => import('@e965/xlsx');

function downloadBytes(bytes: Uint8Array, filename: string): void {
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

interface PriceStockReport {
  startedAt: string;
  finishedAt: string;
  totalRows: number;
  updated: number;
  created: number;
  skipped: number;
  errors: string[];
}

type ExcelSyncReport = StockUpdateReport;

interface ExcelUploadProgress {
  current: number;
  total: number;
  state: 'reading' | 'importing' | 'publishing' | 'done' | 'error';
  message?: string;
}

interface SyncStatusResponse {
  ok: boolean;
  enabled: boolean;
  running: boolean;
  spreadsheetId?: string;
  intervalSeconds?: number;
  entities: SyncStateDTO[];
}

interface ConflictItem {
  id: number;
  entity: string;
  entityKey: string;
  field: string;
  dbValue: string;
  sheetValue: string;
  resolvedTo: string;
  createdAt: string;
}

export function SyncPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const status = useQuery({
    queryKey: ['admin', 'sync', 'status'],
    queryFn: () => api.get<SyncStatusResponse>('/admin/sync/status'),
    refetchInterval: 10_000,
  });

  const conflicts = useQuery({
    queryKey: ['admin', 'sync', 'conflicts'],
    queryFn: () => api.get<{ items: ConflictItem[]; total: number }>('/admin/sync/conflicts'),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'sync'] });
  };

  const [syncDirection, setSyncDirection] = useState<'both' | 'pull' | 'push'>('both');
  const [syncSelectedEntities, setSyncSelectedEntities] = useState<SyncEntity[]>([...SYNC_ENTITIES]);

  const runSync = useMutation({
    mutationFn: (dryRun: boolean) =>
      api.post<{ ok: boolean }>('/admin/sync/run', {
        direction: syncDirection,
        dryRun,
        entities: syncSelectedEntities,
      }),
    onSuccess: () => {
      toast.ok('همگام‌سازی با موفقیت انجام شد.');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clearError = useMutation({
    mutationFn: (entity: SyncEntity) => api.post('/admin/sync/clear-error', { entity }),
    onSuccess: () => {
      toast.ok('خطای همگام‌سازی پاک شد.');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clearConflicts = useMutation({
    mutationFn: () => api.del('/admin/sync/conflicts'),
    onSuccess: () => {
      toast.ok('تاریخچهٔ تضادها پاک شد.');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /* ---------- Product publish (site DB → Google Sheet) ---------- */
  const [priceStockReport, setPriceStockReport] = useState<PriceStockReport | null>(null);

  const priceStockSync = useMutation({
    mutationFn: () => api.post<{ ok: boolean; report: PriceStockReport }>('/admin/sync/price-stock', {}),
    onSuccess: (data) => {
      const r = data.report;
      setPriceStockReport(r);
      toast.ok(`اطلاعات سایت در شیت منتشر شد: ${formatNumber(r.updated)} ردیف تغییر کرد.`);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /* ---------- Excel Sync ---------- */
  const [excelReport, setExcelReport] = useState<ExcelSyncReport | null>(null);
  const [excelJobId, setExcelJobId] = useState<string | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelUploading, setExcelUploading] = useState(false);
  const [excelFileName, setExcelFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const excelProgress = useQuery({
    queryKey: ['admin', 'sync', 'excel-progress', excelJobId],
    queryFn: () => api.get<{ progress: ExcelUploadProgress }>(`/admin/sync/excel-upload/status/${excelJobId}`),
    enabled: Boolean(excelJobId) && excelUploading,
    refetchInterval: 400,
  });

  const progress = excelProgress.data?.progress;

  // Step 1 previews the file (nothing is written); step 2 applies exactly
  // that preview, identified by its planHash.
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const excelSync = useMutation({
    mutationFn: ({ file, jobId, planHash }: { file: File; jobId: string; planHash?: string }) => {
      const formData = new FormData();
      formData.append('excel', file);
      const query = planHash ? `&planHash=${planHash}` : '&dryRun=1';
      return api.upload<{ ok: boolean; report: ExcelSyncReport }>(`/admin/sync/excel-upload?jobId=${encodeURIComponent(jobId)}${query}`, formData);
    },
    onSuccess: (data) => {
      const r = data.report;
      setExcelReport(r);
      setExcelError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (r.dryRun) return;
      setExcelFile(null);
      const message = `از اکسل ${formatNumber(r.updated)} محصول به‌روز شد${r.skipped ? ` و ${formatNumber(r.skipped)} ردیف رد شد` : ''}.`;
      if (r.skipped || r.errors.length) toast.show(message, 'info');
      else toast.ok(message);
      invalidate();
    },
    onError: (err: Error) => {
      setExcelReport(null);
      setExcelFile(null);
      setExcelError(err.message);
      toast.error(err.message);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onSettled: () => setExcelUploading(false),
  });

  const startExcelJob = (file: File, planHash?: string) => {
    const jobId = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `excel-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setExcelError(null);
    setExcelJobId(jobId);
    setExcelUploading(true);
    excelSync.mutate({ file, jobId, planHash });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelReport(null);
    setExcelFileName(file.name);
    setExcelFile(file);
    startExcelJob(file);
  };

  const applyExcelPreview = () => {
    if (!excelFile || !excelReport?.planHash) return;
    startExcelJob(excelFile, excelReport.planHash);
  };

  const cancelExcelPreview = () => {
    setExcelFile(null);
    setExcelReport(null);
  };

  const downloadExcelResult = async () => {
    if (!excelReport) return;
    try {
      const XLSX = await loadXlsx();
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
      downloadBytes(buildStockUpdateResultWorkbook(XLSX, excelReport, excelFileName), `نتیجه-آپدیت-قیمت-موجودی-${stamp}.xlsx`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ساخت فایل نتیجه انجام نشد.');
    }
  };
  const excelCounts = countStockRows(excelReport?.rows);

  const downloadTemplate = async () => {
    try {
      await api.download('/admin/sync/excel-template', {}, 'price-update-template.xlsx');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'دانلود فایل نمونه انجام نشد.');
    }
  };

  const isRunning = status.data?.running ?? false;
  const enabled = status.data?.enabled ?? false;

  const toggleEntity = (e: SyncEntity) => {
    if (syncSelectedEntities.includes(e)) {
      setSyncSelectedEntities((prev: SyncEntity[]) => prev.filter((item) => item !== e));
    } else {
      setSyncSelectedEntities((prev: SyncEntity[]) => [...prev, e]);
    }
  };

  const DIRECTIONS: { id: 'both' | 'pull' | 'push'; label: string }[] = [
    { id: 'both', label: 'دو طرفه (Both)' },
    { id: 'pull', label: 'دریافت از شیت (Pull)' },
    { id: 'push', label: 'ارسال به شیت (Push)' },
  ];

  return (
    <div className="a-page a-fade sync-page">
      {/* Header */}
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">همگام‌سازی گوگل شیت (Google Sheets)</h2>
          <p className="a-subtitle">سایت منبع اصلی محصولات است؛ گوگل شیت نسخه همگام‌شده سایت را نگه می‌دارد.</p>
        </div>
        <div className="a-page-actions a-actions">
          <span className={`a-badge ${enabled ? 'a-badge--success' : 'a-badge--neutral'}`}>
            {status.isLoading ? 'در حال دریافت…' : enabled ? 'فعال' : 'غیرفعال'}
          </span>
          {status.data?.spreadsheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${status.data.spreadsheetId}`}
              target="_blank"
              rel="noreferrer"
              className="a-btn a-btn--secondary a-btn--sm"
            >
              باز کردن شیت <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      </section>

      {/* === Price & Stock Sync Card === */}
      <section className="a-card">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">انتشار محصولات سایت در گوگل شیت</h3>
            <p className="a-card-desc">
              کد، مشخصات، قیمت و موجودی محصولات را از سایت در شیت منتشر می‌کند؛ محصولات حذف‌شده نیز از شیت حذف می‌شوند.
              <br />
              <strong>سایت = منبع اصلی همهٔ اطلاعات محصول</strong>
            </p>
          </div>
          <div className="a-card-actions">
            <button
              type="button"
              className="a-btn a-btn--primary"
              disabled={priceStockSync.isPending}
              aria-busy={priceStockSync.isPending || undefined}
              onClick={() => priceStockSync.mutate()}
            >
              {priceStockSync.isPending ? 'در حال انتشار…' : 'انتشار سایت در شیت'}
            </button>
          </div>
        </div>

        {/* Report */}
        {priceStockReport && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="a-stat">
              <span className="a-stat-label">کل ردیف</span>
              <span className="a-stat-value">{formatNumber(priceStockReport.totalRows)}</span>
            </div>
            <div className="a-stat">
              <span className="a-stat-label">به‌روزرسانی‌شده</span>
              <span className="a-stat-value">{formatNumber(priceStockReport.updated)}</span>
            </div>
            <div className="a-stat">
              <span className="a-stat-label">رد شده</span>
              <span className="a-stat-value">{formatNumber(priceStockReport.skipped)}</span>
            </div>
            <div className="a-stat">
              <span className="a-stat-label">خطا</span>
              <span className={`a-stat-value${priceStockReport.errors.length > 0 ? ' sync-stat-danger' : ''}`}>
                {formatNumber(priceStockReport.errors.length)}
              </span>
            </div>
          </div>
        )}

        {priceStockReport && priceStockReport.errors.length > 0 && (
          <div className="a-error-box sync-error-list mt-3" dir="rtl" role="alert">
            {priceStockReport.errors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        )}
      </section>

      {/* === Excel Upload Card === */}
      <section className="a-card">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">آپدیت گروهی قیمت و موجودی با اکسل</h3>
            <p className="a-card-desc">
              اول پیش‌نمایش تغییرات را می‌بینید و بعد با «اعمال» سایت به‌روز می‌شود و نتیجه به Google Sheet و CRM می‌رود.
              ستون کد کالا (sku) و یکی از ستون‌های قیمت یا موجودی کافی است. عنوان فارسی ستون‌ها هم قبول است؛
              قیمت ریالی در ستون price یا «قیمت (ریال)» و قیمت تومانی در ستون price_toman یا «قیمت (تومان)».
            </p>
          </div>
          <div className="a-card-actions">
            <button
              type="button"
              className="a-btn a-btn--secondary"
              onClick={downloadTemplate}
            >
              دانلود فایل نمونه
            </button>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              aria-label="انتخاب فایل اکسل قیمت و موجودی"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <button
              type="button"
              className="a-btn a-btn--primary"
              disabled={excelSync.isPending || isRunning}
              aria-busy={excelSync.isPending || undefined}
              onClick={() => fileInputRef.current?.click()}
            >
              {excelSync.isPending ? 'در حال بررسی…' : 'انتخاب فایل اکسل'}
            </button>
          </div>
        </div>

        {excelSync.isPending && (
          <div className="a-card mt-4" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <strong>
                {progress?.state === 'publishing'
                  ? 'در حال انتشار تغییرات در سرویس‌های متصل…'
                  : progress?.total
                    ? `در حال ورود محصول ${formatNumber(progress.current)} از ${formatNumber(progress.total)}`
                    : 'در حال خواندن و بررسی فایل اکسل…'}
              </strong>
              {progress?.total ? <span>{formatNumber(Math.round((progress.current / progress.total) * 100))}٪</span> : null}
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="پیشرفت ورود فایل اکسل"
              aria-valuemin={0}
              aria-valuemax={progress?.total || undefined}
              aria-valuenow={progress?.total ? progress.current : undefined}
            >
              <span
                className="sync-progress-fill"
                style={{ width: progress?.total ? `${Math.max(3, (progress.current / progress.total) * 100)}%` : '18%' }}
              />
            </div>
          </div>
        )}

        {excelError && (
          <div className="mt-4">
            <AdminState kind="error" title="ورود فایل انجام نشد." text={excelError} />
          </div>
        )}

        {excelReport?.dryRun && !excelSync.isPending && (
          <ExcelPreview
            report={excelReport}
            fileName={excelFileName}
            onApply={applyExcelPreview}
            onCancel={cancelExcelPreview}
            onDownload={() => void downloadExcelResult()}
          />
        )}

        {excelReport && !excelReport.dryRun && !excelSync.isPending && (
          <div className="sync-done mt-4" role="status">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                عملیات تمام شد: {formatNumber(excelReport.updated)} محصول با موفقیت به‌روزرسانی شد
                {excelReport.rows
                  ? `؛ ${formatNumber(excelCounts.unchanged)} ردیف بدون تغییر بود و ${formatNumber(excelCounts.error)} ردیف خطا داشت.`
                  : excelReport.skipped ? ` و ${formatNumber(excelReport.skipped)} ردیف رد شد.` : '.'}
              </span>
              {excelReport.rows && (
                <button type="button" className="a-btn a-btn--primary a-btn--sm" onClick={() => void downloadExcelResult()}>
                  دانلود نتیجه به اکسل
                </button>
              )}
            </div>
          </div>
        )}

        {/* Excel Report */}
        {excelReport && !excelReport.dryRun && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="a-stat">
              <span className="a-stat-label">کل ردیف‌ها</span>
              <span className="a-stat-value">{formatNumber(excelReport.totalRows)}</span>
            </div>
            <div className="a-stat">
              <span className="a-stat-label">به‌روزرسانی‌شده</span>
              <span className="a-stat-value">{formatNumber(excelReport.updated)}</span>
            </div>
            <div className="a-stat">
              <span className="a-stat-label">رد شده</span>
              <span className="a-stat-value">{formatNumber(excelReport.skipped)}</span>
            </div>
            <div className="a-stat">
              <span className="a-stat-label">خطا</span>
              <span className={`a-stat-value${excelReport.errors.length > 0 ? ' sync-stat-danger' : ''}`}>
                {formatNumber(excelReport.errors.length)}
              </span>
            </div>
          </div>
        )}

        {excelReport && !excelReport.dryRun && excelReport.errors.length > 0 && (
          <div className="a-error-box sync-error-list mt-3" dir="rtl">
            {excelReport.errors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        )}
      </section>

      {/* Sync Control Bar with Advanced Options */}
      <section className="a-card">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">اجرای دستی همگام‌سازی (پیشرفته)</h3>
            <p className="a-card-desc">برای محصولات، سایت همیشه مرجع است و انتخاب Pull نیز چیزی را از شیت وارد سایت نمی‌کند.</p>
          </div>
          <div className="a-card-actions">
            <button
              type="button"
              className="a-btn a-btn--secondary"
              disabled={isRunning || runSync.isPending || syncSelectedEntities.length === 0}
              onClick={() => runSync.mutate(true)}
            >
              پیش‌نمایش (Dry Run)
            </button>
            <button
              type="button"
              className="a-btn a-btn--primary"
              disabled={isRunning || runSync.isPending || syncSelectedEntities.length === 0}
              aria-busy={isRunning || runSync.isPending || undefined}
              onClick={() => runSync.mutate(false)}
            >
              {isRunning ? 'در حال اجرا…' : runSync.isPending ? 'در حال همگام‌سازی…' : 'همگام‌سازی الان'}
            </button>
          </div>
        </div>

        {/* Advanced Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div>
            <p className="a-label a-label--static mb-2" id="sync-direction-label">جهت همگام‌سازی:</p>
            <div className="a-segmented" role="group" aria-labelledby="sync-direction-label">
              {DIRECTIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`a-seg ${syncDirection === d.id ? 'a-seg--on' : ''}`}
                  aria-pressed={syncDirection === d.id}
                  onClick={() => setSyncDirection(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="a-label a-label--static mb-2 flex items-center justify-between">
              <span>جداول هدف:</span>
              <button
                type="button"
                className="a-btn a-btn--link a-btn--xs"
                onClick={() => setSyncSelectedEntities([...SYNC_ENTITIES])}
              >
                انتخاب همه
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {SYNC_ENTITIES.map((e) => (
                <label
                  key={e}
                  className={`a-chip-opt ${syncSelectedEntities.includes(e) ? 'a-chip-opt--on' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={syncSelectedEntities.includes(e)}
                    onChange={() => toggleEntity(e)}
                  />
                  <span className="a-chip-opt-copy">
                    <span className="a-option-title">{SYNC_ENTITY_LABELS[e]}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 7 Entity Sync Status Cards Grid */}
      {status.isLoading ? (
        <AdminState kind="loading" title="در حال دریافت وضعیت همگام‌سازی…" />
      ) : status.isError ? (
        <AdminState kind="error" title="وضعیت همگام‌سازی دریافت نشد." error={status.error} onRetry={() => void status.refetch()} />
      ) : (
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {SYNC_ENTITIES.map((entityKey) => {
          const state = status.data?.entities.find((e) => e.entity === entityKey);
          const hasErr = Boolean(state?.lastError);

          return (
            <div key={entityKey} className={`a-card ${hasErr ? 'a-card--danger' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold a-title-fallback text-sm">{SYNC_ENTITY_LABELS[entityKey]}</h4>
                <span className={`a-badge ${hasErr ? 'a-badge--danger' : 'a-badge--success'}`}>
                  {hasErr ? 'خطا' : 'سالم'}
                </span>
              </div>

              {hasErr ? (
                <div className="flex flex-col gap-2 flex-1 mt-2">
                  <p className="a-error-box sync-entity-error line-clamp-3 a-ltr" dir="ltr">
                    {state?.lastError}
                  </p>
                  <button
                    type="button"
                    className="a-btn a-btn--danger a-btn--sm w-full mt-auto"
                    disabled={clearError.isPending}
                    onClick={() => clearError.mutate(entityKey)}
                  >
                    پاک کردن خطا
                  </button>
                </div>
              ) : (
                <div className="space-y-1 text-xs a-muted">
                  <div>
                    دریافتی:{' '}
                    <span className="sync-strong">
                      {formatNumber(state?.rowsPulled ?? 0)}
                    </span>
                  </div>
                  <div>
                    ارسالی:{' '}
                    <span className="sync-strong">
                      {formatNumber(state?.rowsPushed ?? 0)}
                    </span>
                  </div>
                  {state?.lastPulledAt && (
                    <div className="a-hint mt-2">
                      آخرین به‌روزرسانی: {new Date(state.lastPulledAt).toLocaleTimeString('fa-IR')}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>
      )}

      {/* Conflict History Table */}
      <section className="a-card a-card--flush">
        <div className="a-card-head a-card-head--px">
          <h3 className="a-card-title">تاریخچهٔ تضادها (Conflicts)</h3>
          <div className="a-card-actions">
            <span className="a-badge a-badge--neutral">{formatNumber(conflicts.data?.total ?? 0)} تضاد ثبت‌شده</span>
            {(conflicts.data?.items ?? []).length > 0 && (
              <button
                type="button"
                className="a-btn a-btn--secondary a-btn--sm"
                disabled={clearConflicts.isPending}
                aria-busy={clearConflicts.isPending || undefined}
                onClick={() => clearConflicts.mutate()}
              >
                {clearConflicts.isPending ? 'در حال پاک کردن…' : 'پاک کردن همه'}
              </button>
            )}
          </div>
        </div>

        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>جدول</th>
                <th>فیلد</th>
                <th>مقدار دیتابیس</th>
                <th>مقدار گوگل شیت</th>
                <th>برندهٔ تضاد</th>
                <th>تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.isLoading ? (
                <TableState colSpan={6} kind="loading" />
              ) : conflicts.isError ? (
                <TableState colSpan={6} kind="error" error={conflicts.error} onRetry={() => void conflicts.refetch()} />
              ) : (conflicts.data?.items ?? []).length === 0 ? (
                <TableState colSpan={6} kind="empty" title="هیچ تضادی بین دیتابیس و گوگل شیت وجود ندارد." />
              ) : (
                conflicts.data?.items.map((c) => (
                  <tr key={c.id} className="order-row">
                    <td className="a-strong">{c.entity}</td>
                    <td className="font-mono a-ltr">{c.field}</td>
                    <td>{c.dbValue || '—'}</td>
                    <td>{c.sheetValue || '—'}</td>
                    <td>
                      <span className="a-badge a-badge--neutral">
                        {c.resolvedTo === 'db' ? 'دیتابیس' : 'گوگل شیت'}
                      </span>
                    </td>
                    <td className="a-cell-sub">
                      {new Date(c.createdAt).toLocaleTimeString('fa-IR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
