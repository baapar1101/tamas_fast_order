import type { ExpoConfig } from "expo/config";
import fs from "node:fs";
const googleServices =
  process.env.GOOGLE_SERVICES_JSON || "./google-services.json";
const config: ExpoConfig = {
  name: "تماس مارکت",
  slug: "tamas-market",
  version: "1.0.0",
  scheme: "tamasmarket",
  orientation: "default",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  android: {
    package: "com.tamasmarket.customer",
    versionCode: 1,
    ...(fs.existsSync(googleServices)
      ? { googleServicesFile: googleServices }
      : {}),
    permissions: ["POST_NOTIFICATIONS"],
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.READ_CONTACTS",
    ],
    predictiveBackGestureEnabled: true,
  },
  plugins: [
    "./plugins/with-release-signing.cjs",
    "expo-secure-store",
    "expo-font",
    "expo-document-picker",
    ["expo-notifications", { color: "#087f92", defaultChannel: "orders" }],
    [
      "expo-image-picker",
      {
        photosPermission:
          "برای ارسال رسید و مدارک، تصویر موردنظر را انتخاب کنید.",
        cameraPermission: "برای ثبت تصویر رسید و مدارک، اجازه دوربین لازم است.",
        microphonePermission: false,
      },
    ],
    ["expo-localization", { supportedLocales: ["fa", "en"] }],
  ],
  extra: {
    apiOrigin: "https://tamasmarket.com",
    privacyUrl: "https://tamasmarket.com/terms",
  },
};
export default config;
