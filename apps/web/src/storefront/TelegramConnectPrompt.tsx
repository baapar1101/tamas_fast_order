import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import './telegram-connect.css';

interface TelegramStatus {
  enabled: boolean;
  botUsername: string;
  popup: { title: string; text: string; button: string };
  account: { linked: boolean; username?: string | null; linkedAt?: string };
}

interface LinkResponse {
  url: string;
  expiresAt: string;
}

function wasDismissed(key: string): boolean {
  try { return Boolean(key && sessionStorage.getItem(key)); } catch { return false; }
}

function rememberDismissed(key: string): void {
  try { if (key) sessionStorage.setItem(key, '1'); } catch { /* private browsing can reject storage */ }
}

export function TelegramConnectPrompt() {
  const toast = useToast();
  const { user, ready } = useAuth();
  const customerId = ready && user?.role === 'customer' ? user.id : null;
  const storageKey = customerId ? `tamas_telegram_prompt_dismissed:${customerId}` : '';
  const [dismissed, setDismissed] = useState(() => wasDismissed(storageKey));
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDismissed(wasDismissed(storageKey));
    setWaiting(false);
  }, [storageKey]);

  const status = useQuery({
    queryKey: ['customer-telegram-status', customerId],
    queryFn: () => api.get<TelegramStatus>('/customer-telegram/status'),
    enabled: customerId !== null,
    staleTime: 30_000,
    refetchInterval: waiting ? 3_000 : false,
  });
  const baleStatus = useQuery({
    queryKey: ['customer-bale-status', customerId],
    queryFn: () => api.get<Omit<TelegramStatus, 'popup'>>('/customer-bale/status'),
    enabled: customerId !== null,
    staleTime: 30_000,
    refetchInterval: waiting ? 3_000 : false,
  });

  const linked = status.data?.account.linked === true;
  useEffect(() => {
    if (!waiting || (!linked && baleStatus.data?.account.linked !== true)) return;
    setWaiting(false);
    toast.ok('حساب پیام‌رسان شما با موفقیت متصل شد.');
  }, [baleStatus.data?.account.linked, linked, toast, waiting]);

  const close = () => {
    rememberDismissed(storageKey);
    setDismissed(true);
  };

  const connect = async () => {
    const telegramWindow = window.open('about:blank', '_blank');
    if (telegramWindow) telegramWindow.opener = null;
    setBusy(true);
    try {
      const result = await api.post<LinkResponse>('/customer-telegram/link');
      if (telegramWindow) telegramWindow.location.replace(result.url);
      else window.location.assign(result.url);
      setWaiting(true);
    } catch (error) {
      telegramWindow?.close();
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const connectBale = async () => {
    const target = window.open('about:blank', '_blank');
    if (target) target.opener = null;
    setBusy(true);
    try {
      const result = await api.post<LinkResponse>('/customer-bale/link');
      if (target) target.location.replace(result.url); else window.location.assign(result.url);
      setWaiting(true);
    } catch (error) { target?.close(); toast.error((error as Error).message); }
    finally { setBusy(false); }
  };

  const baleLinked = baleStatus.data?.account.linked === true;
  const open = Boolean(customerId && !dismissed && ((status.data?.enabled && !linked) || (baleStatus.data?.enabled && !baleLinked)));
  const popup = status.data?.popup;

  return (
    <Modal
      open={open}
      size="sm"
      title={popup?.title ?? 'اتصال به ربات تلگرام تماس مارکت'}
      onClose={close}
      busy={busy}
      footer={(
        <div className="telegram-connect-actions">
          <button type="button" className="btn ghost" onClick={close} disabled={busy}>فعلاً نه</button>
          <button type="button" className="btn primary" onClick={() => void connect()} disabled={busy}>
            {busy ? 'در حال ساخت لینک…' : waiting ? 'باز کردن دوباره تلگرام' : (popup?.button ?? 'اتصال امن به تلگرام')}
          </button>
          {baleStatus.data?.enabled && !baleLinked && <button type="button" className="btn primary" onClick={() => void connectBale()} disabled={busy}>اتصال امن به بله</button>}
        </div>
      )}
    >
      <div className="telegram-connect" dir="rtl">
        <div className="telegram-connect-logo" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M21.7 3.2 18.5 19c-.24 1.12-.87 1.4-1.76.87l-4.88-3.6-2.36 2.27c-.26.26-.48.48-.98.48l.35-4.98 9.06-8.19c.4-.35-.08-.55-.61-.2L6.12 12.7l-4.82-1.5c-1.05-.33-1.07-1.05.22-1.56L20.37 2.4c.87-.32 1.64.2 1.33.8Z" /></svg>
        </div>
        <p>{popup?.text ?? 'با اتصال حساب، وضعیت سفارش‌ها و پرداخت‌های خود را سریع و امن در تلگرام دریافت کنید.'}</p>
        <ul>
          <li>اعلان لحظه‌ای سفارش، پرداخت، اعتبار و کیف پول</li>
          <li>مشاهده سفارش‌ها و وضعیت حساب از داخل ربات</li>
          <li>امکان مدیریت جداگانه هر نوع اعلان</li>
        </ul>
        {waiting ? (
          <div className="telegram-connect-wait" role="status">
            <span className="telegram-connect-spinner" aria-hidden="true" />
            <div>
              <strong>منتظر تأیید در تلگرام هستیم</strong>
              <small>در ربات دکمه Start را بزنید. اگر لینک باز نشد، شماره تماس خودتان را با دکمه داخل ربات به اشتراک بگذارید.</small>
            </div>
          </div>
        ) : (
          <p className="telegram-connect-note">لینک اتصال یک‌بارمصرف است و پس از ۱۰ دقیقه منقضی می‌شود. فقط شماره متعلق به حساب تلگرام خودتان پذیرفته خواهد شد.</p>
        )}
      </div>
    </Modal>
  );
}
