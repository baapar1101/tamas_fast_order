import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatNumber, type FunnelAutomationConfig, type FunnelMessageKind, type FunnelReportDTO, type FunnelSegment, type FunnelUserRowDTO } from '@tamas/shared';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../store/auth';
import './funnel-page.css';

const PERIODS = [
  { days: 1, label: '۲۴ ساعت اخیر' },
  { days: 7, label: '۷ روز اخیر' },
  { days: 30, label: '۳۰ روز اخیر' },
] as const;

const SEGMENTS: { id: FunnelSegment; label: string; hint: string }[] = [
  { id: 'browsed', label: 'مرور بدون خرید', hint: 'وارد شده‌اند و کالاها را اسکرول یا مشاهده کرده‌اند، ولی چیزی به سبد اضافه نکرده‌اند.' },
  { id: 'cart', label: 'سبد خرید رهاشده', hint: 'کالا به سبد اضافه کرده‌اند ولی بعد از آن سفارشی ثبت نکرده‌اند.' },
  { id: 'unpaid', label: 'سفارش پرداخت‌نشده', hint: 'سفارش ثبت کرده‌اند ولی پرداخت انجام نشده است (به‌جز سفارش‌های لغوشده).' },
];

const MESSAGE_LABELS: Record<FunnelMessageKind, string> = {
  cart_reminder_1: 'یادآوری اول سبد (۱ ساعت بعد)',
  cart_reminder_2: 'یادآوری دوم سبد (۲۴ ساعت بعد)',
  unpaid_order: 'یادآوری پرداخت سفارش',
  browse_nudge: 'پیشنهاد به مرورکنندگان',
};

const AUTOMATION_OPTIONS: { key: keyof FunnelAutomationConfig; title: string; desc: string }[] = [
  { key: 'abandonedCart', title: 'یادآوری سبد خرید رهاشده', desc: 'یک ساعت و ۲۴ ساعت بعد از آخرین تغییر سبد، اگر سفارشی ثبت نشده باشد (حداکثر ۲ پیام در هفته).' },
  { key: 'unpaidOrder', title: 'یادآوری پرداخت سفارش', desc: '۲ ساعت بعد از ثبت سفارش نقدی پرداخت‌نشده، یک بار؛ برای سفارش‌های چکی، اعتباری یا دارای رسید ارسال نمی‌شود.' },
  { key: 'browseNudge', title: 'پیشنهاد به مرورکنندگان بدون خرید', desc: '۳ ساعت بعد از مرور کالاها بدون افزودن به سبد؛ حداکثر هفته‌ای یک بار برای هر مشتری.' },
  { key: 'smsFallback', title: 'پیامک برای مشتریان بدون ربات', desc: 'اول از ربات تلگرام/بله و اپ ارسال می‌شود؛ اگر مشتری ربات متصل نداشته باشد، پیامک می‌رود (هزینهٔ پیامک دارد).' },
];

function percent(part: number, whole: number): string {
  if (!whole) return '—';
  return `${Math.round((part / whole) * 100).toLocaleString('fa-IR')}٪`;
}

function dateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' });
}

export function FunnelPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canEditSettings = useAuth((state) => state.hasPermission('manage_settings'));
  const [days, setDays] = useState<1 | 7 | 30>(7);
  const [segment, setSegment] = useState<FunnelSegment>('cart');

  const report = useQuery({
    queryKey: ['admin', 'funnel', days],
    queryFn: async () => (await api.get<{ report: FunnelReportDTO }>('/admin/funnel', { days })).report,
    refetchInterval: 60_000,
  });

  const users = useQuery({
    queryKey: ['admin', 'funnel', 'users', segment, days],
    queryFn: async () => (await api.get<{ users: FunnelUserRowDTO[] }>('/admin/funnel/users', { segment, days })).users,
  });

  const saveAutomation = useMutation({
    mutationFn: (config: FunnelAutomationConfig) => api.put<{ message: string }>('/admin/funnel/automation', config),
    onSuccess: (result) => {
      toast.ok(result.message);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'funnel'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'ذخیره ناموفق بود.'),
  });

  // Logged-in visits are a subset of visits, not a stage of their own.
  const allSteps = report.data?.steps ?? [];
  const loggedIn = allSteps.find((step) => step.key === 'logged_in')?.people ?? 0;
  const steps = allSteps.filter((step) => step.key !== 'logged_in');
  const top = steps[0]?.people ?? 0;
  const automation = report.data?.automation;
  const activeSegment = SEGMENTS.find((item) => item.id === segment)!;

  return (
    <div className="a-page a-fade funnel-page">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">قیف فروش</h2>
          <p className="a-subtitle">از ورود به سایت تا پرداخت: هر مشتری کجا متوقف شده و پیگیری خودکار چه نتیجه‌ای داشته است</p>
        </div>
        <div className="a-page-actions">
          <nav className="a-segmented" aria-label="بازهٔ زمانی">
            {PERIODS.map((period) => (
              <button key={period.days} type="button" className={`a-seg${days === period.days ? ' a-seg--on' : ''}`} onClick={() => setDays(period.days)}>
                {period.label}
              </button>
            ))}
          </nav>
        </div>
      </section>

      <section className="a-card">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">مراحل قیف</h3>
            <p className="a-card-desc">
              تعداد افراد یکتا در هر مرحله؛ درصد هر مرحله نسبت به مرحلهٔ قبل است.
              {report.data?.trackingSince && ` ثبت رفتار کاربران از ${dateTime(report.data.trackingSince)} شروع شده است.`}
            </p>
          </div>
        </div>
        {report.isLoading ? (
          <div className="p-6"><div className="a-skeleton a-skeleton--text" /></div>
        ) : report.isError ? (
          <div className="a-alert a-alert--error m-4">دریافت گزارش قیف ناموفق بود.</div>
        ) : (
          <ol className="funnel-steps">
            {steps.map((step, index) => {
              const previous = index > 0 ? steps[index - 1]!.people : step.people;
              const width = top ? Math.max(4, Math.round((step.people / top) * 100)) : 4;
              return (
                <li key={step.key} className="funnel-step">
                  <div className="funnel-step-label">
                    <span className="funnel-step-index">{(index + 1).toLocaleString('fa-IR')}</span>
                    {step.label}
                  </div>
                  <div className="funnel-step-bar" aria-hidden="true"><span style={{ width: `${width}%` }} /></div>
                  <div className="funnel-step-value">
                    <strong>{formatNumber(step.people)}</strong>
                    <span>{index === 0 ? `نفر (${formatNumber(loggedIn)} با حساب)` : percent(step.people, previous)}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="a-card">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">فهرست مشتریان در هر مرحله</h3>
            <p className="a-card-desc">{activeSegment.hint}</p>
          </div>
          <nav className="a-segmented" aria-label="بخش قیف">
            {SEGMENTS.map((item) => (
              <button key={item.id} type="button" className={`a-seg${segment === item.id ? ' a-seg--on' : ''}`} onClick={() => setSegment(item.id)}>
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        {users.isLoading ? (
          <div className="p-6"><div className="a-skeleton a-skeleton--text" /></div>
        ) : !users.data?.length ? (
          <div className="a-empty">در این بازه کسی در این مرحله نیست.</div>
        ) : (
          <div className="a-table-wrap">
            <table className="a-table funnel-table">
              <thead>
                <tr>
                  <th>مشتری</th>
                  <th>موبایل</th>
                  <th>فروشگاه</th>
                  <th>آخرین فعالیت</th>
                  {segment === 'browsed' && <><th>مشاهدهٔ کالا</th><th>اسکرول</th></>}
                  {segment === 'cart' && <><th>کالای سبد</th><th>مبلغ سبد</th></>}
                  {segment === 'unpaid' && <><th>سفارش</th><th>مبلغ</th></>}
                  <th>پیگیری خودکار</th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((row) => (
                  <tr key={`${row.userId}-${row.orderId ?? ''}`}>
                    <td>{row.name || '—'}</td>
                    <td><a className="a-ltr" href={`tel:${row.phone}`}>{row.phone}</a></td>
                    <td>{row.storeName || '—'}</td>
                    <td>{dateTime(row.lastActivityAt)}</td>
                    {segment === 'browsed' && <><td>{formatNumber(row.productViews)}</td><td>{formatNumber(row.scrolls)}</td></>}
                    {segment === 'cart' && <><td>{row.cartItems ? formatNumber(row.cartItems) : 'خالی شده'}</td><td>{row.cartTotal ? `${formatNumber(row.cartTotal)} تومان` : '—'}</td></>}
                    {segment === 'unpaid' && <><td className="a-ltr">{row.orderCode}</td><td>{formatNumber(row.orderTotal ?? 0)} تومان</td></>}
                    <td>{row.messagesSent ? `${formatNumber(row.messagesSent)} پیام، آخرین: ${dateTime(row.lastMessageAt)}` : 'ارسال نشده'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="funnel-grid">
        <section className="a-card">
          <div className="a-card-head">
            <div>
              <h3 className="a-card-title">پیگیری خودکار</h3>
              <p className="a-card-desc">پیام‌ها فقط بین ساعت ۹ تا ۲۱ ارسال می‌شوند و هر پیام فقط یک بار برای هر مشتری می‌رود.</p>
            </div>
          </div>
          <div className="funnel-options">
            {AUTOMATION_OPTIONS.map((option) => (
              <div key={option.key} className="a-option-row">
                <div className="a-option-copy">
                  <div className="a-option-title">{option.title}</div>
                  <div className="a-option-desc">{option.desc}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  className="a-switch"
                  aria-label={option.title}
                  aria-checked={Boolean(automation?.[option.key])}
                  disabled={!automation || !canEditSettings || saveAutomation.isPending}
                  onClick={() => automation && saveAutomation.mutate({ ...automation, [option.key]: !automation[option.key] })}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="a-card">
          <div className="a-card-head">
            <div>
              <h3 className="a-card-title">نتیجهٔ پیام‌های خودکار</h3>
              <p className="a-card-desc">«خرید پس از پیام» یعنی مشتری تا ۳ روز بعد از پیام سفارش ثبت کرده (یا برای یادآوری پرداخت، سفارش را پرداخته) است.</p>
            </div>
          </div>
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>پیام</th><th>ارسال</th><th>تحویل</th><th>خرید پس از پیام</th></tr></thead>
              <tbody>
                {(report.data?.messages ?? []).map((item) => (
                  <tr key={item.kind}>
                    <td>{MESSAGE_LABELS[item.kind]}</td>
                    <td>{formatNumber(item.sent)}</td>
                    <td>{formatNumber(item.delivered)}</td>
                    <td>{formatNumber(item.converted)} <span className="funnel-muted">({percent(item.converted, item.sent)})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
