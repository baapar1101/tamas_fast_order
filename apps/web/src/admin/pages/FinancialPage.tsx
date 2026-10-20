import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InventoryCostDTO, Paged, PaymentDTO } from '@tamas/shared';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import './financial.css';

type Tab = 'payments' | 'costs';
const money = (value: number) => value.toLocaleString('fa-IR');

export function FinancialPage() {
  const toast = useToast();
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>('payments');
  const [costSearch, setCostSearch] = useState('');
  const [costDrafts, setCostDrafts] = useState<Record<number, string>>({});

  const costs = useQuery({
    queryKey: ['admin', 'financial', 'costs', costSearch],
    queryFn: () => api.get<Paged<InventoryCostDTO>>('/admin/financial/inventory-costs', { q: costSearch, perPage: 100 }),
    enabled: tab === 'costs',
  });
  const payments = useQuery({
    queryKey: ['admin', 'payments'],
    queryFn: () => api.get<Paged<PaymentDTO>>('/admin/financial/payments', { perPage: 100 }),
    enabled: tab === 'payments',
  });

  const saveCost = useMutation({
    mutationFn: ({ id, costPrice }: { id: number; costPrice: number }) => api.patch(`/admin/financial/inventory-costs/${id}`, { costPrice }),
    onSuccess: async (_data, variables) => {
      toast.ok('قیمت خرید کالا ذخیره شد.');
      setCostDrafts((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      await Promise.all([
        costs.refetch(),
        client.invalidateQueries({ queryKey: ['admin', 'products'] }),
      ]);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <div className="a-page a-page--financial a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">امور مالی</h2>
          <p className="a-subtitle">مشاهده پرداخت‌ها و مدیریت قیمت خرید کالاها</p>
        </div>
      </section>

      <nav className="fin-tabs" aria-label="بخش‌های مالی">
        <button className={tab === 'payments' ? 'active' : ''} onClick={() => setTab('payments')}>پرداخت‌ها</button>
        <button className={tab === 'costs' ? 'active' : ''} onClick={() => setTab('costs')}>قیمت خرید کالا</button>
      </nav>

      {tab === 'payments' ? (
        <section className="a-card a-card--flush">
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>شناسه</th><th>مبلغ</th><th>درگاه</th><th>کد رهگیری</th><th>وضعیت</th><th>تاریخ</th></tr></thead>
              <tbody>
                {payments.isLoading ? (
                  <tr><td className="a-empty" colSpan={6}>در حال دریافت پرداخت‌ها…</td></tr>
                ) : payments.data?.items.length === 0 ? (
                  <tr><td className="a-empty" colSpan={6}>پرداختی ثبت نشده است.</td></tr>
                ) : payments.data?.items.map((payment) => (
                  <tr key={payment.id}>
                    <td className="a-ltr">#{payment.id}</td>
                    <td className="a-money">{money(payment.amount)}</td>
                    <td>{payment.gateway}</td>
                    <td className="a-ltr">{payment.trackingCode || '—'}</td>
                    <td><span className={`a-badge ${payment.status === 'success' ? 'a-badge--success' : payment.status === 'failed' ? 'a-badge--red' : 'a-badge--amber'}`}>{payment.status === 'success' ? 'موفق' : payment.status === 'failed' ? 'ناموفق' : 'در انتظار'}</span></td>
                    <td>{new Date(payment.createdAt).toLocaleString('fa-IR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'costs' ? (
        <section className="a-card a-card--flush">
          <div className="a-filterbar">
            <div className="a-searchbar"><input className="a-input" type="search" placeholder="جست‌وجوی نام یا کد کالا…" value={costSearch} onChange={(event) => setCostSearch(event.target.value)} /></div>
            <span className="a-badge a-badge--neutral">قیمت خرید، مبنای ارزش موجودی و سود ناخالص است</span>
          </div>
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>کالا</th><th>موجودی</th><th>قیمت فروش</th><th>قیمت خرید واحد</th><th>ارزش موجودی</th><th>ثبت</th></tr></thead>
              <tbody>
                {costs.isLoading ? (
                  <tr><td className="a-empty" colSpan={6}>در حال دریافت کالاها…</td></tr>
                ) : costs.data?.items.map((item) => {
                  const draft = costDrafts[item.id] ?? String(item.costPrice);
                  const changed = Number(draft) !== item.costPrice;
                  return (
                    <tr key={item.id}>
                      <td><strong className="a-strong">{item.title}</strong><small className="a-cell-sub a-ltr">{item.sku || item.productId}</small></td>
                      <td>{money(item.stock)} عدد</td>
                      <td>{money(item.salePrice)}</td>
                      <td><input aria-label={`قیمت خرید ${item.title}`} className="a-input a-input--num fin-cost-input" type="number" min="0" value={draft} onChange={(event) => setCostDrafts((current) => ({ ...current, [item.id]: event.target.value }))} /></td>
                      <td>{money(item.stock * Number(draft || 0))}</td>
                      <td><button className="a-btn a-btn--primary a-btn--sm" disabled={!changed || saveCost.isPending} onClick={() => saveCost.mutate({ id: item.id, costPrice: Number(draft) })}>ذخیره</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
