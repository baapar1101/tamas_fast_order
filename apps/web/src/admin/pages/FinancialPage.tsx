import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { PaymentDTO, Paged } from '@tamas/shared';

export function FinancialPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payments', page],
    queryFn: () => api.get<Paged<PaymentDTO>>('/admin/financial/payments', { page }),
  });

  return (
    <div className="a-page a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">امور مالی</h2>
          <p className="a-subtitle">مشاهده و مدیریت تراکنش‌ها و پرداخت‌های سیستم</p>
        </div>
      </section>

      <section className="a-card a-card--flush">
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>شناسه تراکنش</th>
                <th>مبلغ (تومان)</th>
                <th>درگاه پرداخت</th>
                <th>کد رهگیری</th>
                <th>وضعیت</th>
                <th>تاریخ پرداخت</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="a-empty">
                    در حال دریافت اطلاعات...
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="a-empty">
                    هیچ تراکنشی یافت نشد.
                  </td>
                </tr>
              ) : (
                data?.items.map((payment) => (
                  <tr key={payment.id}>
                    <td className="font-mono text-slate-300 a-ltr">#{payment.id}</td>
                    <td className="font-bold text-emerald-300">{payment.amount.toLocaleString('fa-IR')}</td>
                    <td className="text-slate-300">{payment.gateway}</td>
                    <td className="font-mono text-slate-400 a-ltr">{payment.trackingCode || '—'}</td>
                    <td>
                      <span className={`chip ${payment.status === 'success' ? 'chip-brand' : payment.status === 'failed' ? 'chip-rose' : 'chip-amber'}`}>
                        {payment.status === 'success' ? 'موفق' : payment.status === 'failed' ? 'ناموفق' : 'در انتظار'}
                      </span>
                    </td>
                    <td className="text-xs text-slate-400">
                      {new Date(payment.createdAt).toLocaleDateString('fa-IR')} - {new Date(payment.createdAt).toLocaleTimeString('fa-IR')}
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