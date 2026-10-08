import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useToast } from '../components/Toast';
import './wallet.css';

interface WalletEntry { id: number; direction: 'credit' | 'debit'; type: string; amount: number; balanceAfter: number; description: string; reference?: string; createdAt: string }
interface WalletData { wallet: { balance: number; lifetimeCredit: number; lifetimeDebit: number; isFrozen: boolean }; transactions: WalletEntry[]; total: number; config: { enabled: boolean; minTopup: number; maxTopup: number } }
const money = (value: number) => `${value.toLocaleString('fa-IR')} تومان`;
const labels: Record<string, string> = { deposit: 'شارژ آنلاین', purchase: 'خرید', refund: 'بازگشت وجه', adjustment: 'اصلاح مدیریتی', withdrawal: 'برداشت' };

export function WalletPage() {
  const { user, ready } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [amount, setAmount] = useState(500_000);
  const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: ['wallet'], queryFn: () => api.get<WalletData>('/wallet'), enabled: Boolean(user) });

  useEffect(() => { if (params.get('status') === 'success') toast.ok('کیف پول با موفقیت شارژ شد.'); else if (params.get('status') === 'failed') toast.error('پرداخت شارژ کیف پول ناموفق بود.'); }, [params, toast]);
  if (!ready) return <div className="wallet-loading">در حال بارگذاری…</div>;
  if (!user) return <Navigate to="/" replace />;
  const data = query.data;

  async function topup() {
    setBusy(true);
    try {
      const result = await api.post<{ url: string }>('/wallet/topup', { amount });
      if (result.url) window.location.href = result.url;
    } catch (error) { toast.error((error as Error).message); setBusy(false); }
  }

  return <section className="wallet-page" dir="rtl">
    <header className="wallet-header"><div><h1>کیف پول من</h1><p>مدیریت موجودی، شارژ و سوابق مالی</p></div></header>
    {query.isLoading ? <div className="wallet-loading">در حال دریافت کیف پول…</div> : query.isError ? <div className="wallet-error">{(query.error as Error).message}</div> : data && <>
      <section className="wallet-hero">
        <div><span>موجودی قابل استفاده</span><strong>{money(data.wallet.balance)}</strong><small>{data.wallet.isFrozen ? 'کیف پول مسدود است' : 'آماده پرداخت سفارش'}</small></div>
        <div className="wallet-stats"><article><span>مجموع واریز</span><b>{money(data.wallet.lifetimeCredit)}</b></article><article><span>مجموع برداشت</span><b>{money(data.wallet.lifetimeDebit)}</b></article></div>
      </section>
      <section className="wallet-grid">
        <article className="wallet-panel"><h2>شارژ کیف پول</h2><p>مبلغ دلخواه را انتخاب کنید و از درگاه بانکی بپردازید.</p><div className="wallet-presets">{[500_000,1_000_000,2_000_000,5_000_000].map(v => <button key={v} onClick={() => setAmount(v)}>{v.toLocaleString('fa-IR')}</button>)}</div><label>مبلغ شارژ (تومان)<input type="number" min={data.config.minTopup} max={data.config.maxTopup} value={amount} onChange={e => setAmount(Number(e.target.value))}/></label><button className="wallet-primary" disabled={busy || data.wallet.isFrozen || !data.config.enabled} onClick={() => void topup()}>{busy ? 'در حال اتصال…' : 'پرداخت و شارژ کیف پول'}</button><small>حداقل {money(data.config.minTopup)} · حداکثر {money(data.config.maxTopup)}</small></article>
        <article className="wallet-panel wallet-history"><h2>گردش حساب</h2>{data.transactions.length === 0 ? <div className="wallet-empty">هنوز تراکنشی ثبت نشده است.</div> : <div className="wallet-list">{data.transactions.map(entry => <div className="wallet-row" key={entry.id}><i className={entry.direction}>{entry.direction === 'credit' ? '+' : '−'}</i><div><b>{entry.description}</b><span>{labels[entry.type] || entry.type} · {new Date(entry.createdAt).toLocaleString('fa-IR')}</span></div><div className={entry.direction}><strong>{entry.direction === 'credit' ? '+' : '−'} {money(entry.amount)}</strong><small>مانده: {money(entry.balanceAfter)}</small></div></div>)}</div>}</article>
      </section>
    </>}
  </section>;
}
