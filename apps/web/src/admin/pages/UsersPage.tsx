import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { useDebounced } from '../../storefront/hooks';
import { AnimatedDropdown } from '../components/AnimatedDropdown';

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
  const [role, setRole] = useState<'all' | 'admin' | 'operator' | 'customer'>('all');
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<UserDTO | null>(null);
  const [editRole, setEditRole] = useState<UserDTO['role']>('customer');
  const [editAccessGroupId, setEditAccessGroupId] = useState<number | null>(null);

  const debounced = useDebounced(search);
  const query = useMemo(() => ({ q: debounced, role, page, perPage: 30 }), [debounced, role, page]);

  const accessGroups = useQuery({
    queryKey: ['admin', 'access-groups'],
    queryFn: async () => {
      const res = await api.get<{ groups: { id: number; name: string }[] }>('/admin/access-groups');
      return res.groups;
    },
  });

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
      setEditingUser(null);
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

      {/* Search + Filters */}
      <section className="a-searchbar">
        <div className="a-filterbar a-filterbar--stack">
          <input
            className="a-input"
            placeholder="جستجو در نام، شماره همراه، کد ملی..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <div className="a-filterbar">
            <span className="a-label">نقش کاربر</span>
            <AnimatedDropdown
              buttonClassName="a-select--auto"
              value={role}
              onChange={(val) => {
                setRole(val as typeof role);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'همه نقش‌ها' },
                { value: 'admin', label: 'مدیر ارشد (Admin)' },
                { value: 'operator', label: 'اپراتور (Operator)' },
                { value: 'customer', label: 'مشتریان عادی' }
              ]}
            />
          </div>
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
                  <th>
                    <div>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                      <span>کاربر</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.896-1.596-5.265-3.965-6.861-6.86l1.294-.97c.363-.271.527-.734.418-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" /></svg>
                      <span>شماره همراه</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" /></svg>
                      <span>کد ملی</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" /></svg>
                      <span>نقش کاربر</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                      <span>وضعیت حساب</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                      <span>عملیات</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} className="order-row">
                    <td>
                      <div className="flex items-center justify-center gap-3" dir="rtl">
                        <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-700 text-sm font-bold text-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                          {u.name?.[0] || 'ک'}
                        </span>
                        <div className="text-right">
                          <div className="font-semibold text-[var(--a-t1)] text-sm">
                            {u.name} {u.lastName}
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
                      <div className="flex justify-center">
                        <span className={`chip ${u.role === 'admin' ? 'chip-amber flex gap-1 items-center' : u.role === 'operator' ? 'chip-brand' : 'chip-slate'}`}>
                          {u.role === 'admin' && <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20"><path d="M5.23 7.21a1.25 1.25 0 0 1 1.06.59L10 13.91l3.71-6.11a1.25 1.25 0 0 1 2.12 1.3l-4.78 7.87a1.25 1.25 0 0 1-2.1 0L4.17 9.1a1.25 1.25 0 0 1 1.06-1.89Z" /><path d="M10 2.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z" /><path d="M2.5 6.25a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z" /><path d="M17.5 6.25a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z" /></svg>}
                          {u.role === 'admin' ? 'مدیر ارشد' : u.role === 'operator' ? 'اپراتور' : 'مشتری عادی'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex justify-center">
                        <span className={`chip ${u.isActive ? 'chip-emerald flex gap-1.5 items-center' : 'chip-rose flex gap-1.5 items-center'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${u.isActive ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                          {u.isActive ? 'فعال' : 'مسدود'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          className="a-btn a-btn--secondary a-btn--xs rounded-full border-[1.5px] bg-transparent hover:bg-white/5"
                          onClick={() => {
                            setEditingUser(u);
                            setEditRole(u.role);
                            setEditAccessGroupId(u.accessGroupId || null);
                          }}
                        >
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z" /></svg>
                          تغییر نقش
                        </button>

                        <button
                          type="button"
                          className={`a-btn a-btn--xs rounded-full border-[1.5px] bg-transparent hover:bg-white/5 ${u.isActive ? 'a-btn--danger border-rose-500/50 text-rose-500 hover:border-rose-500' : 'a-btn--secondary border-emerald-500/50 text-emerald-500 hover:border-emerald-500'}`}
                          onClick={() => patch.mutate({ id: u.id, body: { isActive: !u.isActive } })}
                        >
                          {u.isActive ? <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg> : <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
                          {u.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
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

      {/* Edit Role Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="a-card w-full max-w-sm">
            <div className="a-card-head">
              <h3 className="a-card-title">تغییر نقش کاربر</h3>
            </div>
            <p className="a-hint">
              کاربر: <span className="font-bold">{editingUser.name} {editingUser.lastName}</span>
            </p>
            <div className="a-form-grid">
              <div className="a-field">
                <label className="a-label" htmlFor="edit-role">نقش کاربر</label>
                <AnimatedDropdown
                  id="edit-role"
                  value={editRole}
                  onChange={(val) => setEditRole(val as UserDTO['role'])}
                  options={[
                    { value: 'customer', label: 'مشتری عادی' },
                    { value: 'operator', label: 'اپراتور' },
                    { value: 'admin', label: 'مدیر ارشد' }
                  ]}
                />
              </div>

              {editRole === 'operator' && (
                <div className="a-field">
                  <label className="a-label" htmlFor="edit-access-group">گروه دسترسی</label>
                  <AnimatedDropdown
                    id="edit-access-group"
                    value={editAccessGroupId ? String(editAccessGroupId) : ''}
                    onChange={(val) => setEditAccessGroupId(val ? Number(val) : null)}
                    placeholder="-- انتخاب گروه --"
                    options={[
                      { value: '', label: '-- انتخاب گروه --' },
                      ...(accessGroups.data?.map(g => ({ value: String(g.id), label: g.name })) || [])
                    ]}
                  />
                </div>
              )}
            </div>

            <div className="a-actions a-actions--end">
              <button type="button" className="a-btn a-btn--secondary" onClick={() => setEditingUser(null)}>
                انصراف
              </button>
              <button
                type="button"
                className="a-btn a-btn--primary"
                disabled={patch.isPending || (editRole === 'operator' && !editAccessGroupId)}
                onClick={() => {
                  patch.mutate({
                    id: editingUser.id,
                    body: {
                      role: editRole,
                      accessGroupId: editRole === 'operator' ? editAccessGroupId : null,
                    },
                  });
                }}
              >
                {patch.isPending ? 'در حال ذخیره...' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}