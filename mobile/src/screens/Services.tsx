import React, { useEffect, useRef, useState } from "react";
import { Alert, Linking, View } from "react-native";
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
} from "../ui";
import { openBank } from "./Checkout";
import { enablePush, disablePush, pushStatus } from "../notifications";
type Wallet = {
  wallet: { balance: number; isFrozen: boolean };
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
  const [amount, setAmount] = useState(""),
    [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["wallet", user?.id, page],
    queryFn: () => api.get<Wallet>("/wallet", { page }),
    enabled: !!user,
  });
  return (
    <Page refresh={() => void q.refetch()} refreshing={q.isRefetching}>
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
            <Card>
              <Txt bold size={20}>
                موجودی کیف پول
              </Txt>
              <Money amount={q.data.wallet.balance} size={28} />
              {q.data.wallet.isFrozen && (
                <Notice
                  error
                  text="کیف پول موقتاً مسدود است؛ با پشتیبانی تماس بگیرید."
                />
              )}
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
                  <Txt bold>{t.description}</Txt>
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
              <Row style={{ justifyContent: "space-between" }}>
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
    void pushStatus().then(setPush);
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
        <Txt bold>تماس مارکت — نسخه ۱.۰.۰</Txt>
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
