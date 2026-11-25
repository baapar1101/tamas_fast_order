import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import type { CommentDTO, Paged } from '@tamas/shared';
import { TableState } from '../components/AdminState';
import './comments-page.css';

export function CommentsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const comments = useQuery({
    queryKey: ['admin', 'comments', page],
    queryFn: () => api.get<Paged<CommentDTO>>('/admin/comments', { page }),
  });
  const { data, isLoading } = comments;

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
    <div className="a-page a-page--comments a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">نظرات و فرم‌ها</h2>
          <p className="a-subtitle">مدیریت نظرات محصولات و درخواست‌های پشتیبانی</p>
        </div>
      </section>

      <section className="a-card a-card--flush">
        <div className="a-table-wrap">
          <table className="a-table">
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
                <TableState colSpan={7} kind="loading" />
              ) : comments.isError ? (
                <TableState colSpan={7} kind="error" error={comments.error} onRetry={() => void comments.refetch()} />
              ) : data?.items.length === 0 ? (
                <TableState colSpan={7} kind="empty" noun="نظر" />
              ) : (
                data?.items.map((comment) => (
                  <tr key={comment.id}>
                    <td className="a-strong">{comment.guestName || `کاربر #${comment.userId}`}</td>
                    <td className="a-ltr">#{comment.productId}</td>
                    <td>
                      <span className="comments-stars" role="img" aria-label={`امتیاز ${comment.rating.toLocaleString('fa-IR')} از ۵`}>
                        {Array(comment.rating).fill('★').join('')}
                      </span>
                    </td>
                    <td className="max-w-xs truncate" title={comment.content}>{comment.content}</td>
                    <td>
                      <span className={`chip ${comment.status === 'approved' ? 'chip-brand' : comment.status === 'rejected' ? 'chip-rose' : 'chip-amber'}`}>
                        {comment.status === 'approved' ? 'تأییدشده' : comment.status === 'rejected' ? 'رد شده' : 'در انتظار بررسی'}
                      </span>
                    </td>
                    <td className="a-hint">
                      {new Date(comment.createdAt).toLocaleDateString('fa-IR')}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {comment.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => changeStatus.mutate({ id: comment.id, status: 'approved' })}
                            className="a-btn a-btn--info a-btn--xs"
                            disabled={changeStatus.isPending}
                            aria-label={`تأیید نظر ${comment.guestName || `کاربر #${comment.userId}`}`}
                          >
                            تأیید
                          </button>
                        )}
                        {comment.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => changeStatus.mutate({ id: comment.id, status: 'rejected' })}
                            className="a-btn a-btn--danger a-btn--xs"
                            disabled={changeStatus.isPending}
                            aria-label={`رد نظر ${comment.guestName || `کاربر #${comment.userId}`}`}
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
      </section>
    </div>
  );
}