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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 animate-fade-up">
        <div>
          <h1 className="text-xl font-extrabold text-white sm:text-2xl">امور مالی</h1>
          <p className="mt-1 text-xs text-slate-400">مشاهده و مدیریت تراکنش‌ها و پرداخت‌های سیستم</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="huma-table-container">
          <table className="huma-table">
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
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    در حال دریافت اطلاعات...
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    هیچ تراکنشی یافت نشد.
                  </td>
                </tr>
              ) : (
                data?.items.map((payment) => (
                  <tr key={payment.id}>
                    <td className="font-mono text-slate-300" dir="ltr">#{payment.id}</td>
                    <td className="font-bold text-emerald-300">{payment.amount.toLocaleString('fa-IR')}</td>
                    <td className="text-slate-300">{payment.gateway}</td>
                    <td className="font-mono text-slate-400" dir="ltr">{payment.trackingCode || '—'}</td>
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
      </div>
    </div>
  );
}
