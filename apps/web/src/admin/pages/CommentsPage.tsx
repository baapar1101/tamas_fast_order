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
      toast.ok('ÙˆØ¶Ø¹ÛŒØª Ù†Ø¸Ø± ØªØºÛŒÛŒØ± Ú©Ø±Ø¯.');
      void qc.invalidateQueries({ queryKey: ['admin', 'comments'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="a-page a-page--comments a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">Ù†Ø¸Ø±Ø§Øª Ùˆ ÙØ±Ù…â€ŒÙ‡Ø§</h2>
          <p className="a-subtitle">Ù…Ø¯ÛŒØ±ÛŒØª Ù†Ø¸Ø±Ø§Øª Ù…Ø­ØµÙˆÙ„Ø§Øª Ùˆ Ø¯Ø±Ø®ÙˆØ§Ø³Øªâ€ŒÙ‡Ø§ÛŒ Ù¾Ø´ØªÛŒØ¨Ø§Ù†ÛŒ</p>
        </div>
      </section>

      <section className="a-card a-card--flush">
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Ù†ÙˆÛŒØ³Ù†Ø¯Ù‡</th>
                <th>Ù…Ø­ØµÙˆÙ„</th>
                <th>Ø§Ù…ØªÛŒØ§Ø²</th>
                <th>Ù…ØªÙ† Ù†Ø¸Ø±</th>
                <th>ÙˆØ¶Ø¹ÛŒØª</th>
                <th>ØªØ§Ø±ÛŒØ®</th>
                <th>Ø¹Ù…Ù„ÛŒØ§Øª</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="a-empty">
                    Ø¯Ø± Ø­Ø§Ù„ Ø¯Ø±ÛŒØ§ÙØª Ø§Ø·Ù„Ø§Ø¹Ø§Øª...
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="a-empty">
                    Ù‡ÛŒÚ† Ù†Ø¸Ø±ÛŒ ÛŒØ§ÙØª Ù†Ø´Ø¯.
                  </td>
                </tr>
              ) : (
                data?.items.map((comment) => (
                  <tr key={comment.id}>
                    <td className="font-bold text-white">{comment.guestName || `Ú©Ø§Ø±Ø¨Ø± #${comment.userId}`}</td>
                    <td className="font-mono text-slate-300">#{comment.productId}</td>
                    <td className="text-amber-400 text-lg tracking-widest">{Array(comment.rating).fill('â˜…').join('')}</td>
                    <td className="text-slate-400 text-xs max-w-xs truncate" title={comment.content}>{comment.content}</td>
                    <td>
                      <span className={`chip ${comment.status === 'approved' ? 'chip-brand' : comment.status === 'rejected' ? 'chip-rose' : 'chip-amber'}`}>
                        {comment.status === 'approved' ? 'ØªØ§ÛŒÛŒØ¯ Ø´Ø¯Ù‡' : comment.status === 'rejected' ? 'Ø±Ø¯ Ø´Ø¯Ù‡' : 'Ø¯Ø± Ø§Ù†ØªØ¸Ø§Ø± Ø¨Ø±Ø±Ø³ÛŒ'}
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
                            className="a-btn a-btn--info a-btn--xs"
                            disabled={changeStatus.isPending}
                          >
                            ØªØ§ÛŒÛŒØ¯
                          </button>
                        )}
                        {comment.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => changeStatus.mutate({ id: comment.id, status: 'rejected' })}
                            className="a-btn a-btn--danger a-btn--xs"
                            disabled={changeStatus.isPending}
                          >
                            Ø±Ø¯
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