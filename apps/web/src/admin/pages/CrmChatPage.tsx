import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { AdminState } from '../components/AdminState';
import './crm-chat.css';

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

type Filter = 'all' | 'open' | 'closed';

const fa = (n: number) => n.toLocaleString('fa-IR');

function listOf<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function displayName(c: Conversation): string {
  const first = c.first_name || c.visitor_first_name || '';
  const last = c.last_name || c.visitor_last_name || '';
  return `${first} ${last}`.trim() || 'کاربر ناشناس';
}

function contactOf(c: Conversation): string | null {
  return c.phone || c.visitor_phone || c.email || c.visitor_email || null;
}

function initials(name: string): string {
  if (name === 'کاربر ناشناس') return '؟';
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join('‌');
}

/** A stable hue per conversation, so each avatar keeps its colour. */
function avatarHue(id: number): number {
  return (id * 47) % 360;
}

const isOpen = (status: string) => status !== 'closed' && status !== 'resolved' && status !== 'archived';

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return 'امروز';
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'دیروز';
  return new Intl.DateTimeFormat('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

/** List stamp: time today, «دیروز», weekday this week, otherwise the date. */
function listStamp(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (dayKey(iso) === dayKey(new Date().toISOString())) return timeOf(iso);
  if (days < 2 && dayLabel(iso) === 'دیروز') return 'دیروز';
  if (days < 7) return new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(d);
  return new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' }).format(d);
}

function Avatar({ c, size = 'md' }: { c: Conversation; size?: 'md' | 'sm' }) {
  const name = displayName(c);
  return (
    <span className={`crm-chat-avatar crm-chat-avatar--${size}`} style={{ '--hue': avatarHue(c.id) } as React.CSSProperties} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function CrmChatPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const streamRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const { data: convData, isLoading: isLoadingConvs, isError: isConvError, error: convError, refetch: refetchConvs } = useQuery({
    queryKey: ['admin', 'crm-chat-conversations'],
    queryFn: () => api.get<any>('/crm/chat/conversations'),
    refetchInterval: 15000,
  });
  const conversations = listOf<Conversation>(convData);

  const { data: msgData, isLoading: isLoadingMsgs, isError: isMsgError, error: msgError, refetch: refetchMsgs } = useQuery({
    queryKey: ['admin', 'crm-chat-messages', activeConvId],
    queryFn: () => api.get<any>(`/crm/chat/conversations/${activeConvId}/messages`),
    enabled: !!activeConvId,
    refetchInterval: 10000,
  });
  const messages = listOf<Message>(msgData);

  const sendMutation = useMutation({
    mutationFn: (text: string) => api.post(`/crm/chat/conversations/${activeConvId}/messages`, { body: text }),
    onSuccess: () => {
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'crm-chat-messages', activeConvId] });
    },
    onError: () => toast.error('پیام ارسال نشد؛ دوباره تلاش کنید.'),
  });

  const active = conversations.find((c) => c.id === activeConvId) ?? null;
  const openCount = conversations.filter((c) => isOpen(c.status)).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === 'open' && !isOpen(c.status)) return false;
      if (filter === 'closed' && isOpen(c.status)) return false;
      if (!q) return true;
      return `${displayName(c)} ${contactOf(c) ?? ''} ${c.id}`.toLowerCase().includes(q);
    });
  }, [conversations, search, filter]);

  // Day separators, and consecutive messages from one side grouped together.
  const rows = useMemo(() => {
    const out: ({ kind: 'day'; key: string; label: string } | { kind: 'msg'; m: Message; first: boolean; last: boolean })[] = [];
    messages.forEach((m, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      if (!prev || dayKey(prev.created_at) !== dayKey(m.created_at)) out.push({ kind: 'day', key: `d-${m.id}`, label: dayLabel(m.created_at) });
      const sameAsPrev = prev && prev.sender_role === m.sender_role && dayKey(prev.created_at) === dayKey(m.created_at);
      const sameAsNext = next && next.sender_role === m.sender_role && dayKey(next.created_at) === dayKey(m.created_at);
      out.push({ kind: 'msg', m, first: !sameAsPrev, last: !sameAsNext });
    });
    return out;
  }, [messages]);

  // Jump to the newest message when a conversation opens; follow new ones smoothly.
  const lastConvRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    const switched = lastConvRef.current !== activeConvId;
    lastConvRef.current = activeConvId;
    el.scrollTo({ top: el.scrollHeight, behavior: switched ? 'auto' : 'smooth' });
  }, [activeConvId, messages.length]);

  // The composer grows with its text, up to six lines.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [replyText]);

  useEffect(() => {
    if (activeConvId) composerRef.current?.focus();
  }, [activeConvId]);

  const send = () => {
    if (!replyText.trim() || !activeConvId || sendMutation.isPending) return;
    sendMutation.mutate(replyText);
  };
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    send();
  };
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="a-page a-fade crm-chat-page">
      <section className={`crm-chat${active ? ' has-active' : ''}`} aria-label="چت مشتریان">
        {/* Conversation list */}
        <aside className="crm-chat-list" aria-label="مکالمه‌ها">
          <header className="crm-chat-list__head">
            <h2>چت مشتریان</h2>
            <span className="crm-chat-list__count">{fa(conversations.length)} مکالمه</span>
          </header>

          <div className="crm-chat-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جست‌وجوی نام، شماره یا ایمیل…"
              aria-label="جست‌وجو در مکالمه‌ها"
            />
          </div>

          <div className="a-segmented crm-chat-filter" role="radiogroup" aria-label="فیلتر مکالمه‌ها">
            {([
              ['all', 'همه'],
              ['open', `باز${openCount ? ` ${fa(openCount)}` : ''}`],
              ['closed', 'بسته'],
            ] as [Filter, string][]).map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={filter === id} className={`a-seg${filter === id ? ' a-seg--on' : ''}`} onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
          </div>

          <div className="crm-chat-list__scroll">
            {isLoadingConvs ? (
              <AdminState compact kind="loading" />
            ) : isConvError ? (
              <AdminState compact kind="error" error={convError} onRetry={() => void refetchConvs()} />
            ) : conversations.length === 0 ? (
              <AdminState compact kind="empty" noun="مکالمه" />
            ) : visible.length === 0 ? (
              <AdminState compact kind="filtered" noun="مکالمه" />
            ) : (
              <ul className="crm-chat-rows">
                {visible.map((c) => {
                  const contact = contactOf(c);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="crm-chat-row"
                        aria-current={activeConvId === c.id ? 'true' : undefined}
                        onClick={() => setActiveConvId(c.id)}
                      >
                        <Avatar c={c} />
                        <span className="crm-chat-row__body">
                          <span className="crm-chat-row__top">
                            <b>{displayName(c)}</b>
                            <small>{listStamp(c.created_at)}</small>
                          </span>
                          <span className="crm-chat-row__bottom">
                            <span className={contact ? 'a-ltr' : undefined}>{contact ?? 'بدون اطلاعات تماس'}</span>
                            {isOpen(c.status) && <span className="crm-chat-row__open" aria-label="باز" />}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Thread */}
        <div className="crm-chat-thread">
          {!active ? (
            <div className="crm-chat-empty" role="status">
              <span className="crm-chat-empty__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                </svg>
              </span>
              <strong>یک مکالمه را انتخاب کنید.</strong>
              <span>پیام‌های مشتری این‌جا نمایش داده می‌شود و می‌توانید همین‌جا پاسخ دهید.</span>
            </div>
          ) : (
            <>
              <header className="crm-chat-thread__head">
                <button type="button" className="crm-chat-back a-btn a-btn--ghost a-btn--icon" onClick={() => setActiveConvId(null)} aria-label="بازگشت به فهرست مکالمه‌ها">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
                <Avatar c={active} size="sm" />
                <span className="crm-chat-thread__who">
                  <b>{displayName(active)}</b>
                  <small>
                    {contactOf(active) ? <span className="a-ltr">{contactOf(active)}</span> : 'بدون اطلاعات تماس'}
                    <span aria-hidden="true"> · </span>
                    مکالمهٔ {fa(active.id)}
                  </small>
                </span>
                <span className={`a-badge ${isOpen(active.status) ? 'a-badge--success' : 'a-badge--neutral'}`}>{isOpen(active.status) ? 'باز' : 'بسته'}</span>
              </header>

              <div className="crm-chat-stream" ref={streamRef} role="log" aria-live="polite" aria-label={`پیام‌های ${displayName(active)}`}>
                {isLoadingMsgs ? (
                  <AdminState compact kind="loading" />
                ) : isMsgError ? (
                  <AdminState compact kind="error" error={msgError} onRetry={() => void refetchMsgs()} />
                ) : messages.length === 0 ? (
                  <AdminState compact kind="empty" noun="پیام" text="اولین پیام را شما بفرستید." />
                ) : (
                  rows.map((row) => {
                    if (row.kind === 'day') {
                      return (
                        <div key={row.key} className="crm-chat-day" role="separator">
                          <span>{row.label}</span>
                        </div>
                      );
                    }
                    const { m, first, last } = row;
                    if (m.sender_role === 'system') {
                      return (
                        <div key={m.id} className="crm-chat-system">
                          <span>{m.body}</span>
                        </div>
                      );
                    }
                    const mine = m.sender_role === 'agent';
                    return (
                      <div key={m.id} className={`crm-chat-msg ${mine ? 'crm-chat-msg--mine' : 'crm-chat-msg--them'}${first ? ' is-first' : ''}${last ? ' is-last' : ''}`}>
                        <div className="crm-chat-bubble">
                          <span className="crm-chat-bubble__text">{m.body}</span>
                          <time className="crm-chat-bubble__time" dateTime={m.created_at}>
                            {timeOf(m.created_at)}
                            {mine && (
                              <svg viewBox="0 0 16 11" width="14" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" aria-label="ارسال شد">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m1 6 3 3 6-7M7 9l1 1 6-7" />
                              </svg>
                            )}
                          </time>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form className="crm-chat-composer" onSubmit={handleSubmit}>
                <textarea
                  ref={composerRef}
                  rows={1}
                  className="crm-chat-composer__field"
                  placeholder="پیام…"
                  aria-label="متن پاسخ به مشتری"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sendMutation.isPending}
                />
                <button
                  type="submit"
                  className="crm-chat-send"
                  disabled={sendMutation.isPending || !replyText.trim()}
                  aria-busy={sendMutation.isPending || undefined}
                  aria-label={sendMutation.isPending ? 'در حال ارسال…' : 'ارسال پیام'}
                >
                  {sendMutation.isPending ? (
                    <span className="crm-chat-send__spin" aria-hidden="true" />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                  )}
                </button>
              </form>
              <p className="crm-chat-hint">Enter برای ارسال · Shift+Enter برای خط تازه</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
