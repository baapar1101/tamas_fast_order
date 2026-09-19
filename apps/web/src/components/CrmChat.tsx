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
function extractArray(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.messages)) return data.messages;
  if (Array.isArray(data.data?.items)) return data.data.items;
  if (Array.isArray(data.data?.messages)) return data.data.messages;
  return [];
}

async function apiPost(path: string, body: object, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['X-Visitor-Token'] = token;
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? data?.detail?.message ?? 'خطای سرور');
  return data;
}

async function apiGet(path: string, token: string): Promise<Message[]> {
  const separator = path.includes('?') ? '&' : '?';
  const url = `${API_BASE}${path}${separator}visitor_token=${encodeURIComponent(token)}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'X-Visitor-Token': token } });
  } catch {
    // Only a rejected fetch means the network is genuinely unreachable
    throw new Error('network');
  }
  // If the body isn't JSON (proxy error page, empty reply), it's a server hiccup — not a disconnect
  let data: any;
  try { data = await res.json(); } catch { return []; }
  const raw = extractArray(data);
  return raw.map((m: any) => ({
    id: String(m.id ?? Date.now()),
    senderRole: (['visitor','agent','system'].includes(m.sender_role) ? m.sender_role : 'system') as Message['senderRole'],
    body: m.body ?? '',
    createdAt: m.created_at ?? new Date().toISOString(),
    displayTime: m.created_at_formatted?.time_only ?? null,
  }));
}

/* ─── tamasmarket interaction: pressed scale + subtle hover, never hover-only ─── */
const PRESS_SCALE: React.CSSProperties = {
  transition: 'transform 0.1s cubic-bezier(0.2, 0.8, 0.2, 1)',
};
function pointerScale(disabled = false) {
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (disabled) return;
      (e.currentTarget as HTMLElement).style.transform = 'scale(0.95)';
    },
    onPointerUp: (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
    },
    onPointerCancel: (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
    },
    onPointerLeave: (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
    },
    onMouseEnter: (e: React.MouseEvent) => {
      if (disabled) return;
      (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; // Removed hover scaling per DESIGN.md: "never hover-only"
    },
    onMouseLeave: (e: React.MouseEvent) => {
      (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
    },
  };
}

/* ─── Sub-components ─────────────────────────────────────── */
function AgentBubble({ text, time }: { text: string; time?: string }) {
  // Agent is .out (right in RTL, so flex-start)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', animation: 'msgIn 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
      <div style={{
        background: 'color-mix(in srgb, var(--tamas-surface) 82%, transparent)', color: 'var(--tamas-fg)',
        padding: '10px 14px', borderRadius: 14,
        fontSize: 12.5, lineHeight: 1.6, maxWidth: '82%',
        border: 'var(--tamas-border-w, 1px) solid var(--tamas-border)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>{text}</div>
      {time && <span style={{ fontSize: 10, color: 'var(--tamas-muted)', marginTop: 3 }}>{time}</span>}
    </div>
  );
}
function VisitorBubble({ text, time }: { text: string; time?: string }) {
  // Visitor is .in (left in RTL, so flex-end)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', animation: 'msgIn 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
      <div style={{
        background: 'var(--tamas-accent)', color: '#fff',
        padding: '10px 14px', borderRadius: 14,
        fontSize: 12.5, lineHeight: 1.6, maxWidth: '82%',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>{text}</div>
      {time && <span style={{ fontSize: 10, color: 'var(--tamas-muted)', marginTop: 3 }}>{time}</span>}
    </div>
  );
}
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', animation: 'msgIn 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
      <div style={{
        background: 'color-mix(in srgb, var(--tamas-surface) 82%, transparent)', borderRadius: 14,
        padding: '10px 16px', display: 'flex', gap: 5, alignItems: 'center',
        border: 'var(--tamas-border-w, 1px) solid var(--tamas-border)',
      }}>
        {[0, 160, 320].map(d => (
          <span key={d} style={{
            width: 7, height: 7, borderRadius: '50%', background: 'var(--tamas-accent)',
            display: 'inline-block',
            animation: `dotBounce 1.2s ${d}ms infinite ease-in-out`,
          }} />
        ))}
      </div>
    </div>
  );
}
function SendBtn({ disabled, loading }: { disabled: boolean; loading: boolean }) {
  const scale = pointerScale(disabled);
  return (
    <button
      type="submit"
      disabled={disabled}
      style={{
        width: 44, height: 44, flexShrink: 0,
        background: disabled ? 'var(--tamas-bg)' : 'var(--tamas-accent)',
        color: disabled ? 'var(--tamas-muted)' : '#fff',
        border: disabled ? 'var(--tamas-border-w, 1px) solid var(--tamas-border)' : 'none',
        borderRadius: 'var(--tamas-radius-pill, 980px)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: disabled ? 'none' : '0 6px 16px rgba(8, 121, 143, 0.28)',
        ...PRESS_SCALE,
      }}
      {...scale}
    >
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
  const [netAlive, setNetAlive] = useState(true); // REST polling working — WS may still be down, but chat works
  const [unread,   setUnread]   = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const intakeScrollRef = useRef<HTMLDivElement>(null);
  const chatScrollRef   = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLInputElement>(null);
  const wsRef           = useRef<WebSocket | null>(null);
  const hbRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnAtt       = useRef(0);
  const intentRef       = useRef(false);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  /* Scroll to bottom reliably: scroll the actual scrollable container. */
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isTyping, phase]);

  useEffect(() => {
    const el = intakeScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [qIndex, answers, phase]);

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
        if (frame.type === 'auth_ok') { setWsStatus('connected'); reconnAtt.current = 0; setNetAlive(true); return; }
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
      if (hbRef.current) { clearInterval(hbRef.current); hbRef.current = null; }
      if (intentRef.current) return;
      reconnAtt.current += 1;
      if (reconnAtt.current >= MAX_WS_RETRIES) { setWsStatus('offline'); return; } // give up
      reconnRef.current = setTimeout(() => openWs(s), Math.min(1000 * 2 ** (reconnAtt.current - 1), 20000));
      setWsStatus('offline');
    };
    // Keep the socket alive so idle server connections don't drop and trigger false reconnects
    if (hbRef.current) clearInterval(hbRef.current);
    hbRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, 20000);
  }, [isOpen]);

  const closeWs = useCallback(() => {
    intentRef.current = true;
    if (reconnRef.current) clearTimeout(reconnRef.current);
    if (hbRef.current) { clearInterval(hbRef.current); hbRef.current = null; }
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
    const goOff = () => { setWsStatus('offline'); setNetAlive(false); };
    const goOn  = () => {
      setNetAlive(true);
      if (!session) return;
      intentRef.current = false;
      reconnAtt.current = 0; // allow reconnecting after network recovery
      openWs(session);
    };
    window.addEventListener('offline', goOff);
    window.addEventListener('online', goOn);
    return () => { window.removeEventListener('offline', goOff); window.removeEventListener('online', goOn); };
  }, [session, openWs]);

  /* Polling — always on while a session exists; slow catch-up when WS is live, fast when it isn't */
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failRef = useRef(0); // consecutive REST failures — ignore single blips
  const isWsConnected = wsStatus === 'connected';

  useEffect(() => {
    if (!session) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }

    const delay = isWsConnected ? 8000 : 3000;
    const tick = () => {
      apiGet(
        `/api/v1/public/crm-chat/conversations/${session.conversationId}/messages?limit=80`,
        session.visitorToken
      ).then(fresh => {
        failRef.current = 0;
        setNetAlive(true); // network is fine even if WS isn't — don't scare the user
        if (!fresh) return;
        setMessages(prev => {
          const map = new Map<string, Message>();
          // 1. Add fresh messages from server
          fresh.forEach(m => map.set(m.id, m));
          // 2. Preserve local temporary messages not yet in server list
          prev.forEach(m => {
            if (!map.has(m.id)) {
              const alreadyInServer = fresh.some(sf => sf.body === m.body && sf.senderRole === m.senderRole);
              if (!alreadyInServer) map.set(m.id, m);
            }
          });
          const merged = Array.from(map.values()).sort((a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );

          // Check for new agent messages to update unread badge
          if (!isOpen) {
            const existingAgentIds = new Set(prev.filter(m => m.senderRole === 'agent').map(m => m.id));
            const newAgentCount = fresh.filter(m => m.senderRole === 'agent' && !existingAgentIds.has(m.id)).length;
            if (newAgentCount > 0) setUnread(n => n + newAgentCount);
          }
          setIsTyping(false);
          return merged;
        });
      }).catch(() => {
        failRef.current += 1;
        // Only report disconnection after several consecutive failures
        if (failRef.current >= 2) setNetAlive(false);
      });
    };

    tick();
    pollRef.current = setInterval(tick, delay);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [session, isWsConnected, isOpen]);

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
      setNetAlive(true);
      const d = data?.data ?? data;
      const s: Session = { visitorToken: d.visitor_token, conversationId: Number(d.conversation_id) };
      saveSession(s);
      setSession(s);
      const history = await apiGet(`/api/v1/public/crm-chat/conversations/${s.conversationId}/messages?limit=80`, s.visitorToken);
      setMessages(history.length > 0 ? history : [{ id: String(Date.now()), senderRole: 'visitor', body: newAns.msg, createdAt: new Date().toISOString() }]);
      setPhase('chat');
    } catch (ex: any) {
      setNetAlive(false);
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
    const tempId = `temp_${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, senderRole: 'visitor', body, createdAt: new Date().toISOString() }]);
    setInput('');
    setSending(true);
    setIsTyping(true);
    try {
      await apiPost('/api/v1/public/crm-chat/messages', { visitor_token: session.visitorToken, conversation_id: session.conversationId, body }, session.visitorToken);
      setNetAlive(true);
      // Refresh messages immediately to get true server ID & any agent reply
      const fresh = await apiGet(`/api/v1/public/crm-chat/conversations/${session.conversationId}/messages?limit=80`, session.visitorToken);
      if (fresh && fresh.length > 0) {
        setMessages(fresh);
      }
    } catch {
      setNetAlive(false);
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

  /* Colors — tamasmarket state tokens */
  /* Visible status reflects REST reachability (polling), never the flaky WS */
  const orbColor = netAlive ? 'var(--tamas-success)' : 'var(--tamas-danger)';
  const toggleBottom = isMobile ? 80 : 24;
  const widgetBottom = isMobile ? 0 : 24;
  const widgetLeft   = isMobile ? 0 : 20;
  const widgetW      = isMobile ? '100vw' : 390;
  const widgetH      = isMobile ? '100svh' : 560;
  const widgetRadius = isMobile ? 0 : 'var(--tamas-radius-card)';

  const togglePress = pointerScale();

  const inputStyle: React.CSSProperties = {
    flex: 1, padding: '10px 16px',
    border: 'var(--tamas-border-w, 1px) solid var(--tamas-border)', borderRadius: 'var(--tamas-radius-pill, 980px)', fontSize: 12.5,
    background: 'var(--tamas-surface)', color: 'var(--tamas-fg)', outline: 'none',
    caretColor: 'var(--tamas-accent)',
    transition: 'border-color 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
    fontFamily: 'var(--tamas-font)',
  };

  const focusInput = (e: React.FocusEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    el.style.borderColor = 'var(--tamas-accent)';
    el.style.boxShadow = '0 0 0 3px rgba(8, 121, 143, 0.12)';
  };
  const blurInput = (e: React.FocusEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    el.style.borderColor = 'var(--tamas-border)';
    el.style.boxShadow = 'none';
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
          position: 'fixed', bottom: toggleBottom, left: 20,
          width: 58, height: 58, borderRadius: '50%',
          background: 'var(--tamas-promo-grad)',
          color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: '0 8px 22px rgba(8, 121, 143, 0.34)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, ...PRESS_SCALE,
        }}
        {...togglePress}
      >
        <img
          src="/logo.svg"
          alt="تماس"
          style={{
            width: 30, height: 30, objectFit: 'contain',
            filter: 'brightness(0) invert(1)',
            pointerEvents: 'none',
          }}
        />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: 'var(--tamas-danger)', color: '#fff', borderRadius: '50%',
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
        position: 'fixed', bottom: widgetBottom, left: widgetLeft,
        width: widgetW, height: widgetH,
        background: 'var(--tamas-surface)', borderRadius: widgetRadius,
        boxShadow: 'var(--tamas-shadow-lg), 0 4px 16px rgba(0, 0, 0, 0.06)',
        display: 'flex', flexDirection: 'column',
        zIndex: 9999, overflow: 'hidden',
        border: 'var(--tamas-border-w, 1px) solid var(--tamas-border)',
        fontFamily: 'var(--tamas-font)',
        animation: 'chatSlideUp 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
    >
      <style>{`
        @keyframes chatSlideUp { from{opacity:0;transform:translateY(20px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes msgIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dotBounce { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
        #crm-chat-widget *{box-sizing:border-box}
        #crm-chat-widget ::-webkit-scrollbar{width:4px}
        #crm-chat-widget ::-webkit-scrollbar-track{background:transparent}
        #crm-chat-widget ::-webkit-scrollbar-thumb{background:var(--tamas-border);border-radius:4px}
        #crm-chat-toggle:focus-visible,
        #crm-chat-widget button:focus-visible{outline:2px solid var(--tamas-accent);outline-offset:2px}
      `}</style>

      {/* Header — teal promo strip (Apple-style compact) */}
      <div style={{
        padding: '0 16px', height: 44,
        background: 'var(--tamas-promo-grad)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', width: 28, height: 28 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🎧</div>
            <span style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%', background: orbColor, border: '2px solid rgba(0, 0, 0, 0.1)', transition: 'background 0.4s' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13.5 }}>پشتیبانی تماس</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {phase === 'chat' && (
            <button
              type="button"
              onClick={handleEnd}
              style={{
                background: 'rgba(255,255,255,0.16)', border: 'none',
                color: '#fff', borderRadius: 'var(--tamas-radius-pill, 980px)', padding: '4px 12px', minHeight: 28,
                cursor: 'pointer', fontSize: 11, fontWeight: 700, ...PRESS_SCALE,
              }}
              {...pointerScale()}
            >پایان</button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="بستن چت"
            style={{
              background: 'transparent', border: 'none',
              color: '#fff', borderRadius: '50%', padding: 0, minHeight: 28, minWidth: 28,
              cursor: 'pointer', fontSize: 20, lineHeight: 1, fontWeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', ...PRESS_SCALE,
            }}
            {...pointerScale()}
          >×</button>
        </div>
      </div>

      {/* Intake */}
      {phase === 'intake' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--tamas-bg)' }}>
          <div ref={intakeScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
          </div>
          <form onSubmit={handleIntakeSubmit} style={{ padding: '10px 12px 14px', borderTop: 'var(--tamas-border-w, 1px) solid var(--tamas-border)', background: 'var(--tamas-surface)', flexShrink: 0 }}>
            {err && <div style={{ color: 'var(--tamas-danger)', fontSize: 12, marginBottom: 6, fontWeight: 500 }}>⚠️ {err}</div>}
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
                onFocus={focusInput}
                onBlur={blurInput}
              />
              <SendBtn disabled={sending || !input.trim()} loading={sending} />
            </div>
          </form>
        </div>
      )}

      {/* Chat */}
      {phase === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--tamas-bg)' }}>
          <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--tamas-muted)', padding: '32px 16px' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--tamas-fg)' }}>مکالمه شروع شد!</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>کارشناس ما به زودی پاسخ می‌دهد.</p>
              </div>
            )}
            {messages.map(msg =>
              msg.senderRole === 'visitor'
                ? <VisitorBubble key={msg.id} text={msg.body} time={msg.displayTime ?? formatTime(msg.createdAt)} />
                : <AgentBubble   key={msg.id} text={msg.body} time={msg.displayTime ?? formatTime(msg.createdAt)} />
            )}
            {isTyping && <TypingIndicator />}
          </div>
          <form onSubmit={handleSend} style={{ padding: '10px 12px 14px', borderTop: 'var(--tamas-border-w, 1px) solid var(--tamas-border)', background: 'var(--tamas-surface)', flexShrink: 0 }}>
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
                onFocus={focusInput}
                onBlur={blurInput}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e as any); } }}
              />
              <SendBtn disabled={sending || !input.trim()} loading={sending} />
            </div>
            {!netAlive && (
              <p style={{ fontSize: 11, color: 'var(--tamas-danger)', marginTop: 5, fontWeight: 500 }}>⚠️ اتصال قطع شده — در حال اتصال مجدد...</p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}