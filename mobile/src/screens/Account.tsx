import React, { useEffect, useState } from "react";
import { Alert, Linking, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import type { AuthStateDTO, OrderDTO } from "@tamas/shared";
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
  confirm,
} from "../ui";
import { uploadFile } from "../files";
import type { RootRoutes, ScreenProps } from "../navigation";
type Nav = NativeStackNavigationProp<RootRoutes>;
export function LoginScreen({ navigation }: ScreenProps<"Login">) {
  const store = useStore(),
    a = useAction();
  const [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [password, setPassword] = useState("");
  const [mode, setMode] = useState<"otp" | "password">("otp"),
    [sent, setSent] = useState(false),
    [until, setUntil] = useState(0),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = Math.max(0, Math.ceil((until - now) / 1000));
  const send = () =>
    a.run(async () => {
      const r = await api.post<{ resendAfter: number }>("/auth/otp/request", {
        phone: ascii(phone),
      });
      setUntil(Date.now() + r.resendAfter * 1000);
      setSent(true);
    }, "کد ورود پیامک شد.");
  const login = () =>
    a.run(async () => {
      const r = await api.post<AuthStateDTO>(
        mode === "password" ? "/auth/password/login" : "/auth/otp/verify",
        mode === "password"
          ? { phone: ascii(phone), password }
          : { phone: ascii(phone), code: ascii(code) },
      );
      await store.login(r);
      navigation.replace(r.complete ? "Main" : "Profile");
    }, "خوش آمدید.");
  return (
    <Page>
      <Card>
        <Txt bold size={26}>
          به تماس مارکت خوش آمدید
        </Txt>
        <Txt muted>
          با همان حساب سایت وارد شوید. اطلاعات و سفارش‌ها مشترک هستند.
        </Txt>
        <Field
          label="شماره موبایل"
          keyboardType="phone-pad"
          autoComplete="tel"
          value={phone}
          onChangeText={(v) => {
            setPhone(v);
            setSent(false);
          }}
          placeholder="09xxxxxxxxx"
          maxLength={13}
          editable={!a.busy}
        />
        <Select
          label="روش ورود"
          value={mode}
          options={[
            { label: "کد یک‌بارمصرف", value: "otp" },
            { label: "رمز عبور", value: "password" },
          ]}
          onChange={(v) => setMode(v as typeof mode)}
        />
        {mode === "password" ? (
          <Field
            label="رمز عبور"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
          />
        ) : sent ? (
          <Field
            label="کد پیامک‌شده"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            autoComplete="sms-otp"
            maxLength={8}
          />
        ) : null}
        {a.feedback}
        {mode === "otp" && !sent ? (
          <Button
            label="دریافت کد ورود"
            onPress={() => void send()}
            busy={a.busy}
            disabled={ascii(phone).replace(/\D/g, "").length !== 11}
          />
        ) : (
          <Button
            label="ورود به حساب"
            onPress={() => void login()}
            busy={a.busy}
            disabled={mode === "otp" ? !code : !password}
          />
        )}
        {mode === "otp" && sent && (
          <Button
            secondary
            label={
              seconds
                ? `ارسال مجدد تا ${seconds.toLocaleString("fa-IR")} ثانیه دیگر`
                : "ارسال مجدد کد"
            }
            onPress={() => void send()}
            disabled={seconds > 0}
            busy={a.busy}
          />
        )}
        <Txt muted size={12}>
          کد ورود و رمز عبور شما هرگز در حافظهٔ عمومی دستگاه ذخیره نمی‌شود.
        </Txt>
      </Card>
    </Page>
  );
}
export function AccountScreen() {
  const store = useStore(),
    nav = useNavigation<Nav>();
  if (!store.ready) return <Loading />;
  if (!store.user)
    return (
      <Page>
        <Empty
          title="حساب کاربری شما"
          description={
            store.authError || "برای مشاهده سفارش‌ها و اطلاعات حساب، وارد شوید."
          }
          action={
            <Button
              label="ورود / ثبت‌نام"
              onPress={() => nav.navigate("Login")}
            />
          }
        />
        {store.authError && (
          <Button
            label="تلاش دوباره برای بازیابی نشست"
            secondary
            onPress={() =>
              void store.refresh().catch((e) => Alert.alert("خطا", e.message))
            }
          />
        )}
      </Page>
    );
  const items: Array<[keyof RootRoutes, string]> = [
    ["Profile", "اطلاعات حساب و احراز هویت"],
    ["Wallet", "کیف پول و تراکنش‌ها"],
    ["Credit", "اعتبار، چک‌ها و اقساط"],
    ["Documents", "درخواست‌های تکمیل مدارک"],
    ["Discounts", "کدهای تخفیف من"],
    ["Connections", "اتصال به تلگرام و بله"],
    ["Support", "گفت‌وگو با پشتیبانی"],
    ["Settings", "تنظیمات اپ و اعلان‌ها"],
    ["Terms", "شرایط و قوانین"],
  ];
  return (
    <Page
      refresh={() =>
        void store.refresh().catch((e) => Alert.alert("خطا", e.message))
      }
    >
      <Card>
        <Txt bold size={24}>
          {store.user.name} {store.user.lastName}
        </Txt>
        <Txt muted>
          {store.user.storeName} • {store.user.phone}
        </Txt>
        <Notice
          text={
            !store.complete
              ? "برای ثبت سفارش، اطلاعات حساب را کامل کنید."
              : !store.user.isActive
                ? "حساب همکاری شما در انتظار تأیید است."
                : "حساب همکاری شما فعال است."
          }
        />
      </Card>
      <Card>
        {items.map(([key, label]) => (
          <Button
            key={key}
            secondary
            label={label}
            onPress={() => nav.navigate(key as "Profile")}
          />
        ))}
      </Card>
      <Button
        secondary
        label="خروج از حساب"
        onPress={() =>
          confirm(
            "خروج از حساب",
            "نشست و فایل‌های خصوصی موقت از این دستگاه پاک می‌شوند.",
            () =>
              void store.logout().catch((e) => Alert.alert("خطا", e.message)),
          )
        }
      />
    </Page>
  );
}
export function ProfileScreen({ navigation }: ScreenProps<"Profile">) {
  const store = useStore(),
    a = useAction();
  const u = store.user;
  const [form, setForm] = useState({
    name: u?.name || "",
    lastName: u?.lastName || "",
    storeName: u?.storeName || "",
    landline: u?.landline || "",
    address: u?.address || "",
    postalCode: u?.postalCode || "",
    certificateFileUrl: u?.certificateFileUrl || "",
    activity: u?.activity || "",
    pageWebsite: u?.pageWebsite || "",
  });
  const [national, setNational] = useState(u?.nationalCode || ""),
    [birth, setBirth] = useState(u?.birthDate || "");
  const [oldPassword, setOld] = useState(""),
    [newPassword, setNew] = useState("");
  if (!u)
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
  const labels: Record<keyof typeof form, string> = {
    name: "نام",
    lastName: "نام خانوادگی",
    storeName: "نام فروشگاه",
    landline: "تلفن ثابت",
    address: "نشانی تحویل",
    postalCode: "کد پستی",
    certificateFileUrl: "جواز کسب",
    activity: "زمینه فعالیت",
    pageWebsite: "وب‌سایت",
  };
  return (
    <Page>
      <Card>
        <Txt bold size={20}>
          اطلاعات حساب
        </Txt>
        {(Object.keys(form) as Array<keyof typeof form>)
          .filter((k) => k !== "certificateFileUrl")
          .map((k) => (
            <Field
              key={k}
              label={labels[k]}
              value={form[k]}
              onChangeText={(v) => setForm((f) => ({ ...f, [k]: v }))}
              multiline={k === "address"}
              keyboardType={
                k === "landline" || k === "postalCode"
                  ? "number-pad"
                  : "default"
              }
            />
          ))}
        <Button
          secondary
          label={
            form.certificateFileUrl ? "جایگزینی جواز کسب" : "بارگذاری جواز کسب"
          }
          busy={a.busy}
          onPress={() =>
            void a.run(async () => {
              const f = await uploadFile();
              if (f) setForm((s) => ({ ...s, certificateFileUrl: f.url }));
            }, "فایل آمادهٔ ذخیره شد.")
          }
        />
        <Button
          label="ذخیره اطلاعات"
          busy={a.busy}
          onPress={() =>
            void a.run(async () => {
              await api.put("/auth/profile", form);
              await store.refresh();
            })
          }
        />
        {a.feedback}
      </Card>
      <Card>
        <Txt bold size={20}>
          احراز هویت اختیاری
        </Txt>
        <Txt muted>اطلاعات هویتی توسط سرویس فعلی سایت بررسی می‌شود.</Txt>
        <Field
          label="کد ملی"
          value={national}
          onChangeText={setNational}
          keyboardType="number-pad"
          maxLength={10}
        />
        <Field
          label="تاریخ تولد شمسی"
          placeholder="1370/01/01"
          value={birth}
          onChangeText={setBirth}
        />
        <Button
          secondary
          label="استعلام هویت"
          busy={a.busy}
          onPress={() =>
            void a.run(async () => {
              await api.post("/auth/inquiry-identity", {
                national_code: ascii(national),
                birth_date: ascii(birth),
              });
              await store.refresh();
            })
          }
        />
      </Card>
      <Card>
        <Txt bold size={20}>
          تنظیم رمز عبور
        </Txt>
        <Field
          label="رمز فعلی (اگر قبلاً تنظیم کرده‌اید)"
          secureTextEntry
          value={oldPassword}
          onChangeText={setOld}
        />
        <Field
          label="رمز جدید (حداقل ۶ کاراکتر)"
          secureTextEntry
          value={newPassword}
          onChangeText={setNew}
        />
        <Button
          secondary
          label="ثبت رمز جدید"
          busy={a.busy}
          disabled={newPassword.length < 6}
          onPress={() =>
            void a.run(async () => {
              await api.post("/auth/password/set", {
                oldPassword: oldPassword || undefined,
                newPassword,
              });
              setOld("");
              setNew("");
            })
          }
        />
      </Card>
    </Page>
  );
}
export function OrdersScreen() {
  const store = useStore(),
    nav = useNavigation<Nav>();
  const q = useQuery({
    queryKey: ["orders", store.user?.id],
    queryFn: ({ signal }) =>
      api.get<{ orders: OrderDTO[] }>("/orders", undefined, signal),
    enabled: !!store.user,
  });
  return (
    <Page refresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {!store.user ? (
        <Empty
          title="سفارش‌های من"
          description="برای پیگیری سفارش وارد شوید."
          action={<Button label="ورود" onPress={() => nav.navigate("Login")} />}
        />
      ) : q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Empty
          title="دریافت سفارش‌ها ناموفق بود"
          description={q.error.message}
          action={<Button label="تلاش مجدد" onPress={() => void q.refetch()} />}
        />
      ) : q.data?.orders.length ? (
        q.data.orders.map((o) => (
          <Card key={o.id}>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt bold size={18}>
                سفارش {o.orderCode}
              </Txt>
              <Txt muted>{date(o.createdAt)}</Txt>
            </Row>
            <Txt>
              {statusLabel(o.status)} •{" "}
              {o.paymentStatus === "paid"
                ? "پرداخت شده"
                : o.paymentStatus === "pending"
                  ? "در انتظار تأیید پرداخت"
                  : "پرداخت نشده"}
            </Txt>
            <Money amount={o.total} />
            <Button
              secondary
              label="جزئیات و اطلاعات پرداخت"
              onPress={() => nav.navigate("Order", { id: o.id })}
            />
          </Card>
        ))
      ) : (
        <Empty title="هنوز سفارشی ثبت نشده" />
      )}
    </Page>
  );
}
export function statusLabel(status: string) {
  return (
    (
      {
        pending: "در انتظار بررسی",
        confirmed: "تأیید شده",
        processing: "در حال آماده‌سازی",
        shipped: "ارسال شده",
        delivered: "تحویل شده",
        cancelled: "لغو شده",
      } as Record<string, string>
    )[status] || status
  );
}
export function ConnectionsScreen() {
  const store = useStore(),
    a = useAction();
  const q = useQuery({
    queryKey: ["connections", store.user?.id],
    queryFn: async () =>
      Promise.all(
        (["telegram", "bale"] as const).map(async (key) => ({
          key,
          ...(await api.get<{
            enabled: boolean;
            account: { linked: boolean; username?: string };
          }>(`/customer-${key}/status`)),
        })),
      ),
    enabled: !!store.user,
  });
  return (
    <Page>
      <Txt bold size={22}>
        اطلاع‌رسانی سفارش‌ها
      </Txt>
      <Txt muted>حساب تلگرام یا بله را با لینک امن به همین حساب متصل کنید.</Txt>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Notice error text={q.error.message} />
      ) : (
        q.data?.map((b) => (
          <Card key={b.key}>
            <Txt bold size={18}>
              {b.key === "telegram" ? "تلگرام" : "بله"}
            </Txt>
            <Txt>
              {b.account.linked
                ? `متصل ${b.account.username || ""}`
                : "هنوز متصل نشده"}
            </Txt>
            <Button
              label={b.account.linked ? "قطع اتصال" : "اتصال امن به ربات"}
              disabled={!b.enabled}
              busy={a.busy}
              onPress={() => {
                if (b.account.linked)
                  confirm(
                    "قطع اتصال",
                    "اطلاع‌رسانی در این پیام‌رسان متوقف می‌شود.",
                    () =>
                      void a.run(async () => {
                        await api.del(`/customer-${b.key}/link`);
                        await q.refetch();
                      }),
                  );
                else
                  void a.run(async () => {
                    const r = await api.post<{ url: string }>(
                      `/customer-${b.key}/link`,
                    );
                    const url = new URL(r.url);
                    if (
                      url.protocol !== "https:" ||
                      !["t.me", "ble.ir"].includes(url.hostname)
                    )
                      throw new Error("لینک ربات معتبر نیست.");
                    await Linking.openURL(url.href);
                  }, "پس از شروع ربات به اپ برگردید.");
              }}
            />
            {!b.enabled && <Txt muted>ربات از تنظیمات مدیریت غیرفعال است.</Txt>}
          </Card>
        ))
      )}
      {a.feedback}
      <Button
        label="بررسی وضعیت اتصال"
        secondary
        onPress={() => void q.refetch()}
      />
    </Page>
  );
}
export function DiscountsScreen() {
  const store = useStore();
  const q = useQuery({
    queryKey: ["discounts", store.user?.id],
    queryFn: () =>
      api.get<{
        items: Array<{
          code: string;
          kind: string;
          value: number;
          remainingUses: number;
          endsAt: string | null;
          minOrderAmount: number;
        }>;
      }>("/discounts/my"),
    enabled: !!store.user,
  });
  return (
    <Page>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Notice text={q.error.message} error />
      ) : q.data?.items.length ? (
        q.data.items.map((d) => (
          <Card key={d.code}>
            <Txt bold size={21}>
              {d.code}
            </Txt>
            <Txt>
              {d.kind === "free_shipping"
                ? "ارسال رایگان"
                : d.kind === "percent"
                  ? `${d.value.toLocaleString("fa-IR")}٪ تخفیف`
                  : money(d.value)}
            </Txt>
            <Txt muted>
              حداقل خرید: {money(d.minOrderAmount)} • دفعات باقی‌مانده:{" "}
              {d.remainingUses.toLocaleString("fa-IR")}
            </Txt>
            <Txt muted>
              اعتبار تا: {d.endsAt ? date(d.endsAt) : "بدون تاریخ پایان"}
            </Txt>
          </Card>
        ))
      ) : (
        <Empty title="کد تخفیف فعالی ندارید" />
      )}
    </Page>
  );
}
