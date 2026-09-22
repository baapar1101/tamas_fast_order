import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';

interface Conversation {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
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
    <div className="a-page">
      <div className="a-page-header">
        <h1 className="a-page-title">چت مشتریان</h1>
      </div>
      <div className="a-page-content" style={{ display: 'flex', gap: '1rem', height: 'calc(100vh - 150px)', paddingBottom: '1rem' }}>
        
        {/* Sidebar */}
        <div style={{ width: '320px', backgroundColor: 'var(--a-surface)', borderRadius: '12px', border: '1px solid var(--a-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--a-border)', fontWeight: 'bold', backgroundColor: 'var(--a-surface)' }}>
            مکالمات
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isLoadingConvs ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--a-t4)' }}>در حال دریافت اطلاعات...</div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--a-t4)' }}>هیچ مکالمه‌ای یافت نشد.</div>
            ) : (
              conversations.map((c) => (
                <div 
                  key={c.id} 
                  onClick={() => setActiveConvId(c.id)}
                  style={{
                    padding: '1rem', 
                    borderBottom: '1px solid var(--a-border)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: activeConvId === c.id ? 'var(--a-brand-soft)' : 'transparent',
                    borderRight: activeConvId === c.id ? '3px solid var(--a-brand)' : '3px solid transparent',
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', color: activeConvId === c.id ? 'var(--a-brand)' : 'var(--a-t1)' }}>
                    {c.first_name} {c.last_name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--a-t4)' }}>
                    {c.phone || c.email || 'بدون اطلاعات تماس'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div style={{ flex: 1, backgroundColor: 'var(--a-surface)', borderRadius: '12px', border: '1px solid var(--a-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!activeConvId ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--a-t4)', flexDirection: 'column', gap: '1rem' }}>
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              <span>یک مکالمه را برای نمایش انتخاب کنید</span>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--a-border)', backgroundColor: 'var(--a-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 'bold' }}>
                  {conversations.find(c => c.id === activeConvId)?.first_name} {conversations.find(c => c.id === activeConvId)?.last_name}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--a-t4)' }}>
                  شناسه مکالمه: {activeConvId}
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {isLoadingMsgs ? (
                  <div style={{ textAlign: 'center', color: 'var(--a-t4)' }}>در حال بارگذاری پیام‌ها...</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--a-t4)' }}>پیامی وجود ندارد.</div>
                ) : (
                  messages.map(m => {
                    const isAgent = m.sender_role === 'agent' || m.sender_role === 'system';
                    return (
                      <div key={m.id} style={{ alignSelf: isAgent ? 'flex-end' : 'flex-start', maxWidth: '75%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ 
                          backgroundColor: isAgent ? 'var(--a-brand)' : 'var(--a-field-bg)', 
                          color: isAgent ? '#ffffff' : 'var(--a-t1)',
                          padding: '0.75rem 1.25rem', 
                          borderRadius: '16px',
                          borderBottomRightRadius: isAgent ? '4px' : '16px',
                          borderBottomLeftRadius: isAgent ? '16px' : '4px',
                          border: isAgent ? 'none' : '1px solid var(--a-border)',
                          lineHeight: '1.6',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {m.body}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--a-t4)', marginTop: '0.35rem', textAlign: isAgent ? 'left' : 'right', padding: '0 0.25rem' }}>
                          {new Date(m.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div style={{ padding: '1rem', borderTop: '1px solid var(--a-border)', backgroundColor: 'var(--a-surface)' }}>
                <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.75rem' }}>
                  <input 
                    type="text" 
                    className="a-input" 
                    style={{ flex: 1, padding: '0.75rem 1rem' }}
                    placeholder="پاسخ خود را بنویسید..." 
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    disabled={sendMutation.isPending}
                    autoFocus
                  />
                  <button 
                    type="submit" 
                    className="a-btn a-btn--primary" 
                    style={{ padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    disabled={sendMutation.isPending || !replyText.trim()}
                  >
                    {sendMutation.isPending ? 'در حال ارسال...' : (
                      <>
                        <span>ارسال</span>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
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
