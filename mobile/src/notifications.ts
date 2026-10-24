import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { api, session } from "./api";
let lastRegistration = "";
let lastRegisteredAt = 0;
async function registerToken(token: string, capturedSession: string | null) {
  if (!capturedSession || session.token() !== capturedSession) return;
  let id = await SecureStore.getItemAsync("tamas.installation");
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync("tamas.installation", id);
  }
  if (session.token() !== capturedSession) return;
  const registration = `${capturedSession}:${token}`;
  if (registration === lastRegistration && Date.now() - lastRegisteredAt < 300_000) return;
  await api.post("/native/push-devices", { installationId: id, token, platform: "android" });
  if (session.token() !== capturedSession) return;
  lastRegistration = registration;
  lastRegisteredAt = Date.now();
}
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
export async function pushStatus() {
  const p = await Notifications.getPermissionsAsync();
  const registered = await SecureStore.getItemAsync("tamas.push.enabled");
  return p.granted
    ? registered === "true"
      ? "اعلان‌های این دستگاه فعال شده‌اند."
      : "اجازهٔ اندروید داده شده؛ برای اتصال به سرور، فعال‌سازی را بزنید."
    : "اجازه نمایش اعلان هنوز داده نشده است.";
}
export async function enablePush() {
  const capturedSession = session.token();
  if (!capturedSession) throw new Error("برای فعال‌سازی اعلان ابتدا وارد شوید.");
  if (Platform.OS !== "android")
    throw new Error("این نسخه برای اندروید تنظیم شده است.");
  await Notifications.setNotificationChannelAsync("orders", {
    name: "سفارش‌ها و اقساط",
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "برای دریافت هشدار، اجازه اعلان را از تنظیمات اندروید فعال کنید.",
    );
  const config = await api.get<{ pushEnabled: boolean }>("/native/config");
  if (!config.pushEnabled)
    throw new Error(
      "ارسال پوش هنوز در سرور فعال نشده است؛ پیامک و ربات همچنان در دسترس‌اند.",
    );
  const t = await Notifications.getDevicePushTokenAsync();
  if (typeof t.data !== "string")
    throw new Error("شناسه اعلان دستگاه دریافت نشد.");
  await registerToken(t.data, capturedSession);
  if (session.token() === capturedSession) await SecureStore.setItemAsync("tamas.push.enabled", "true");
}
export async function disablePush() {
  lastRegistration = "";
  const id = await SecureStore.getItemAsync("tamas.installation");
  if (id) await api.del("/native/push-devices", { installationId: id });
  await SecureStore.deleteItemAsync("tamas.push.enabled");
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
}
export async function refreshPush() {
  const capturedSession = session.token();
  if (!capturedSession || (await SecureStore.getItemAsync("tamas.push.enabled")) !== "true") return;
  // Returning to the app must never open a fresh permission dialog.
  if (!(await Notifications.getPermissionsAsync()).granted) {
    if (session.token() === capturedSession) await disablePush();
    return;
  }
  const token = await Notifications.getDevicePushTokenAsync();
  if (typeof token.data === "string") await registerToken(token.data, capturedSession);
}
export function watchPushToken() {
  const capturedSession = session.token();
  return Notifications.addPushTokenListener((token) => {
    // Use the token provided by the listener; requesting a new token here can loop.
    void (async () => {
      if (typeof token.data === "string" && (await SecureStore.getItemAsync("tamas.push.enabled")) === "true" && (await Notifications.getPermissionsAsync()).granted)
        await registerToken(token.data, capturedSession);
    })().catch(() => {});
  });
}
