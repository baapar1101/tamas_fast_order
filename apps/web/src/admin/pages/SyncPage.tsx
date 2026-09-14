import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SyncEntity, SyncStateDTO } from '@tamas/shared';
import { SYNC_ENTITIES, SYNC_ENTITY_LABELS, formatNumber } from '@tamas/shared';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';

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

  const isRunning = status.data?.running ?? false;
  const enabled = status.data?.enabled ?? false;

  const toggleEntity = (e: SyncEntity) => {
    if (syncSelectedEntities.includes(e)) {
      setSyncSelectedEntities((prev: SyncEntity[]) => prev.filter((item) => item !== e));
    } else {
      setSyncSelectedEntities((prev: SyncEntity[]) => [...prev, e]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-wrap items-center justify-between gap-4 animate-fade-up">
        <div>
          <h2 className="text-xl font-extrabold text-white sm:text-2xl">همگام‌سازی گوگل شیت (Google Sheets)</h2>
          <p className="mt-1 text-xs text-slate-400">اتصال و همگام‌سازی ۲ طرفه دیتابیس و شیت گوگل</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`chip ${enabled ? 'chip-brand' : 'chip-rose'}`}>
            {enabled ? 'فعال (Enabled)' : 'غیرفعال'}
          </span>
          {status.data?.spreadsheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${status.data.spreadsheetId}`}
              target="_blank"
              rel="noreferrer"
              className="huma-btn-secondary !py-1.5 !px-3 !text-xs"
            >
              باز کردن شیت ↗
            </a>
          )}
        </div>
      </section>

      {/* Sync Control Bar with Advanced Options */}
      <section className="glass-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-5 mb-5">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">اجرای دستی همگام‌سازی (پیشرفته)</h3>
            <p className="text-xs text-slate-400">انتخاب جهت همگام‌سازی و جداول دلخواه برای اجرا</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="huma-btn-secondary"
              disabled={isRunning || runSync.isPending || syncSelectedEntities.length === 0}
              onClick={() => runSync.mutate(true)}
            >
              پیش‌نمایش (Dry Run)
            </button>
            <button
              type="button"
              className="huma-btn-primary"
              disabled={isRunning || runSync.isPending || syncSelectedEntities.length === 0}
              onClick={() => runSync.mutate(false)}
            >
              {isRunning ? 'در حال اجرا...' : 'همگام‌سازی الان'}
            </button>
          </div>
        </div>

        {/* Advanced Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-3">جهت همگام‌سازی:</label>
            <div className="flex bg-[#0b111d] rounded-xl p-1 border border-white/[0.06]">
              <button
                type="button"
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  syncDirection === 'both' ? 'bg-emerald-500 text-slate-950 shadow-glow' : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setSyncDirection('both')}
              >
                دو طرفه (Both)
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  syncDirection === 'pull' ? 'bg-cyan-500 text-slate-950 shadow-glow' : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setSyncDirection('pull')}
              >
                دریافت از شیت (Pull)
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  syncDirection === 'push' ? 'bg-amber-500 text-slate-950 shadow-glow' : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setSyncDirection('push')}
              >
                ارسال به شیت (Push)
              </button>
            </div>
          </div>
          
          <div>
            <label className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-3">
              جداول هدف:
              <button 
                type="button" 
                className="text-emerald-400 hover:text-emerald-300 underline"
                onClick={() => setSyncSelectedEntities([...SYNC_ENTITIES])}
              >
                انتخاب همه
              </button>
            </label>
            <div className="flex flex-wrap gap-2">
              {SYNC_ENTITIES.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    syncSelectedEntities.includes(e) 
                      ? 'bg-slate-700/50 border-emerald-500/30 text-emerald-300 shadow-glow' 
                      : 'bg-transparent border-white/[0.06] text-slate-500 hover:border-slate-400/30 hover:text-slate-300'
                  }`}
                  onClick={() => toggleEntity(e)}
                >
                  {SYNC_ENTITY_LABELS[e]}
                </button>
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
            <div key={entityKey} className={`glass-card p-5 flex flex-col ${hasErr ? 'border-rose-500/40 bg-rose-500/10' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-white text-sm">{SYNC_ENTITY_LABELS[entityKey]}</h4>
                <span className={`chip ${hasErr ? 'chip-rose' : 'chip-brand'}`}>
                  {hasErr ? 'خطا' : 'سالم'}
                </span>
              </div>

              {hasErr ? (
                <div className="flex flex-col gap-2 flex-1 mt-2">
                  <p className="text-[11px] leading-relaxed text-rose-300 bg-black/20 p-2 rounded-lg line-clamp-3 text-left font-mono" dir="ltr">
                    {state?.lastError}
                  </p>
                  <button
                    type="button"
                    className="text-xs font-bold text-rose-400 hover:text-white bg-rose-500/20 hover:bg-rose-500/40 px-3 py-2 rounded-lg mt-auto transition-colors w-full text-center"
                    onClick={() => clearError.mutate(entityKey)}
                  >
                    پاکسازی خطا
                  </button>
                </div>
              ) : (
                <div className="space-y-1 text-xs text-slate-400">
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
                    <div className="text-[10px] text-slate-500 mt-2">
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
      <section className="glass-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h3 className="text-sm font-bold text-white">تاریخچه تضادها (Conflicts)</h3>
          <span className="chip chip-slate">{formatNumber(conflicts.data?.total ?? 0)} تضاد ثبت‌شده</span>
        </div>

        <div className="huma-table-container">
          <table className="huma-table">
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
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    هیچ تضادی بین دیتابیس و گوگل شیت وجود ندارد.
                  </td>
                </tr>
              ) : (
                conflicts.data?.items.map((c) => (
                  <tr key={c.id} className="order-row">
                    <td className="font-bold text-white">{c.entity}</td>
                    <td className="font-mono text-xs text-slate-300">{c.field}</td>
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
