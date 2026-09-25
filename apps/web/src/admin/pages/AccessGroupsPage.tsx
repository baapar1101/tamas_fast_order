import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatNumber } from '@tamas/shared';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';

interface AccessGroup {
  id: number;
  name: string;
  permissions: string[];
  memberCount: number;
}

const AVAILABLE_PERMISSIONS = [
  { key: 'manage_orders', label: 'مدیریت سفارشات', desc: 'سفارش‌ها، تغییر وضعیت و امور مالی' },
  { key: 'manage_products', label: 'مدیریت محصولات', desc: 'محصولات، ویژگی‌ها، برندها و انبارها' },
  { key: 'manage_users', label: 'مدیریت کاربران', desc: 'مشتریان و سطح دسترسی آنها' },
  { key: 'manage_content', label: 'مدیریت محتوا', desc: 'دسته‌بندی‌ها، بنرها و رسانه‌ها' },
  { key: 'manage_settings', label: 'تنظیمات', desc: 'تنظیمات سیستم، پیامک‌ها و گزارش‌ها' },
];

function permissionLabel(key: string): string {
  return AVAILABLE_PERMISSIONS.find((p) => p.key === key)?.label ?? key;
}

export function AccessGroupsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [isEditing, setIsEditing] = useState<AccessGroup | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);

  const groups = useQuery({
    queryKey: ['admin', 'access-groups'],
    queryFn: async () => {
      const res = await api.get<{ groups: AccessGroup[] }>('/admin/access-groups');
      return res.groups;
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'access-groups'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  };

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; permissions: string[] }) => {
      if (isEditing) return api.put(`/admin/access-groups/${isEditing.id}`, data);
      return api.post('/admin/access-groups', data);
    },
    onSuccess: () => {
      invalidate();
      toast.ok('گروه دسترسی با موفقیت ذخیره شد.');
      handleClose();
    },
    onError: (err: Error) => toast.error(err.message || 'خطا در ذخیره گروه.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.del(`/admin/access-groups/${id}`),
    onSuccess: () => {
      invalidate();
      toast.ok('گروه حذف شد.');
    },
    onError: (err: Error) => toast.error(err.message || 'خطا در حذف گروه.'),
  });

  const handleEdit = (group: AccessGroup) => {
    setIsEditing(group);
    setIsCreating(false);
    setName(group.name);
    setPermissions(group.permissions);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setIsEditing(null);
    setName('');
    setPermissions([]);
  };

  const handleClose = () => {
    setIsEditing(null);
    setIsCreating(false);
    setName('');
    setPermissions([]);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('نام گروه الزامی است.');
    saveMutation.mutate({ name, permissions });
  };

  const togglePermission = (key: string) => {
    setPermissions((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  };

  const totalMembers = (groups.data ?? []).reduce((acc, g) => acc + g.memberCount, 0);

  return (
    <div className="a-page a-page--users a-fade">
      {/* Header */}
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">گروه‌های دسترسی</h2>
          <p className="a-subtitle">مدیریت سطوح دسترسی اپراتورهای فروشگاه؛ هر اپراتور به یک گروه متصل می‌شود</p>
        </div>
        <div className="a-page-actions">
          <span className="a-badge a-badge--brand">{formatNumber(totalMembers)} عضو کل</span>
          <button type="button" className="a-btn a-btn--primary" onClick={handleCreate}>
            + افزودن گروه جدید
          </button>
        </div>
      </section>

      {/* List */}
      <section className="a-card a-card--flush">
        {groups.isLoading ? (
          <div className="a-empty">در حال دریافت گروه‌ها...</div>
        ) : (groups.data ?? []).length === 0 ? (
          <div className="a-empty">هنوز گروهی ساخته نشده است. با «افزودن گروه جدید» شروع کنید.</div>
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>نام گروه</th>
                  <th>اعضا</th>
                  <th>دسترسی‌ها</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {groups.data?.map((g) => (
                  <tr key={g.id} className="order-row">
                    <td>
                      <div className="font-bold text-white">{g.name}</div>
                      <div className="text-[11px] text-slate-500" dir="ltr">
                        #{g.id}
                      </div>
                    </td>
                    <td>
                      <span className={`chip ${g.memberCount > 0 ? 'chip-brand' : 'chip-slate'}`}>
                        {formatNumber(g.memberCount)} نفر
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {g.permissions.map((p) => (
                          <span key={p} className="chip chip-surface text-[10px]">
                            {permissionLabel(p)}
                          </span>
                        ))}
                        {g.permissions.length === 0 && <span className="text-xs text-slate-500">بدون دسترسی</span>}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button type="button" className="a-btn a-btn--secondary a-btn--xs" onClick={() => handleEdit(g)}>
                          ویرایش
                        </button>
                        <button
                          type="button"
                          className="a-btn a-btn--danger a-btn--xs"
                          disabled={g.memberCount > 0}
                          title={g.memberCount > 0 ? 'ابتدا اعضای این گروه را جابه‌جا کنید' : 'حذف گروه'}
                          onClick={() => {
                            if (window.confirm(`آیا از حذف گروه «${g.name}» اطمینان دارید؟`)) deleteMutation.mutate(g.id);
                          }}
                        >
                          حذف
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

      {/* Modal */}
      {(isEditing || isCreating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto">
          <div className="a-card w-full max-w-xl">
            <div className="a-card-head">
              <h3 className="a-card-title">{isEditing ? 'ویرایش گروه دسترسی' : 'گروه دسترسی جدید'}</h3>
            </div>
            <form onSubmit={handleSave} className="a-form-grid">
              <div className="a-field a-span-2">
                <label className="a-label" htmlFor="group-name">نام گروه</label>
                <input
                  id="group-name"
                  autoFocus
                  type="text"
                  className="a-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: مدیران فروش"
                  required
                />
                <span className="a-hint">
                  اپراتورها از این نام در بخش «تغییر نقش» صفحه مشتریان قابل انتخاب هستند.
                </span>
              </div>

              <div className="a-field a-span-2">
                <span className="a-label">سطوح دسترسی</span>
                <div className="a-option-grid">
                  {AVAILABLE_PERMISSIONS.map((ap) => {
                    const checked = permissions.includes(ap.key);
                    return (
                      <label
                        key={ap.key}
                        className={`a-chip-opt ${checked ? 'a-chip-opt--on' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(ap.key)}
                        />
                        <span className="a-chip-opt-copy">
                          <strong>{ap.label}</strong>
                          <small>{ap.desc}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="a-actions a-actions--end a-span-2">
                <button type="button" className="a-btn a-btn--secondary" onClick={handleClose}>
                  انصراف
                </button>
                <button type="submit" className="a-btn a-btn--primary" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'در حال ذخیره...' : 'ذخیره گروه'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}