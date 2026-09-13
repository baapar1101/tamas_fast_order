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
    <div className="space-y-6">
      {/* Page Header */}
      <section className="flex flex-wrap items-center justify-between gap-4 animate-fade-up">
        <div>
          <h2 className="text-xl font-extrabold text-white sm:text-2xl">مدیریت کاربران</h2>
          <p className="mt-1 text-xs text-slate-400">مشاهده، بررسی احراز هویت و مدیریت دسترسی‌های کاربران</p>
        </div>
        <div className="chip chip-brand">{formatNumber(total)} کاربر کل</div>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>کل کاربران</span>
            <span className="chip chip-brand">{formatNumber(total)}</span>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-white">{formatNumber(total)}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>مدیران سیستم</span>
            <span className="chip chip-amber">{formatNumber(adminUsersCount)}</span>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-amber-400">{formatNumber(adminUsersCount)}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>کد ملی تایید شده</span>
            <span className="chip chip-aqua">{formatNumber(verifiedIdCount)}</span>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-cyan-400">{formatNumber(verifiedIdCount)}</p>
        </div>
      </section>

      {/* Filters Bar */}
      <section className="glass-card p-4 flex flex-wrap items-center gap-3">
        <input
          className="huma-input flex-1 min-w-[200px]"
          placeholder="جستجو در نام، شماره همراه، کد ملی..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="huma-input !w-auto"
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
      </section>

      {/* Glass Users Table */}
      <section className="glass-card overflow-hidden">
        {users.isLoading ? (
          <div className="p-12 text-center text-slate-400">در حال دریافت لیست کاربران...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-500">هیچ کاربری یافت نشد.</div>
        ) : (
          <div className="huma-table-container">
            <table className="huma-table">
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
                              className="text-[10px] text-amber-400 underline hover:text-white"
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
                            className="huma-btn-secondary !py-1 !px-2.5 !text-xs"
                            onClick={() => patch.mutate({ id: u.id, body: { role: 'customer' } })}
                          >
                            تنزل به مشتری
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="huma-btn-primary !py-1 !px-2.5 !text-xs"
                            onClick={() => patch.mutate({ id: u.id, body: { role: 'admin' } })}
                          >
                            ارتقا به مدیر
                          </button>
                        )}

                        <button
                          type="button"
                          className={`huma-btn-secondary !py-1 !px-2.5 !text-xs ${
                            u.isActive ? '!bg-rose-500/15 !text-rose-300' : ''
                          }`}
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
        <section className="flex items-center justify-between glass-card p-4">
          <button type="button" className="huma-btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            صفحه قبلی
          </button>
          <span className="text-xs text-slate-400 font-semibold">
            صفحه {formatNumber(page)} از {formatNumber(pageCount)}
          </span>
          <button type="button" className="huma-btn-secondary" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
            صفحه بعدی
          </button>
        </section>
      )}
    </div>
  );
}
