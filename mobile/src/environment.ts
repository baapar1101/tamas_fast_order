// Inlined by Expo during the standalone APK build. Production builds force false.
export const QA_BUILD = process.env.EXPO_PUBLIC_TAMAS_QA === "true";
export const API_ORIGIN = QA_BUILD
  ? "http://127.0.0.1:3103"
  : "https://tamasmarket.com";
