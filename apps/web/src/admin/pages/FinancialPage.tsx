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
    <div className="a-page a-page--financial a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">Ø§Ù…ÙˆØ± Ù…Ø§Ù„ÛŒ</h2>
          <p className="a-subtitle">Ù…Ø´Ø§Ù‡Ø¯Ù‡ Ùˆ Ù…Ø¯ÛŒØ±ÛŒØª ØªØ±Ø§Ú©Ù†Ø´â€ŒÙ‡Ø§ Ùˆ Ù¾Ø±Ø¯Ø§Ø®Øªâ€ŒÙ‡Ø§ÛŒ Ø³ÛŒØ³ØªÙ…</p>
        </div>
      </section>

      <section className="a-card a-card--flush">
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Ø´Ù†Ø§Ø³Ù‡ ØªØ±Ø§Ú©Ù†Ø´</th>
                <th>Ù…Ø¨Ù„Øº (ØªÙˆÙ…Ø§Ù†)</th>
                <th>Ø¯Ø±Ú¯Ø§Ù‡ Ù¾Ø±Ø¯Ø§Ø®Øª</th>
                <th>Ú©Ø¯ Ø±Ù‡Ú¯ÛŒØ±ÛŒ</th>
                <th>ÙˆØ¶Ø¹ÛŒØª</th>
                <th>ØªØ§Ø±ÛŒØ® Ù¾Ø±Ø¯Ø§Ø®Øª</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="a-empty">
                    Ø¯Ø± Ø­Ø§Ù„ Ø¯Ø±ÛŒØ§ÙØª Ø§Ø·Ù„Ø§Ø¹Ø§Øª...
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="a-empty">
                    Ù‡ÛŒÚ† ØªØ±Ø§Ú©Ù†Ø´ÛŒ ÛŒØ§ÙØª Ù†Ø´Ø¯.
                  </td>
                </tr>
              ) : (
                data?.items.map((payment) => (
                  <tr key={payment.id}>
                    <td className="font-mono text-slate-300 a-ltr">#{payment.id}</td>
                    <td className="font-bold text-emerald-300">{payment.amount.toLocaleString('fa-IR')}</td>
                    <td className="text-slate-300">{payment.gateway}</td>
                    <td className="font-mono text-slate-400 a-ltr">{payment.trackingCode || 'â€”'}</td>
                    <td>
                      <span className={`chip ${payment.status === 'success' ? 'chip-brand' : payment.status === 'failed' ? 'chip-rose' : 'chip-amber'}`}>
                        {payment.status === 'success' ? 'Ù…ÙˆÙÙ‚' : payment.status === 'failed' ? 'Ù†Ø§Ù…ÙˆÙÙ‚' : 'Ø¯Ø± Ø§Ù†ØªØ¸Ø§Ø±'}
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