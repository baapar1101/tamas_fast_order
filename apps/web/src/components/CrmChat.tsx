import { useState, useEffect, useRef, useCallback } from 'react';

/* ─── Config ─────────────────────────────────────────────── */
const API_BASE       = 'https://tamastore.ir';
const PUBLIC_KEY     = 'wPzldz3FGwE2EX8tYS4WYew2kf9aL72Y';
const WS_URL         = 'wss://tamastore.ir/ws/crm-chat';
const SESSION_KEY    = 'tamas_crm_session';
const MAX_WS_RETRIES = 5;

/* ─── Types ──────────────────────────────────────────────── */
interface Message {
  id: string;
  senderRole: 'visitor' | 'agent' | 'system';
  body: string;
  createdAt: string;
  displayTime?: string | null;
}

interface Session {
  visitorToken: string;
  conversationId: number;
}

interface CrmChatProps {
  user?: { name?: string; lastName?: string; email?: string; phone?: string };
}

/* ─── Guided intake questions (conversational style) ─────── */
type Question = {
  id: 'name' | 'phone' | 'msg';
  prompt: string | ((name: string) => string);
  placeholder: string;
  type: string;
};
const QUESTIONS: Question[] = [
  { id: 'name',  prompt: 'سلام! 👋 اسمت چیه؟',                         placeholder: 'مثلاً: علی',          type: 'text' },
  { id: 'phone', prompt: (n: string) => `${n} عزیز، شماره موبایلت؟`,  placeholder: '09xxxxxxxxx',         type: 'tel'  },
  { id: 'msg',   prompt: 'چه کمکی می‌تونم بکنم؟',                      placeholder: 'سوالت رو بنویس...',  type: 'text' },
];

/* ─── Helpers ────────────────────────────────────────────── */
function saveSession(s: Session) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* noop */ }
}
function loadSession(): Session | null {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null'); } catch { return null; }
}
function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
}
function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}
async function apiPost(path: string, body: object, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['X-Visitor-Token'] = token;
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? 'خطای سرور');
  return data;
}
async function apiGet(path: string, token: string): Promise<Message[]> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'X-Visitor-Token': token } });
  const data = await res.json();
  const raw: unknown[] = Array.isArray(data?.data) ? data.data
    : Array.isArray(data?.data?.items) ? data.data.items
    : Array.isArray(data) ? data : [];
  return (raw as any[]).map((m) => ({
    id: String(m.id ?? Date.now()),
    senderRole: (['visitor','agent','system'].includes(m.sender_role) ? m.sender_role : 'system') as Message['senderRole'],
    body: m.body ?? '',
    createdAt: m.created_at ?? new Date().toISOString(),
    displayTime: m.created_at_formatted?.time_only ?? null,
  }));
}

/* ─── Sub-components ─────────────────────────────────────── */
function AgentBubble({ text, time }: { text: string; time?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', animation: 'msgIn 0.22s ease' }}>
      <div style={{
        background: '#f0f4ff', color: '#1e293b',
        padding: '10px 14px', borderRadius: '16px 16px 4px 16px',
        fontSize: 13.5, lineHeight: 1.65, maxWidth: '82%',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        border: '1px solid #e2e8f0',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>{text}</div>
      {time && <span style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{time}</span>}
    </div>
  );
}
function VisitorBubble({ text, time }: { text: string; time?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', animation: 'msgIn 0.22s ease' }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a6ef7, #1558d6)', color: '#fff',
        padding: '10px 14px', borderRadius: '16px 16px 16px 4px',
        fontSize: 13.5, lineHeight: 1.65, maxWidth: '82%',
        boxShadow: '0 2px 10px rgba(26,110,247,0.28)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>{text}</div>
      {time && <span style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{time}</span>}
    </div>
  );
}
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', animation: 'msgIn 0.2s ease' }}>
      <div style={{
        background: '#f0f4ff', borderRadius: '16px 16px 4px 16px',
        padding: '10px 16px', display: 'flex', gap: 5, alignItems: 'center',
        border: '1px solid #e2e8f0',
      }}>
        {[0, 160, 320].map(d => (
          <span key={d} style={{
            width: 7, height: 7, borderRadius: '50%', background: '#94a3b8',
            display: 'inline-block',
            animation: `dotBounce 1.2s ${d}ms infinite ease-in-out`,
          }} />
        ))}
      </div>
    </div>
  );
}
function SendBtn({ disabled, loading }: { disabled: boolean; loading: boolean }) {
  return (
    <button type="submit" disabled={disabled} style={{
      width: 44, height: 44, flexShrink: 0,
      background: disabled ? '#e2e8f0' : 'linear-gradient(135deg,#1a6ef7,#1558d6)',
      color: disabled ? '#94a3b8' : '#fff',
      border: 'none', borderRadius: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.18s',
      boxShadow: disabled ? 'none' : '0 2px 10px rgba(26,110,247,0.3)',
    }}
    onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.transform = 'scale(1.07)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}>
      {loading
        ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/></svg>
        : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13" strokeLinecap="round"/><polygon points="22 2 15 22 11 13 2 9 22 2" strokeLinejoin="round"/></svg>
      }
    </button>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
export function CrmChat({ user }: CrmChatProps) {
  const [isOpen,   setIsOpen]   = useState(false);
  const [phase,    setPhase]    = useState<'idle' | 'intake' | 'chat'>('idle');
  const [qIndex,   setQIndex]   = useState(0);
  const [answers,  setAnswers]  = useState({ name: user?.name ?? '', phone: user?.phone ?? '', msg: '' });
  const [input,    setInput]    = useState('');
  const [err,      setErr]      = useState('');
  const [session,  setSession]  = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending,  setSending]  = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [wsStatus, setWsStatus] = useState<'idle' | 'connecting' | 'connected' | 'offline'>('idle');
  const [unread,   setUnread]   = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const wsRef     = useRef<WebSocket | null>(null);
  const reconnRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnAtt = useRef(0);
  const intentRef = useRef(false);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  useEffect(() => {
    const s = loadSession();
    if (!s) return;
    setSession(s);
    setPhase('chat');
    apiGet(`/api/v1/public/crm-chat/conversations/${s.conversationId}/messages?limit=80`, s.visitorToken)
      .then(setMessages).catch(() => {});
  }, []);

  useEffect(() => { if (isOpen && phase !== 'idle') setTimeout(() => inputRef.current?.focus(), 120); }, [isOpen, phase]);
  useEffect(() => { if (isOpen) setUnread(0); }, [isOpen]);

  /* WebSocket */
  const openWs = useCallback((s: Session) => {
    if (intentRef.current || wsRef.current?.readyState === WebSocket.OPEN) return;
    // Give up silently after MAX_WS_RETRIES — avoids console spam when WS is unavailable
    if (reconnAtt.current >= MAX_WS_RETRIES) { setWsStatus('offline'); return; }
    setWsStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', role: 'visitor', visitor_token: s.visitorToken, conversation_id: s.conversationId }));
    ws.onmessage = (e) => {
      try {
        const frame = JSON.parse(e.data as string);
        if (frame.type === 'auth_ok') { setWsStatus('connected'); reconnAtt.current = 0; return; }
        if (frame.type === 'ping' || frame.type === 'heartbeat') { ws.send(JSON.stringify({ type: 'pong' })); return; }
        if (frame.type !== 'crm_chat.event' || frame.event !== 'message.created') return;
        const raw = frame?.payload?.message ?? frame?.data?.message ?? frame?.message ?? frame?.payload ?? frame?.data;
        if (!raw || !('sender_role' in raw)) return;
        const msg: Message = {
          id: String(raw.id ?? Date.now()),
          senderRole: raw.sender_role === 'visitor' ? 'visitor' : raw.sender_role === 'agent' ? 'agent' : 'system',
          body: raw.body ?? '',
          createdAt: raw.created_at ?? new Date().toISOString(),
          displayTime: raw.created_at_formatted?.time_only ?? null,
        };
        setIsTyping(false);
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        if (!isOpen && msg.senderRole === 'agent') setUnread(n => n + 1);
      } catch { /* noop */ }
    };
    ws.onerror = () => setWsStatus('offline');
    ws.onclose = () => {
      wsRef.current = null;
      if (intentRef.current) return;
      reconnAtt.current += 1;
      if (reconnAtt.current >= MAX_WS_RETRIES) { setWsStatus('offline'); return; } // give up
      reconnRef.current = setTimeout(() => openWs(s), Math.min(1000 * 2 ** (reconnAtt.current - 1), 20000));
      setWsStatus('offline');
    };
  }, [isOpen]);

  const closeWs = useCallback(() => {
    intentRef.current = true;
    if (reconnRef.current) clearTimeout(reconnRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    setWsStatus('idle');
  }, []);

  useEffect(() => {
    if (!session) return;
    intentRef.current = false;
    openWs(session);
    return () => { closeWs(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    const goOff = () => setWsStatus('offline');
    const goOn  = () => { if (session) { intentRef.current = false; openWs(session); } };
    window.addEventListener('offline', goOff);
    window.addEventListener('online', goOn);
    return () => { window.removeEventListener('offline', goOff); window.removeEventListener('online', goOn); };
  }, [session, openWs]);

  /* Intake */
  const currentQ = QUESTIONS[qIndex];
  const currentPrompt = typeof currentQ?.prompt === 'function' ? currentQ.prompt(answers.name) : currentQ?.prompt ?? '';

  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = input.trim();
    if (qIndex === 1 && !/^09\d{9}$/.test(val)) { setErr('شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود'); return; }
    if (!val) { setErr('لطفاً پاسخ را وارد کنید'); return; }
    setErr('');
    const key = currentQ!.id;
    const newAns = { ...answers, [key]: val };
    setAnswers(newAns);
    setInput('');
    if (qIndex < QUESTIONS.length - 1) { setQIndex(qIndex + 1); return; }

    setSending(true);
    try {
      const data = await apiPost('/api/v1/public/crm-chat/conversations/start', {
        public_key: PUBLIC_KEY,
        first_name: newAns.name,
        last_name: '-',
        email: `${newAns.phone}@tamas.local`,
        phone: newAns.phone,
        page_url: window.location.href,
        device_type: isMobile ? 'mobile' : 'desktop',
        initial_message: newAns.msg,
      });
      const d = data?.data ?? data;
      const s: Session = { visitorToken: d.visitor_token, conversationId: Number(d.conversation_id) };
      saveSession(s);
      setSession(s);
      const history = await apiGet(`/api/v1/public/crm-chat/conversations/${s.conversationId}/messages?limit=80`, s.visitorToken);
      setMessages(history.length > 0 ? history : [{ id: String(Date.now()), senderRole: 'visitor', body: newAns.msg, createdAt: new Date().toISOString() }]);
      setPhase('chat');
    } catch (ex: any) {
      setErr(ex?.message ?? 'خطا در اتصال. دوباره تلاش کن.');
    } finally {
      setSending(false);
    }
  };

  /* Send */
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !session || sending) return;
    const body = input.trim();
    const tempId = String(Date.now());
    setMessages(prev => [...prev, { id: tempId, senderRole: 'visitor', body, createdAt: new Date().toISOString() }]);
    setInput('');
    setSending(true);
    setIsTyping(true);
    try {
      await apiPost('/api/v1/public/crm-chat/messages', { visitor_token: session.visitorToken, conversation_id: session.conversationId, body }, session.visitorToken);
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setIsTyping(false);
    } finally {
      setSending(false);
    }
  };

  /* End */
  const handleEnd = () => {
    closeWs(); clearSession(); setSession(null); setMessages([]);
    setPhase('idle'); setQIndex(0); setAnswers({ name: user?.name ?? '', phone: user?.phone ?? '', msg: '' });
    setInput(''); setIsOpen(false);
  };

  /* Colors */
  const orbColor = wsStatus === 'connected' ? '#22c55e' : wsStatus === 'connecting' ? '#f59e0b' : wsStatus === 'offline' ? '#ef4444' : '#1a6ef7';
  const bottom   = isMobile ? 80 : 24;
  const widgetW  = isMobile ? 'calc(100vw - 24px)' : 390;
  const widgetH  = isMobile ? 'calc(100svh - 104px)' : 560;

  const inputStyle: React.CSSProperties = {
    flex: 1, padding: '11px 14px',
    border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14,
    background: '#f8fafc', color: '#1e293b', outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: "'Vazirmatn','Segoe UI',Tahoma,sans-serif",
  };

  /* Toggle button */
  if (!isOpen) {
    return (
      <button
        id="crm-chat-toggle"
        type="button"
        onClick={() => { setIsOpen(true); if (phase === 'idle') setPhase('intake'); }}
        title="چت با پشتیبانی"
        aria-label="چت با پشتیبانی"
        style={{
          position: 'fixed', bottom, left: 20,
          width: 58, height: 58, borderRadius: '50%',
          background: 'linear-gradient(135deg,#1a6ef7,#1558d6)',
          color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(26,110,247,0.42)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, zIndex: 9999, transition: 'transform 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        💬
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#ef4444', color: '#fff', borderRadius: '50%',
            width: 20, height: 20, fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
    );
  }

  return (
    <div
      id="crm-chat-widget"
      dir="rtl"
      style={{
        position: 'fixed', bottom, left: 20,
        width: widgetW, height: widgetH,
        background: '#fff', borderRadius: 18,
        boxShadow: '0 16px 64px rgba(0,0,0,0.14),0 4px 16px rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column',
        zIndex: 9999, overflow: 'hidden',
        border: '1px solid #e2e8f0',
        fontFamily: "'Vazirmatn','Segoe UI',Tahoma,sans-serif",
        animation: 'chatSlideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <style>{`
        @keyframes chatSlideUp { from{opacity:0;transform:translateY(20px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes msgIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dotBounce { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
        #crm-chat-widget *{box-sizing:border-box}
        #crm-chat-widget ::-webkit-scrollbar{width:4px}
        #crm-chat-widget ::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:4px}
      `}</style>

      {/* Header */}
      <div style={{
        padding: '14px 16px',
        background: 'linear-gradient(135deg,#1a6ef7,#1558d6)',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', width: 40, height: 40 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎧</div>
            <span style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', background: orbColor, border: '2px solid white', transition: 'background 0.4s' }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>پشتیبانی تاماس</div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 1 }}>
              {wsStatus === 'connected' ? '● آنلاین' : wsStatus === 'connecting' ? '◌ در حال اتصال...' : wsStatus === 'offline' ? '○ آفلاین' : 'آماده پاسخگویی'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {phase === 'chat' && (
            <button type="button" onClick={handleEnd} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>پایان</button>
          )}
          <button type="button" onClick={() => setIsOpen(false)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      </div>

      {/* Intake */}
      {phase === 'intake' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AgentBubble text="سلام! خوش اومدی 😊 برای شروع مکالمه با پشتیبانی، چند سوال کوتاه داریم." />
            {QUESTIONS.slice(0, qIndex).map((q, i) => {
              const prompt = typeof q.prompt === 'function' ? q.prompt(answers.name) : q.prompt;
              return (
                <div key={q.id}>
                  <AgentBubble text={prompt} />
                  <div style={{ height: 6 }} />
                  <VisitorBubble text={answers[q.id]} />
                </div>
              );
            })}
            {qIndex < QUESTIONS.length && <AgentBubble text={currentPrompt} />}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={handleIntakeSubmit} style={{ padding: '10px 12px 14px', borderTop: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
            {err && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 6, fontWeight: 500 }}>⚠️ {err}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                type={currentQ?.type === 'tel' ? 'tel' : 'text'}
                value={input}
                onChange={e => { setInput(e.target.value); setErr(''); }}
                placeholder={currentQ?.placeholder}
                disabled={sending}
                dir="auto"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#1a6ef7')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
              />
              <SendBtn disabled={sending || !input.trim()} loading={sending} />
            </div>
          </form>
        </div>
      )}

      {/* Chat */}
      {phase === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#64748b', padding: '32px 16px' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>مکالمه شروع شد!</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>کارشناس ما به زودی پاسخ می‌دهد.</p>
              </div>
            )}
            {messages.map(msg =>
              msg.senderRole === 'visitor'
                ? <VisitorBubble key={msg.id} text={msg.body} time={msg.displayTime ?? formatTime(msg.createdAt)} />
                : <AgentBubble   key={msg.id} text={msg.body} time={msg.displayTime ?? formatTime(msg.createdAt)} />
            )}
            {isTyping && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={handleSend} style={{ padding: '10px 12px 14px', borderTop: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="پیام خود را بنویسید..."
                disabled={sending}
                dir="auto"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#1a6ef7')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e as any); } }}
              />
              <SendBtn disabled={sending || !input.trim()} loading={sending} />
            </div>
            {wsStatus === 'offline' && (
              <p style={{ fontSize: 11, color: '#f59e0b', marginTop: 5, fontWeight: 500 }}>⚠️ اتصال قطع شده — در حال اتصال مجدد...</p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

