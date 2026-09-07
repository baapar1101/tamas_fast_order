import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SyncConflictDTO, SyncEntity, SyncReport } from '@tamas/shared';
import { SYNC_ENTITIES, SYNC_ENTITY_LABELS, formatNumber } from '@tamas/shared';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';

interface SyncStatus {
  enabled: boolean;
  running: boolean;
  spreadsheetId: string;
  intervalSeconds: number;
  syncPrivateData: boolean;
  entities: Array<{
    entity: string;
    lastPulledAt: string | null;
    lastPushedAt: string | null;
    rowsPulled: number;
    rowsPushed: number;
    lastError: string | null;
  }>;
}

type Direction = 'pull' | 'push' | 'both';

const DIRECTION_LABELS: Record<Direction, string> = {
  both: 'دوطرفه (پیشنهادی)',
  pull: 'فقط از شیت به دیتابیس',
  push: 'فقط از دیتابیس به شیت',
};

export function SyncPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [direction, setDirection] = useState<Direction>('both');
  const [entities, setEntities] = useState<SyncEntity[]>([...SYNC_ENTITIES]);
  const [report, setReport] = useState<SyncReport | null>(null);
  const [conflictEntity, setConflictEntity] = useState<SyncEntity | ''>('');

  const status = useQuery({
    queryKey: ['admin', 'sync', 'status'],
    queryFn: () => api.get<SyncStatus>('/admin/sync/status'),
    refetchInterval: 15_000,
  });

  const conflicts = useQuery({
    queryKey: ['admin', 'sync', 'conflicts', conflictEntity],
    queryFn: () =>
      api.get<{ items: SyncConflictDTO[]; total: number }>('/admin/sync/conflicts', {
        entity: conflictEntity || undefined,
        perPage: 100,
      }),
  });

  const run = useMutation({
    mutationFn: (dryRun: boolean) => api.post<{ report: SyncReport }>('/admin/sync/run', { direction, entities, dryRun }),
    onSuccess: (res) => {
      setReport(res.report);
      const totals = res.report.entities.reduce(
        (acc, e) => ({ pulled: acc.pulled + e.pulled, pushed: acc.pushed + e.pushed, conflicts: acc.conflicts + e.conflicts }),
        { pulled: 0, pushed: 0, conflicts: 0 },
      );
      toast.ok(
        res.report.dryRun
          ? `پیش‌نمایش: ${formatNumber(totals.pulled)} ردیف از شیت و ${formatNumber(totals.pushed)} ردیف به شیت تغییر می‌کند.`
          : `همگام‌سازی انجام شد — ${formatNumber(totals.pulled)} دریافت، ${formatNumber(totals.pushed)} ارسال.`,
      );
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clearConflicts = useMutation({
    mutationFn: () => api.del('/admin/sync/conflicts'),
    onSuccess: () => {
      toast.ok('تاریخچه تضادها پاک شد.');
      void qc.invalidateQueries({ queryKey: ['admin', 'sync', 'conflicts'] });
    },
  });

  const s = status.data;

  return (
    <>
      <div className="admin-head">
        <h1>همگام‌سازی گوگل شیت</h1>
        {s && <span className={`badge ${s.enabled ? 'success' : 'warn'}`}>{s.enabled ? 'فعال' : 'غیرفعال'}</span>}
        {s?.running && <span className="badge brand">در حال اجرا…</span>}
      </div>

      {s && !s.enabled && (
        <div className="alert warn" style={{ marginBottom: 14 }}>
          همگام‌سازی خاموش است. در فایل <code>.env</code> سرویس API مقدار <code>SHEETS_ENABLED=true</code> را بگذارید،
          شناسه شیت و فایل service-account را تنظیم کنید و سرویس را دوباره راه‌اندازی کنید.
        </div>
      )}

      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="dir">جهت همگام‌سازی</label>
            <select id="dir" className="select" value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
              {Object.entries(DIRECTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>بازه اجرای خودکار</label>
            <div className="card" style={{ padding: '9px 12px', background: 'var(--surface-2)' }}>
              {s?.intervalSeconds ? `هر ${formatNumber(Math.round(s.intervalSeconds / 60))} دقیقه` : 'غیرفعال'}
            </div>
          </div>

          <div className="field full">
            <label>جدول‌ها</label>
            <div className="row wrap" style={{ gap: 6 }}>
              {SYNC_ENTITIES.map((e) => {
                const on = entities.includes(e);
                return (
                  <button
                    key={e}
                    type="button"
                    className={`chip${on ? ' on' : ''}`}
                    onClick={() => setEntities(on ? entities.filter((x) => x !== e) : [...entities, e])}
                  >
                    {SYNC_ENTITY_LABELS[e]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn primary"
            disabled={!s?.enabled || run.isPending || s?.running || entities.length === 0}
            onClick={() => run.mutate(false)}
          >
            {run.isPending ? 'در حال اجرا…' : 'اجرای همگام‌سازی'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!s?.enabled || run.isPending || s?.running || entities.length === 0}
            onClick={() => run.mutate(true)}
          >
            پیش‌نمایش بدون تغییر
          </button>
          <span className="spacer" />
          {s?.spreadsheetId && (
            <a
              className="btn"
              href={`https://docs.google.com/spreadsheets/d/${s.spreadsheetId}`}
              target="_blank"
              rel="noreferrer"
            >
              باز کردن شیت ↗
            </a>
          )}
        </div>
      </div>

      {report && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <h3 style={{ marginTop: 0, fontSize: 14.5 }}>
            نتیجه {report.dryRun ? 'پیش‌نمایش' : 'اجرا'} — {new Date(report.finishedAt).toLocaleString('fa-IR')}
          </h3>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>جدول</th>
                  <th>از شیت</th>
                  <th>به شیت</th>
                  <th>جدید</th>
                  <th>به‌روز</th>
                  <th>تضاد</th>
                  <th>خطا</th>
                </tr>
              </thead>
              <tbody>
                {report.entities.map((e) => (
                  <tr key={e.entity}>
                    <td>{SYNC_ENTITY_LABELS[e.entity as SyncEntity] ?? e.entity}</td>
                    <td>{formatNumber(e.pulled)}</td>
                    <td>{formatNumber(e.pushed)}</td>
                    <td>{formatNumber(e.created)}</td>
                    <td>{formatNumber(e.updated)}</td>
                    <td>{e.conflicts > 0 ? <span className="badge warn">{formatNumber(e.conflicts)}</span> : '—'}</td>
                    <td className="wrap" style={{ color: 'var(--danger)' }}>{e.error ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h3 style={{ fontSize: 15 }}>وضعیت جدول‌ها</h3>
      <div className="sync-grid" style={{ marginBottom: 18 }}>
        {(s?.entities ?? []).map((e) => (
          <div className="stat" key={e.entity}>
            <div className="label">{SYNC_ENTITY_LABELS[e.entity as SyncEntity] ?? e.entity}</div>
            <div style={{ fontSize: 12.5, marginTop: 4 }}>
              <div>دریافت: {e.lastPulledAt ? new Date(e.lastPulledAt).toLocaleString('fa-IR') : '—'}</div>
              <div>ارسال: {e.lastPushedAt ? new Date(e.lastPushedAt).toLocaleString('fa-IR') : '—'}</div>
              <div className="faint">
                {formatNumber(e.rowsPulled)} ردیف دریافتی · {formatNumber(e.rowsPushed)} ردیف ارسالی
              </div>
            </div>
            {e.lastError && (
              <div className="alert error" style={{ marginTop: 8, fontSize: 11.5 }}>
                {e.lastError}
              </div>
            )}
          </div>
        ))}
        {(s?.entities.length ?? 0) === 0 && <div className="card empty">هنوز همگام‌سازی‌ای انجام نشده است.</div>}
      </div>

      <div className="row" style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>تضادها</h3>
        <span className="badge">{formatNumber(conflicts.data?.total ?? 0)}</span>
        <select
          className="select"
          style={{ width: 'auto' }}
          value={conflictEntity}
          onChange={(e) => setConflictEntity(e.target.value as SyncEntity | '')}
        >
          <option value="">همه جدول‌ها</option>
          {SYNC_ENTITIES.map((e) => (
            <option key={e} value={e}>
              {SYNC_ENTITY_LABELS[e]}
            </option>
          ))}
        </select>
        <span className="spacer" />
        {(conflicts.data?.total ?? 0) > 0 && (
          <button type="button" className="btn sm" onClick={() => clearConflicts.mutate()}>
            پاک کردن تاریخچه
          </button>
        )}
      </div>

      <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>
        هر بار که یک ردیف هم در دیتابیس و هم در شیت تغییر کرده باشد، طرف با <code>updated_at</code> جدیدتر برنده می‌شود و
        مقدار بازنده اینجا ثبت می‌گردد. مقدار سبز همان چیزی است که الان در هر دو طرف نشسته.
      </p>

      {conflicts.isLoading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : (conflicts.data?.items.length ?? 0) === 0 ? (
        <div className="card empty">تضادی ثبت نشده است.</div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>زمان</th>
                <th>جدول</th>
                <th>کلید</th>
                <th>ستون</th>
                <th>مقدار دیتابیس</th>
                <th>مقدار شیت</th>
                <th>برنده</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.data!.items.map((c) => (
                <tr key={c.id}>
                  <td>{new Date(c.createdAt).toLocaleString('fa-IR')}</td>
                  <td>{SYNC_ENTITY_LABELS[c.entity as SyncEntity] ?? c.entity}</td>
                  <td className="ltr">{c.entityKey}</td>
                  <td className="ltr">{c.field}</td>
                  <td className={`diff-cell ${c.resolvedTo === 'db' ? 'win' : 'lose'}`} title={c.dbValue ?? ''}>
                    {c.dbValue || '—'}
                  </td>
                  <td className={`diff-cell ${c.resolvedTo === 'sheet' ? 'win' : 'lose'}`} title={c.sheetValue ?? ''}>
                    {c.sheetValue || '—'}
                  </td>
                  <td>
                    <span className={`badge ${c.resolvedTo === 'db' ? 'brand' : 'warn'}`}>
                      {c.resolvedTo === 'db' ? 'دیتابیس' : 'گوگل شیت'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
