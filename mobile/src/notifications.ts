import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { api } from "./api";
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
  let id = await SecureStore.getItemAsync("tamas.installation");
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync("tamas.installation", id);
  }
  await api.post("/native/push-devices", {
    installationId: id,
    token: t.data,
    platform: "android",
  });
  await SecureStore.setItemAsync("tamas.push.enabled", "true");
}
export async function disablePush() {
  const id = await SecureStore.getItemAsync("tamas.installation");
  if (id) await api.del("/native/push-devices", { installationId: id });
  await SecureStore.deleteItemAsync("tamas.push.enabled");
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
}
export async function refreshPush() {
  if ((await SecureStore.getItemAsync("tamas.push.enabled")) === "true")
    await enablePush();
}
