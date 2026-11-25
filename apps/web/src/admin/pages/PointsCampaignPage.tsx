import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_POINTS_CAMPAIGN_CONFIG,
  formatNumber,
  isoToTehranJalali,
  tehranJalaliToIso,
  type PointsCampaignConfig,
  type PointsCampaignDraw,
  type PointsCampaignPhase,
} from '@tamas/shared';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { MomentInput, formatMoment } from '../components/FestivalSettings';
import { AdminState, TableState } from '../components/AdminState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import './points-campaign.css';

interface Standing {
  userId: number;
  name: string;
  lastName: string;
  phone: string;
  storeName: string;
  points: number;
  orders: number;
}

interface Loaded {
  config: PointsCampaignConfig;
  phase: PointsCampaignPhase;
  productsWithPoints: number;
  standings: Standing[];
  participants: number;
}

const PHASE_TEXT: Record<PointsCampaignPhase, { text: string; badge: string }> = {
  off: { text: 'کمپین خاموش است.', badge: 'a-badge a-badge--neutral' },
  unscheduled: { text: 'تاریخ شروع و پایان مشخص نشده است.', badge: 'a-badge a-badge--amber' },
  upcoming: { text: 'کمپین هنوز شروع نشده است.', badge: 'a-badge a-badge--amber' },
  running: { text: 'کمپین در جریان است و امتیازها زنده حساب می‌شود.', badge: 'a-badge a-badge--green' },
  ended: { text: 'کمپین تمام شده است.', badge: 'a-badge a-badge--neutral' },
};

const loadXlsx = () => import('@e965/xlsx');

/**
 * The points campaign: schedule and prizes, the live standings with contact
 * details (the public board shows only first names and masked phones), and
 * the one-time draw after the end.
 */
export function PointsCampaignPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'points-campaign'],
    queryFn: () => api.get<Loaded>('/admin/points-campaign'),
    refetchInterval: 30_000,
  });
  const [config, setConfig] = useState<PointsCampaignConfig>(DEFAULT_POINTS_CAMPAIGN_CONFIG);
  const [start, setStart] = useState({ date: '', time: '00:00' });
  const [end, setEnd] = useState({ date: '', time: '23:59' });
  const [loadedAt, setLoadedAt] = useState(0);
  const [drawConfirmOpen, setDrawConfirmOpen] = useState(false);

  // Fill the form once per load of the saved settings, not on every refetch.
  useEffect(() => {
    if (!query.data || loadedAt) return;
    setConfig(query.data.config);
    setStart(isoToTehranJalali(query.data.config.startsAt) ?? { date: '', time: '00:00' });
    setEnd(isoToTehranJalali(query.data.config.endsAt) ?? { date: '', time: '23:59' });
    setLoadedAt(Date.now());
  }, [query.data, loadedAt]);

  const save = useMutation({
    mutationFn: () => api.put<{ message: string }>('/admin/points-campaign', {
      ...config,
      startsAt: tehranJalaliToIso(start.date, start.time),
      endsAt: tehranJalaliToIso(end.date, end.time),
    }),
    onSuccess: (data) => {
      toast.ok(data.message);
      setLoadedAt(0);
      void qc.invalidateQueries({ queryKey: ['admin', 'points-campaign'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const draw = useMutation({
    mutationFn: () => api.post<{ draw: PointsCampaignDraw; message: string }>('/admin/points-campaign/draw', {}),
    onSuccess: (data) => {
      toast.ok(data.message);
      setDrawConfirmOpen(false);
      setLoadedAt(0);
      void qc.invalidateQueries({ queryKey: ['admin', 'points-campaign'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const exportStandings = async () => {
    const rows = query.data?.standings ?? [];
    if (!rows.length) return;
    const XLSX = await loadXlsx();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['رتبه', 'نام', 'فروشگاه', 'موبایل', 'سفارش‌ها', 'امتیاز'],
      ...rows.map((row, index) => [index + 1, `${row.name} ${row.lastName}`.trim(), row.storeName, row.phone, row.orders, row.points]),
    ]);
    sheet['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 24 }, { wch: 14 }, { wch: 10 }, { wch: 10 }];
    const book = XLSX.utils.book_new();
    book.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(book, sheet, 'امتیازها');
    XLSX.writeFile(book, `campaign-standings-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (query.isLoading) return <div className="a-page"><AdminState kind="loading" /></div>;
  if (query.error) return <div className="a-page"><AdminState kind="error" title="تنظیمات کمپین دریافت نشد." error={query.error} onRetry={() => query.refetch()} /></div>;
  const data = query.data!;
  const phase = PHASE_TEXT[data.phase];
  const savedDraw = data.config.draw;

  return (
    <div className="a-page a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">کمپین امتیاز و قرعه‌کشی</h2>
          <p className="a-subtitle">
            هر کالا امتیاز دارد؛ مشتری با سفارش پرداخت‌شده یا تحویل‌شده در بازهٔ کمپین امتیاز می‌گیرد.
            نفر اول بدون قرعه‌کشی جایزه می‌گیرد و بقیه به نسبت امتیازشان در قرعه‌کشی شرکت می‌کنند.
          </p>
        </div>
        <div className="a-page-actions">
          <span className={phase.badge}>{phase.text}</span>
          <a className="a-btn a-btn--secondary" href="/campaign" target="_blank" rel="noreferrer">مشاهدهٔ صفحهٔ کمپین <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="a-stat"><span className="a-stat-label">کالاهای دارای امتیاز</span><span className="a-stat-value">{formatNumber(data.productsWithPoints)}</span></div>
        <div className="a-stat"><span className="a-stat-label">شرکت‌کنندگان</span><span className="a-stat-value">{formatNumber(data.participants)}</span></div>
        <div className="a-stat"><span className="a-stat-label">مجموع امتیازها</span><span className="a-stat-value">{formatNumber(data.standings.reduce((sum, row) => sum + row.points, 0))}</span></div>
        <div className="a-stat"><span className="a-stat-label">بیشترین امتیاز</span><span className="a-stat-value">{formatNumber(data.standings[0]?.points ?? 0)}</span></div>
      </div>

      <section className="a-card mt-4">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">امتیاز کالاها</h3>
            <p className="a-card-desc">
              امتیاز هر کالا را در فرم کالا، با «تنظیم امتیاز کمپین» برای کالاهای انتخاب‌شده در فهرست کالاها،
              یا با ستون «امتیاز» در آپدیت گروهی اکسل وارد کنید. امتیاز در لحظهٔ ثبت سفارش روی سفارش ثبت می‌شود.
            </p>
          </div>
          <div className="a-card-actions">
            <Link className="a-btn a-btn--secondary" to="/admin/products">رفتن به فهرست کالاها</Link>
            <Link className="a-btn a-btn--secondary" to="/admin/sync">آپدیت با اکسل</Link>
          </div>
        </div>
      </section>

      <form
        className="a-card mt-4 a-form"
        onSubmit={(event) => { event.preventDefault(); save.mutate(); }}
      >
        <div className="a-card-head"><h3 className="a-card-title">تنظیمات کمپین</h3></div>
        <label className="flex items-center gap-2 mb-3">
          <input type="checkbox" checked={config.enabled} onChange={(e) => setConfig({ ...config, enabled: e.target.checked })} />
          <strong>کمپین روشن است</strong> <span className="a-hint">(صفحهٔ کمپین و نشان امتیاز روی کالاها فقط وقتی روشن است دیده می‌شود)</span>
        </label>
        <div className="a-form-grid">
          <label className="a-field">
            <span className="a-label">عنوان</span>
            <input className="a-input" maxLength={80} value={config.title} onChange={(e) => setConfig({ ...config, title: e.target.value })} />
          </label>
          <label className="a-field">
            <span className="a-label">زیرعنوان</span>
            <input className="a-input" maxLength={240} value={config.subtitle} onChange={(e) => setConfig({ ...config, subtitle: e.target.value })} />
          </label>
          <MomentInput id="pc-start" label="شروع" value={start} onChange={setStart} />
          <MomentInput id="pc-end" label="پایان" value={end} onChange={setEnd} />
          <label className="a-field">
            <span className="a-label">جایزهٔ نفر اول (بدون قرعه‌کشی)</span>
            <input className="a-input" maxLength={200} value={config.firstPrize} onChange={(e) => setConfig({ ...config, firstPrize: e.target.value })} placeholder="مثلاً یک گوشی آیفون ۱۶" />
          </label>
          <label className="a-field">
            <span className="a-label">جایزهٔ قرعه‌کشی</span>
            <input className="a-input" maxLength={200} value={config.lotteryPrize} onChange={(e) => setConfig({ ...config, lotteryPrize: e.target.value })} placeholder="مثلاً ۵ میلیون تومان اعتبار خرید" />
          </label>
          <label className="a-field">
            <span className="a-label">تعداد برندگان قرعه‌کشی</span>
            <input className="a-input a-ltr" type="number" min={0} max={50} value={config.lotteryWinners} onChange={(e) => setConfig({ ...config, lotteryWinners: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })} />
          </label>
          <label className="a-field">
            <span className="a-label">تعداد نفرات جدول عمومی</span>
            <input className="a-input a-ltr" type="number" min={3} max={50} value={config.leaderboardSize} onChange={(e) => setConfig({ ...config, leaderboardSize: Math.max(3, Math.min(50, Number(e.target.value) || 10)) })} />
          </label>
        </div>
        <label className="a-field mt-3">
          <span className="a-label">قوانین (هر خط یک بند)</span>
          <textarea className="a-textarea" rows={5} maxLength={3000} value={config.rules} onChange={(e) => setConfig({ ...config, rules: e.target.value })} />
        </label>
        <div className="flex justify-end mt-3">
          <button type="submit" className="a-btn a-btn--primary" disabled={save.isPending} aria-busy={save.isPending || undefined}>{save.isPending ? 'در حال ذخیره…' : 'ذخیرهٔ تنظیمات'}</button>
        </div>
      </form>

      <section className="a-card mt-4">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">قرعه‌کشی</h3>
            <p className="a-card-desc">
              {savedDraw
                ? `انجام‌شده در ${formatMoment(savedDraw.drawnAt)} بین ${formatNumber(savedDraw.entrants)} نفر با ${formatNumber(savedDraw.totalPoints)} امتیاز (شانس).`
                : data.phase === 'ended'
                  ? 'نفر اول جدول برندهٔ جایزهٔ اول است؛ بقیه به نسبت امتیاز در قرعه‌کشی شرکت می‌کنند. قرعه‌کشی فقط یک بار انجام می‌شود و نتیجه در صفحهٔ کمپین نمایش داده می‌شود.'
                  : 'بعد از پایان کمپین فعال می‌شود.'}
            </p>
          </div>
          {!savedDraw && (
            <button
              type="button"
              className="a-btn a-btn--primary"
              disabled={data.phase !== 'ended' || draw.isPending || data.participants === 0}
              aria-busy={draw.isPending || undefined}
              onClick={() => setDrawConfirmOpen(true)}
            >
              {draw.isPending ? 'در حال قرعه‌کشی…' : 'انجام قرعه‌کشی'}
            </button>
          )}
        </div>
        {savedDraw && (
          <div className="a-table-wrap mt-3">
            <table className="a-table">
              <thead><tr><th>جایزه</th><th>نام</th><th className="a-ltr">موبایل</th><th className="a-num">امتیاز</th></tr></thead>
              <tbody>
                {savedDraw.winners.map((winner) => (
                  <tr key={`${winner.kind}-${winner.userId}`}>
                    <td>{winner.kind === 'first' ? `نفر اول: ${data.config.firstPrize || '—'}` : `قرعه‌کشی: ${data.config.lotteryPrize || '—'}`}</td>
                    <td>{winner.name || '—'}</td>
                    <td className="a-ltr">{winner.phone}</td>
                    <td className="a-num">{formatNumber(winner.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="a-card mt-4">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">جدول امتیازها ({formatNumber(data.participants)} نفر)</h3>
            <p className="a-card-desc">فقط سفارش‌های پرداخت‌شده یا تحویل‌شده و لغونشده در بازهٔ کمپین؛ هر ۳۰ ثانیه تازه می‌شود.</p>
          </div>
          <button type="button" className="a-btn a-btn--secondary" disabled={!data.standings.length} onClick={() => void exportStandings()}>دانلود اکسل</button>
        </div>
        <div className="a-table-wrap points-standings-wrap">
          <table className="a-table">
            <thead><tr><th className="a-num">رتبه</th><th>نام</th><th>فروشگاه</th><th className="a-ltr">موبایل</th><th className="a-num">سفارش‌ها</th><th className="a-num">امتیاز</th></tr></thead>
            <tbody>
              {data.standings.map((row, index) => (
                <tr key={row.userId}>
                  <td className="a-num">{formatNumber(index + 1)}</td>
                  <td>{`${row.name} ${row.lastName}`.trim() || '—'}</td>
                  <td>{row.storeName || '—'}</td>
                  <td className="a-ltr">{row.phone}</td>
                  <td className="a-num">{formatNumber(row.orders)}</td>
                  <td className="a-num a-strong">{formatNumber(row.points)}</td>
                </tr>
              ))}
              {!data.standings.length && <TableState colSpan={6} kind="empty" title="هنوز کسی امتیاز نگرفته است." />}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={drawConfirmOpen}
        title="انجام قرعه‌کشی"
        description={`قرعه‌کشی بین ${formatNumber(data.participants)} شرکت‌کننده انجام می‌شود و نتیجه در صفحهٔ کمپین نمایش داده می‌شود. قرعه‌کشی فقط یک بار انجام می‌شود و برگشت ندارد.`}
        confirmLabel="انجام قرعه‌کشی"
        busyLabel="در حال قرعه‌کشی…"
        tone="primary"
        busy={draw.isPending}
        onConfirm={() => draw.mutate()}
        onClose={() => { if (!draw.isPending) setDrawConfirmOpen(false); }}
      />
    </div>
  );
}
