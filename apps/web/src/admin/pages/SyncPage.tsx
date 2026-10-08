import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SyncEntity, SyncStateDTO } from '@tamas/shared';
import { SYNC_ENTITIES, SYNC_ENTITY_LABELS, formatNumber } from '@tamas/shared';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';

interface PriceStockReport {
  startedAt: string;
  finishedAt: string;
  totalRows: number;
  updated: number;
  created: number;
  skipped: number;
  errors: string[];
}

interface ExcelSyncReport {
  totalRows: number;
  updated: number;
  skipped: number;
  errors: string[];
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
  });

  const clearConflicts = useMutation({
    mutationFn: () => api.del('/admin/sync/conflicts'),
    onSuccess: () => {
      toast.ok('تاریخچه تضادها پاک شد.');
      invalidate();
    },
  });

  /* ---------- Product publish (site DB → Google Sheet) ---------- */
  const [priceStockReport, setPriceStockReport] = useState<PriceStockReport | null>(null);

  const priceStockSync = useMutation({
    mutationFn: () => api.post<{ ok: boolean; report: PriceStockReport }>('/admin/sync/price-stock', {}),
    onSuccess: (data) => {
      const r = data.report;
      setPriceStockReport(r);
      toast.ok(`اطلاعات سایت در شیت منتشر شد: ${r.updated} ردیف تغییر کرد.`);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /* ---------- Excel Sync ---------- */
  const [excelReport, setExcelReport] = useState<ExcelSyncReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const excelSync = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('excel', file);
      return api.upload<{ ok: boolean; report: ExcelSyncReport }>('/admin/sync/excel-upload', formData);
    },
    onSuccess: (data) => {
      const r = data.report;
      setExcelReport(r);
      const message = `از اکسل ${formatNumber(r.updated)} محصول به‌روز شد${r.skipped ? ` و ${formatNumber(r.skipped)} ردیف رد شد` : ''}.`;
      if (r.skipped || r.errors.length) toast.show(message, 'info');
      else toast.ok(message);
      invalidate();
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (err: Error) => {
      toast.error(err.message);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    excelSync.mutate(file);
  };

  const downloadTemplate = async () => {
    try {
      await api.download('/admin/sync/excel-template', {}, 'price-update-template.xlsx');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در دانلود فایل نمونه');
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
    <div className="a-page a-fade">
      {/* Header */}
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">همگام‌سازی گوگل شیت (Google Sheets)</h2>
          <p className="a-subtitle">سایت منبع اصلی محصولات است؛ گوگل شیت نسخه همگام‌شده سایت را نگه می‌دارد.</p>
        </div>
        <div className="a-page-actions a-actions">
          <span className={`chip ${enabled ? 'chip-brand' : 'chip-rose'}`}>
            {enabled ? 'فعال (Enabled)' : 'غیرفعال'}
          </span>
          {status.data?.spreadsheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${status.data.spreadsheetId}`}
              target="_blank"
              rel="noreferrer"
              className="a-btn a-btn--secondary a-btn--sm"
            >
              باز کردن شیت ↗
            </a>
          )}
        </div>
      </section>

      {/* === Price & Stock Sync Card === */}
      <section className="a-card" style={{ borderColor: 'var(--clr-brand)', borderWidth: 2 }}>
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">انتشار محصولات سایت در گوگل شیت</h3>
            <p className="a-card-desc">
              کد، مشخصات، قیمت و موجودی محصولات را از سایت در شیت منتشر می‌کند؛ محصولات حذف‌شده نیز از شیت حذف می‌شوند.
              <br />
              <strong>سایت = منبع اصلی همه اطلاعات محصول</strong>
            </p>
          </div>
          <div className="a-card-actions">
            <button
              type="button"
              className="a-btn a-btn--primary"
              disabled={priceStockSync.isPending}
              onClick={() => priceStockSync.mutate()}
            >
              {priceStockSync.isPending ? 'در حال انتشار...' : 'انتشار سایت در شیت'}
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
              <span className="a-stat-label">بروزرسانی شده</span>
              <span className="a-stat-value" style={{ color: 'var(--clr-brand)' }}>{formatNumber(priceStockReport.updated)}</span>
            </div>
            <div className="a-stat">
              <span className="a-stat-label">رد شده</span>
              <span className="a-stat-value">{formatNumber(priceStockReport.skipped)}</span>
            </div>
            <div className="a-stat">
              <span className="a-stat-label">خطا</span>
              <span className="a-stat-value" style={{ color: priceStockReport.errors.length > 0 ? 'var(--clr-rose)' : undefined }}>
                {priceStockReport.errors.length}
              </span>
            </div>
          </div>
        )}

        {priceStockReport && priceStockReport.errors.length > 0 && (
          <div className="a-error-box mt-3 text-xs font-mono" dir="ltr" style={{ maxHeight: 160, overflow: 'auto' }}>
            {priceStockReport.errors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        )}
      </section>

      {/* === Excel Upload Card === */}
      <section className="a-card" style={{ borderColor: 'var(--clr-aqua)', borderWidth: 2, marginTop: 16 }}>
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">آپدیت گروهی قیمت و موجودی با اکسل</h3>
            <p className="a-card-desc">
              فایل اکسل ابتدا سایت را بروزرسانی می‌کند و سپس نتیجه به Google Sheet و CRM ارسال می‌شود. قیمت را به ریال وارد کنید.
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
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <button
              type="button"
              className="a-btn a-btn--primary"
              disabled={excelSync.isPending || isRunning}
              onClick={() => fileInputRef.current?.click()}
            >
              {excelSync.isPending ? 'در حال آپلود...' : 'آپلود اکسل و بروزرسانی'}
            </button>
          </div>
        </div>

        {/* Excel Report */}
        {excelReport && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="a-stat">
              <span className="a-stat-label">کل ردیف‌ها</span>
              <span className="a-stat-value">{formatNumber(excelReport.totalRows)}</span>
            </div>
            <div className="a-stat">
              <span className="a-stat-label">بروزرسانی شده</span>
              <span className="a-stat-value" style={{ color: 'var(--clr-aqua)' }}>{formatNumber(excelReport.updated)}</span>
            </div>
            <div className="a-stat">
              <span className="a-stat-label">رد شده</span>
              <span className="a-stat-value">{formatNumber(excelReport.skipped)}</span>
            </div>
            <div className="a-stat">
              <span className="a-stat-label">خطا</span>
              <span className="a-stat-value" style={{ color: excelReport.errors.length > 0 ? 'var(--clr-rose)' : undefined }}>
                {excelReport.errors.length}
              </span>
            </div>
          </div>
        )}

        {excelReport && excelReport.errors.length > 0 && (
          <div className="a-error-box mt-3 text-xs font-mono" dir="ltr" style={{ maxHeight: 160, overflow: 'auto' }}>
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
              onClick={() => runSync.mutate(false)}
            >
              {isRunning ? 'در حال اجرا...' : 'همگام‌سازی الان'}
            </button>
          </div>
        </div>

        {/* Advanced Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div>
            <label className="a-label a-label--static mb-2">جهت همگام‌سازی:</label>
            <div className="a-segmented">
              {DIRECTIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`a-seg ${syncDirection === d.id ? 'a-seg--on' : ''}`}
                  onClick={() => setSyncDirection(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="a-label a-label--static mb-2 flex items-center justify-between">
              جداول هدف:
              <span
                className="a-link cursor-pointer"
                onClick={() => setSyncSelectedEntities([...SYNC_ENTITIES])}
              >
                انتخاب همه
              </span>
            </label>
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
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {SYNC_ENTITIES.map((entityKey) => {
          const state = status.data?.entities.find((e) => e.entity === entityKey);
          const hasErr = Boolean(state?.lastError);

          return (
            <div key={entityKey} className={`a-card ${hasErr ? 'a-card--danger' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold a-title-fallback text-sm">{SYNC_ENTITY_LABELS[entityKey]}</h4>
                <span className={`chip ${hasErr ? 'chip-rose' : 'chip-brand'}`}>
                  {hasErr ? 'خطا' : 'سالم'}
                </span>
              </div>

              {hasErr ? (
                <div className="flex flex-col gap-2 flex-1 mt-2">
                  <p className="a-error-box text-[11px] leading-relaxed line-clamp-3 text-left font-mono" dir="ltr">
                    {state?.lastError}
                  </p>
                  <button
                    type="button"
                    className="a-btn a-btn--danger a-btn--sm w-full mt-auto"
                    onClick={() => clearError.mutate(entityKey)}
                  >
                    پاکسازی خطا
                  </button>
                </div>
              ) : (
                <div className="space-y-1 text-xs a-muted">
                  <div>
                    دریافتی:{' '}
                    <span className="font-bold text-emerald-300">
                      {formatNumber(state?.rowsPulled ?? 0)}
                    </span>
                  </div>
                  <div>
                    ارسالی:{' '}
                    <span className="font-bold text-cyan-300">
                      {formatNumber(state?.rowsPushed ?? 0)}
                    </span>
                  </div>
                  {state?.lastPulledAt && (
                    <div className="text-[10px] a-muted mt-2">
                      آخرین بروزرسانی: {new Date(state.lastPulledAt).toLocaleTimeString('fa-IR')}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Conflict History Table */}
      <section className="a-card a-card--flush">
        <div className="a-card-head a-card-head--px">
          <h3 className="a-card-title">تاریخچه تضادها (Conflicts)</h3>
          <div className="a-card-actions">
            <span className="chip chip-slate">{formatNumber(conflicts.data?.total ?? 0)} تضاد ثبت‌شده</span>
            {(conflicts.data?.items ?? []).length > 0 && (
              <button type="button" className="a-btn a-btn--secondary a-btn--sm" onClick={() => clearConflicts.mutate()}>
                پاک کردن همه
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
                <th>برنده تضاد</th>
                <th>تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {(conflicts.data?.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="a-empty">
                    هیچ تضادی بین دیتابیس و گوگل شیت وجود ندارد.
                  </td>
                </tr>
              ) : (
                conflicts.data?.items.map((c) => (
                  <tr key={c.id} className="order-row">
                    <td className="font-bold text-white">{c.entity}</td>
                    <td className="font-mono text-xs text-slate-300 a-ltr">{c.field}</td>
                    <td className="text-xs text-slate-300">{c.dbValue || '—'}</td>
                    <td className="text-xs text-slate-300">{c.sheetValue || '—'}</td>
                    <td>
                      <span className={`chip ${c.resolvedTo === 'db' ? 'chip-brand' : 'chip-aqua'}`}>
                        {c.resolvedTo === 'db' ? 'دیتابیس' : 'گوگل شیت'}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500">
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
