import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { OrderDTO, PaymentTermsQuoteResult } from "@tamas/shared";
import { WAREHOUSE_LABELS, formatMoney, formatNumber, repricePaymentPlan } from "@tamas/shared";
import { Price } from "../components/Price";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import { ApiRequestError, api } from "../lib/api";
import { useAuth } from "../store/auth";
import { cartTotal, useCart } from "../store/cart";
import { Icon } from "../components/Icon";
import { useBootstrap } from "./hooks";
import { parsePaymentMethods } from "../lib/payment-methods";
import { readAttribution } from "../lib/attribution";

interface Props {
  onCancel: () => void;
  onFinished: () => void;
  /** Opens the profile step when the server says the account is incomplete. */
  onNeedsProfile: () => void;
}

interface OrderResponse {
  order: OrderDTO;
  message: string;
}

/** Payment method definitions */
const PAYMENT_METHODS = [
  {
    id: "aqayepardakht",
    label: "پرداخت آنلاین (درگاه بانکی)",
    desc: "تسویه از طریق درگاه امن بانکی و تایید آنی سفارش",
  },
  {
    id: "online",
    label: "کارت به کارت / واریز به حساب",
    desc: "تسویه به صورت دستی و ثبت فیش در واتساپ",
  },
  {
    id: "credit_weekly",
    label: "اعتباری هفتگی",
    desc: "تسویه پنجشنبه‌ها (نیاز به تأیید واحد مالی)",
  },
  {
    id: "check_2_month",
    label: "چکی دو ماهه",
    desc: "با ارائه چک صیادی و ثبت قرارداد",
  },
  {
    id: "check_4_month",
    label: "چکی چهار ماهه",
    desc: "مخصوص سفارشات عمده (با تأیید مالی)",
  },
] as const;

/** Secondary form instructions by payment method */
const SECONDARY_INFO: Record<
  string,
  {
    title: string;
    instructions: string[];
    fields: Array<{
      key: string;
      label: string;
      placeholder: string;
      type?: string;
    }>;
  }
> = {
  online: {
    title: "اطلاعات واریز — کارت به کارت",
    instructions: [
      "مبلغ سفارش را به شماره حساب زیر واریز کنید:",
      "💳 بانک ملت — به نام حمید قاسم زاده",
      "💳 شماره کارت: 6104-3311-4877-4871",
      "💳 شماره شبا: IR980120010000007697585463",
      "💳 شماره حساب: 7697 5854 63",
      "پس از واریز، می‌توانید رسید واریز را آپلود کرده یا اطلاعات فیش را وارد کنید.",
    ],
    fields: [
      {
        key: "receiptImageUrl",
        label: "آپلود رسید (تصویر)",
        placeholder: "انتخاب فایل",
        type: "file",
      },
      {
        key: "receiptNote",
        label: "متن دلخواه یا شماره پیگیری",
        placeholder: "متن دلخواه، ساعت واریز یا کد رهگیری",
      },
    ],
  },
  credit_weekly: {
    title: "تأیید خرید اعتباری هفتگی",
    instructions: [
      "سفارش شما با روش اعتباری هفتگی ثبت شد.",
      "تسویه حساب هر پنجشنبه انجام می‌شود.",
      "لطفاً اطلاعات تکمیلی زیر را وارد کنید:",
    ],
    fields: [
      {
        key: "businessName",
        label: "نام فروشگاه / کسب‌وکار",
        placeholder: "نام تجاری",
      },
      {
        key: "creditNote",
        label: "توضیحات (اختیاری)",
        placeholder: "توضیح اضافی",
      },
    ],
  },
  check_2_month: {
    title: "ثبت اطلاعات چک — دو ماهه",
    instructions: [
      "سفارش شما با روش چکی دو ماهه ثبت شد.",
      "لطفاً اطلاعات چک صیادی را وارد کنید:",
    ],
    fields: [
      {
        key: "checkNumber",
        label: "شماره چک صیادی",
        placeholder: "شماره ۱۶ رقمی چک",
      },
      {
        key: "checkBankName",
        label: "نام بانک",
        placeholder: "مثال: بانک ملت",
      },
      { key: "receiptImageUrl", label: "تصویر چک (اختیاری)", placeholder: "انتخاب فایل", type: "file" },
      { key: "checkNote", label: "توضیحات (اختیاری)", placeholder: "" },
    ],
  },
  check_4_month: {
    title: "ثبت اطلاعات چک — چهار ماهه",
    instructions: [
      "سفارش شما با روش چکی چهار ماهه ثبت شد.",
      "لطفاً اطلاعات چک صیادی را وارد کنید:",
    ],
    fields: [
      {
        key: "checkNumber",
        label: "شماره چک صیادی",
        placeholder: "شماره ۱۶ رقمی چک",
      },
      {
        key: "checkBankName",
        label: "نام بانک",
        placeholder: "مثال: بانک ملت",
      },
      { key: "receiptImageUrl", label: "تصویر چک (اختیاری)", placeholder: "انتخاب فایل", type: "file" },
      { key: "checkNote", label: "توضیحات (اختیاری)", placeholder: "" },
    ],
  },
};

export function CheckoutFlow({ onCancel, onFinished, onNeedsProfile }: Props) {
  const toast = useToast();
  const user = useAuth((s) => s.user);
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);

  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [discountCode, setDiscountCode] = useState('');
  const [discountQuote, setDiscountQuote] = useState<{ amount: number; freeShipping: boolean } | null>(null);
  const [discountBusy, setDiscountBusy] = useState(false);

  // Secondary form state (post-order)
  const [completedOrder, setCompletedOrder] = useState<OrderDTO | null>(null);
  const [completedMethod, setCompletedMethod] = useState("");
  const [secondaryData, setSecondaryData] = useState<Record<string, string>>({});
  const [secondaryBusy, setSecondaryBusy] = useState(false);

  const bootstrap = useBootstrap();
  const total = cartTotal(lines);
  const walletQuery = useQuery({
    queryKey: ['wallet', 'checkout', user?.id ?? null],
    queryFn: () => api.get<{ wallet: { balance: number; isFrozen: boolean }; config: { enabled: boolean; orderPaymentEnabled: boolean } }>('/wallet'),
    enabled: Boolean(user),
  });
  const discountsQuery = useQuery({
    queryKey: ['customer-discounts', user?.id ?? null],
    queryFn: () => api.get<{ items: Array<{ code: string; kind: 'percent' | 'fixed' | 'free_shipping'; value: number; remainingUses: number }> }>('/discounts/my'),
    enabled: Boolean(user),
  });
  const termsQuery = useQuery({
    queryKey: ['payment-terms', 'quote', lines.map((line) => [line.productId, line.qty])],
    queryFn: () => api.post<PaymentTermsQuoteResult>('/payment/terms/quote', {
      items: lines.map((line) => ({ productId: line.productId, qty: line.qty })),
    }),
    enabled: lines.length > 0,
  });

  const configuredMethods = parsePaymentMethods(bootstrap.data?.settings.payment_methods);
  const productBaseAmount = termsQuery.data?.baseAmount ?? total;
  const quotedBaseAmount = Math.max(0, productBaseAmount - (discountQuote?.amount ?? 0));
  const paymentPlans = (termsQuery.data?.plans ?? []).map((plan) =>
    quotedBaseAmount === productBaseAmount ? plan : repricePaymentPlan(plan, quotedBaseAmount));
  const availableMethods = configuredMethods.filter(
    (m) =>
      m.enabled !== false &&
      (!m.minAmount || quotedBaseAmount >= m.minAmount) &&
      (!m.maxAmount || quotedBaseAmount <= m.maxAmount) &&
      (!termsQuery.data?.enforcedSettlement && (paymentPlans.length === 0 || ['wallet', 'aqayepardakht', 'credit_weekly'].includes(m.id)))
  );

  const canUseWallet = Boolean(walletQuery.data?.config.enabled && walletQuery.data.config.orderPaymentEnabled && !walletQuery.data.wallet.isFrozen && walletQuery.data.wallet.balance >= quotedBaseAmount);

  const selectedPlan = paymentPlans.find((plan) => plan.id === paymentMethod) ?? null;
  const selectedConfiguredMethod = availableMethods.some((m) => m.id === paymentMethod && (m.id !== 'wallet' || canUseWallet));
  const activePaymentMethod = selectedPlan?.id ?? (
    (selectedConfiguredMethod ? paymentMethod : '')
    || paymentPlans[0]?.id
    || availableMethods.find((m) => m.id !== 'wallet' || canUseWallet)?.id
    || (termsQuery.data?.enforcedSettlement ? '' : 'aqayepardakht')
  );
  const activePaymentPlan = paymentPlans.find((plan) => plan.id === activePaymentMethod) ?? null;
  const activeConfiguredMethod = availableMethods.find((method) => method.id === activePaymentMethod) ?? null;
  const paymentKindValue = activePaymentPlan
    ? `plan:${activePaymentPlan.kind}`
    : activeConfiguredMethod
      ? `method:${activeConfiguredMethod.id}`
      : '';
  const chequePlans = paymentPlans.filter((plan) => plan.kind === 'cheque');
  const chequeTerms = [...new Set(chequePlans.map((plan) => plan.termMonths).filter((value): value is number => value != null))].sort((a, b) => a - b);
  const activeChequeTerm = activePaymentPlan?.kind === 'cheque' ? activePaymentPlan.termMonths : null;
  const chequeIntervals = [...new Set(chequePlans
    .filter((plan) => plan.termMonths === activeChequeTerm)
    .map((plan) => plan.installmentIntervalMonths)
    .filter((value): value is number => value != null))].sort((a, b) => a - b);
  const dailyPlans = paymentPlans.filter((plan) => plan.kind === 'daily');
  const payableTotal = activePaymentPlan?.finalAmount ?? quotedBaseAmount;
  const paymentSavings = activePaymentPlan ? Math.max(0, activePaymentPlan.baseAmount - activePaymentPlan.finalAmount) : 0;

  function selectPaymentKind(value: string) {
    if (value.startsWith('method:')) {
      setPaymentMethod(value.slice('method:'.length));
      return;
    }
    const kind = value.slice('plan:'.length);
    const plan = paymentPlans.find((item) => item.kind === kind);
    if (plan) setPaymentMethod(plan.id);
  }

  function selectChequeTerm(termMonths: number) {
    const plan = chequePlans.find((item) =>
      item.termMonths === termMonths && item.installmentIntervalMonths === activePaymentPlan?.installmentIntervalMonths,
    ) ?? chequePlans.find((item) => item.termMonths === termMonths);
    if (plan) setPaymentMethod(plan.id);
  }

  function selectChequeInterval(intervalMonths: number) {
    const plan = chequePlans.find((item) =>
      item.termMonths === activeChequeTerm && item.installmentIntervalMonths === intervalMonths,
    );
    if (plan) setPaymentMethod(plan.id);
  }

  const deliveryAddress = address.trim() || user?.address || "";

  function handleClose() {
    setCompletedOrder(null);
    setCompletedMethod("");
    setSecondaryData({});
    onFinished();
  }

  async function submit() {
    if (lines.length === 0) {
      setError("سبد خرید شما خالی است.");
      return;
    }
    if (!agreeTerms) {
      setError(
        "لطفاً جهت ثبت سفارش، شرایط و مفاد فاکتور را مطالعه کرده و تیک تأیید را بزنید.",
      );
      return;
    }
    if (!activePaymentMethod) {
      setError(termsQuery.data?.message ?? 'هیچ روش تسویه معتبری برای کالاهای این فاکتور فعال نیست.');
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await api.post<OrderResponse>("/orders", {
        items: lines.map((l) => ({
          productId: l.productId,
          warehouse: l.warehouse,
          qty: l.qty,
        })),
        address: address.trim() || undefined,
        note: note.trim() || undefined,
        paymentMethod: activePaymentMethod,
        paymentPlanId: activePaymentPlan?.id,
        discountCode: discountQuote ? discountCode.trim() : undefined,
        attribution: readAttribution(),
      });
      clear();
      setAddress("");
      setNote("");
      setAgreeTerms(false);
      setDiscountCode('');
      setDiscountQuote(null);

      if (activePaymentMethod === "aqayepardakht") {
        toast.ok("سفارش ثبت شد، در حال انتقال به درگاه پرداخت...");
        const paymentRes = await api.post<{ ok: boolean; url: string }>(
          "/payment/create",
          {
            orderId: res.order.id,
          },
        );
        if (paymentRes.url) {
          window.location.href = paymentRes.url;
          return;
        }
      }

      // For non-gateway methods, show secondary form if configured or standard
      const hasSecondary = res.order.paymentPlan || SECONDARY_INFO[activePaymentMethod] || availableMethods.find(m => m.id === activePaymentMethod)?.instructions;
      if (hasSecondary) {
        setCompletedOrder(res.order);
        setCompletedMethod(activePaymentMethod);
        setSecondaryData({});
        toast.ok(res.message);
        return;
      }

      toast.ok(res.message);
      onFinished();
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "profile_incomplete") {
        onNeedsProfile();
        return;
      }
      setError(err instanceof Error ? err.message : "ثبت سفارش ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function submitSecondary() {
    if (!completedOrder) return;
    setSecondaryBusy(true);
    try {
      await api.post("/orders/payment-info", {
        orderId: completedOrder.id,
        paymentMethod: completedMethod,
        ...secondaryData,
      });
      toast.ok("اطلاعات پرداخت با موفقیت ثبت شد.");
      handleClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "ثبت اطلاعات ناموفق بود.",
      );
    } finally {
      setSecondaryBusy(false);
    }
  }

  async function applyDiscount() {
    if (!discountCode.trim()) return;
    setDiscountBusy(true);
    setError('');
    try {
      const quote = await api.post<{ amount: number; freeShipping: boolean }>('/discounts/quote', {
        code: discountCode.trim(),
        items: lines.map((line) => ({ productId: line.productId, qty: line.qty })),
      });
      setDiscountQuote({ amount: quote.amount, freeShipping: quote.freeShipping });
      toast.ok(quote.freeShipping ? 'ارسال رایگان برای سفارش فعال شد.' : `تخفیف ${quote.amount.toLocaleString('fa-IR')} تومان اعمال شد.`);
    } catch (err) {
      setDiscountQuote(null);
      setError(err instanceof Error ? err.message : 'کد تخفیف معتبر نیست.');
    } finally { setDiscountBusy(false); }
  }

  // ── Secondary form view (post-order) ────────────────────────────
  if (completedOrder) {
    const plan = completedOrder.paymentPlan;
    const planSchedule = plan?.schedule.map((item) => `${item.dueLabel}: ${item.optional || item.amount == null ? 'اختیاری' : `${item.amount.toLocaleString('fa-IR')} تومان`}`) ?? [];
    const pendingInstructions = completedOrder.paymentInstructions?.status === 'pending';
    const baseInfo = plan ? {
      title: `تکمیل سفارش - ${plan.label}`,
      instructions: [
        plan.description,
        ...(plan.instructions ? [plan.instructions] : []),
        ...planSchedule,
      ],
      fields: pendingInstructions ? [] : plan.kind === 'cheque' ? [
        { key: 'checkNumber', label: 'شماره چک صیادی', placeholder: 'شماره ۱۶ رقمی چک' },
        { key: 'checkBankName', label: 'نام بانک', placeholder: 'مثال: بانک ملت' },
        { key: 'receiptImageUrl', label: 'تصویر چک اول (اختیاری)', placeholder: 'انتخاب فایل', type: 'file' },
        { key: 'checkNote', label: 'توضیحات سایر چک‌ها (اختیاری)', placeholder: 'شماره و تاریخ سایر چک‌ها' },
      ] : plan.kind === 'cash' ? [
        { key: 'receiptImageUrl', label: 'آپلود رسید (تصویر)', placeholder: 'انتخاب فایل', type: 'file' },
        { key: 'receiptNote', label: 'شماره پیگیری یا توضیحات', placeholder: 'کد رهگیری، ساعت واریز یا توضیح' },
      ] : [],
    } : SECONDARY_INFO[completedMethod];
    const routedInstructions = completedOrder.paymentInstructions?.instructions;
    const info = baseInfo ? {
      ...baseInfo,
      instructions: routedInstructions
        ? [pendingInstructions ? 'اطلاعات پرداخت پس از بررسی واحد مالی ارسال می‌شود.' : 'اطلاعات حساب تخصیص‌یافته به این سفارش:', routedInstructions]
        : baseInfo.instructions,
      fields: pendingInstructions ? [] : baseInfo.fields,
    } : baseInfo;
    const customMethodObj = availableMethods.find(m => m.id === completedMethod);

    if (info) {
      return (
        <Modal
          open
          inline
          title={info.title}
          onClose={handleClose}
          busy={secondaryBusy}
          footer={
            <>
              <button
                type="button"
                className="btn primary"
                style={{ flex: 1 }}
                disabled={secondaryBusy}
                onClick={() => info.fields.length > 0 ? void submitSecondary() : handleClose()}
              >
                {secondaryBusy ? "در حال ثبت…" : info.fields.length > 0 ? "ثبت اطلاعات پرداخت" : "تأیید و پایان"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleClose}
                disabled={secondaryBusy}
              >
                بعداً تکمیل می‌کنم
              </button>
            </>
          }
        >
        <div className="stack">
          {/* Order summary */}
          <div
            className="card"
            style={{
              padding: "var(--ds-space-3)",
              background: "var(--primary-light)",
              borderColor: "var(--primary)",
            }}
          >
            <div className="stack" style={{ gap: "var(--ds-space-1)", fontSize: "var(--ds-text-sm)" }}>
              <div className="row">
                <span className="muted">شماره سفارش</span>
                <span className="spacer" />
                <b className="ltr-inline">{completedOrder.orderCode}</b>
              </div>
              <div className="row">
                <span className="muted">مبلغ کل</span>
                <span className="spacer" />
                <b style={{ color: "var(--primary-dark)" }}>
                  <Price amount={completedOrder.total} />
                </b>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="card" style={{ padding: "var(--ds-space-3)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {info.instructions.map((line, i) => (
                <p
                  key={i}
                  style={{
                    margin: "var(--ds-space-0)",
                    fontSize: "var(--ds-text-sm)",
                    lineHeight: 1.8,
                    color: i === 0 ? "var(--text)" : "var(--muted)",
                  }}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>

          {info.fields.map((f) => {
            if (f.type === 'file') {
              return (
                <div key={f.key} className="field">
                  <label htmlFor={`sf-${f.key}`}>{f.label}</label>
                  {secondaryData[f.key] ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: "var(--ds-space-2)", background: 'var(--surface-2)', padding: "var(--ds-space-2)", borderRadius: 8 }}>
                      <a href={secondaryData[f.key]} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: "var(--ds-text-sm)", direction: 'ltr', textAlign: 'right' }}>
                        {secondaryData[f.key]}
                      </a>
                      <button type="button" onClick={() => setSecondaryData({ ...secondaryData, [f.key]: '' })} style={{ background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer' }}>×</button>
                    </div>
                  ) : (
                    <input
                      id={`sf-${f.key}`}
                      className="input"
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append('file', file);
                        setSecondaryBusy(true);
                        try {
                          const res = await api.upload<{ok: boolean; url?: string; message?: string}>('/uploads', formData);
                          if (res.ok && res.url) {
                            setSecondaryData({ ...secondaryData, [f.key]: res.url });
                            toast.ok('فایل با موفقیت آپلود شد.');
                          } else {
                            toast.error(res.message || 'خطا در آپلود فایل');
                          }
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'آپلود ناموفق بود.');
                        } finally {
                          setSecondaryBusy(false);
                          if (e.target) e.target.value = ''; // clear input
                        }
                      }}
                    />
                  )}
                </div>
              );
            }

            return (
              <div key={f.key} className="field">
                <label htmlFor={`sf-${f.key}`}>{f.label}</label>
                <input
                  id={`sf-${f.key}`}
                  className="input"
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  value={secondaryData[f.key] || ""}
                  onChange={(e) =>
                    setSecondaryData({
                      ...secondaryData,
                      [f.key]: e.target.value,
                    })
                  }
                />
              </div>
            );
          })}

          <p className="faint" style={{ margin: "var(--ds-space-0)", fontSize: "var(--ds-text-caption)" }}>
            در صورت عدم تکمیل فرم، می‌توانید اطلاعات را بعداً از بخش «سفارش‌های
            من» ارسال کنید.
          </p>
        </div>
      </Modal>
    );
    } else if (customMethodObj) {
      return (
        <Modal
          open
          inline
          title={`ثبت سفارش — ${customMethodObj.label}`}
          onClose={handleClose}
          footer={
            <button
              type="button"
              className="btn primary"
              style={{ flex: 1 }}
              onClick={handleClose}
            >
              متوجه شدم / بستن
            </button>
          }
        >
          <div className="stack">
            <div
              className="card"
              style={{
                padding: "var(--ds-space-3)",
                background: "var(--primary-light)",
                borderColor: "var(--primary)",
              }}
            >
              <div className="stack" style={{ gap: "var(--ds-space-1)", fontSize: "var(--ds-text-sm)" }}>
                <div className="row">
                  <span className="muted">شماره سفارش</span>
                  <span className="spacer" />
                  <b className="ltr-inline">{completedOrder.orderCode}</b>
                </div>
                <div className="row">
                  <span className="muted">مبلغ کل</span>
                  <span className="spacer" />
                  <b style={{ color: "var(--primary-dark)" }}>
                    <Price amount={completedOrder.total} />
                  </b>
                </div>
              </div>
            </div>

            {customMethodObj.instructions && (
              <div className="card" style={{ padding: 14 }}>
                <h4 style={{ margin: "0 0 var(--ds-space-2)", fontSize: "var(--ds-text-md)", fontWeight: 700 }}>دستورالعمل و راهنمای پرداخت:</h4>
                <p style={{ margin: "var(--ds-space-0)", fontSize: "var(--ds-text-sm)", lineHeight: 1.8, whiteSpace: 'pre-line', color: 'var(--text)' }}>
                  {customMethodObj.instructions}
                </p>
              </div>
            )}
          </div>
        </Modal>
      );
    }
  }

  // ── Main checkout form ──────────────────────────────────────────
  return (
    <Modal
      open
      inline
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button
            type="button"
            className="btn primary"
            style={{ flex: 1 }}
            disabled={busy || !agreeTerms || termsQuery.isPending || !activePaymentMethod}
            onClick={() => void submit()}
          >
            {busy || termsQuery.isPending ? (
              termsQuery.isPending ? "در حال محاسبه شرایط…" : "در حال ثبت…"
            ) : (
              <>
                ثبت سفارش — <Price amount={payableTotal} />
              </>
            )}
          </button>
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            disabled={busy}
          >
            انصراف
          </button>
        </>
      }
    >
      <div className="checkout-flow-grid">
        {error && <div className="alert error">{error}</div>}

        <section className="checkout-flow-fields" aria-labelledby="checkout-details-title">
          <div className="checkout-section-heading">
            <span className="checkout-section-heading__icon"><Icon name="pin" /></span>
            <div>
              <h2 id="checkout-details-title">اطلاعات تحویل</h2>
              <p>مشخصات گیرنده و نشانی ارسال سفارش</p>
            </div>
          </div>

        <div className="checkout-card checkout-delivery-card">

        {user && (
          <div className="checkout-customer-card">
              <span className="checkout-customer-card__avatar"><Icon name="user" /></span>
              <div className="checkout-customer-card__item">
                <span>خریدار</span>
                <b>
                  {user.name} {user.lastName}
                  {user.storeName ? ` (${user.storeName})` : ""}
                </b>
              </div>
              <div className="checkout-customer-card__item checkout-customer-card__phone">
                <span>شماره همراه</span>
                <b className="ltr-inline">{user.phone}</b>
              </div>
          </div>
        )}

        <div className="field">
          <label htmlFor="co-address">آدرس تحویل</label>
          <textarea
            id="co-address"
            className="textarea"
            rows={3}
            placeholder={user?.address || "آدرس کامل تحویل سفارش"}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          {!address.trim() && user?.address && (
            <span className="faint" style={{ fontSize: "var(--ds-text-caption)" }}>
              خالی بماند، آدرس حساب استفاده می‌شود.
            </span>
          )}
          {!deliveryAddress && (
            <span
              className="alert warn"
              style={{
                fontSize: "var(--ds-text-caption)",
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--ds-space-1)",
              }}
            >
              <Icon name="warn" /> آدرسی ثبت نشده است.
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="co-note">توضیحات (اختیاری)</label>
          <input
            id="co-note"
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        </div>

        <div className="field checkout-card checkout-payment-card">
          <div className="checkout-section-heading checkout-section-heading--compact">
            <span className="checkout-section-heading__icon"><Icon name="card" /></span>
            <div>
              <h2>روش پرداخت و تسویه حساب</h2>
              <p>شرایط دلخواه را مرحله‌به‌مرحله انتخاب کنید.</p>
            </div>
          </div>
          <div style={{ display: "grid", gap: "var(--ds-space-2)", marginTop: "var(--ds-space-1)" }}>
            {termsQuery.isPending && <div className="alert">در حال محاسبه شرایط پرداخت…</div>}
            {termsQuery.isError && <div className="alert warn">محاسبه شرایط پرداخت انجام نشد؛ روش‌های عادی همچنان در دسترس هستند.</div>}
            {termsQuery.data?.message && <div className="alert warn">{termsQuery.data.message}</div>}
            {!termsQuery.isPending && (
              <div className="checkout-payment-steps">
                <div className="field checkout-payment-step">
                  <label htmlFor="payment-kind-select"><span>۱</span> نوع پرداخت</label>
                  <select
                    id="payment-kind-select"
                    className="input"
                    value={paymentKindValue}
                    onChange={(event) => selectPaymentKind(event.target.value)}
                    style={{ minHeight: 48, fontWeight: 700 }}
                  >
                    {paymentPlans.some((plan) => plan.kind === 'cash') && <option value="plan:cash">نقدی</option>}
                    {chequePlans.length > 0 && <option value="plan:cheque">پرداخت با چک</option>}
                    {dailyPlans.length > 0 && <option value="plan:daily">تسویه مدت‌دار</option>}
                    {availableMethods.map((method) => {
                      const disabled = method.id === 'wallet' && !canUseWallet;
                      return <option key={method.id} value={`method:${method.id}`} disabled={disabled}>{method.label}{disabled ? ' - موجودی کافی نیست' : ''}</option>;
                    })}
                  </select>
                </div>

                {activePaymentPlan?.kind === 'cheque' && (
                  <div className="field checkout-payment-step">
                    <label htmlFor="payment-term-select"><span>۲</span> مدت بازپرداخت</label>
                    <select id="payment-term-select" className="input" value={activeChequeTerm ?? ''} onChange={(event) => selectChequeTerm(Number(event.target.value))} style={{ minHeight: 48 }}>
                      {chequeTerms.map((term) => <option key={term} value={term}>{formatNumber(term)} ماهه</option>)}
                    </select>
                  </div>
                )}

                {activePaymentPlan?.kind === 'cheque' && chequeIntervals.length > 0 && (
                  <div className="field checkout-payment-step">
                    <label htmlFor="payment-interval-select"><span>۳</span> فاصله پرداخت چک‌ها</label>
                    <select id="payment-interval-select" className="input" value={activePaymentPlan.installmentIntervalMonths ?? ''} onChange={(event) => selectChequeInterval(Number(event.target.value))} style={{ minHeight: 48 }}>
                      {chequeIntervals.map((interval) => (
                        <option key={interval} value={interval}>{interval === 1 ? 'ماه‌به‌ماه' : `هر ${formatNumber(interval)} ماه`}</option>
                      ))}
                    </select>
                  </div>
                )}

                {activePaymentPlan?.kind === 'daily' && (
                  <div className="field checkout-payment-step">
                    <label htmlFor="payment-days-select"><span>۲</span> مدت تسویه</label>
                    <select id="payment-days-select" className="input" value={activePaymentPlan.settlementDays ?? ''} onChange={(event) => {
                      const plan = dailyPlans.find((item) => item.settlementDays === Number(event.target.value));
                      if (plan) setPaymentMethod(plan.id);
                    }} style={{ minHeight: 48 }}>
                      {dailyPlans.map((plan) => <option key={plan.id} value={plan.settlementDays ?? 0}>{formatNumber(plan.settlementDays ?? 0)} روزه</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            {activePaymentPlan && (
              <div className="checkout-plan-card">
                <div className="checkout-plan-card__head">
                  <span className="checkout-plan-card__icon"><Icon name={activePaymentPlan.kind === 'cash' ? 'cash' : 'calendar'} /></span>
                  <div><span>طرح انتخاب‌شده</span><strong>{activePaymentPlan.label}</strong></div>
                  <strong className="checkout-plan-card__price"><Price amount={activePaymentPlan.finalAmount} /></strong>
                </div>
                <p className="checkout-plan-card__description">{activePaymentPlan.description}</p>
                {paymentSavings > 0 && (
                  <div className="checkout-plan-card__savings">
                    <Icon name="tag" />
                    <span>
                      سود شما از این خرید {activePaymentPlan.kind === 'cash' ? 'در صورت پرداخت نقدی' : `با انتخاب ${activePaymentPlan.label}`}:
                      {' '}<b><Price amount={paymentSavings} /></b>
                    </span>
                  </div>
                )}
                {activePaymentPlan.upfrontAmount != null && activePaymentPlan.upfrontPercent != null && activePaymentPlan.kind !== 'cash' && (
                  <div className="checkout-plan-card__upfront"><span>پیش‌پرداخت</span><b><Price amount={activePaymentPlan.upfrontAmount} /></b></div>
                )}
                {activePaymentPlan.schedule.length > 0 && (
                  <div className="checkout-plan-schedule">
                    {activePaymentPlan.schedule.map((item, index) => (
                      <span key={`${item.dueLabel}-${index}`}>
                        <small>{item.dueLabel}</small><b>{item.optional || item.amount == null ? 'اختیاری' : <Price amount={item.amount} />}</b>
                      </span>
                    ))}
                  </div>
                )}
                {activePaymentPlan.instructions && <div className="checkout-plan-card__instructions"><Icon name="bank" /><p>{activePaymentPlan.instructions}</p></div>}
              </div>
            )}

            {activeConfiguredMethod && (
              <div className="checkout-plan-card checkout-plan-card--simple">
                <strong>{activeConfiguredMethod.label}</strong>
                <p className="muted" style={{ fontSize: "var(--ds-text-caption)", margin: '6px 0 0' }}>
                  {activeConfiguredMethod.id === 'wallet' && walletQuery.data
                    ? `موجودی: ${walletQuery.data.wallet.balance.toLocaleString('fa-IR')} تومان`
                    : activeConfiguredMethod.desc}
                </p>
                {activeConfiguredMethod.instructions && <p style={{ fontSize: "var(--ds-text-caption)", margin: "var(--ds-space-2) 0 0", whiteSpace: 'pre-line', lineHeight: 1.7 }}>{activeConfiguredMethod.instructions}</p>}
              </div>
            )}
          </div>
        </div>

        </section>

        <section className="checkout-flow-summary" aria-labelledby="checkout-summary-title">
          <div className="checkout-section-heading">
            <span className="checkout-section-heading__icon"><Icon name="receipt" /></span>
            <div>
              <h2 id="checkout-summary-title">خلاصه سفارش</h2>
              <p>{formatNumber(lines.length)} ردیف کالا در این سفارش</p>
            </div>
          </div>

        <div className="checkout-card checkout-summary-card">
        <div className="field" style={{ marginBottom: "var(--ds-space-4)" }}>
          <label htmlFor="discount-code">کد تخفیف اختصاصی</label>
          <div className="row" style={{ gap: "var(--ds-space-2)" }}>
            <input id="discount-code" className="input" dir="ltr" value={discountCode} onChange={(event) => { setDiscountCode(event.target.value.toUpperCase()); setDiscountQuote(null); }} placeholder="مثال: TAMAS-..." />
            <button type="button" className="btn" disabled={discountBusy || !discountCode.trim()} onClick={() => void applyDiscount()}>{discountBusy ? 'در حال بررسی…' : 'اعمال'}</button>
          </div>
          {discountQuote && <span className="alert" style={{ marginTop: "var(--ds-space-2)" }}>{discountQuote.freeShipping ? 'ارسال رایگان فعال است.' : `${discountQuote.amount.toLocaleString('fa-IR')} تومان تخفیف اعمال می‌شود.`}</span>}
          {!discountCode && discountsQuery.data?.items[0] && <button type="button" className="btn ghost" style={{ marginTop: "var(--ds-space-2)" }} onClick={() => setDiscountCode(discountsQuery.data!.items[0]!.code)}>استفاده از کد اختصاصی من: <b dir="ltr">{discountsQuery.data.items[0].code}</b></button>}
        </div>
        <div className="table-wrap checkout-order-table-wrap">
          <table className="data checkout-order-table">
            <thead>
              <tr>
                <th>کالا</th>
                <th>انبار</th>
                <th>تعداد</th>
                <th>مبلغ</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key}>
                  <td className="wrap">
                    {l.title}
                    {l.color ? ` — ${l.color}` : ""}
                  </td>
                  <td>{WAREHOUSE_LABELS[l.warehouse]}</td>
                  <td>{formatNumber(l.qty)}</td>
                  <td>
                    <Price amount={l.price * l.qty} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {activePaymentPlan && (
          <div className="checkout-totals">
            <div className="checkout-totals__row"><span>جمع قیمت کالاها</span><Price amount={productBaseAmount} /></div>
            {(discountQuote?.amount ?? 0) > 0 && (
              <div className="checkout-totals__row checkout-totals__row--adjustment">
                <span>کد تخفیف اختصاصی</span><span>-<Price amount={discountQuote!.amount} /></span>
              </div>
            )}
            {activePaymentPlan.adjustmentAmount !== 0 && (
              <div className="checkout-totals__row checkout-totals__row--adjustment">
                <span>{activePaymentPlan.adjustmentAmount < 0
                  ? activePaymentPlan.kind === 'cash' ? 'تخفیف خرید نقدی' : 'تخفیف شرایط پرداخت'
                  : activePaymentPlan.kind === 'cheque' ? 'سود اقساط' : 'هزینه خدمات'}</span>
                <span>{activePaymentPlan.adjustmentAmount < 0 ? '-' : '+'}<Price amount={Math.abs(activePaymentPlan.adjustmentAmount)} /></span>
              </div>
            )}
            <div className="checkout-totals__final"><span>مبلغ نهایی قابل پرداخت</span><strong><Price amount={activePaymentPlan.finalAmount} /></strong></div>
          </div>
        )}

        <label className="checkout-consent">
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
          />
          <span>
            <b><Icon name="shield" /> تأیید شرایط سفارش</b>
            با تیک زدن این گزینه، اینجانب تمامی شرایط و مفاد مندرج در این فاکتور
            (از جمله شرایط حفظ مالکیت کالا و تعهدات بازپرداخت) را مطالعه کرده و
            به عنوان «امضای دیجیتال» خود تأیید می‌نمایم. من آگاه هستم که این
            تأییدیه در حکم قرارداد رسمی بوده و برای من لازم‌الاجراست.{" "}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--primary)",
                fontWeight: 700,
                textDecoration: "underline",
              }}
            >
              (مشاهده کامل شرایط و قوانین)
            </a>
          </span>
        </label>

        <p className="checkout-price-note">
          <Icon name="help" />
          قیمت‌ها در لحظه ثبت سفارش از سرور خوانده می‌شوند و ممکن است با نمایش
          فعلی تفاوت جزئی داشته باشند.
        </p>
        </div>
        </section>
      </div>
    </Modal>
  );
}
