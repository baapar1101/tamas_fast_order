import React, { useEffect, useRef, useState } from "react";
import { BackHandler, Linking, View } from "react-native";
import { WebView } from "react-native-webview";
import { useStore } from "../state";
import { Button, Empty, Loading, Notice, Page, useColors } from "../ui";
import { MANAGEMENT_ORIGIN, managementNavigation } from "../web-policy";

export function ManagementScreen() {
  const { user } = useStore();
  const c = useColors();
  const web = useRef<WebView<object>>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const allowed =
    !!user?.isActive && (user.role === "admin" || user.role === "operator");
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack) return false;
      web.current?.goBack();
      return true;
    });
    return () => listener.remove();
  }, [canGoBack]);
  if (!allowed)
    return (
      <Page>
        <Empty
          title="پنل مدیریت"
          description="ابتدا با حساب مدیر یا اپراتور وارد اپ شوید."
        />
      </Page>
    );
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Notice text="پنل مدیریت نسخه وب است. برای امنیت، ورود مدیریت در همین پنجره انجام می‌شود." />
      {error ? (
        <Page>
          <Empty
            title="بارگذاری پنل ناموفق بود"
            description={error}
            action={
              <Button
                label="تلاش مجدد"
                onPress={() => {
                  setError("");
                  setRevision((v) => v + 1);
                }}
              />
            }
          />
        </Page>
      ) : (
        <WebView<object>
          key={`${user.id}-${revision}`}
          ref={web}
          source={{ uri: `${MANAGEMENT_ORIGIN}/native-management.html?v=1.1.0` }}
          style={{ flex: 1, backgroundColor: c.bg }}
          startInLoadingState
          renderLoading={() => <Loading />}
          // An ephemeral web session prevents an administrator's cookies surviving
          // a native logout/account switch. Native credentials never enter JS/URLs.
          incognito
          domStorageEnabled
          javaScriptEnabled
          // Enable the WebView marker for our trusted bootstrap page. Messages
          // cannot trigger native actions or grant permissions.
          onMessage={() => undefined}
          mixedContentMode="never"
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          originWhitelist={["https://*", "tel:*", "mailto:*"]}
          onShouldStartLoadWithRequest={(request) => {
            const policy = managementNavigation(request.url);
            if (policy === "external")
              void Linking.openURL(request.url).catch(() =>
                setError("باز کردن لینک ممکن نشد."),
              );
            return policy === "internal";
          }}
          onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
          onError={() =>
            setError("ارتباط امن با سایت برقرار نشد. اینترنت را بررسی کنید.")
          }
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode >= 500)
              setError("سرور موقتاً در دسترس نیست.");
          }}
          onRenderProcessGone={() =>
            setError("نمای وب بسته شد. دوباره پنل را باز کنید.")
          }
        />
      )}
    </View>
  );
}
