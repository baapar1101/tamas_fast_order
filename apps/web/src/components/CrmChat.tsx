import { useState, useEffect, useRef } from 'react';

const API_BASE = 'https://tamastore.ir';
const PUBLIC_KEY = 'wPzldz3FGwE2EX8tYS4WYew2kf9aL72Y';

const isMobile = () => window.innerWidth < 768;

interface Message {
  id: number;
  conversation_id: number;
  sender_role: 'visitor' | 'agent';
  body: string;
  created_at: string;
  file?: {
    id: number;
    original_name: string;
    file_size: number;
    mime_type: string;
  };
}

interface CrmChatProps {
  user?: {
    name?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
}

export function CrmChat({ user }: CrmChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'chat'>('form');
  const [visitorToken, setVisitorToken] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileView, setIsMobileView] = useState(isMobile());
  const [formData, setFormData] = useState({
    first_name: user?.name || '',
    last_name: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => setIsMobileView(isMobile());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Restore session from storage
  useEffect(() => {
    const storedToken = sessionStorage.getItem('crm_visitor_token');
    const storedConversationId = sessionStorage.getItem('crm_conversation_id');
    if (storedToken && storedConversationId) {
      setVisitorToken(storedToken);
      setConversationId(Number(storedConversationId));
      setStep('chat');
      loadMessages(Number(storedConversationId), storedToken);
    }
  }, []);

  const startConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/v1/public/crm-chat/conversations/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          public_key: PUBLIC_KEY,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          page_url: window.location.href,
          device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        }),
      });

      const data = await response.json();

      if (data.data) {
        setVisitorToken(data.data.visitor_token);
        setConversationId(data.data.conversation_id);
        sessionStorage.setItem('crm_visitor_token', data.data.visitor_token);
        sessionStorage.setItem('crm_conversation_id', String(data.data.conversation_id));
        setStep('chat');
      } else {
        console.error('Failed to start conversation:', data);
        alert('خطا در شروع مکالمه. لطفاً دوباره تلاش کنید.');
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      alert('خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (convId: number, token: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/public/crm-chat/conversations/${convId}/messages?limit=50`,
        {
          headers: {
            'X-Visitor-Token': token,
          },
        }
      );

      const data = await response.json();
      if (data.data) {
        setMessages(data.data);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !visitorToken || !conversationId) return;

    const tempMessage: Message = {
      id: Date.now(),
      conversation_id: conversationId,
      sender_role: 'visitor',
      body: inputMessage,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/v1/public/crm-chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Visitor-Token': visitorToken,
        },
        body: JSON.stringify({
          visitor_token: visitorToken,
          conversation_id: conversationId,
          body: inputMessage,
        }),
      });

      const data = await response.json();
      
      // Reload messages to get the correct server response
      if (conversationId && visitorToken) {
        await loadMessages(conversationId, visitorToken);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="crm-chat-toggle"
        style={{
          position: 'fixed',
          bottom: isMobileView ? 80 : 24,
          left: 24,
          width: 60,
          height: 60,
          borderRadius: '50%',
          backgroundColor: '#10b981',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          zIndex: 1000,
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        title="چت با پشتیبانی"
      >
        💬
      </button>
    );
  }

  return (
    <div
      className="crm-chat-widget"
      style={{
        position: 'fixed',
        bottom: isMobileView ? 80 : 24,
        left: 24,
        width: 380,
        maxWidth: 'calc(100vw - 48px)',
        height: 520,
        maxHeight: 'calc(100vh - 48px)',
        backgroundColor: 'white',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 16,
          backgroundColor: '#10b981',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>💬</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>پشتیبانی آنلاین</h3>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.9 }}>
              {step === 'chat' ? 'آنلاین و آماده پاسخگویی' : 'شروع مکالمه جدید'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: 24,
            cursor: 'pointer',
            padding: 4,
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {step === 'form' ? (
          <form onSubmit={startConversation} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#334155' }}>
                نام *
              </label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                style={{
                  width: '100%',
                  padding: 10,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                }}
                placeholder="نام خود را وارد کنید"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#334155' }}>
                نام خانوادگی *
              </label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                style={{
                  width: '100%',
                  padding: 10,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                }}
                placeholder="نام خانوادگی خود را وارد کنید"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#334155' }}>
                شماره موبایل *
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                style={{
                  width: '100%',
                  padding: 10,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                }}
                placeholder="09xxxxxxxxx"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#334155' }}>
                ایمیل
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={{
                  width: '100%',
                  padding: 10,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                }}
                placeholder="example@email.com"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: 12,
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? 'در حال اتصال...' : 'شروع مکالمه'}
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginBottom: 12,
              }}
            >
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>
                  <p style={{ fontSize: 14 }}>مکالمه جدیدی را شروع کنید!</p>
                  <p style={{ fontSize: 12, marginTop: 8 }}>تیم پشتیبانی ما به زودی پاسخ خواهند داد.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: msg.sender_role === 'visitor' ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: msg.sender_role === 'visitor' ? '#10b981' : '#f1f5f9',
                        color: msg.sender_role === 'visitor' ? 'white' : '#334155',
                        padding: 10,
                        borderRadius: 12,
                        fontSize: 14,
                        lineHeight: 1.5,
                      }}
                    >
                      {msg.body}
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>
                      {new Date(msg.created_at).toLocaleTimeString('fa-IR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="پیام خود را بنویسید..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: 10,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                style={{
                  padding: '10 16',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isLoading || !inputMessage.trim() ? 'not-allowed' : 'pointer',
                  opacity: isLoading || !inputMessage.trim() ? 0.7 : 1,
                }}
              >
                {isLoading ? '...' : 'ارسال'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}