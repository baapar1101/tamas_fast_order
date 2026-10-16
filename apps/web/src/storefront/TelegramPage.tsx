import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';

interface TelegramStatus {
  enabled: boolean;
  botUsername: string;
  account: { linked: boolean; username?: string | null; linkedAt?: string; notificationsEnabled?: boolean };
}

export function TelegramPage() {
  const user = useAuth((state) => state.user);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const status = useQuery({
    queryKey: ['customer-telegram-status', user?.id ?? null],
    queryFn: () => api.get<TelegramStatus>('/customer-telegram/status'),
    enabled: user?.role === 'customer',
  });

  const connect = async () => {
    const telegramWindow = window.open('about:blank', '_blank');
    if (telegramWindow) telegramWindow.opener = null;
    setBusy(true);
    try {
      const result = await api.post<{ url: string }>('/customer-telegram/link');
      if (telegramWindow) telegramWindow.location.replace(result.url);
      else window.location.assign(result.url);
      toast.show('پس از زدن Start در ربات، وضعیت اتصال این صفحه را بررسی کنید.');
    } catch (error) {
      telegramWindow?.close();
      toast.error((error as Error).message);
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (!window.confirm('اتصال حساب تلگرام قطع شود؟')) return;
    setBusy(true);
    try {
      await api.del('/customer-telegram/link');
      await queryClient.invalidateQueries({ queryKey: ['customer-telegram-status', user?.id ?? null] });
      toast.ok('اتصال ربات تلگرام قطع شد.');
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(false); }
  };

  if (user?.role !== 'customer') return <div className="card account-state">این بخش مخصوص حساب مشتریان است.</div>;
  if (status.isLoading) return <div className="card account-state">در حال بررسی اتصال تلگرام…</div>;
  if (status.error) return <div className="card account-state">دریافت وضعیت ربات ممکن نشد.</div>;
  if (!status.data?.enabled) return <div className="card account-state"><h2>ربات مشتریان فعلاً غیرفعال است</h2><p>پس از فعال‌سازی توسط مدیریت، امکان اتصال از همین صفحه فراهم می‌شود.</p></div>;

  const linked = status.data.account.linked;
  return (
    <section className="card account-telegram-card">
      <div className="account-telegram-logo" aria-hidden="true">✈</div>
      <div>
        <span className={`account-status-pill ${linked ? 'is-linked' : ''}`}>{linked ? 'متصل' : 'متصل نشده'}</span>
        <h2>ربات تلگرام تماس مارکت</h2>
        <p>{linked ? 'اعلان سفارش، پرداخت، کیف پول و اعتبار برای حساب شما فعال است.' : 'برای پیگیری سریع سفارش‌ها و دریافت اعلان‌های حساب، ربات را متصل کنید.'}</p>
        {linked ? (
          <dl className="account-telegram-details">
            <div><dt>حساب تلگرام</dt><dd dir="ltr">{status.data.account.username ? `@${status.data.account.username}` : 'متصل'}</dd></div>
            <div><dt>اعلان‌ها</dt><dd>{status.data.account.notificationsEnabled ? 'فعال' : 'غیرفعال از داخل ربات'}</dd></div>
            {status.data.account.linkedAt ? <div><dt>تاریخ اتصال</dt><dd>{new Date(status.data.account.linkedAt).toLocaleString('fa-IR')}</dd></div> : null}
          </dl>
        ) : null}
        <div className="account-telegram-actions">
          {linked ? (
            <>
              <a className="btn primary" href={`https://t.me/${status.data.botUsername}`} target="_blank" rel="noreferrer">باز کردن ربات</a>
              <button type="button" className="btn danger" disabled={busy} onClick={() => void disconnect()}>قطع اتصال</button>
            </>
          ) : (
            <button type="button" className="btn primary" disabled={busy} onClick={() => void connect()}>{busy ? 'در حال ساخت لینک…' : 'اتصال امن به تلگرام'}</button>
          )}
          <button type="button" className="btn ghost" disabled={status.isFetching} onClick={() => void status.refetch()}>بررسی مجدد وضعیت</button>
        </div>
      </div>
    </section>
  );
}
