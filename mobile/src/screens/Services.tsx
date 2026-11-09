import React, { useEffect, useRef, useState } from "react";
import { Alert, AppState, Linking, Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import { useQuery } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { request } from "../api";
import { api } from "../api";
import { useStore } from "../state";
import { ascii, date, money, ORIGIN } from "../domain";
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
import { openBank } from "./Checkout";
import { enablePush, disablePush, pushStatus } from "../notifications";
type Wallet = {
  wallet: {
    balance: number;
    isFrozen: boolean;
    lifetimeCredit: number;
    lifetimeDebit: number;
  };
  config: { enabled: boolean; minTopup: number; maxTopup: number };
  transactions: Array<{
    id: number;
    direction: string;
    amount: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
  }>;
  total: number;
};
export function WalletScreen() {
  const { user } = useStore(),
    a = useAction();
  const c = useColors();
  const [amount, setAmount] = useState("500000"),
    [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["wallet", user?.id, page],
    queryFn: () => api.get<Wallet>("/wallet", { page }),
    enabled: !!user,
  });
  return (
    <Page refresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <View style={{ gap: 4 }}>
        <Txt bold size={24}>
          کیف پول من
        </Txt>
        <Txt muted size={13}>
          مدیریت موجودی، شارژ و سوابق مالی
        </Txt>
      </View>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Empty
          title="دریافت کیف پول ناموفق بود"
          description={q.error.message}
          action={<Button label="تلاش مجدد" onPress={() => void q.refetch()} />}
        />
      ) : (
        q.data && (
          <>
            <LinearGradient
              colors={["#063b37", "#008f7a"]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ padding: 22, borderRadius: 28, gap: 8 }}
            >
              <Txt color="#ffffff" size={14}>
                موجودی قابل استفاده
              </Txt>
              <Txt color="#ffffff" bold size={28}>
                {money(q.data.wallet.balance)}
              </Txt>
              <Txt color="#d5f2f3" size={12}>
                {q.data.wallet.isFrozen
                  ? "کیف پول مسدود است"
                  : "آماده پرداخت سفارش"}
              </Txt>
              <View style={{ gap: 12, marginTop: 12 }}>
                {[
                  ["مجموع واریز", q.data.wallet.lifetimeCredit],
                  ["مجموع برداشت", q.data.wallet.lifetimeDebit],
                ].map(([label, value]) => (
                  <View
                    key={label}
                    style={{
                      padding: 16,
                      gap: 6,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: "#ffffff2b",
                      backgroundColor: "#ffffff12",
                    }}
                  >
                    <Txt color="#d5f2f3" size={12}>
                      {label}
                    </Txt>
                    <Txt color="#ffffff" bold>
                      {money(Number(value || 0))}
                    </Txt>
                  </View>
                ))}
              </View>
            </LinearGradient>
            <Card>
              <Txt bold size={20}>
                شارژ کیف پول
              </Txt>
              <Txt muted size={13}>
                مبلغ دلخواه را انتخاب کنید و از درگاه بانکی بپردازید.
              </Txt>
              {q.data.wallet.isFrozen && (
                <Notice
                  error
                  text="کیف پول موقتاً مسدود است؛ با پشتیبانی تماس بگیرید."
                />
              )}
              <Row style={{ flexWrap: "wrap", gap: 8 }}>
                {[500_000, 1_000_000, 2_000_000, 5_000_000].map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={`شارژ ${money(value)}`}
                    accessibilityState={{ selected: amount === String(value) }}
                    onPress={() => setAmount(String(value))}
                    style={{
                      padding: 10,
                      borderWidth: 1,
                      borderColor:
                        amount === String(value) ? c.primary : c.border,
                      borderRadius: 10,
                      backgroundColor: c.soft,
                    }}
                  >
                    <Txt color={c.primary} size={12}>
                      {value.toLocaleString("fa-IR")}
                    </Txt>
                  </Pressable>
                ))}
              </Row>
              <Field
                label="مبلغ شارژ (تومان)"
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
              />
              <Txt muted size={12}>
                از {money(q.data.config.minTopup)} تا{" "}
                {money(q.data.config.maxTopup)}
              </Txt>
              <Button
                label="شارژ از طریق درگاه بانکی"
                disabled={
                  !q.data.config.enabled || q.data.wallet.isFrozen || !amount
                }
                busy={a.busy}
                onPress={() =>
                  void a.run(async () => {
                    const n = Number(ascii(amount).replace(/[,،\s]/g, ""));
                    if (
                      !Number.isSafeInteger(n) ||
                      n < q.data!.config.minTopup ||
                      n > q.data!.config.maxTopup
                    )
                      throw new Error("مبلغ شارژ خارج از محدوده مجاز است.");
                    const r = await api.post<{ url: string }>("/wallet/topup", {
                      amount: n,
                    });
                    await openBank(r.url);
                  }, "پس از پرداخت به اپ برگردید؛ موجودی از سرور به‌روز می‌شود.")
                }
              />
            </Card>
            <Card>
              <Txt bold size={20}>
                گردش حساب
              </Txt>
              {!q.data.transactions.length && (
                <Txt muted>تراکنشی وجود ندارد.</Txt>
              )}
              {q.data.transactions.map((t) => (
                <View key={t.id} style={{ gap: 6, paddingVertical: 10 }}>
                  <Row>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor:
                          t.direction === "credit"
                            ? c.successSoft
                            : c.dangerSoft,
                      }}
                    >
                      <Ionicons
                        name={t.direction === "credit" ? "add" : "remove"}
                        size={21}
                        color={t.direction === "credit" ? c.success : c.danger}
                      />
                    </View>
                    <Txt bold>{t.description}</Txt>
                  </Row>
                  <Row style={{ justifyContent: "space-between" }}>
                    <Txt muted>{date(t.createdAt)}</Txt>
                    <Txt bold>
                      {t.direction === "credit" ? "+" : "−"} {money(t.amount)}
                    </Txt>
                  </Row>
                  <Txt muted size={12}>
                    مانده: {money(t.balanceAfter)}
                  </Txt>
                </View>
              ))}
              <Row
                style={{ justifyContent: "space-between", flexWrap: "wrap" }}
              >
                <Button
                  label="صفحه قبل"
                  secondary
                  disabled={page === 1}
                  onPress={() => setPage((p) => p - 1)}
                />
                <Txt>{page.toLocaleString("fa-IR")}</Txt>
                <Button
                  label="صفحه بعد"
                  secondary
                  disabled={page * 20 >= q.data.total}
                  onPress={() => setPage((p) => p + 1)}
                />
              </Row>
            </Card>
          </>
        )
      )}
      {a.feedback}
      <Button
        secondary
        label="بررسی مجدد موجودی"
        onPress={() => void q.refetch()}
      />
    </Page>
  );
}
type ChatSession = {
  conversation_id: number;
  visitor_token: string;
  userId: number;
};
type Message = {
  id: number;
  body: string;
  sender_role: string;
  created_at: string;
};
export function SupportScreen() {
  const { user } = useStore(),
    a = useAction();
  const [chat, setChat] = useState<ChatSession | null>(null),
    [ready, setReady] = useState(false),
    [body, setBody] = useState("");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    void SecureStore.getItemAsync("tamas.chat")
      .then((v) => {
        if (v) {
          try {
            const c = JSON.parse(v) as ChatSession;
            if (c.userId === user?.id && active.current) setChat(c);
          } catch {}
        }
      })
      .finally(() => {
        if (active.current) setReady(true);
      });
    return () => {
      active.current = false;
    };
  }, [user?.id]);
  const q = useQuery({
    queryKey: ["chat", user?.id, chat?.conversation_id],
    queryFn: () =>
      request<{ data: Message[] }>(
        `/crm/chat/public/conversations/${chat!.conversation_id}/messages`,
        { headers: { "x-visitor-token": chat!.visitor_token } },
      ),
    enabled: !!chat,
    refetchInterval: 15000,
  });
  return (
    <Page
      refresh={chat ? () => void q.refetch() : undefined}
      refreshing={q.isRefetching}
    >
      <Txt bold size={23}>
        گفت‌وگو با پشتیبانی
      </Txt>
      <Card>
        <Txt muted>
          پیام‌ها در همان صندوق پشتیبانی پنل مدیریت سایت ثبت می‌شوند.
        </Txt>
        {!ready ? (
          <Loading />
        ) : (
          q.data?.data.map((m) => (
            <Card
              key={m.id}
              style={{
                alignSelf:
                  m.sender_role === "visitor" ? "flex-end" : "flex-start",
                maxWidth: "94%",
              }}
            >
              <Txt bold size={12}>
                {m.sender_role === "visitor" ? "شما" : "پشتیبانی"}
              </Txt>
              <Txt>{m.body}</Txt>
              <Txt muted size={11}>
                {date(m.created_at)}
              </Txt>
            </Card>
          ))
        )}
        {q.error && <Notice error text={q.error.message} />}
        <Field
          label="پیام شما"
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={4000}
        />
        {a.feedback}
        <Button
          label="ارسال پیام"
          busy={a.busy}
          disabled={!ready || !body.trim() || !user}
          onPress={() =>
            void a.run(async () => {
              if (!user) return;
              const captured = user.id;
              if (!chat) {
                const res = await api.post<{
                  data: Omit<ChatSession, "userId">;
                }>("/crm/chat/public/conversations/start", {
                  first_name: user.name || "مشتری",
                  last_name: user.lastName,
                  phone: user.phone,
                  initial_message: body,
                  page_url: "tamasmarket://support",
                  device_type: "mobile",
                });
                if (!active.current) return;
                const s = { ...res.data, userId: captured };
                await SecureStore.setItemAsync("tamas.chat", JSON.stringify(s));
                setChat(s);
              } else {
                await request("/crm/chat/public/messages", {
                  method: "POST",
                  headers: { "x-visitor-token": chat.visitor_token },
                  body: {
                    conversation_id: chat.conversation_id,
                    visitor_token: chat.visitor_token,
                    body,
                  },
                });
                await q.refetch();
              }
              setBody("");
            }, "پیام ارسال شد.")
          }
        />
      </Card>
      <Button
        secondary
        label="پشتیبانی واتس‌اپ"
        onPress={() =>
          void Linking.openURL(
            "https://api.whatsapp.com/send/?phone=989135006644",
          ).catch((e) => Alert.alert("خطا", e.message))
        }
      />
    </Page>
  );
}
export function SettingsScreen() {
  const store = useStore(),
    a = useAction();
  const [push, setPush] = useState("در حال بررسی…");
  useEffect(() => {
    const check = () =>
      void pushStatus()
        .then(setPush)
        .catch(() => setPush("بررسی وضعیت اعلان ممکن نشد."));
    check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => sub.remove();
  }, []);
  return (
    <Page>
      <Card>
        <Txt bold size={22}>
          ظاهر اپ
        </Txt>
        <Select
          label="پوسته"
          value={store.theme}
          options={[
            { label: "هماهنگ با دستگاه", value: "system" },
            { label: "روشن", value: "light" },
            { label: "تاریک", value: "dark" },
          ]}
          onChange={(v) => store.setTheme(v as typeof store.theme)}
        />
        <Txt muted>
          فونت فارسی استاندارد، اندازه متن مطابق تنظیمات دستگاه و چیدمان
          راست‌به‌چپ.
        </Txt>
      </Card>
      <Card>
        <Txt bold size={22}>
          اعلان‌های اندروید
        </Txt>
        <Txt>{push}</Txt>
        <Txt muted>
          فقط وجود رویداد جدید روی صفحه قفل نمایش داده می‌شود؛ اطلاعات مالی و
          مدارک در متن اعلان قرار نمی‌گیرند.
        </Txt>
        <Txt muted size={12}>
          با فعال‌سازی، شناسهٔ اعلان این دستگاه برای ارسال پیام از سرویس
          Firebase گوگل استفاده می‌شود. دریافت پوش به Google Play Services و
          اینترنت نیاز دارد؛ پیامک و ربات مستقل هستند.
        </Txt>
        <Button
          label="فعال‌سازی اعلان سفارش و اقساط"
          disabled={!store.user}
          busy={a.busy}
          onPress={() =>
            void a.run(async () => {
              await enablePush();
              setPush(await pushStatus());
            }, "اعلان‌ها فعال شدند.")
          }
        />
        <Button
          secondary
          label="غیرفعال‌سازی اعلان این دستگاه"
          busy={a.busy}
          onPress={() =>
            void a.run(async () => {
              await disablePush();
              setPush(await pushStatus());
            })
          }
        />
        {a.feedback}
      </Card>
      <Card>
        <Txt bold>تماس مارکت — نسخه {Constants.expoConfig?.version || "—"}</Txt>
        <Txt muted>اپ نیتیو مشتریان • اتصال مستقیم به بک‌اند تماس مارکت</Txt>
        <Button
          secondary
          label="سیاست‌ها و پشتیبانی سایت"
          onPress={() =>
            void Linking.openURL(`${ORIGIN}/terms`).catch((e) =>
              Alert.alert("خطا", e.message),
            )
          }
        />
      </Card>
    </Page>
  );
}
