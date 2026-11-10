import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatNumber, type FunnelReportDTO, type FunnelStepDTO } from '@tamas/shared';
import { api } from '../../lib/api';
import { FUNNEL_MIN_WIDTH as MIN_WIDTH, funnelWidths } from './funnelGeometry';
import './funnel-infographic.css';

const PERIODS = [
  { days: 1, label: '۲۴ ساعت' },
  { days: 7, label: '۷ روز' },
  { days: 30, label: '۳۰ روز' },
] as const;

function pct(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

function faPct(value: number | null): string {
  if (value == null) return '—';
  const rounded = value >= 10 || value === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded.toLocaleString('fa-IR')}٪`;
}

function trapezoid(top: number, bottom: number): string {
  const l1 = (100 - top) / 2;
  const l2 = (100 - bottom) / 2;
  return `polygon(${l1}% 0, ${100 - l1}% 0, ${100 - l2}% 100%, ${l2}% 100%)`;
}

export function FunnelInfographic() {
  const [days, setDays] = useState<1 | 7 | 30>(7);
  const [active, setActive] = useState<number | null>(null);

  const report = useQuery({
    queryKey: ['admin', 'funnel', days],
    queryFn: async () => (await api.get<{ report: FunnelReportDTO }>('/admin/funnel', { days })).report,
    refetchInterval: 60_000,
  });

  const all = report.data?.steps ?? [];
  const loggedIn = all.find((step) => step.key === 'logged_in')?.people ?? 0;
  const steps = all.filter((step) => step.key !== 'logged_in');
  const widths = funnelWidths(steps);
  const top = steps[0]?.people ?? 0;
  const last = steps.at(-1)?.people ?? 0;

  // The step that loses the largest share of the people who reached the one before it.
  const worstStep = steps.reduce<{ index: number; loss: number } | null>((worst, step, index) => {
    const before = index > 0 ? steps[index - 1]!.people : 0;
    if (!before) return worst;
    const loss = Math.max(0, 1 - step.people / before);
    return !worst || loss > worst.loss ? { index, loss } : worst;
  }, null);

  return (
    <section className="a-card funnel-infographic" aria-labelledby="funnel-infographic-title">
      <div className="a-card-head a-card-head--split">
        <div>
          <h3 className="a-card-title" id="funnel-infographic-title">قیف فروش سایت</h3>
          <p className="a-card-desc">
            از بازدید تا پرداخت؛ عدد داخل هر لایه تعداد افراد یکتاست و عرض لایه نشان می‌دهد چند نفر تا آن مرحله مانده‌اند.
          </p>
        </div>
        <nav className="a-segmented" aria-label="بازهٔ قیف فروش">
          {PERIODS.map((period) => (
            <button
              key={period.days}
              type="button"
              className={`a-seg${days === period.days ? ' a-seg--on' : ''}`}
              aria-pressed={days === period.days}
              onClick={() => setDays(period.days)}
            >
              {period.label}
            </button>
          ))}
        </nav>
      </div>

      {report.isLoading ? (
        <div className="funnel-ig-skeleton" aria-hidden="true">
          {[100, 84, 70, 58, 48, 40, 34].map((width) => <span key={width} style={{ width: `${width}%` }} />)}
        </div>
      ) : report.isError ? (
        <div className="a-alert a-alert--error m-4">دریافت آمار قیف فروش ناموفق بود.</div>
      ) : top === 0 ? (
        <div className="a-empty">در این بازه هنوز بازدیدی ثبت نشده است. آمار از لحظهٔ فعال‌شدن ردیابی جمع می‌شود.</div>
      ) : (
        <>
          <div className="funnel-ig-summary">
            <div className="funnel-ig-kpi">
              <span className="funnel-ig-kpi-label">بازدیدکنندهٔ یکتا</span>
              <strong>{formatNumber(top)}</strong>
              <span className="funnel-ig-kpi-note">{formatNumber(loggedIn)} نفر با حساب کاربری</span>
            </div>
            <div className="funnel-ig-kpi">
              <span className="funnel-ig-kpi-label">پرداخت‌شده</span>
              <strong>{formatNumber(last)}</strong>
              <span className="funnel-ig-kpi-note">نرخ تبدیل کل {faPct(pct(last, top))}</span>
            </div>
            <div className="funnel-ig-kpi">
              <span className="funnel-ig-kpi-label">بیشترین ریزش</span>
              <strong className="funnel-ig-kpi-text">{worstStep ? steps[worstStep.index]!.label : '—'}</strong>
              <span className="funnel-ig-kpi-note">
                {worstStep ? `${faPct(worstStep.loss * 100)} از ${steps[worstStep.index - 1]!.label} جلوتر نرفتند` : 'ریزشی ثبت نشده'}
              </span>
            </div>
          </div>

          <ol className="funnel-ig" aria-label="مراحل قیف فروش">
            {steps.map((step, index) => {
              const previous = index > 0 ? steps[index - 1]!.people : null;
              const stepRate = previous == null ? null : pct(step.people, previous);
              const dropped = previous == null ? 0 : Math.max(0, previous - step.people);
              const bottom = widths[index + 1] ?? Math.max(MIN_WIDTH - 6, widths[index]! * 0.82);
              const isWorst = worstStep?.index === index;
              const description = `${step.label}: ${formatNumber(step.people)} نفر، ${faPct(pct(step.people, top))} از کل بازدیدها${
                previous == null ? '' : `، ${faPct(stepRate)} از مرحلهٔ قبل، ریزش ${formatNumber(dropped)} نفر`}`;
              return (
                <li
                  key={step.key}
                  className={`funnel-ig-row${active === index ? ' is-active' : ''}${isWorst ? ' is-worst' : ''}`}
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                >
                  <div className="funnel-ig-label">
                    <span className="funnel-ig-index">{(index + 1).toLocaleString('fa-IR')}</span>
                    <span>{step.label}</span>
                  </div>

                  <div
                    className="funnel-ig-band-wrap"
                    tabIndex={0}
                    role="img"
                    aria-label={description}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                  >
                    <div className="funnel-ig-band" style={{ clipPath: trapezoid(widths[index]!, bottom) }} />
                    <span className="funnel-ig-count">{formatNumber(step.people)}</span>
                    {active === index && (
                      <div className="funnel-ig-tip" role="presentation">
                        <strong>{step.label}</strong>
                        <span>{formatNumber(step.people)} نفر</span>
                        <span>{faPct(pct(step.people, top))} از کل بازدیدکنندگان</span>
                        {previous != null && <span>{faPct(stepRate)} از مرحلهٔ قبل · ریزش {formatNumber(dropped)} نفر</span>}
                      </div>
                    )}
                  </div>

                  <div className="funnel-ig-rate">
                    {previous == null ? (
                      <span className="funnel-ig-rate-main">۱۰۰٪</span>
                    ) : (
                      <>
                        <span className="funnel-ig-rate-main">{faPct(stepRate)}</span>
                        <span className="funnel-ig-rate-drop">{dropped ? `${formatNumber(dropped)} نفر ریزش` : 'بدون ریزش'}</span>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="funnel-ig-foot">
            <span>درصد کنار هر لایه: سهم افرادی که از مرحلهٔ قبل به این مرحله رسیده‌اند.</span>
            <Link to="/admin/funnel" className="a-btn a-btn--secondary a-btn--xs">فهرست مشتریان و پیگیری خودکار</Link>
          </div>
        </>
      )}
    </section>
  );
}
