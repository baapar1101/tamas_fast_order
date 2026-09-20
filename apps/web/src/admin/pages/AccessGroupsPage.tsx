import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';

interface AccessGroup {
  id: number;
  name: string;
  permissions: string[];
}

const AVAILABLE_PERMISSIONS = [
  { key: 'manage_orders', label: 'مدیریت سفارشات' },
  { key: 'manage_products', label: 'مدیریت محصولات' },
  { key: 'manage_users', label: 'مدیریت کاربران' },
  { key: 'manage_content', label: 'مدیریت محتوا' },
  { key: 'manage_settings', label: 'تنظیمات' },
];

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

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; permissions: string[] }) => {
      if (isEditing) {
        return api.put(`/admin/access-groups/${isEditing.id}`, data);
      }
      return api.post('/admin/access-groups', data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'access-groups'] });
      toast.ok('گروه دسترسی با موفقیت ذخیره شد.');
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err.message || 'خطا در ذخیره گروه.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.del(`/admin/access-groups/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'access-groups'] });
      toast.ok('گروه حذف شد.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'خطا در حذف گروه.');
    },
  });

  const handleEdit = (group: AccessGroup) => {
    setIsEditing(group);
    setName(group.name);
    setPermissions(group.permissions);
  };

  const handleCreate = () => {
    setIsCreating(true);
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
    if (permissions.includes(key)) {
      setPermissions(permissions.filter(p => p !== key));
    } else {
      setPermissions([...permissions, key]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">گروه‌های دسترسی</h2>
          <p className="mt-1 text-sm text-slate-400">مدیریت سطوح دسترسی اپراتورهای پنل مدیریت</p>
        </div>
        <button className="huma-btn-primary" onClick={handleCreate}>
          + افزودن گروه جدید
        </button>
      </div>

      <div className="glass-card overflow-hidden p-0">
        <table className="huma-table">
          <thead>
            <tr>
              <th className="w-16">آیدی</th>
              <th>نام گروه</th>
              <th>دسترسی‌ها</th>
              <th className="w-32">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {groups.data?.map(g => (
              <tr key={g.id}>
                <td>{g.id}</td>
                <td className="font-bold text-white">{g.name}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {g.permissions.map(p => {
                      const label = AVAILABLE_PERMISSIONS.find(ap => ap.key === p)?.label || p;
                      return (
                        <span key={p} className="chip chip-surface text-[10px]">
                          {label}
                        </span>
                      );
                    })}
                    {g.permissions.length === 0 && <span className="text-slate-500 text-xs">بدون دسترسی</span>}
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <button className="icon-btn" onClick={() => handleEdit(g)}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button className="icon-btn text-rose-400 hover:bg-rose-400/10 hover:text-rose-300" onClick={() => {
                      if (window.confirm('آیا از حذف این گروه اطمینان دارید؟')) deleteMutation.mutate(g.id);
                    }}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {groups.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-slate-400">هیچ گروهی یافت نشد.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(isEditing || isCreating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass-card w-full max-w-md">
            <h3 className="mb-4 text-lg font-bold text-white">
              {isEditing ? 'ویرایش گروه دسترسی' : 'گروه دسترسی جدید'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">نام گروه</label>
                <input
                  autoFocus
                  type="text"
                  className="huma-input w-full"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="مثال: مدیران فروش"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">سطوح دسترسی</label>
                <div className="space-y-2">
                  {AVAILABLE_PERMISSIONS.map(ap => (
                    <label key={ap.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions.includes(ap.key)}
                        onChange={() => togglePermission(ap.key)}
                        className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                      />
                      <span className="text-sm text-slate-300">{ap.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button type="button" className="huma-btn-surface" onClick={handleClose}>
                  انصراف
                </button>
                <button type="submit" className="huma-btn-primary" disabled={saveMutation.isPending}>
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
