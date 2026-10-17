import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  InvestmentEntryDTO,
  InvestmentEntryStatus,
  InvestmentEntryType,
  InventoryCostDTO,
  InvestorDashboardDTO,
  InvestorSettingsDTO,
  Paged,
  PaymentDTO,
} from '@tamas/shared';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';
import './financial.css';

type Tab = 'overview' | 'entries' | 'costs' | 'payments' | 'settings';

const typeLabels: Record<InvestmentEntryType, string> = {
  capital_injection: 'افزایش سرمایه',
  capital_withdrawal: 'برداشت سرمایه',
  purchase: 'خرید کالا',
  expense: 'هزینه جاری',
  profit_distribution: 'تقسیم سود',
  adjustment: 'اصلاح حساب',
};

const statusLabels: Record<InvestmentEntryStatus, string> = { paid: 'قطعی', pending: 'در انتظار', cancelled: 'لغوشده' };
const money = (value: number) => value.toLocaleString('fa-IR');

interface EntryForm {
  type: InvestmentEntryType;
  status: InvestmentEntryStatus;
  amount: string;
  title: string;
  category: string;
  reference: string;
  notes: string;
  transactionDate: string;
}

const emptyEntry = (): EntryForm => ({
  type: 'expense',
  status: 'paid',
  amount: '',
  title: '',
  category: '',
  reference: '',
  notes: '',
  transactionDate: new Date().toISOString().slice(0, 10),
});

function EntryEditor({ value, busy, onChange, onSubmit }: { value: EntryForm; busy: boolean; onChange: (value: EntryForm) => void; onSubmit: (event: FormEvent) => void }) {
  const field = <K extends keyof EntryForm>(key: K, next: EntryForm[K]) => onChange({ ...value, [key]: next });
  return (
    <form id="investment-entry-form" className="a-form" onSubmit={onSubmit}>
      <div className="a-form-grid">
        <label className="a-field"><span className="a-label">نوع رویداد</span><select className="a-select" value={value.type} onChange={(event) => field('type', event.target.value as InvestmentEntryType)}>{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="a-field"><span className="a-label">وضعیت</span><select className="a-select" value={value.status} onChange={(event) => field('status', event.target.value as InvestmentEntryStatus)}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="a-field"><span className="a-label">مبلغ (تومان)</span><input className="a-input a-input--num" type="number" min="1" required value={value.amount} onChange={(event) => field('amount', event.target.value)} /></label>
        <label className="a-field"><span className="a-label">تاریخ</span><input className="a-input" type="date" required value={value.transactionDate} onChange={(event) => field('transactionDate', event.target.value)} /></label>
        <label className="a-field a-span-2"><span className="a-label">عنوان</span><input className="a-input" required minLength={2} maxLength={240} placeholder="مثلاً خرید محموله موبایل" value={value.title} onChange={(event) => field('title', event.target.value)} /></label>
        <label className="a-field"><span className="a-label">دسته‌بندی</span><input className="a-input" maxLength={120} placeholder="حمل، اجاره، خرید عمده…" value={value.category} onChange={(event) => field('category', event.target.value)} /></label>
        <label className="a-field"><span className="a-label">شماره مرجع</span><input className="a-input" maxLength={160} placeholder="فاکتور یا رسید" value={value.reference} onChange={(event) => field('reference', event.target.value)} /></label>
        <label className="a-field a-span-2"><span className="a-label">یادداشت</span><textarea className="a-textarea" rows={3} maxLength={2000} value={value.notes} onChange={(event) => field('notes', event.target.value)} /></label>
      </div>
      {busy ? <p className="a-form-hint">در حال ذخیره…</p> : null}
    </form>
  );
}

function SettingsForm({ initial, onSaved }: { initial: InvestorSettingsDTO; onSaved: () => void }) {
  const toast = useToast();
  const [companyLabel, setCompanyLabel] = useState(initial.companyLabel);
  const [initialCapital, setInitialCapital] = useState(String(initial.initialCapital));
  const [investorSharePercent, setInvestorSharePercent] = useState(String(initial.investorSharePercent));
  const mutation = useMutation({
    mutationFn: () => api.put('/admin/financial/investor-settings', { companyLabel, initialCapital: Number(initialCapital), investorSharePercent: Number(investorSharePercent) }),
    onSuccess: () => { toast.ok('تنظیمات سرمایه‌گذار ذخیره شد.'); onSaved(); },
    onError: (error) => toast.error((error as Error).message),
  });
  const executor = Math.max(0, 100 - Number(investorSharePercent || 0));
  return <section className="a-card fin-settings"><div className="a-card-head"><div><h3 className="a-card-title">تنظیمات قرارداد و سرمایه</h3><p className="a-card-sub">این مقادیر مبنای محاسبات و عنوان پنل سرمایه‌گذار هستند.</p></div></div><form className="a-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><div className="a-form-grid"><label className="a-field a-span-2"><span className="a-label">عنوان مشارکت</span><input className="a-input" value={companyLabel} onChange={(event) => setCompanyLabel(event.target.value)} required /></label><label className="a-field"><span className="a-label">سرمایه پایه (تومان)</span><input className="a-input a-input--num" type="number" min="0" value={initialCapital} onChange={(event) => setInitialCapital(event.target.value)} required /></label><label className="a-field"><span className="a-label">سهم سرمایه‌گذار (درصد)</span><input className="a-input a-input--num" type="number" min="0" max="100" value={investorSharePercent} onChange={(event) => setInvestorSharePercent(event.target.value)} required /></label></div><div className="fin-split-preview"><span style={{ width: `${Number(investorSharePercent || 0)}%` }}>سرمایه‌گذار {investorSharePercent || 0}٪</span><span style={{ width: `${executor}%` }}>مجری {executor}٪</span></div><button className="a-btn a-btn--primary" disabled={mutation.isPending}>{mutation.isPending ? 'در حال ذخیره…' : 'ذخیره تنظیمات'}</button></form></section>;
}

export function FinancialPage() {
  const toast = useToast();
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [entryOpen, setEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<InvestmentEntryDTO | null>(null);
  const [entryForm, setEntryForm] = useState<EntryForm>(emptyEntry);
  const [costSearch, setCostSearch] = useState('');
  const [costDrafts, setCostDrafts] = useState<Record<number, string>>({});

  const dashboard = useQuery({ queryKey: ['investor', 'dashboard', '30d'], queryFn: async () => (await api.get<{ dashboard: InvestorDashboardDTO }>('/investor/dashboard', { range: '30d' })).dashboard });
  const entries = useQuery({ queryKey: ['admin', 'financial', 'entries'], queryFn: () => api.get<Paged<InvestmentEntryDTO>>('/admin/financial/entries', { perPage: 100 }) });
  const costs = useQuery({ queryKey: ['admin', 'financial', 'costs', costSearch], queryFn: () => api.get<Paged<InventoryCostDTO>>('/admin/financial/inventory-costs', { q: costSearch, perPage: 100 }), enabled: tab === 'costs' });
  const payments = useQuery({ queryKey: ['admin', 'payments'], queryFn: () => api.get<Paged<PaymentDTO>>('/admin/financial/payments', { perPage: 100 }), enabled: tab === 'payments' });

  const refreshFinance = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['investor', 'dashboard'] }),
      client.invalidateQueries({ queryKey: ['admin', 'financial'] }),
    ]);
  };

  const saveEntry = useMutation({
    mutationFn: () => {
      const body = { ...entryForm, amount: Number(entryForm.amount), transactionDate: new Date(`${entryForm.transactionDate}T12:00:00`).toISOString() };
      return editingEntry ? api.patch(`/admin/financial/entries/${editingEntry.id}`, body) : api.post('/admin/financial/entries', body);
    },
    onSuccess: async () => { toast.ok(editingEntry ? 'رکورد مالی ویرایش شد.' : 'رکورد مالی ثبت شد.'); setEntryOpen(false); setEditingEntry(null); setEntryForm(emptyEntry()); await refreshFinance(); },
    onError: (error) => toast.error((error as Error).message),
  });
  const deleteEntry = useMutation({
    mutationFn: (id: number) => api.del(`/admin/financial/entries/${id}`),
    onSuccess: async () => { toast.ok('رکورد مالی حذف شد.'); await refreshFinance(); },
    onError: (error) => toast.error((error as Error).message),
  });
  const saveCost = useMutation({
    mutationFn: ({ id, costPrice }: { id: number; costPrice: number }) => api.patch(`/admin/financial/inventory-costs/${id}`, { costPrice }),
    onSuccess: async (_data, variables) => { toast.ok('قیمت خرید کالا ذخیره شد.'); setCostDrafts((current) => { const next = { ...current }; delete next[variables.id]; return next; }); await Promise.all([costs.refetch(), client.invalidateQueries({ queryKey: ['investor', 'dashboard'] }), client.invalidateQueries({ queryKey: ['admin', 'products'] }), client.invalidateQueries({ queryKey: ['admin', 'warehouses', 'investment-summary'] })]); },
    onError: (error) => toast.error((error as Error).message),
  });

  const openCreate = () => { setEditingEntry(null); setEntryForm(emptyEntry()); setEntryOpen(true); };
  const openEdit = (entry: InvestmentEntryDTO) => {
    setEditingEntry(entry);
    setEntryForm({ type: entry.type, status: entry.status, amount: String(entry.amount), title: entry.title, category: entry.category || '', reference: entry.reference || '', notes: entry.notes || '', transactionDate: entry.transactionDate.slice(0, 10) });
    setEntryOpen(true);
  };
  const stats = dashboard.data?.metrics;

  return (
    <div className="a-page a-page--financial a-fade">
      <section className="a-page-head"><div className="a-titles"><h2 className="a-title">مرکز مالی و سرمایه‌گذاری</h2><p className="a-subtitle">محاسبات سرمایه‌گذاری فقط شامل محصولاتی است که گزینه تأمین مالی آن‌ها در مدیریت محصولات روشن باشد.</p></div><div className="a-page-actions"><a className="a-btn a-btn--secondary" href="/investor" target="_blank" rel="noreferrer">مشاهده پنل سرمایه‌گذار</a><button className="a-btn a-btn--primary" type="button" onClick={openCreate}>ثبت رویداد مالی</button></div></section>
      <nav className="fin-tabs" aria-label="بخش‌های مالی">{([['overview', 'خلاصه'], ['entries', 'دفتر مالی'], ['costs', 'قیمت خرید کالا'], ['payments', 'پرداخت‌ها'], ['settings', 'تنظیمات مشارکت']] as Array<[Tab, string]>).map(([value, label]) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}</button>)}</nav>

      {tab === 'overview' ? <>
        <section className="a-stat-strip fin-stats">{[
          ['فروش خالص ۳۰ روز', stats?.netSales, 'تومان'], ['خرید خالص', stats?.netPurchases, 'تومان'], ['هزینه جاری', stats?.operatingExpenses, 'تومان'], ['سود خالص', stats?.netProfit, 'تومان'], ['ارزش موجودی', stats?.inventoryValue, 'تومان'], ['موجودی تعدادی', stats?.inventoryUnits, 'عدد'],
        ].map(([label, value, suffix]) => <article className="a-stat-card" key={String(label)}><span className="a-stat-label">{label}</span><strong className="a-stat-value">{money(Number(value || 0))}</strong><small className="a-stat-caption">{suffix}</small></article>)}</section>
        <section className="fin-overview-grid"><article className="a-card"><div className="a-card-head"><div><h3 className="a-card-title">تقسیم سود دوره</h3><p className="a-card-sub">فقط سود مثبت و قطعی میان طرفین تقسیم می‌شود.</p></div></div><div className="fin-share"><div><span>سرمایه‌گذار · {dashboard.data?.settings.investorSharePercent ?? 60}٪</span><strong>{money(stats?.investorShare || 0)} تومان</strong></div><div><span>مجری · {dashboard.data?.settings.executorSharePercent ?? 40}٪</span><strong>{money(stats?.executorShare || 0)} تومان</strong></div></div></article><article className="a-card"><div className="a-card-head"><div><h3 className="a-card-title">کنترل کیفیت داده</h3><p className="a-card-sub">دقت سود وابسته به تکمیل قیمت خرید است.</p></div></div><div className="fin-coverage"><label>پوشش قیمت خرید موجودی <strong>{dashboard.data?.dataQuality.inventoryCostCoveragePercent ?? 0}٪</strong></label><progress max="100" value={dashboard.data?.dataQuality.inventoryCostCoveragePercent ?? 0} /><label>پوشش بهای فروش <strong>{dashboard.data?.dataQuality.salesCostCoveragePercent ?? 0}٪</strong></label><progress max="100" value={dashboard.data?.dataQuality.salesCostCoveragePercent ?? 0} /></div></article></section>
      </> : null}

      {tab === 'entries' ? <section className="a-card a-card--flush"><div className="a-table-wrap"><table className="a-table"><thead><tr><th>شرح</th><th>نوع</th><th>مبلغ</th><th>وضعیت</th><th>تاریخ</th><th>عملیات</th></tr></thead><tbody>{entries.isLoading ? <tr><td className="a-empty" colSpan={6}>در حال دریافت دفتر مالی…</td></tr> : entries.data?.items.length === 0 ? <tr><td className="a-empty" colSpan={6}>رکوردی ثبت نشده است.</td></tr> : entries.data?.items.map((entry) => <tr key={entry.id}><td><strong className="a-strong">{entry.title}</strong><small className="a-cell-sub">{entry.reference || entry.category || 'بدون مرجع'}</small></td><td><span className="a-badge a-badge--neutral">{typeLabels[entry.type]}</span></td><td><strong className="a-money">{money(entry.amount)}</strong></td><td><span className={`a-badge ${entry.status === 'paid' ? 'a-badge--success' : entry.status === 'pending' ? 'a-badge--amber' : 'a-badge--neutral'}`}>{statusLabels[entry.status]}</span></td><td>{new Date(entry.transactionDate).toLocaleDateString('fa-IR')}</td><td><div className="fin-actions"><button className="a-btn a-btn--secondary a-btn--sm" onClick={() => openEdit(entry)}>ویرایش</button><button className="a-btn a-btn--danger a-btn--sm" disabled={deleteEntry.isPending} onClick={() => { if (window.confirm('این رکورد مالی حذف شود؟')) deleteEntry.mutate(entry.id); }}>حذف</button></div></td></tr>)}</tbody></table></div></section> : null}

      {tab === 'costs' ? <section className="a-card a-card--flush"><div className="a-filterbar"><div className="a-searchbar"><input className="a-input" type="search" placeholder="جست‌وجوی نام یا کد کالا…" value={costSearch} onChange={(event) => setCostSearch(event.target.value)} /></div><span className="a-badge a-badge--neutral">قیمت خرید، مبنای ارزش موجودی و سود است</span></div><div className="a-table-wrap"><table className="a-table"><thead><tr><th>کالا</th><th>موجودی</th><th>قیمت فروش</th><th>قیمت خرید واحد</th><th>ارزش موجودی</th><th>ثبت</th></tr></thead><tbody>{costs.isLoading ? <tr><td className="a-empty" colSpan={6}>در حال دریافت کالاها…</td></tr> : costs.data?.items.map((item) => { const draft = costDrafts[item.id] ?? String(item.costPrice); const changed = Number(draft) !== item.costPrice; return <tr key={item.id}><td><strong className="a-strong">{item.title}</strong><small className="a-cell-sub a-ltr">{item.sku || item.productId}</small></td><td>{money(item.stock)} عدد</td><td>{money(item.salePrice)}</td><td><input aria-label={`قیمت خرید ${item.title}`} className="a-input a-input--num fin-cost-input" type="number" min="0" value={draft} onChange={(event) => setCostDrafts((current) => ({ ...current, [item.id]: event.target.value }))} /></td><td>{money(item.stock * Number(draft || 0))}</td><td><button className="a-btn a-btn--primary a-btn--sm" disabled={!changed || saveCost.isPending} onClick={() => saveCost.mutate({ id: item.id, costPrice: Number(draft) })}>ذخیره</button></td></tr>; })}</tbody></table></div></section> : null}

      {tab === 'payments' ? <section className="a-card a-card--flush"><div className="a-table-wrap"><table className="a-table"><thead><tr><th>شناسه</th><th>مبلغ</th><th>درگاه</th><th>کد رهگیری</th><th>وضعیت</th><th>تاریخ</th></tr></thead><tbody>{payments.isLoading ? <tr><td className="a-empty" colSpan={6}>در حال دریافت پرداخت‌ها…</td></tr> : payments.data?.items.length === 0 ? <tr><td className="a-empty" colSpan={6}>پرداختی ثبت نشده است.</td></tr> : payments.data?.items.map((payment) => <tr key={payment.id}><td className="a-ltr">#{payment.id}</td><td className="a-money">{money(payment.amount)}</td><td>{payment.gateway}</td><td className="a-ltr">{payment.trackingCode || '—'}</td><td><span className={`a-badge ${payment.status === 'success' ? 'a-badge--success' : payment.status === 'failed' ? 'a-badge--red' : 'a-badge--amber'}`}>{payment.status === 'success' ? 'موفق' : payment.status === 'failed' ? 'ناموفق' : 'در انتظار'}</span></td><td>{new Date(payment.createdAt).toLocaleString('fa-IR')}</td></tr>)}</tbody></table></div></section> : null}

      {tab === 'settings' && dashboard.data ? <SettingsForm key={`${dashboard.data.settings.initialCapital}-${dashboard.data.settings.investorSharePercent}-${dashboard.data.settings.companyLabel}`} initial={dashboard.data.settings} onSaved={() => { void Promise.all([client.invalidateQueries({ queryKey: ['investor', 'dashboard'] }), client.invalidateQueries({ queryKey: ['admin', 'orders'] }), client.invalidateQueries({ queryKey: ['admin', 'warehouses', 'investment-summary'] })]); }} /> : null}

      <Modal open={entryOpen} onClose={() => { if (!saveEntry.isPending) setEntryOpen(false); }} busy={saveEntry.isPending} title={editingEntry ? 'ویرایش رویداد مالی' : 'ثبت رویداد مالی'} footer={<><button type="button" className="a-btn a-btn--secondary" onClick={() => setEntryOpen(false)} disabled={saveEntry.isPending}>انصراف</button><button type="submit" form="investment-entry-form" className="a-btn a-btn--primary" disabled={saveEntry.isPending}>{saveEntry.isPending ? 'در حال ذخیره…' : 'ذخیره رکورد'}</button></>}><EntryEditor value={entryForm} busy={saveEntry.isPending} onChange={setEntryForm} onSubmit={(event) => { event.preventDefault(); saveEntry.mutate(); }} /></Modal>
    </div>
  );
}
