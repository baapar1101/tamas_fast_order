import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";
import { api, session } from "./api";
import { privateUrl } from "./domain";
const cache = `${FileSystem.cacheDirectory}tamas-private/`;
export async function clearPrivateCache() {
  await FileSystem.deleteAsync(cache, { idempotent: true });
}
async function selectAttachment(report: boolean) {
  const source = report
    ? "file"
    : await new Promise<"file" | "camera" | "photos" | null>((resolve) =>
        Alert.alert(
          "بارگذاری مدرک یا رسید",
          "روش دریافت فایل را انتخاب کنید.",
          [
            { text: "انتخاب فایل / PDF", onPress: () => resolve("file") },
            { text: "گالری تصاویر", onPress: () => resolve("photos") },
            { text: "گرفتن عکس با دوربین", onPress: () => resolve("camera") },
            { text: "انصراف", style: "cancel", onPress: () => resolve(null) },
          ],
          { cancelable: true, onDismiss: () => resolve(null) },
        ),
      );
  if (!source) return null;
  if (source === "file") {
    const r = await DocumentPicker.getDocumentAsync({
      type: report ? "application/pdf" : ["image/*", "application/pdf"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    return r.canceled ? null : r.assets[0] || null;
  }
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted)
      throw new Error("برای ثبت عکس مدرک، اجازه دوربین لازم است.");
  }
  const r =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.85,
          exif: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.85,
          exif: false,
        });
  if (r.canceled || !r.assets[0]) return null;
  const asset = r.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName || `receipt-${Date.now()}.jpg`,
    mimeType: asset.mimeType || "image/jpeg",
    size: asset.fileSize,
  };
}
export async function uploadFile(
  report = false,
): Promise<{ url: string; name: string } | null> {
  const asset = await selectAttachment(report);
  if (!asset) return null;
  try {
    if (asset.size && asset.size > 20 * 1024 * 1024)
      throw new Error("حجم فایل نباید بیشتر از ۲۰ مگابایت باشد.");
    const form = new FormData();
    // React Native's multipart implementation accepts a local URI descriptor.
    form.append("file", {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType || (report ? "application/pdf" : "image/jpeg"),
    } as unknown as Blob);
    if (report) {
      await api.upload("/credit/reports/upload", form);
      return { url: "", name: asset.name };
    }
    const res = await api.upload<{ url: string }>("/uploads", form);
    return { url: res.url, name: asset.name };
  } finally {
    if (asset.uri.startsWith(FileSystem.cacheDirectory || "__none__"))
      await FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(
        () => {},
      );
  }
}
export async function sharePrivate(value: string, name = "document.pdf") {
  const url = privateUrl(value);
  const token = session.token();
  if (!token) throw new Error("ابتدا وارد شوید.");
  await FileSystem.makeDirectoryAsync(cache, { intermediates: true });
  const path = `${cache}${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  let finalPath = path;
  try {
    const result = await FileSystem.downloadAsync(url, path, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (result.status !== 200 || token !== session.token())
      throw new Error("دریافت مدرک ناموفق بود.");
    if (!(await Sharing.isAvailableAsync()))
      throw new Error("اشتراک‌گذاری روی این دستگاه در دسترس نیست.");
    const mime = Object.entries(result.headers)
      .find(([key]) => key.toLowerCase() === "content-type")?.[1]
      ?.split(";")[0];
    const ext =
      mime === "image/jpeg"
        ? ".jpg"
        : mime === "image/png"
          ? ".png"
          : mime === "image/webp"
            ? ".webp"
            : ".pdf";
    finalPath = path.replace(/\.[^.]+$/, ext);
    if (finalPath !== path)
      await FileSystem.moveAsync({ from: path, to: finalPath });
    await Sharing.shareAsync(finalPath, {
      dialogTitle: "ذخیره یا اشتراک‌گذاری مدرک",
      mimeType: mime,
    });
  } finally {
    await FileSystem.deleteAsync(finalPath, { idempotent: true }).catch(
      () => {},
    );
  }
}
