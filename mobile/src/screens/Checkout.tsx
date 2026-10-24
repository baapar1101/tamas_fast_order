import React, { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, Switch, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type {
  OrderDTO,
  PaymentPlanQuote,
  PaymentTermsQuoteResult,
  PaymentMethodConfig,
} from "@tamas/shared";
import { repricePaymentPlan } from "@tamas/shared";
import { api, ApiError } from "../api";
import { queryClient, useStore } from "../state";
import { useBootstrap } from "../hooks";
import {
  checkoutItems,
  date,
  money,
  total,
  nativePaymentMethods,
  type CartLine,
} from "../domain";
import {
  Button,
  Card,
  Empty,
  Field,
  Loading,
  Money,
  Notice,
  Page,
  Row,
  Select,
  Txt,
  useAction,
  useColors,
} from "../ui";
import { uploadFile } from "../files";
import { statusLabel } from "./Account";
import type { ScreenProps } from "../navigation";
type Partition = PaymentTermsQuoteResult & { productIds: string[] };
type Quote = PaymentTermsQuoteResult & { partitions?: Partition[] };
export async function openBank(url: string) {
  const u = new URL(url);
  // The gateway URL comes from our authenticated backend; reject app/file/http links.
  if (u.protocol !== "https:" || u.username || u.password)
    throw new Error("نشانی درگاه معتبر نیست.");
  await Linking.openURL(u.href);
}
export function CheckoutScreen({ navigation }: ScreenProps<"Checkout">) {
  const store = useStore();
  const boot = useBootstrap();
  const c = useColors();
  const a = useAction();
  const submitting = useRef(false);
  const [group, setGroup] = useState(""),
    [method, setMethod] = useState(""),
    [address, setAddress] = useState(store.user?.address || ""),
    [note, setNote] = useState(""),
    [agree, setAgree] = useState(false);
  const [code, setCode] = useState(""),
    [discount, setDiscount] = useState<{
      code: string;
      amount: number;
      freeShipping: boolean;
      signature: string;
    } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const items = checkoutItems(store.lines);
  const signature = JSON.stringify(items);
  const q = useQuery({
    queryKey: ["checkout-quote", signature],
    queryFn: () => api.post<Quote>("/payment/terms/quote", { items }),
    enabled: items.length > 0,
    staleTime: 0,
  });
  const wallet = useQuery({
    queryKey: ["wallet", store.user?.id],
    queryFn: () =>
      api.get<{
        wallet: { balance: number; isFrozen: boolean };
        config: { enabled: boolean; orderPaymentEnabled: boolean };
      }>("/wallet"),
    enabled: !!store.user,
  });
  const partition =
    q.data?.partitions?.find((p) => p.audience === group) ||
    q.data?.partitions?.[0];
  const active = q.data?.audience === "mixed" ? partition : q.data;
  const lines =
    active && "productIds" in active
      ? store.lines.filter((l) =>
          (active as Partition).productIds.includes(l.product.productId),
        )
      : store.lines;
  const activeItems = checkoutItems(lines);
  const activeSignature = JSON.stringify(activeItems);
  const discountAmount =
    discount?.signature === activeSignature && discount.code === code.trim()
      ? discount.amount
      : 0;
  const base = active?.baseAmount ?? total(lines);
  const discountedBase = Math.max(0, base - discountAmount);
  const plans = (active?.plans || []).map((p) =>
    discountAmount ? repricePaymentPlan(p, discountedBase) : p,
  );
  const methods = useMemo(
    () => nativePaymentMethods(boot.data?.settings.payment_methods),
    [boot.data?.settings.payment_methods],
  );
  const available = methods.filter(
    (m) =>
      m.enabled !== false &&
      (!m.minAmount || discountedBase >= m.minAmount) &&
      (!m.maxAmount || discountedBase <= m.maxAmount) &&
      !active?.enforcedSettlement &&
      (!plans.length ||
        ["wallet", "aqayepardakht", "credit_weekly"].includes(m.id)),
  );
  const selected =
    plans.find((p) => p.id === method) ||
    (!available.some((m) => m.id === method) ? plans[0] : undefined);
  const activeMethod =
    selected?.id ||
    available.find((m) => m.id === method)?.id ||
    (!plans.length ? available[0]?.id : undefined) ||
    "";
  const walletAllowed =
    !!wallet.data?.config.enabled &&
    !!wallet.data.config.orderPaymentEnabled &&
    !wallet.data.wallet.isFrozen &&
    wallet.data.wallet.balance >= discountedBase;
  const final = selected?.finalAmount ?? discountedBase;
  useEffect(() => setAgree(false), [final, activeMethod, activeSignature]);
  const change = (id: string) => {
    setMethod(id);
    setAgree(false);
  };
  if (!store.user)
    return (
      <Page>
        <Empty
          title="ابتدا وارد شوید"
          action={
            <Button label="ورود" onPress={() => navigation.replace("Login")} />
          }
        />
      </Page>
    );
  if (!store.complete || !store.user.isActive)
    return (
      <Page>
        <Empty
          title={
            !store.complete
              ? "اطلاعات حساب کامل نیست"
              : "حساب همکاری در انتظار تأیید است"
          }
          action={
            !store.complete ? (
              <Button
                label="تکمیل حساب"
                onPress={() => navigation.navigate("Profile")}
              />
            ) : undefined
          }
        />
      </Page>
    );
  if (!lines.length)
    return (
      <Page>
        <Empty title="سبد خرید خالی است" />
      </Page>
    );
  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      await a.run(async () => {
        if (!agree || !activeMethod || !active || q.isFetching)
          throw new Error("شرایط و مبلغ نهایی را بررسی و تأیید کنید.");
        if (q.data?.audience === "mixed" && !partition)
          throw new Error(
            "برای سبد ترکیبی، محاسبه فاکتورهای جدا هنوز در دسترس نیست.",
          );
        let res: { order: OrderDTO };
        try {
          res = await api.post<{ order: OrderDTO }>("/orders", {
            items: activeItems,
            address,
            note,
            paymentMethod: activeMethod,
            paymentPlanId: selected?.id,
            discountCode:
              discount?.signature === activeSignature &&
              discount.code === code.trim()
                ? discount.code
                : undefined,
            attribution: { source: "android", medium: "native_app" },
          });
        } catch (error) {
          if (
            error instanceof ApiError &&
            (error.status === 0 ||
              error.status >= 500 ||
              error.code === "invalid_response")
          ) {
            setUncertain(true);
            throw new Error(
              "پاسخ ثبت سفارش دریافت نشد و ممکن است سفارش ثبت شده باشد. برای جلوگیری از ثبت تکراری، ابتدا بخش سفارش‌ها را بررسی کنید.",
              { cause: error },
            );
          }
          throw error;
        }
        store.removeLines(lines.map((l) => l.product.productId));
        await queryClient.invalidateQueries({ queryKey: ["orders"] });
        await queryClient.invalidateQueries({ queryKey: ["wallet"] });
        // Navigate first: a failed external gateway launch must not allow a duplicate order.
        navigation.replace("Order", { id: res.order.id });
      }, "سفارش ثبت شد.");
    } finally {
      submitting.current = false;
    }
  };
  return (
    <Page>
      <Txt bold size={24}>
        تأیید و ثبت سفارش
      </Txt>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Card>
          <Notice error text={q.error.message} />
          <Button label="محاسبه مجدد" onPress={() => void q.refetch()} />
        </Card>
      ) : null}
      {q.data?.audience === "mixed" && (
        <Card>
          <Notice text="موبایل و جانبی در فاکتورهای جدا ثبت می‌شوند. پس از ثبت این فاکتور، کالاهای دیگر در سبد باقی می‌مانند." />
          {q.data.partitions ? (
            <Select
              label="فاکتور موردنظر"
              value={String(partition?.audience || "")}
              options={q.data.partitions.map((p) => ({
                value: String(p.audience),
                label: p.audience === "mobile" ? "موبایل" : "لوازم جانبی",
              }))}
              onChange={(v) => {
                setGroup(v);
                setMethod("");
                setDiscount(null);
                setAgree(false);
              }}
            />
          ) : (
            <Notice text={q.data.message} />
          )}
        </Card>
      )}
      <Card>
        <Txt bold size={18}>
          اطلاعات تحویل
        </Txt>
        <Field
          label="نشانی تحویل"
          value={address}
          onChangeText={setAddress}
          multiline
        />
        <Field
          label="توضیحات سفارش (اختیاری)"
          value={note}
          onChangeText={setNote}
          multiline
        />
      </Card>
      <Card>
        <Txt bold size={18}>
          روش پرداخت و تسویه حساب
        </Txt>
        <Notice text={active?.message} />
        <Select
          label="۱. نوع پرداخت"
          value={selected ? `plan:${selected.kind}` : activeMethod}
          options={[
            ...(["cash", "cheque", "daily"] as const)
              .filter((k) => plans.some((p) => p.kind === k))
              .map((k) => ({
                value: `plan:${k}`,
                label:
                  k === "cash"
                    ? "نقدی"
                    : k === "cheque"
                      ? "پرداخت با چک"
                      : "اعتباری روزانه",
              })),
            ...available.map((m) => ({
              value: m.id,
              label:
                m.label +
                (m.id === "wallet" && !walletAllowed ? " (موجودی ناکافی)" : ""),
            })),
          ]}
          onChange={(v) =>
            change(
              v.startsWith("plan:")
                ? plans.find((p) => p.kind === v.slice(5))?.id || ""
                : v,
            )
          }
        />
        {selected?.kind === "cheque" && (
          <>
            <Select
              label="۲. مدت بازپرداخت"
              value={String(selected.termMonths)}
              options={[
                ...new Set(
                  plans
                    .filter((p) => p.kind === "cheque")
                    .map((p) => p.termMonths),
                ),
              ].map((t) => ({ label: `${t} ماهه`, value: String(t) }))}
              onChange={(v) =>
                change(
                  plans.find(
                    (p) =>
                      p.kind === "cheque" &&
                      p.termMonths === Number(v) &&
                      p.installmentIntervalMonths ===
                        selected.installmentIntervalMonths,
                  )?.id ||
                    plans.find(
                      (p) => p.kind === "cheque" && p.termMonths === Number(v),
                    )?.id ||
                    "",
                )
              }
            />
            <Select
              label="۳. فاصله چک‌ها"
              value={String(selected.installmentIntervalMonths)}
              options={[
                ...new Set(
                  plans
                    .filter(
                      (p) =>
                        p.kind === "cheque" &&
                        p.termMonths === selected.termMonths,
                    )
                    .map((p) => p.installmentIntervalMonths),
                ),
              ].map((t) => ({
                label: t === 1 ? "ماه‌به‌ماه" : `${t} ماه یک‌بار`,
                value: String(t),
              }))}
              onChange={(v) =>
                change(
                  plans.find(
                    (p) =>
                      p.kind === "cheque" &&
                      p.termMonths === selected.termMonths &&
                      p.installmentIntervalMonths === Number(v),
                  )?.id || "",
                )
              }
            />
          </>
        )}
        {selected?.kind === "daily" && (
          <Select
            label="۲. مدت تسویه"
            value={selected.id}
            options={plans
              .filter((p) => p.kind === "daily")
              .map((p) => ({ label: p.label, value: p.id }))}
            onChange={change}
          />
        )}
        {selected && (
          <>
            <Txt bold size={18}>
              {selected.label}
            </Txt>
            <Money amount={selected.finalAmount} size={23} />
            {selected.adjustmentAmount < 0 && (
              <Notice
                text={`سود شما از این خرید: ${money(-selected.adjustmentAmount)}`}
              />
            )}{" "}
            {selected.adjustmentAmount > 0 && (
              <Txt>هزینه تسویه اقساطی: {money(selected.adjustmentAmount)}</Txt>
            )}
            {!!selected.upfrontAmount && (
              <Txt bold>پیش‌پرداخت: {money(selected.upfrontAmount)}</Txt>
            )}
            {selected.schedule.map((s, i) => (
              <Row
                key={i}
                style={{ justifyContent: "space-between", flexWrap: "wrap" }}
              >
                <Txt muted>
                  {s.dueLabel}
                  {s.optional ? " (اختیاری)" : ""}
                </Txt>
                <Txt bold>
                  {s.amount === null ? "طبق مبلغ ثبت‌شده" : money(s.amount)}
                </Txt>
              </Row>
            ))}
            <Notice text={selected.instructions} />
          </>
        )}
        <Txt muted size={12}>
          سررسیدها و مبلغ قطعی پس از ثبت، از روی فاکتور سرور نمایش داده می‌شوند.
        </Txt>
      </Card>
      <Card>
        <Txt bold size={18}>
          خلاصه فاکتور
        </Txt>
        {lines.map((l) => (
          <Row
            key={`${l.product.productId}-${l.warehouse}`}
            style={{
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <Txt style={{ maxWidth: "65%" }}>
              {l.product.title} × {l.qty.toLocaleString("fa-IR")}
            </Txt>
            <Txt>{money(l.product.price * l.qty)}</Txt>
          </Row>
        ))}
        <Field
          label="کد تخفیف اختصاصی"
          value={code}
          onChangeText={(v) => {
            setCode(v.toUpperCase());
            setAgree(false);
          }}
          autoCapitalize="characters"
        />
        <Button
          secondary
          label="بررسی کد تخفیف"
          busy={a.busy}
          disabled={!code.trim()}
          onPress={() =>
            void a.run(async () => {
              const r = await api.post<{
                amount: number;
                freeShipping: boolean;
              }>("/discounts/quote", { code: code.trim(), items: activeItems });
              setDiscount({
                ...r,
                code: code.trim(),
                signature: activeSignature,
              });
              setAgree(false);
            }, "کد تخفیف تأیید شد.")
          }
        />
        {discountAmount > 0 && <Txt>تخفیف کد: {money(discountAmount)}</Txt>}
        {discount?.freeShipping && discount.signature === activeSignature && (
          <Txt>ارسال رایگان فعال است.</Txt>
        )}
        <Row style={{ justifyContent: "space-between" }}>
          <Txt bold>مبلغ نهایی قابل پرداخت</Txt>
          <Money amount={final} />
        </Row>
        <Button
          secondary
          label="مطالعه کامل شرایط و قوانین"
          onPress={() => navigation.navigate("Terms")}
        />
        <Row>
          <Switch
            accessibilityLabel="پذیرش شرایط خرید"
            value={agree}
            onValueChange={setAgree}
            trackColor={{ true: c.primary }}
          />
          <Txt>شرایط فروش و مفاد فاکتور را خواندم و می‌پذیرم.</Txt>
        </Row>
        {a.feedback}
        {uncertain ? (
          <Button
            label="بررسی سفارش‌های ثبت‌شده"
            onPress={() => navigation.navigate("Main", { screen: "Orders" })}
          />
        ) : (
          <Button
            label={`ثبت سفارش — ${money(final)}`}
            busy={a.busy}
            disabled={
              !agree ||
              !activeMethod ||
              q.isFetching ||
              !!q.error ||
              (activeMethod === "wallet" && !walletAllowed) ||
              (q.data?.audience === "mixed" && !partition)
            }
            onPress={() => void submit()}
          />
        )}
      </Card>
    </Page>
  );
}
export function OrderScreen({ route, navigation }: ScreenProps<"Order">) {
  const store = useStore(),
    a = useAction();
  const [receipt, setReceipt] = useState(""),
    [ref, setRef] = useState("");
  const q = useQuery({
    queryKey: ["orders", store.user?.id],
    queryFn: () => api.get<{ orders: OrderDTO[] }>("/orders"),
    enabled: !!store.user,
    staleTime: 0,
  });
  const o = q.data?.orders.find((o) => o.id === route.params.id);
  if (!o)
    return (
      <Page>
        {q.isPending ? (
          <Loading />
        ) : (
          <Empty
            title="سفارش در دسترس نیست"
            description={q.error?.message}
            action={
              <Button label="تلاش مجدد" onPress={() => void q.refetch()} />
            }
          />
        )}
      </Page>
    );
  return (
    <Page refresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Card>
        <Txt bold size={24}>
          سفارش {o.orderCode}
        </Txt>
        <Txt muted>
          {date(o.createdAt)} • {statusLabel(o.status)}
        </Txt>
        <Txt bold>
          {o.paymentStatus === "paid"
            ? "پرداخت تأیید شده"
            : o.paymentStatus === "pending"
              ? "پرداخت در انتظار بررسی"
              : "پرداخت نشده"}
        </Txt>
        <Money amount={o.total} size={25} />
        <Txt>{o.address}</Txt>
        <Notice
          text={
            o.paymentInstructions?.instructions ||
            o.paymentPlan?.instructions ||
            undefined
          }
        />
        {o.paymentInstructions?.status === "pending" && (
          <Notice text="اطلاعات پرداخت اختصاصی این فاکتور به‌زودی از طریق پیامک و پیام‌رسان برای شما ارسال می‌شود. تا دریافت اطلاعات، به حساب دیگری واریز نکنید." />
        )}
        {o.paymentStatus !== "paid" &&
          o.status !== "cancelled" &&
          o.paymentMethod === "aqayepardakht" && (
            <Button
              label="پرداخت امن در درگاه بانکی"
              busy={a.busy}
              onPress={() =>
                void a.run(async () => {
                  const r = await api.post<{ url: string }>("/payment/create", {
                    orderId: o.id,
                  });
                  await openBank(r.url);
                }, "پس از پرداخت به اپ بازگردید و وضعیت را تازه‌سازی کنید.")
              }
            />
          )}
      </Card>
      <Card>
        <Txt bold size={18}>
          اقلام فاکتور
        </Txt>
        {o.items.map((l, i) => (
          <View key={i} style={{ gap: 5 }}>
            <Txt bold>{l.title}</Txt>
            <Txt muted>
              {l.color} • {l.warehouse === "kerman" ? "کرمان" : "تهران"} •{" "}
              {l.qty.toLocaleString("fa-IR")} عدد
            </Txt>
            <Money amount={l.price * l.qty} size={15} />
          </View>
        ))}
      </Card>
      {o.paymentPlan && (
        <Card>
          <Txt bold size={18}>
            {o.paymentPlan.label}
          </Txt>
          {o.paymentPlan.schedule.map((s, i) => (
            <Row
              key={i}
              style={{ justifyContent: "space-between", flexWrap: "wrap" }}
            >
              <Txt>{s.dueDate ? date(s.dueDate) : s.dueLabel}</Txt>
              <Txt bold>{s.amount === null ? "اختیاری" : money(s.amount)}</Txt>
            </Row>
          ))}
          {o.paymentPlan.kind !== "cash" && (
            <Button
              secondary
              label="ثبت چک‌ها و رسید اقساط"
              onPress={() => navigation.navigate("Credit")}
            />
          )}
        </Card>
      )}
      {o.paymentStatus !== "paid" &&
        o.status !== "cancelled" &&
        o.paymentPlan?.kind !== "cheque" && (
          <Card>
            <Txt bold size={18}>
              ثبت رسید پرداخت
            </Txt>
            <Field
              label="کد رهگیری یا توضیح واریز"
              value={ref}
              onChangeText={setRef}
            />
            <Button
              secondary
              label={
                receipt
                  ? "رسید انتخاب شد؛ تغییر فایل"
                  : "انتخاب تصویر یا PDF رسید"
              }
              busy={a.busy}
              onPress={() =>
                void a.run(async () => {
                  const f = await uploadFile();
                  if (!f) return false;
                  setReceipt(f.url);
                }, "رسید بارگذاری شد؛ برای ارسال نهایی دکمه ثبت را بزنید.")
              }
            />
            <Button
              label="ثبت اطلاعات پرداخت"
              disabled={!receipt && !ref.trim()}
              busy={a.busy}
              onPress={() =>
                void a.run(async () => {
                  await api.post("/orders/payment-info", {
                    orderId: o.id,
                    paymentMethod: o.paymentMethod,
                    receiptImageUrl: receipt || undefined,
                    receiptNote: ref,
                  });
                  setReceipt("");
                  setRef("");
                  await q.refetch();
                })
              }
            />
          </Card>
        )}
      {a.feedback}
      <Button
        secondary
        label="به‌روزرسانی وضعیت پرداخت از سرور"
        onPress={() => void q.refetch()}
      />
    </Page>
  );
}
