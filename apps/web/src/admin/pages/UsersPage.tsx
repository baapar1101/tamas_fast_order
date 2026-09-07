import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { useDebounced } from '../../storefront/hooks';

interface UsersResponse {
  items: UserDTO[];
  total: number;
}

export function UsersPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const me = useAuth((s) => s.user);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'pending'>('all');
  const [role, setRole] = useState<'all' | 'customer' | 'admin'>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detail, setDetail] = useState<UserDTO | null>(null);

  const debounced = useDebounced(search);
  const query = useMemo(() => ({ q: debounced, status, role, page, perPage: 40 }), [debounced, status, role, page]);

  const users = useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: () => api.get<UsersResponse>('/admin/users', query),
    placeholderData: (prev) => prev,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'counters'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
  };

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<UserDTO> }) => api.patch<{ user: UserDTO }>(`/admin/users/${id}`, body),
    onSuccess: (res) => {
      toast.ok('کاربر به‌روزرسانی شد.');
      setDetail(res.user);
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulk = useMutation({
    mutationFn: (body: { ids: number[]; action: 'activate' | 'deactivate' }) =>
      api.post<{ changed: number }>('/admin/users/bulk', body),
    onSuccess: (res) => {
      toast.ok(`${formatNumber(res.changed)} کاربر به‌روزرسانی شد.`);
      setSelected(new Set());
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = users.data?.items ?? [];
  const total = users.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 40));

  return (
    <>
      <div className="admin-head">
        <h1>کاربران</h1>
        <span className="badge">{formatNumber(total)} مورد</span>
        <span className="spacer" />
        <button
          type="button"
          className="btn"
          onClick={() => void api.download('/admin/users/export', {}, `users-${Date.now()}.csv`).catch((e: Error) => toast.error(e.message))}
        >
          خروجی CSV
        </button>
      </div>

      <div className="filters-bar">
        <input
          className="input grow"
          placeholder="جستجو در نام، فروشگاه، موبایل…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select className="select" style={{ width: 'auto' }} value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}>
          <option value="all">همه</option>
          <option value="active">تاییدشده</option>
          <option value="pending">در انتظار تایید</option>
        </select>
        <select className="select" style={{ width: 'auto' }} value={role} onChange={(e) => { setRole(e.target.value as typeof role); setPage(1); }}>
          <option value="all">همه نقش‌ها</option>
          <option value="customer">مشتری</option>
          <option value="admin">مدیر</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <b>{formatNumber(selected.size)} کاربر انتخاب شده</b>
          <button type="button" className="btn sm" onClick={() => bulk.mutate({ ids: [...selected], action: 'activate' })}>تایید</button>
          <button type="button" className="btn sm" onClick={() => bulk.mutate({ ids: [...selected], action: 'deactivate' })}>لغو تایید</button>
          <span className="spacer" />
          <button type="button" className="btn ghost sm" onClick={() => setSelected(new Set())}>لغو انتخاب</button>
        </div>
      )}

      {users.isLoading ? (
        <div className="skeleton" style={{ height: 340 }} />
      ) : items.length === 0 ? (
        <div className="card empty">کاربری پیدا نشد.</div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 34 }}>
                  <input
                    type="checkbox"
                    checked={items.length > 0 && items.every((u) => selected.has(u.id))}
                    onChange={(e) => {
                      const next = new Set(selected);
                      for (const u of items) {
                        if (e.target.checked) next.add(u.id);
                        else next.delete(u.id);
                      }
                      setSelected(next);
                    }}
                    aria-label="انتخاب همه"
                  />
                </th>
                <th>موبایل</th>
                <th>نام</th>
                <th>فروشگاه</th>
                <th>شهر / آدرس</th>
                <th>وضعیت</th>
                <th>نقش</th>
                <th>عضویت</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => {
                        const next = new Set(selected);
                        if (next.has(u.id)) next.delete(u.id);
                        else next.add(u.id);
                        setSelected(next);
                      }}
                      aria-label={u.phone}
                    />
                  </td>
                  <td className="ltr">{u.phone}</td>
                  <td>{`${u.name} ${u.lastName}`.trim() || '—'}</td>
                  <td>{u.storeName || '—'}</td>
                  <td className="wrap" style={{ maxWidth: 260 }}>{u.address || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className={`badge ${u.isActive ? 'success' : 'warn'}`}
                      style={{ cursor: 'pointer', border: 'none' }}
                      onClick={() => patch.mutate({ id: u.id, body: { isActive: !u.isActive } })}
                      disabled={u.id === me?.id}
                      title={u.id === me?.id ? 'نمی‌توانید وضعیت خودتان را تغییر دهید' : 'تغییر وضعیت'}
                    >
                      {u.isActive ? 'تاییدشده' : 'در انتظار'}
                    </button>
                  </td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'brand' : ''}`}>{u.role === 'admin' ? 'مدیر' : 'مشتری'}</span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString('fa-IR')}</td>
                  <td>
                    <button type="button" className="btn sm" onClick={() => setDetail(u)}>جزئیات</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="pager">
          <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>قبلی</button>
          <span className="muted">صفحه {formatNumber(page)} از {formatNumber(pageCount)}</span>
          <button type="button" className="btn" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>بعدی</button>
        </div>
      )}

      <Modal open={detail !== null} title={detail ? `کاربر ${detail.phone}` : ''} onClose={() => setDetail(null)}>
        {detail && (
          <div className="stack">
            <div className="card" style={{ padding: 14 }}>
              <div className="stack" style={{ gap: 6, fontSize: 13 }}>
                {[
                  ['نام', `${detail.name} ${detail.lastName}`.trim() || '—'],
                  ['فروشگاه', detail.storeName || '—'],
                  ['تلفن ثابت', detail.landline || '—'],
                  ['کد پستی', detail.postalCode || '—'],
                  ['آدرس', detail.address || '—'],
                ].map(([label, value]) => (
                  <div className="row" key={label}>
                    <span className="muted">{label}</span>
                    <span className="spacer" />
                    <b style={{ textAlign: 'left', maxWidth: '65%' }}>{value}</b>
                  </div>
                ))}
              </div>
            </div>

            {detail.certificateFileUrl && (
              <a className="btn block" href={detail.certificateFileUrl} target="_blank" rel="noreferrer">
                مشاهده جواز کسب
              </a>
            )}

            <div className="row">
              <button
                type="button"
                className={`btn ${detail.isActive ? '' : 'primary'} block`}
                disabled={detail.id === me?.id || patch.isPending}
                onClick={() => patch.mutate({ id: detail.id, body: { isActive: !detail.isActive } })}
              >
                {detail.isActive ? 'لغو تایید فروشگاه' : 'تایید فروشگاه'}
              </button>
            </div>

            <div className="field">
              <label htmlFor="u-role">نقش</label>
              <select
                id="u-role"
                className="select"
                value={detail.role}
                disabled={detail.id === me?.id}
                onChange={(e) => patch.mutate({ id: detail.id, body: { role: e.target.value as 'customer' | 'admin' } })}
              >
                <option value="customer">مشتری</option>
                <option value="admin">مدیر (دسترسی کامل به پنل)</option>
              </select>
              {detail.id === me?.id && (
                <span className="faint" style={{ fontSize: 11 }}>نمی‌توانید دسترسی مدیریت خودتان را بردارید.</span>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
