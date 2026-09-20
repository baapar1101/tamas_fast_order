import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { useDebounced } from '../../storefront/hooks';

interface UsersResponse {
  items: UserDTO[];
  total: number;
  page: number;
  perPage: number;
}

export function UsersPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState<'all' | 'admin' | 'customer'>('all');
  const [page, setPage] = useState(1);

  const debounced = useDebounced(search);
  const query = useMemo(() => ({ q: debounced, role, page, perPage: 30 }), [debounced, role, page]);

  const users = useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: () => api.get<UsersResponse>('/admin/users', query),
    placeholderData: (prev) => prev,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'counters'] });
  };

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<UserDTO> }) => api.patch(`/admin/users/${id}`, body),
    onSuccess: () => {
      toast.ok('Ø§Ø·Ù„Ø§Ø¹Ø§Øª Ú©Ø§Ø±Ø¨Ø± Ø¨Ù‡â€ŒØ±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ø´Ø¯.');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = users.data?.items ?? [];
  const total = users.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 30));

  const adminUsersCount = items.filter((u) => u.role === 'admin').length;
  const verifiedIdCount = items.filter((u) => u.isVerifiedIdentity).length;

  return (
    <div className="a-page a-page--users a-fade">
      {/* Page Header */}
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">Ù…Ø¯ÛŒØ±ÛŒØª Ú©Ø§Ø±Ø¨Ø±Ø§Ù†</h2>
          <p className="a-subtitle">Ù…Ø´Ø§Ù‡Ø¯Ù‡ØŒ Ø¨Ø±Ø±Ø³ÛŒ Ø§Ø­Ø±Ø§Ø² Ù‡ÙˆÛŒØª Ùˆ Ù…Ø¯ÛŒØ±ÛŒØª Ø¯Ø³ØªØ±Ø³ÛŒâ€ŒÙ‡Ø§ÛŒ Ú©Ø§Ø±Ø¨Ø±Ø§Ù†</p>
        </div>
        <div className="a-page-actions">
          <span className="a-badge a-badge--brand">{formatNumber(total)} Ú©Ø§Ø±Ø¨Ø± Ú©Ù„</span>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="a-stat">
          <div className="a-stat-head">
            <span className="a-stat-label">Ú©Ù„ Ú©Ø§Ø±Ø¨Ø±Ø§Ù†</span>
            <span className="a-badge a-badge--brand">{formatNumber(total)}</span>
          </div>
          <p className="a-stat-value">{formatNumber(total)}</p>
        </div>
        <div className="a-stat">
          <div className="a-stat-head">
            <span className="a-stat-label">Ù…Ø¯ÛŒØ±Ø§Ù† Ø³ÛŒØ³ØªÙ…</span>
            <span className="a-badge a-badge--amber">{formatNumber(adminUsersCount)}</span>
          </div>
          <p className="a-stat-value a-stat-value--amber">{formatNumber(adminUsersCount)}</p>
        </div>
        <div className="a-stat">
          <div className="a-stat-head">
            <span className="a-stat-label">Ú©Ø¯ Ù…Ù„ÛŒ ØªØ§ÛŒÛŒØ¯ Ø´Ø¯Ù‡</span>
            <span className="a-badge a-badge--brand">{formatNumber(verifiedIdCount)}</span>
          </div>
          <p className="a-stat-value a-stat-value--green">{formatNumber(verifiedIdCount)}</p>
        </div>
      </section>

      {/* Filters Bar */}
      <section className="a-card">
        <div className="a-filterbar">
          <input
            className="a-input a-grow"
            placeholder="Ø¬Ø³ØªØ¬Ùˆ Ø¯Ø± Ù†Ø§Ù…ØŒ Ø´Ù…Ø§Ø±Ù‡ Ù‡Ù…Ø±Ø§Ù‡ØŒ Ú©Ø¯ Ù…Ù„ÛŒ..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="a-select a-select--auto"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as typeof role);
              setPage(1);
            }}
          >
            <option value="all">Ù‡Ù…Ù‡ Ù†Ù‚Ø´â€ŒÙ‡Ø§</option>
            <option value="admin">Ù…Ø¯ÛŒØ±Ø§Ù† (Admin)</option>
            <option value="customer">Ù…Ø´ØªØ±ÛŒØ§Ù† Ø¹Ø§Ø¯ÛŒ</option>
          </select>
        </div>
      </section>

      {/* Users Table */}
      <section className="a-card a-card--flush">
        {users.isLoading ? (
          <div className="a-empty">Ø¯Ø± Ø­Ø§Ù„ Ø¯Ø±ÛŒØ§ÙØª Ù„ÛŒØ³Øª Ú©Ø§Ø±Ø¨Ø±Ø§Ù†...</div>
        ) : items.length === 0 ? (
          <div className="a-empty">Ù‡ÛŒÚ† Ú©Ø§Ø±Ø¨Ø±ÛŒ ÛŒØ§ÙØª Ù†Ø´Ø¯.</div>
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Ú©Ø§Ø±Ø¨Ø±</th>
                  <th>Ø´Ù…Ø§Ø±Ù‡ Ù‡Ù…Ø±Ø§Ù‡</th>
                  <th>Ú©Ø¯ Ù…Ù„ÛŒ</th>
                  <th>Ù†Ù‚Ø´ Ú©Ø§Ø±Ø¨Ø±</th>
                  <th>ÙˆØ¶Ø¹ÛŒØª Ø­Ø³Ø§Ø¨</th>
                  <th>Ø¹Ù…Ù„ÛŒØ§Øª Ùˆ Ø³Ø·Ø­ Ø¯Ø³ØªØ±Ø³ÛŒ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} className="order-row">
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-xs font-extrabold text-slate-950">
                          {u.name?.[0] || 'Ú©'}
                        </span>
                        <div>
                          <div className="font-bold text-white">
                            {u.name} {u.lastName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Ø«Ø¨Øª Ù†Ø§Ù…: {new Date(u.createdAt).toLocaleDateString('fa-IR')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-slate-300" dir="ltr">
                      {u.phone}
                    </td>
                    <td>
                      {u.nationalCode ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-slate-200" dir="ltr">
                            {u.nationalCode}
                          </span>
                          {u.isVerifiedIdentity ? (
                            <span className="chip chip-brand !py-0.5 !px-1.5">ØªØ§ÛŒÛŒØ¯ Ø´Ø¯Ù‡</span>
                          ) : (
                            <button
                              type="button"
                              className="a-btn a-btn--info a-btn--xs"
                              onClick={() => patch.mutate({ id: u.id, body: { isVerifiedIdentity: true } })}
                            >
                              ØªØ§ÛŒÛŒØ¯ Ú©Ø¯ Ù…Ù„ÛŒ
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Ø«Ø¨Øª Ù†Ø´Ø¯Ù‡</span>
                      )}
                    </td>
                    <td>
                      <span className={`chip ${u.role === 'admin' ? 'chip-amber' : 'chip-slate'}`}>
                        {u.role === 'admin' ? 'Ù…Ø¯ÛŒØ± Ø³ÛŒØ³ØªÙ…' : 'Ù…Ø´ØªØ±ÛŒ Ø¹Ø§Ø¯ÛŒ'}
                      </span>
                    </td>
                    <td>
                      <span className={`chip ${u.isActive ? 'chip-brand' : 'chip-rose'}`}>
                        {u.isActive ? 'ÙØ¹Ø§Ù„' : 'Ù…Ø³Ø¯ÙˆØ¯'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {u.role === 'admin' ? (
                          <button
                            type="button"
                            className="a-btn a-btn--secondary a-btn--xs"
                            onClick={() => patch.mutate({ id: u.id, body: { role: 'customer' } })}
                          >
                            ØªÙ†Ø²Ù„ Ø¨Ù‡ Ù…Ø´ØªØ±ÛŒ
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="a-btn a-btn--primary a-btn--xs"
                            onClick={() => patch.mutate({ id: u.id, body: { role: 'admin' } })}
                          >
                            Ø§Ø±ØªÙ‚Ø§ Ø¨Ù‡ Ù…Ø¯ÛŒØ±
                          </button>
                        )}

                        <button
                          type="button"
                          className={`a-btn a-btn--xs ${u.isActive ? 'a-btn--danger' : 'a-btn--secondary'}`}
                          onClick={() => patch.mutate({ id: u.id, body: { isActive: !u.isActive } })}
                        >
                          {u.isActive ? 'Ù…Ø³Ø¯ÙˆØ¯Ø³Ø§Ø²ÛŒ' : 'ÙØ¹Ø§Ù„â€ŒØ³Ø§Ø²ÛŒ'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pagination */}
      {pageCount > 1 && (
        <section className="a-card a-pager">
          <button type="button" className="a-btn a-btn--secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ØµÙØ­Ù‡ Ù‚Ø¨Ù„ÛŒ
          </button>
          <span className="a-pager-info">
            ØµÙØ­Ù‡ {formatNumber(page)} Ø§Ø² {formatNumber(pageCount)}
          </span>
          <button type="button" className="a-btn a-btn--secondary" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
            ØµÙØ­Ù‡ Ø¨Ø¹Ø¯ÛŒ
          </button>
        </section>
      )}
    </div>
  );
}