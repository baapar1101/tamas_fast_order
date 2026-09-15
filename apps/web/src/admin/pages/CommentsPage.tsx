import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { CommentDTO, Paged } from '@tamas/shared';

export function CommentsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'comments', page],
    queryFn: () => api.get<Paged<CommentDTO>>('/admin/comments', { page }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">نظرات و فرم‌ها</h1>
          <p className="text-sm text-slate-400">مدیریت نظرات محصولات و درخواست‌ها</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table w-full text-right text-sm">
            <thead className="bg-[#131c2e]/60 text-xs text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">نویسنده</th>
                <th className="px-4 py-3 font-medium">محصول</th>
                <th className="px-4 py-3 font-medium">امتیاز</th>
                <th className="px-4 py-3 font-medium">متن نظر</th>
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
                    نظری یافت نشد.
                  </td>
                </tr>
              ) : (
                data?.items.map((comment) => (
                  <tr key={comment.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white">{comment.guestName || `کاربر #${comment.userId}`}</td>
                    <td className="px-4 py-3 text-slate-300">محصول #{comment.productId}</td>
                    <td className="px-4 py-3 text-amber-400">{Array(comment.rating).fill('★').join('')}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">{comment.content}</td>
                    <td className="px-4 py-3">
                      <span className={`chip ${comment.status === 'approved' ? 'chip-success' : comment.status === 'rejected' ? 'chip-danger' : 'chip-warning'}`}>
                        {comment.status === 'approved' ? 'تایید شده' : comment.status === 'rejected' ? 'رد شده' : 'در انتظار'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs" dir="ltr">
                      {new Date(comment.createdAt).toLocaleString('fa-IR')}
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
