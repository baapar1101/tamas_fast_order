import React, { useState } from "react";
import { Alert, Linking, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  CREDIT_STATUS_LABELS,
  CHEQUE_STATUS_LABELS,
  DOCUMENT_REQUEST_STATUS_LABELS,
  type CreditDashboardDTO,
  type DocumentRequestDTO,
} from "@tamas/shared";
import { api } from "../api";
import { useStore } from "../state";
import { ascii, date, money } from "../domain";
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
import { sharePrivate, uploadFile } from "../files";
import type { ScreenProps } from "../navigation";
export function useCredit() {
  const { user } = useStore();
  return useQuery({
    queryKey: ["credit", user?.id],
    queryFn: () => api.get<CreditDashboardDTO>("/credit/dashboard"),
    enabled: !!user,
  });
}
export function CreditScreen({ navigation }: ScreenProps<"Credit">) {
  const q = useCredit(),
    a = useAction(),
    c = useColors();
  const [orderId, setOrderId] = useState(""),
    [number, setNumber] = useState(""),
    [bank, setBank] = useState(""),
    [holder, setHolder] = useState(""),
    [image, setImage] = useState("");
  const data = q.data;
  const chequeOrder =
    data?.chequeOrders.find((o) => String(o.orderId) === orderId) ||
    data?.chequeOrders[0];
  return (
    <Page refresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Txt bold size={23}>
        اعتبار و تسویه اقساط
      </Txt>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Empty
          title="دریافت اطلاعات ناموفق بود"
          description={q.error.message}
          action={<Button label="تلاش مجدد" onPress={() => void q.refetch()} />}
        />
      ) : (
        data && (
          <>
            <Card>
              <Txt bold size={19}>
                {data.application
                  ? CREDIT_STATUS_LABELS[data.application.status]
                  : "پرونده اعتباری ندارید"}
              </Txt>
              <Txt muted>اعتبار کل</Txt>
              <Money amount={data.totalCreditLimit} />
              <Row style={{ justifyContent: "space-between" }}>
                <Txt>مصرف‌شده</Txt>
                <Money amount={data.usedCredit} size={15} />
              </Row>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt>اعتبار قابل استفاده</Txt>
                <Money amount={data.remainingCredit} size={15} />
              </Row>
              <Notice
                error={!!data.application?.rejectionReason}
                text={data.application?.rejectionReason || undefined}
              />
              <Button
                label={
                  data.application
                    ? "تکمیل یا ویرایش درخواست"
                    : "درخواست اعتبار"
                }
                onPress={() => navigation.navigate("CreditApply")}
              />
            </Card>
            {data.notifications.map((n) => (
              <Notice
                key={n.id}
                error={n.severity === "danger"}
                text={`${n.title}\n${n.message}`}
              />
            ))}
            <Card>
              <Txt bold size={20}>
                گزارش اعتبارسنجی ICS24
              </Txt>
              <Txt muted>
                گزارش جدید هر دو ماه یک‌بار لازم است. نسخه‌های قبلی در پرونده
                شما باقی می‌مانند.
              </Txt>
              {data.creditReportRequired && (
                <Notice error text="گزارش جدید اعتبارسنجی لازم است." />
              )}
              <Button
                secondary
                label="دریافت گزارش از ICS24"
                onPress={() =>
                  void Linking.openURL("https://ics24.ir/").catch((e) =>
                    Alert.alert("خطا", e.message),
                  )
                }
              />
              <Button
                label="بارگذاری PDF گزارش جدید"
                busy={a.busy}
                onPress={() =>
                  void a.run(async () => {
                    await uploadFile(true);
                    await q.refetch();
                  }, "گزارش دریافت شد؛ نتیجهٔ استخراج در پرونده نمایش داده می‌شود.")
                }
              />
              {data.creditReports.map((r) => (
                <View
                  key={r.id}
                  style={{
                    gap: 9,
                    borderTopWidth: 1,
                    borderColor: c.border,
                    paddingTop: 14,
                  }}
                >
                  <Txt bold>
                    {r.originalName} • {date(r.createdAt)}
                  </Txt>
                  <Row style={{ justifyContent: "space-between" }}>
                    <Txt>امتیاز: {r.score?.toLocaleString("fa-IR") || "—"}</Txt>
                    <Txt>رتبه: {r.riskGrade || "—"}</Txt>
                  </Row>
                  <View
                    style={{
                      height: 8,
                      borderRadius: 5,
                      backgroundColor: c.border,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: 8,
                        width: `${Math.max(0, Math.min(100, (r.score || 0) / 9))}%`,
                        backgroundColor: c.primary,
                      }}
                    />
                  </View>
                  <Txt muted>
                    {r.riskLevel || "سطح ریسک مشخص نشده"} • اعتبار تا{" "}
                    {date(r.expiresAt)}
                    {r.isExpired ? " (منقضی شده)" : ""}
                  </Txt>
                  <Txt>
                    احتمال خوش‌حسابی: {r.goodPayerMinPercent ?? "—"} تا{" "}
                    {r.goodPayerMaxPercent ?? "—"}٪
                  </Txt>
                  <Txt>تعداد چک برگشتی: {r.bouncedChequeCount ?? "—"}</Txt>
                  {r.data.negativeReasons.map((n, i) => (
                    <Txt key={i} size={12}>
                      {n.code}: {n.description}
                    </Txt>
                  ))}
                  {r.warnings.map((w, i) => (
                    <Notice key={i} text={w} />
                  ))}
                  <Button
                    secondary
                    label="ذخیره / مشاهده اصل گزارش"
                    busy={a.busy}
                    onPress={() =>
                      void a.run(
                        () => sharePrivate(r.fileUrl, "credit-report.pdf"),
                        "فایل دریافت شد.",
                      )
                    }
                  />
                </View>
              ))}
            </Card>
            {data.installmentOrders.map((o) => (
              <Card key={o.orderId}>
                <Txt bold size={20}>
                  اقساط سفارش {o.orderCode}
                </Txt>
                <Txt muted>{o.planLabel}</Txt>
                {o.schedule.map((s) => (
                  <View
                    key={s.index}
                    style={{
                      gap: 9,
                      paddingTop: 10,
                      borderTopWidth: 1,
                      borderColor: c.border,
                    }}
                  >
                    <Row style={{ justifyContent: "space-between" }}>
                      <Txt bold>{date(s.dueDate)}</Txt>
                      <Money amount={s.amount} size={16} />
                    </Row>
                    <Txt muted>
                      {s.receipt
                        ? s.receipt.status === "approved"
                          ? "رسید تأیید شده"
                          : s.receipt.status === "pending"
                            ? "رسید در انتظار بررسی"
                            : "رسید رد شده"
                        : s.isOverdue
                          ? "سررسید گذشته؛ رسید لازم است"
                          : s.isDue
                            ? "موعد پرداخت"
                            : "در انتظار سررسید"}
                    </Txt>
                    {s.receipt?.rejectionReason && (
                      <Notice error text={s.receipt.rejectionReason} />
                    )}
                    {s.receipt?.receiptUrl && (
                      <Button
                        secondary
                        label="دریافت رسید فعلی"
                        onPress={() =>
                          void a.run(() =>
                            sharePrivate(
                              s.receipt!.receiptUrl,
                              "installment-receipt.pdf",
                            ),
                          )
                        }
                      />
                    )}
                    <Button
                      label={
                        s.receipt
                          ? "ارسال رسید جدید"
                          : "بارگذاری و ثبت رسید این قسط"
                      }
                      disabled={
                        s.receipt?.status === "approved" ||
                        s.receipt?.status === "pending"
                      }
                      busy={a.busy}
                      onPress={() =>
                        void a.run(async () => {
                          const f = await uploadFile();
                          if (!f) return;
                          await api.post(
                            `/credit/installments/${o.orderId}/${s.index}/receipt`,
                            { receiptUrl: f.url },
                          );
                          await q.refetch();
                        }, "رسید قسط ثبت شد و پس از تأیید مدیر، پرداخت نهایی می‌شود.")
                      }
                    />
                  </View>
                ))}
              </Card>
            ))}
            {!!data.chequeOrders.length && (
              <Card>
                <Txt bold size={20}>
                  ثبت چک بعدی
                </Txt>
                <Select
                  label="فاکتور چکی"
                  value={String(chequeOrder?.orderId || "")}
                  options={data.chequeOrders.map((o) => ({
                    label: o.orderCode,
                    value: String(o.orderId),
                  }))}
                  onChange={setOrderId}
                />
                {chequeOrder?.nextInstallment && (
                  <Notice
                    text={`مبلغ چک: ${money(chequeOrder.nextInstallment.amount)}\nسررسید: ${date(chequeOrder.nextInstallment.dueDate)}`}
                  />
                )}
                <Notice error text={chequeOrder?.blockedReason || undefined} />
                <Field
                  label="شماره چک / صیادی"
                  value={number}
                  onChangeText={setNumber}
                  keyboardType="number-pad"
                />
                <Field label="نام بانک" value={bank} onChangeText={setBank} />
                <Field
                  label="نام صاحب حساب"
                  value={holder}
                  onChangeText={setHolder}
                />
                <Button
                  secondary
                  label={
                    image ? "تصویر انتخاب شد؛ تغییر تصویر" : "بارگذاری تصویر چک"
                  }
                  busy={a.busy}
                  onPress={() =>
                    void a.run(async () => {
                      const f = await uploadFile();
                      if (f) setImage(f.url);
                    }, "تصویر آماده ثبت شد.")
                  }
                />
                <Button
                  label="ثبت چک با مبلغ و تاریخ تعیین‌شده"
                  disabled={
                    !chequeOrder?.canSubmitNextCheque ||
                    !number ||
                    !bank ||
                    !holder
                  }
                  busy={a.busy}
                  onPress={() =>
                    void a.run(async () => {
                      await api.post("/credit/cheques", {
                        orderId: chequeOrder?.orderId,
                        chequeNumber: ascii(number),
                        bankName: bank,
                        accountHolder: holder,
                        imageUrl: image || undefined,
                      });
                      setNumber("");
                      setImage("");
                      await q.refetch();
                    })
                  }
                />
              </Card>
            )}
            {!!data.cheques.length && (
              <Card>
                <Txt bold size={20}>
                  چک‌های ثبت‌شده
                </Txt>
                {data.cheques.map((ch) => (
                  <View key={ch.id} style={{ gap: 6 }}>
                    <Txt bold>
                      {ch.bankName} • {ch.chequeNumber}
                    </Txt>
                    <Row style={{ justifyContent: "space-between" }}>
                      <Txt>{date(ch.dueDate)}</Txt>
                      <Money amount={ch.amount} size={15} />
                    </Row>
                    <Txt muted>{CHEQUE_STATUS_LABELS[ch.status]}</Txt>
                  </View>
                ))}
              </Card>
            )}
          </>
        )
      )}
      {a.feedback}
    </Page>
  );
}
export function CreditApplyScreen({ navigation }: ScreenProps<"CreditApply">) {
  const q = useCredit(),
    a = useAction();
  const { user } = useStore();
  const existing = q.data?.application;
  const [nationalId, setNational] = useState(user?.nationalCode || ""),
    [businessType, setBusiness] = useState("مغازه‌دار"),
    [referral, setReferral] = useState("");
  const [files, setFiles] = useState<Record<string, string>>({});
  const fields = [
    ["nationalCardUrl", "کارت ملی"],
    ["businessDocsUrl", "جواز کسب / اجاره‌نامه"],
    ["checkImageUrl", "چک صیادی"],
    ["bankStatementUrl", "گردش حساب (اختیاری)"],
  ] as const;
  const file = (key: string) =>
    files[key] || existing?.[key as "nationalCardUrl"] || "";
  return (
    <Page>
      <Card>
        <Txt bold size={22}>
          پرونده درخواست اعتبار
        </Txt>
        <Notice text="ابتدا گزارش معتبر ICS24 را در صفحه اعتبار بارگذاری کنید. مدارک فقط برای خودتان و مسئول مجاز پرونده قابل دسترسی هستند." />
        <Field
          label="کد ملی"
          value={nationalId}
          onChangeText={setNational}
          keyboardType="number-pad"
          maxLength={10}
        />
        <Select
          label="نوع کسب‌وکار"
          value={businessType}
          onChange={setBusiness}
          options={["مغازه‌دار", "عمده‌فروش", "فروشگاه اینترنتی", "سایر"].map(
            (v) => ({ label: v, value: v }),
          )}
        />
        {fields.map(([key, label]) => (
          <View key={key} style={{ gap: 7 }}>
            <Txt bold>{label}</Txt>
            <Button
              secondary
              label={
                file(key)
                  ? "مدرک موجود است؛ بارگذاری نسخه جدید"
                  : "انتخاب و بارگذاری فایل"
              }
              busy={a.busy}
              onPress={() =>
                void a.run(async () => {
                  const f = await uploadFile();
                  if (f) setFiles((v) => ({ ...v, [key]: f.url }));
                }, "فایل آمادهٔ ثبت پرونده شد.")
              }
            />
          </View>
        ))}
        <Field
          label="اطلاعات معرف (اختیاری)"
          value={referral}
          onChangeText={setReferral}
        />
        {a.feedback}
        <Button
          label="ثبت و ارسال برای بررسی"
          busy={a.busy}
          disabled={
            !file("nationalCardUrl") ||
            !file("businessDocsUrl") ||
            !file("checkImageUrl")
          }
          onPress={() =>
            void a.run(async () => {
              await api.post("/credit/apply", {
                nationalId: ascii(nationalId),
                businessType,
                nationalCardUrl: file("nationalCardUrl"),
                businessDocsUrl: file("businessDocsUrl"),
                checkImageUrl: file("checkImageUrl"),
                bankStatementUrl: file("bankStatementUrl") || null,
                referralInfo: referral || null,
              });
              await q.refetch();
              navigation.goBack();
            })
          }
        />
      </Card>
    </Page>
  );
}
export function DocumentsScreen() {
  const { user } = useStore(),
    a = useAction();
  const q = useQuery({
    queryKey: ["document-requests", user?.id],
    queryFn: () =>
      api.get<{ items: DocumentRequestDTO[] }>("/document-requests"),
    enabled: !!user,
  });
  return (
    <Page refresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Txt bold size={22}>
        تکمیل و جایگزینی مدارک
      </Txt>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Notice error text={q.error.message} />
      ) : q.data?.items.length ? (
        q.data.items.map((r) => (
          <Card key={r.id}>
            <Txt bold size={18}>
              {r.documentLabel}
            </Txt>
            <Txt>{r.message}</Txt>
            <Txt muted>
              {date(r.createdAt)} • {DOCUMENT_REQUEST_STATUS_LABELS[r.status]}
            </Txt>
            {r.submissions.map((s) => (
              <View key={s.id}>
                <Txt muted>
                  {date(s.submittedAt)} •{" "}
                  {s.status === "approved"
                    ? "تأیید شده"
                    : s.status === "rejected"
                      ? "نیاز به اصلاح"
                      : "در انتظار بررسی"}
                </Txt>
                <Notice
                  error={s.status === "rejected"}
                  text={s.reviewNote || undefined}
                />
              </View>
            ))}
            {r.status === "pending" && (
              <Button
                label="بارگذاری و ارسال مدرک جایگزین"
                busy={a.busy}
                onPress={() =>
                  void a.run(async () => {
                    const f = await uploadFile();
                    if (!f) return;
                    await api.post(`/document-requests/${r.id}/submit`, {
                      fileUrl: f.url,
                    });
                    await q.refetch();
                  }, "مدرک برای بررسی مدیر ارسال شد.")
                }
              />
            )}
          </Card>
        ))
      ) : (
        <Empty
          title="درخواست بازی ندارید"
          description="هر زمان مدرکی نیاز به اصلاح داشته باشد، اینجا نمایش داده می‌شود."
        />
      )}
      {a.feedback}
    </Page>
  );
}
