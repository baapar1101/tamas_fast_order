import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import type { CommentDTO, Paged } from '@tamas/shared';

export function CommentsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'comments', page],
    queryFn: () => api.get<Paged<CommentDTO>>('/admin/comments', { page }),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'rejected' }) =>
      api.patch(`/admin/comments/${id}`, { status }),
    onSuccess: () => {
      toast.ok('وضعیت نظر تغییر کرد.');
      void qc.invalidateQueries({ queryKey: ['admin', 'comments'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 animate-fade-up">
        <div>
          <h1 className="text-xl font-extrabold text-white sm:text-2xl">نظرات و فرم‌ها</h1>
          <p className="mt-1 text-xs text-slate-400">مدیریت نظرات محصولات و درخواست‌های پشتیبانی</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="huma-table-container">
          <table className="huma-table">
            <thead>
              <tr>
                <th>نویسنده</th>
                <th>محصول</th>
                <th>امتیاز</th>
                <th>متن نظر</th>
                <th>وضعیت</th>
                <th>تاریخ</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    در حال دریافت اطلاعات...
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    هیچ نظری یافت نشد.
                  </td>
                </tr>
              ) : (
                data?.items.map((comment) => (
                  <tr key={comment.id}>
                    <td className="font-bold text-white">{comment.guestName || `کاربر #${comment.userId}`}</td>
                    <td className="font-mono text-slate-300">#{comment.productId}</td>
                    <td className="text-amber-400 text-lg tracking-widest">{Array(comment.rating).fill('★').join('')}</td>
                    <td className="text-slate-400 text-xs max-w-xs truncate" title={comment.content}>{comment.content}</td>
                    <td>
                      <span className={`chip ${comment.status === 'approved' ? 'chip-brand' : comment.status === 'rejected' ? 'chip-rose' : 'chip-amber'}`}>
                        {comment.status === 'approved' ? 'تایید شده' : comment.status === 'rejected' ? 'رد شده' : 'در انتظار بررسی'}
                      </span>
                    </td>
                    <td className="text-xs text-slate-400">
                      {new Date(comment.createdAt).toLocaleDateString('fa-IR')}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {comment.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => changeStatus.mutate({ id: comment.id, status: 'approved' })}
                            className="huma-btn-secondary !py-1 !px-2.5 !text-xs !text-emerald-400 !border-emerald-500/30 !bg-emerald-500/15"
                            disabled={changeStatus.isPending}
                          >
                            تایید
                          </button>
                        )}
                        {comment.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => changeStatus.mutate({ id: comment.id, status: 'rejected' })}
                            className="huma-btn-secondary !py-1 !px-2.5 !text-xs !bg-rose-500/15 !text-rose-300 !border-rose-500/30"
                            disabled={changeStatus.isPending}
                          >
                            رد
                          </button>
                        )}
                      </div>
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
