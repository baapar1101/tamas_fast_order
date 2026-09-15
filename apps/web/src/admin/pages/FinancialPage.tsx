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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">امور مالی</h1>
          <p className="text-sm text-slate-400">مدیریت پرداخت‌ها و تراکنش‌ها</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table w-full text-right text-sm">
            <thead className="bg-[#131c2e]/60 text-xs text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">شناسه</th>
                <th className="px-4 py-3 font-medium">مبلغ</th>
                <th className="px-4 py-3 font-medium">درگاه</th>
                <th className="px-4 py-3 font-medium">کد رهگیری</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium">تاریخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    در حال دریافت...
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    تراکنشی یافت نشد.
                  </td>
                </tr>
              ) : (
                data?.items.map((payment) => (
                  <tr key={payment.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-slate-300">#{payment.id}</td>
                    <td className="px-4 py-3 text-white font-medium">{payment.amount.toLocaleString('fa-IR')} تومان</td>
                    <td className="px-4 py-3 text-slate-400">{payment.gateway}</td>
                    <td className="px-4 py-3 text-slate-400">{payment.trackingCode || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`chip ${payment.status === 'success' ? 'chip-success' : payment.status === 'failed' ? 'chip-danger' : 'chip-warning'}`}>
                        {payment.status === 'success' ? 'موفق' : payment.status === 'failed' ? 'ناموفق' : 'در انتظار'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs" dir="ltr">
                      {new Date(payment.createdAt).toLocaleString('fa-IR')}
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
