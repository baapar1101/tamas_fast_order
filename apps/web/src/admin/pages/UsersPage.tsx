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
      toast.ok('اطلاعات کاربر به‌روزرسانی شد.');
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
    <div className="a-page a-fade">
      {/* Page Header */}
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">مدیریت کاربران</h2>
          <p className="a-subtitle">مشاهده، بررسی احراز هویت و مدیریت دسترسی‌های کاربران</p>
        </div>
        <div className="a-page-actions">
          <span className="a-badge a-badge--brand">{formatNumber(total)} کاربر کل</span>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="a-stat">
          <div className="a-stat-head">
            <span className="a-stat-label">کل کاربران</span>
            <span className="a-badge a-badge--brand">{formatNumber(total)}</span>
          </div>
          <p className="a-stat-value">{formatNumber(total)}</p>
        </div>
        <div className="a-stat">
          <div className="a-stat-head">
            <span className="a-stat-label">مدیران سیستم</span>
            <span className="a-badge a-badge--amber">{formatNumber(adminUsersCount)}</span>
          </div>
          <p className="a-stat-value a-stat-value--amber">{formatNumber(adminUsersCount)}</p>
        </div>
        <div className="a-stat">
          <div className="a-stat-head">
            <span className="a-stat-label">کد ملی تایید شده</span>
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
            placeholder="جستجو در نام، شماره همراه، کد ملی..."
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
            <option value="all">همه نقش‌ها</option>
            <option value="admin">مدیران (Admin)</option>
            <option value="customer">مشتریان عادی</option>
          </select>
        </div>
      </section>

      {/* Users Table */}
      <section className="a-card a-card--flush">
        {users.isLoading ? (
          <div className="a-empty">در حال دریافت لیست کاربران...</div>
        ) : items.length === 0 ? (
          <div className="a-empty">هیچ کاربری یافت نشد.</div>
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>کاربر</th>
                  <th>شماره همراه</th>
                  <th>کد ملی</th>
                  <th>نقش کاربر</th>
                  <th>وضعیت حساب</th>
                  <th>عملیات و سطح دسترسی</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} className="order-row">
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-xs font-extrabold text-slate-950">
                          {u.name?.[0] || 'ک'}
                        </span>
                        <div>
                          <div className="font-bold text-white">
                            {u.name} {u.lastName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            ثبت نام: {new Date(u.createdAt).toLocaleDateString('fa-IR')}
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
                            <span className="chip chip-brand !py-0.5 !px-1.5">تایید شده</span>
                          ) : (
                            <button
                              type="button"
                              className="a-btn a-btn--info a-btn--xs"
                              onClick={() => patch.mutate({ id: u.id, body: { isVerifiedIdentity: true } })}
                            >
                              تایید کد ملی
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">ثبت نشده</span>
                      )}
                    </td>
                    <td>
                      <span className={`chip ${u.role === 'admin' ? 'chip-amber' : 'chip-slate'}`}>
                        {u.role === 'admin' ? 'مدیر سیستم' : 'مشتری عادی'}
                      </span>
                    </td>
                    <td>
                      <span className={`chip ${u.isActive ? 'chip-brand' : 'chip-rose'}`}>
                        {u.isActive ? 'فعال' : 'مسدود'}
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
                            تنزل به مشتری
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="a-btn a-btn--primary a-btn--xs"
                            onClick={() => patch.mutate({ id: u.id, body: { role: 'admin' } })}
                          >
                            ارتقا به مدیر
                          </button>
                        )}

                        <button
                          type="button"
                          className={`a-btn a-btn--xs ${u.isActive ? 'a-btn--danger' : 'a-btn--secondary'}`}
                          onClick={() => patch.mutate({ id: u.id, body: { isActive: !u.isActive } })}
                        >
                          {u.isActive ? 'مسدودسازی' : 'فعال‌سازی'}
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
            صفحه قبلی
          </button>
          <span className="a-pager-info">
            صفحه {formatNumber(page)} از {formatNumber(pageCount)}
          </span>
          <button type="button" className="a-btn a-btn--secondary" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
            صفحه بعدی
          </button>
        </section>
      )}
    </div>
  );
}