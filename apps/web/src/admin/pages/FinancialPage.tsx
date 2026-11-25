import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InventoryCostDTO, Paged, PaymentDTO } from '@tamas/shared';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { TableState } from '../components/AdminState';
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
        <button type="button" className={tab === 'payments' ? 'active' : ''} aria-current={tab === 'payments' ? 'true' : undefined} onClick={() => setTab('payments')}>پرداخت‌ها</button>
        <button type="button" className={tab === 'costs' ? 'active' : ''} aria-current={tab === 'costs' ? 'true' : undefined} onClick={() => setTab('costs')}>قیمت خرید کالا</button>
      </nav>

      {tab === 'payments' ? (
        <section className="a-card a-card--flush">
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>شناسه</th><th className="a-num">مبلغ</th><th>درگاه</th><th>کد رهگیری</th><th>وضعیت</th><th>تاریخ</th></tr></thead>
              <tbody>
                {payments.isLoading ? (
                  <TableState colSpan={6} kind="loading" />
                ) : payments.isError ? (
                  <TableState colSpan={6} kind="error" error={payments.error} onRetry={() => void payments.refetch()} />
                ) : payments.data?.items.length === 0 ? (
                  <TableState colSpan={6} kind="empty" noun="پرداخت" />
                ) : payments.data?.items.map((payment) => (
                  <tr key={payment.id}>
                    <td className="a-ltr">#{payment.id}</td>
                    <td className="a-money a-num">{money(payment.amount)}</td>
                    <td className="a-ltr">{payment.gateway}</td>
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
            <div className="a-searchbar"><input className="a-input" type="search" placeholder="جست‌وجوی نام یا کد کالا…" aria-label="جست‌وجوی کالا" value={costSearch} onChange={(event) => setCostSearch(event.target.value)} /></div>
            <span className="a-badge a-badge--neutral">قیمت خرید، مبنای ارزش موجودی و سود ناخالص است</span>
          </div>
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>کالا</th><th className="a-num">موجودی</th><th className="a-num">قیمت فروش</th><th>قیمت خرید واحد</th><th className="a-num">ارزش موجودی</th><th>ثبت</th></tr></thead>
              <tbody>
                {costs.isLoading ? (
                  <TableState colSpan={6} kind="loading" />
                ) : costs.isError ? (
                  <TableState colSpan={6} kind="error" error={costs.error} onRetry={() => void costs.refetch()} />
                ) : costs.data?.items.length === 0 ? (
                  <TableState colSpan={6} kind={costSearch.trim() ? 'filtered' : 'empty'} noun="کالا" />
                ) : costs.data?.items.map((item) => {
                  const draft = costDrafts[item.id] ?? String(item.costPrice);
                  const changed = Number(draft) !== item.costPrice;
                  return (
                    <tr key={item.id}>
                      <td><strong className="a-strong">{item.title}</strong><small className="a-cell-sub a-ltr">{item.sku || item.productId}</small></td>
                      <td className="a-num">{money(item.stock)} عدد</td>
                      <td className="a-num">{money(item.salePrice)}</td>
                      <td><input aria-label={`قیمت خرید ${item.title}`} className="a-input a-input--num fin-cost-input" type="number" min="0" inputMode="numeric" dir="ltr" value={draft} onChange={(event) => setCostDrafts((current) => ({ ...current, [item.id]: event.target.value }))} /></td>
                      <td className="a-num">{money(item.stock * Number(draft || 0))}</td>
                      <td>
                        <button
                          type="button"
                          className="a-btn a-btn--outline a-btn--sm"
                          disabled={!changed || saveCost.isPending}
                          aria-busy={(saveCost.isPending && saveCost.variables?.id === item.id) || undefined}
                          aria-label={`ذخیره قیمت خرید ${item.title}`}
                          onClick={() => saveCost.mutate({ id: item.id, costPrice: Number(draft) })}
                        >
                          {saveCost.isPending && saveCost.variables?.id === item.id ? 'در حال ذخیره…' : 'ذخیره'}
                        </button>
                      </td>
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
