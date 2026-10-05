import { useEffect, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';

interface CrmSyncLog {
  id: number;
  entity: 'order' | 'product' | 'person';
  entityKey: string;
  action: 'create' | 'update' | 'delete';
  status: 'success' | 'error' | 'pending';
  remoteId?: string;
  error?: string;
  payload: Record<string, unknown>;
  response?: Record<string, unknown>;
  createdAt: string;
}

interface CrmStats {
  ok: boolean;
  crm: { reachable: boolean; baseUrl: string; syncEnabled: boolean };
  local: { activeUsers: number; totalOrders: number; activeProducts: number };
}

interface SyncProgress {
  key: string;
  label: string;
  current: number;
  total: number;
  done: boolean;
  error: boolean;
}

export function CrmSyncPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [progressBars, setProgressBars] = useState<SyncProgress[]>([]);
  const rafs = useRef<Record<string, number>>({});

  useEffect(() => {
    return () => {
      Object.values(rafs.current).forEach((raf) => cancelAnimationFrame(raf));
    };
  }, []);

  const crmStats = useQuery({
    queryKey: ['admin', 'crm-stats'],
    queryFn: () => api.get<CrmStats>('/crm/stats'),
    refetchInterval: 30000,
  });

  const syncLogs = useQuery({
    queryKey: ['admin', 'crm-sync-logs'],
    queryFn: () => api.get<{ items: CrmSyncLog[] }>('/crm/sync/logs'),
  });

  function startSync(
    key: string,
    label: string,
    total: number,
    apiCall: () => Promise<{ pushed?: number; synced?: number; errors?: number; ok?: boolean }>,
  ) {
    if (rafs.current[key]) cancelAnimationFrame(rafs.current[key]);
    setProgressBars((prev) => [...prev, { key, label, current: 0, total, done: false, error: false }]);
    const t0 = performance.now();
    function tick(now: number) {
      const elapsed = now - t0;
      const progress = Math.min(elapsed / 1500, 1);
      const eased = progress * (2 - progress);
      const current = Math.round(eased * total);
      setProgressBars((prev) =>
        prev.map((p) => (p.key === key ? { ...p, current, done: false, error: false } : p)),
      );
      if (progress < 1) {
        rafs.current[key] = requestAnimationFrame(tick);
      } else {
        apiCall()
          .then((res) => {
            const final = res?.pushed ?? res?.synced ?? total;
            setProgressBars((prev) =>
              prev.map((p) =>
                p.key === key ? { ...p, current: final, done: true, error: false, label: 'تکمیل شد' } : p,
              ),
            );
            setTimeout(() => setProgressBars((prev) => prev.filter((p) => p.key !== key)), 3000);
          })
          .catch(() => {
            setProgressBars((prev) =>
              prev.map((p) =>
                p.key === key ? { ...p, current: 0, done: true, error: true, label: 'خطا' } : p,
              ),
            );
            setTimeout(() => setProgressBars((prev) => prev.filter((p) => p.key !== key)), 3000);
          });
      }
    }
    rafs.current[key] = requestAnimationFrame(tick);
  }

  return (
    <div className="a-page a-fade">
      {/* Header */}
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">همگام‌سازی با CRM (Hesabix)</h2>
          <p className="a-subtitle">سینک محصولات، مشتریان و سفارش‌ها با سیستم Hesabix مارک‌استریت</p>
        </div>
        <div className="a-page-actions">
          <span className={`a-badge ${crmStats.data?.crm.reachable ? 'a-badge--success' : 'a-badge--danger'}`}>
            {crmStats.data?.crm.reachable ? '✓ متصل' : '✗ قطع'}
          </span>
        </div>
      </section>

      {/* Progress Bars */}
      {progressBars.length > 0 && (
        <div className="a-page-stack">
          {progressBars.map((pb) => (
            <section className="a-card" key={pb.key}>
              <div className="a-card-head a-card-head--split">
                <div>
                  <h3 className="a-card-title">{pb.label}</h3>
                  <p className="a-card-desc">در حال همگام‌سازی با CRM</p>
                </div>
                <span className={`a-badge ${pb.error ? 'a-badge--danger' : pb.done ? 'a-badge--success' : 'a-badge--info'}`}>
                  {pb.error ? 'خطا' : pb.done ? 'تکمیل شد' : `${pb.current}/${pb.total}`}
                </span>
              </div>
              <div className="flex items-center gap-3 px-6 pb-4">
                <div className="relative flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-150 ${
                      pb.error ? 'bg-red-400' : pb.done ? 'bg-emerald-400' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.round((pb.current / (pb.total || 1)) * 100))}%` }}
                  />
                </div>
                <span className="a-ltr font-mono text-xs font-bold w-16 text-right">
                  {pb.current}/{pb.total}
                </span>
                {!pb.done && (
                  <svg className="h-3 w-3 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Sync Buttons */}
      <section className="a-card">
        <div className="a-card-head">
          <h3 className="a-card-title">عملیات همگام‌سازی</h3>
        </div>
        <div className="a-grid a-grid--4 a-gap--4 p-6">
          <button
            type="button"
            className="a-btn a-btn--primary a-btn--block"
            onClick={() => {
              const total = crmStats.data?.local.activeProducts ?? 0;
              startSync('products', 'همگام‌سازی محصولات', total, async () => {
                const res = await api.post<{ ok: boolean; pushed: number; errors: number; errorDetails: string[] }>('/crm/sync/products/push');
                if (res.ok) toast.ok(`${res.pushed} محصول سینک شد`);
                else toast.error(`خطا: ${res.errorDetails?.[0]}`);
                void qc.invalidateQueries({ queryKey: ['admin', 'crm-sync-logs'] });
                void qc.invalidateQueries({ queryKey: ['admin', 'crm-stats'] });
                return res;
              });
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4 8 4m-8-4v12l-8-4m0-12V4m8 4l-8 4m8-4l-8-4" />
              </svg>
              <span>محصولات ({crmStats.data?.local.activeProducts ?? 0})</span>
            </div>
          </button>

          <button
            type="button"
            className="a-btn a-btn--secondary a-btn--block"
            onClick={() => {
              const total = crmStats.data?.local.activeProducts ?? 0;
              startSync('stock', 'همگام‌سازی موجودی', total, async () => {
                const res = await api.post<{ ok: boolean; synced: number; errors: number; errorDetails: string[] }>('/crm/sync/stock');
                if (res.ok) toast.ok(`${res.synced} محصول سینک شد`);
                else toast.error(`خطا: ${res.errorDetails?.[0]}`);
                void qc.invalidateQueries({ queryKey: ['admin', 'crm-sync-logs'] });
                return res;
              });
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>موجودی ({crmStats.data?.local.activeProducts ?? 0})</span>
            </div>
          </button>

          <button
            type="button"
            className="a-btn a-btn--secondary a-btn--block"
            onClick={() => {
              const total = crmStats.data?.local.totalOrders ?? 0;
              startSync('orders', 'سفارش‌ها', total, async () => {
                const res = await api.post<{ ok: boolean; pushed: number; errors: number; errorDetails: string[] }>('/crm/sync/orders');
                if (res.ok) toast.ok(`${res.pushed} سفارش سینک شد`);
                else toast.error(`خطa: ${res.errorDetails?.[0]}`);
                void qc.invalidateQueries({ queryKey: ['admin', 'crm-sync-logs'] });
                void qc.invalidateQueries({ queryKey: ['admin', 'crm-stats'] });
                return res;
              });
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span>سفارش‌ها ({crmStats.data?.local.totalOrders ?? 0})</span>
            </div>
          </button>

          <button
            type="button"
            className="a-btn a-btn--secondary a-btn--block"
            onClick={() => {
              const total = crmStats.data?.local.activeUsers ?? 0;
              startSync('persons', 'مشتریان', total, async () => {
                const res = await api.post<{ ok: boolean; pushed: number; errors: number; errorDetails: string[] }>('/crm/sync/persons');
                if (res.ok) toast.ok(`${res.pushed} مشتری سینک شد`);
                else toast.error(`خطa: ${res.errorDetails?.[0]}`);
                void qc.invalidateQueries({ queryKey: ['admin', 'crm-sync-logs'] });
                void qc.invalidateQueries({ queryKey: ['admin', 'crm-stats'] });
                return res;
              });
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>مشتریان ({crmStats.data?.local.activeUsers ?? 0})</span>
            </div>
          </button>
        </div>
      </section>

      {/* Sync Logs Table */}
      <section className="a-card">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">نتایج همگام‌سازی</h3>
            <p className="a-card-desc">تاریخچه سینک محصولات، مشتریان و سفارش‌ها</p>
          </div>
          <button
            type="button"
            className="a-btn a-btn--secondary"
            onClick={() => void qc.invalidateQueries({ queryKey: ['admin', 'crm-sync-logs'] })}
            disabled={syncLogs.isFetching}
          >
            {syncLogs.isFetching ? '...' : 'بازآوری'}
          </button>
        </div>

        {syncLogs.isLoading ? (
          <div className="a-skeleton a-skeleton--text" />
        ) : syncLogs.error ? (
          <div className="a-alert a-alert--error">خطا در بارگذاری: {syncLogs.error.message}</div>
        ) : syncLogs.data?.items && syncLogs.data.items.length > 0 ? (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>زمان</th>
                  <th>نوع</th>
                  <th>عملیات</th>
                  <th>شناسه</th>
                  <th>وضعیت</th>
                  <th>ID در CRM</th>
                  <th>جزئیات</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.data.items.slice(0, 50).map((log) => (
                  <tr key={log.id} className={log.status === 'error' ? 'a-row--error' : ''}>
                    <td className="text-xs text-slate-400">
                      {new Date(log.createdAt).toLocaleString('fa-IR')}
                    </td>
                    <td>
                      <span className={`a-badge ${
                        log.entity === 'product' ? 'a-badge--info' :
                        log.entity === 'order' ? 'a-badge--warning' :
                        'a-badge--success'
                      }`}>
                        {log.entity === 'product' ? 'محصول' :
                         log.entity === 'order' ? 'سفارش' : 'مشتری'}
                      </span>
                    </td>
                    <td>
                      <span className={`a-badge ${
                        log.action === 'create' ? 'a-badge--success' :
                        log.action === 'update' ? 'a-badge--info' :
                        'a-badge--danger'
                      }`}>
                        {log.action === 'create' ? 'ایجاد' :
                         log.action === 'update' ? 'بروزرسانی' : 'حذف'}
                      </span>
                    </td>
                    <td className="a-ltr font-mono text-xs">{log.entityKey}</td>
                    <td>
                      <span className={`a-badge ${
                        log.status === 'success' ? 'a-badge--success' :
                        log.status === 'error' ? 'a-badge--danger' :
                        'a-badge--warning'
                      }`}>
                        {log.status === 'success' ? 'موفق' :
                         log.status === 'error' ? 'خطا' : 'در انتظار'}
                      </span>
                    </td>
                    <td className="a-ltr font-mono text-xs">
                      {log.remoteId ?? '—'}
                    </td>
                    <td className="text-xs max-w-xs truncate" title={log.error || ''}>
                      {log.error ? (
                        <span className="text-red-400">{log.error}</span>
                      ) : log.response ? (
                        <span className="text-emerald-400">✓ ثبت شد</span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="a-empty p-8">
            <svg className="h-12 w-12 mx-auto text-slate-500 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <p className="text-slate-400">هنوز لاگی ثبت نشده است.</p>
            <p className="text-xs text-slate-500 mt-1">با کلیک روی دکمه‌های بالا، همگام‌سازی شروع می‌شود.</p>
          </div>
        )}
      </section>
    </div>
  );
}
