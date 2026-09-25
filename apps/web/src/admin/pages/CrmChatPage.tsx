import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';

interface Conversation {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  visitor_first_name?: string;
  visitor_last_name?: string;
  visitor_phone?: string;
  visitor_email?: string;
  status: string;
  created_at: string;
}

interface Message {
  id: number;
  sender_role: 'visitor' | 'agent' | 'system';
  body: string;
  created_at: string;
}

export function CrmChatPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: convData, isLoading: isLoadingConvs } = useQuery({
    queryKey: ['admin', 'crm-chat-conversations'],
    queryFn: () => api.get<any>('/crm/chat/conversations'),
    refetchInterval: 15000,
  });

  let conversations: Conversation[] = [];
  if (Array.isArray(convData)) conversations = convData;
  else if (Array.isArray(convData?.data)) conversations = convData.data;
  else if (Array.isArray(convData?.data?.items)) conversations = convData.data.items;
  else if (Array.isArray(convData?.items)) conversations = convData.items;

  const { data: msgData, isLoading: isLoadingMsgs } = useQuery({
    queryKey: ['admin', 'crm-chat-messages', activeConvId],
    queryFn: () => api.get<any>(`/crm/chat/conversations/${activeConvId}/messages`),
    enabled: !!activeConvId,
    refetchInterval: 10000,
  });

  let messages: Message[] = [];
  if (Array.isArray(msgData)) messages = msgData;
  else if (Array.isArray(msgData?.data)) messages = msgData.data;
  else if (Array.isArray(msgData?.data?.items)) messages = msgData.data.items;
  else if (Array.isArray(msgData?.items)) messages = msgData.items;

  const sendMutation = useMutation({
    mutationFn: (text: string) => api.post(`/crm/chat/conversations/${activeConvId}/messages`, { body: text }),
    onSuccess: () => {
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'crm-chat-messages', activeConvId] });
    },
    onError: () => toast.error('خطا در ارسال پیام'),
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeConvId) return;
    sendMutation.mutate(replyText);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="a-page a-fade">
      <div className="a-page-header mb-4">
        <h1 className="a-page-title text-xl font-bold text-[var(--a-t1)]">چت مشتریان</h1>
      </div>
      <div className="a-page-content flex flex-col lg:flex-row gap-4 h-[calc(100vh-140px)] min-h-[500px] pb-4">
        {/* Section 1: Conversations List */}
        <div className="w-full lg:w-80 h-48 lg:h-auto shrink-0 bg-[var(--a-surface)] rounded-xl border border-[var(--a-border)] flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[var(--a-border)] font-bold text-sm bg-[var(--a-surface)] flex items-center justify-between">
            <span>مکالمات</span>
            <span className="text-xs font-normal text-[var(--a-t4)]">{conversations.length} مکالمه</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {isLoadingConvs ? (
              <div className="p-6 text-center text-[var(--a-t4)] text-xs">در حال دریافت اطلاعات...</div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-[var(--a-t4)] text-xs">هیچ مکالمه‌ای یافت نشد.</div>
            ) : (
              conversations.map((c) => (
                <div 
                  key={c.id} 
                  onClick={() => setActiveConvId(c.id)}
                  className={`p-3 border-b border-[var(--a-border)] cursor-pointer transition-all ${
                    activeConvId === c.id ? 'bg-[var(--a-brand-soft)] border-r-4 border-r-[var(--a-brand)]' : 'hover:bg-white/5'
                  }`}
                >
                  <div className={`font-bold text-sm mb-1 ${activeConvId === c.id ? 'text-[var(--a-brand)]' : 'text-[var(--a-t1)]'}`}>
                    {c.first_name || c.visitor_first_name} {c.last_name || c.visitor_last_name}
                    {!(c.first_name || c.visitor_first_name) && 'کاربر ناشناس'}
                  </div>
                  <div className="text-xs text-[var(--a-t4)]">
                    {c.phone || c.visitor_phone || c.email || c.visitor_email || 'بدون اطلاعات تماس'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Section 2 & 3: Chat Area (Messages + Reply Form) */}
        <div className="flex-1 bg-[var(--a-surface)] rounded-xl border border-[var(--a-border)] flex flex-col overflow-hidden min-w-0">
          {!activeConvId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--a-t4)] gap-3 p-6 text-center">
              <svg className="w-14 h-14 opacity-40" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              <span className="text-sm">یک مکالمه را برای نمایش انتخاب کنید</span>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-3.5 border-b border-[var(--a-border)] bg-[var(--a-surface)] flex items-center justify-between">
                <div className="font-bold text-sm text-[var(--a-t1)]">
                  {(() => {
                    const c = conversations.find(x => x.id === activeConvId);
                    if (!c) return '';
                    const f = c.first_name || c.visitor_first_name;
                    const l = c.last_name || c.visitor_last_name;
                    return (f || l) ? `${f || ''} ${l || ''}` : 'کاربر ناشناس';
                  })()}
                </div>
                <div className="text-xs text-[var(--a-t4)]">
                  شناسه مکالمه: {activeConvId}
                </div>
              </div>

              {/* Section 2: Messages Stream */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
                {isLoadingMsgs ? (
                  <div className="text-center text-[var(--a-t4)] text-xs py-4">در حال بارگذاری پیام‌ها...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-[var(--a-t4)] text-xs py-4">پیامی وجود ندارد.</div>
                ) : (
                  messages.map(m => {
                    const isAgent = m.sender_role === 'agent' || m.sender_role === 'system';
                    return (
                      <div key={m.id} className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isAgent ? 'self-end' : 'self-start'}`}>
                        <div className={`p-3 px-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                          isAgent 
                            ? 'bg-[var(--a-brand)] text-white rounded-br-none' 
                            : 'bg-[var(--a-field-bg)] text-[var(--a-t1)] border border-[var(--a-border)] rounded-bl-none'
                        }`}>
                          {m.body}
                        </div>
                        <div className={`text-[10px] text-[var(--a-t4)] mt-1 px-1 ${isAgent ? 'text-left' : 'text-right'}`}>
                          {new Date(m.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Section 3: Reply Box */}
              <div className="p-3 border-t border-[var(--a-border)] bg-[var(--a-surface)]">
                <form onSubmit={handleSend} className="flex gap-2">
                  <input 
                    type="text" 
                    className="a-input flex-1 py-2.5 px-3.5 text-sm" 
                    placeholder="پاسخ خود را بنویسید..." 
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    disabled={sendMutation.isPending}
                    autoFocus
                  />
                  <button 
                    type="submit" 
                    className="a-btn a-btn--primary px-4 shrink-0 flex items-center gap-1.5" 
                    disabled={sendMutation.isPending || !replyText.trim()}
                  >
                    {sendMutation.isPending ? '...' : (
                      <>
                        <span>ارسال</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
