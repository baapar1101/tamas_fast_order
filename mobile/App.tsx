import React, { useEffect, useRef, useState } from "react";
import { Alert, AppState, Linking, Text, View } from "react-native";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { StateProvider, queryClient, useStore } from "./src/state";
import { palette, useColors, Loading } from "./src/ui";
import {
  ProductScreen,
  FavoritesScreen,
  CartScreen,
} from "./src/screens/Store";
import {
  StoreScreen,
  CategoriesScreen,
  SearchScreen,
} from "./src/screens/Storefront";
import { ManagementScreen } from "./src/screens/Management";
import { BrowseProvider } from "./src/browse";
import { StoreHeader, CustomerTabBar, type CustomerTab } from "./src/chrome";
import {
  AccountScreen,
  LoginScreen,
  ProfileScreen,
  OrdersScreen,
  ConnectionsScreen,
  DiscountsScreen,
} from "./src/screens/Account";
import { CheckoutScreen, OrderScreen } from "./src/screens/Checkout";
import {
  CreditScreen,
  CreditApplyScreen,
  DocumentsScreen,
} from "./src/screens/Credit";
import {
  SettingsScreen,
  SupportScreen,
  WalletScreen,
} from "./src/screens/Services";
import { CatalogScreen, TermsScreen } from "./src/screens/Catalog";
import {
  refreshPush,
  watchPushToken,
  acknowledgeNotification,
} from "./src/notifications";
import { notificationDestination } from "./src/domain";
import type { RootRoutes } from "./src/navigation";
import { api } from "./src/api";
const Stack = createNativeStackNavigator<RootRoutes>();
const Tabs = createBottomTabNavigator();
const nav = createNavigationContainerRef<RootRoutes>();
function MainTabs() {
  return (
    <Tabs.Navigator tabBar={() => null} screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="Store"
        component={StoreScreen}
        options={{ title: "فروشگاه" }}
      />
      <Tabs.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{ title: "دسته‌بندی‌ها" }}
      />
      <Tabs.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: "جستجو" }}
      />
      <Tabs.Screen
        name="Cart"
        component={CartScreen}
        options={{ title: "سبد خرید" }}
      />
      <Tabs.Screen
        name="Account"
        component={AccountScreen}
        options={{ title: "حساب من" }}
      />
    </Tabs.Navigator>
  );
}
const screenTitles: Record<string, string> = {
  Product: "جزئیات محصول",
  Login: "ورود / ثبت‌نام",
  Profile: "اطلاعات حساب",
  Checkout: "تأیید و ثبت سفارش",
  Order: "جزئیات سفارش",
  Wallet: "کیف پول من",
  Credit: "پرونده اعتباری",
  CreditApply: "درخواست اعتبار",
  Documents: "مدارک و درخواست‌های تکمیل",
  Discounts: "تخفیف‌های من",
  Connections: "ربات تلگرام و بله",
  Support: "پشتیبانی",
  Settings: "تنظیمات",
  Terms: "شرایط و قوانین",
  CatalogExport: "کاتالوگ",
  Favorites: "علاقه‌مندی‌ها",
  Orders: "سفارش‌های من",
  Management: "پنل مدیریت",
};
function Navigation() {
  const c = useColors(),
    store = useStore();
  const prompted = useRef(0);
  const [current, setCurrent] = useState("Store");
  const selectTab = (screen: CustomerTab) => {
    if (nav.isReady()) nav.navigate("Main", { screen });
  };
  const activeTab: CustomerTab = [
    "Store",
    "Categories",
    "Search",
    "Cart",
    "Account",
  ].includes(current)
    ? (current as CustomerTab)
    : current === "Product" ||
        current === "Favorites" ||
        current === "CatalogExport"
      ? "Store"
      : current === "Checkout"
        ? "Cart"
        : "Account";
  const handleNotification = (response: Notifications.NotificationResponse) => {
    if (!nav.isReady() || !store.user) return;
    const data = response.notification.request.content.data;
    const event = data?.event;
    void acknowledgeNotification(data, "opened").catch(() => {});
    void queryClient.invalidateQueries();
    const destination = notificationDestination(event, data?.destination);
    if (destination === "orders") nav.navigate("Orders");
    else if (destination === "wallet") nav.navigate("Wallet");
    else if (destination === "documents") nav.navigate("Documents");
    else if (destination === "credit") nav.navigate("Credit");
    else if (destination === "store") nav.navigate("Main", { screen: "Store" });
    else if (destination === "favorites") nav.navigate("Favorites");
    else if (destination === "cart") nav.navigate("Main", { screen: "Cart" });
    else if (destination === "discounts") nav.navigate("Discounts");
    else if (destination === "support") nav.navigate("Support");
    else if (destination === "catalog") nav.navigate("CatalogExport");
    else nav.navigate("Main", { screen: "Account" });
    void Notifications.clearLastNotificationResponseAsync();
  };
  useEffect(() => {
    if (
      !store.user ||
      !store.loginCount ||
      prompted.current === store.loginCount
    )
      return;
    prompted.current = store.loginCount;
    void api
      .get<{ enabled: boolean; account: { linked: boolean } }>(
        "/customer-telegram/status",
      )
      .then((r) => {
        if (r.enabled && !r.account.linked)
          Alert.alert(
            "ربات تلگرام تماس مارکت",
            "برای اتصال به ربات و دریافت اطلاع‌رسانی سفارش‌ها کلیک کنید.",
            [
              { text: "بعداً", style: "cancel" },
              {
                text: "اتصال به ربات",
                onPress: () => {
                  if (nav.isReady()) nav.navigate("Connections");
                },
              },
            ],
          );
      })
      .catch(() => {});
  }, [store.user?.id, store.loginCount]);
  useEffect(() => {
    const received =
      Notifications.addNotificationResponseReceivedListener(handleNotification);
    const updates = Notifications.addNotificationReceivedListener(
      (notification) => {
        if (store.user) {
          void queryClient.invalidateQueries();
          void acknowledgeNotification(
            notification.request.content.data,
            "received",
          ).catch(() => {});
        }
      },
    );
    const onActive = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void queryClient.invalidateQueries();
        if (store.user) {
          void store.refresh().catch(() => {});
          void refreshPush().catch(() => {});
        }
      }
    });
    const links = Linking.addEventListener("url", ({ url }) => {
      if (!url.startsWith("tamasmarket://")) return;
      void queryClient.invalidateQueries(); /* A deep link is never proof of payment. */
    });
    if (store.user) void refreshPush().catch(() => {});
    const tokenUpdates = store.user ? watchPushToken() : undefined;
    return () => {
      received.remove();
      updates.remove();
      onActive.remove();
      links.remove();
      tokenUpdates?.remove();
    };
  }, [store.user?.id]);
  if (!store.ready) return <Loading />;
  return (
    <NavigationContainer
      key={store.user?.id || "guest"}
      ref={nav}
      direction="rtl"
      onStateChange={() => setCurrent(nav.getCurrentRoute()?.name || "Store")}
      onReady={() => {
        setCurrent(nav.getCurrentRoute()?.name || "Store");
        void Notifications.getLastNotificationResponseAsync().then((r) => {
          if (r) handleNotification(r);
        });
      }}
      theme={{
        dark: c === palette.dark,
        colors: {
          primary: c.primary,
          background: c.bg,
          card: c.surface,
          text: c.text,
          border: c.border,
          notification: c.primary,
        },
        fonts: {
          regular: { fontFamily: "Vazir", fontWeight: "400" },
          medium: { fontFamily: "VazirBold", fontWeight: "500" },
          bold: { fontFamily: "VazirBold", fontWeight: "700" },
          heavy: { fontFamily: "VazirBold", fontWeight: "800" },
        },
      }}
    >
      <StatusBar style={c === palette.dark ? "light" : "dark"} />
      <SafeAreaView
        edges={["top", "left", "right", "bottom"]}
        style={{ flex: 1, backgroundColor: c.surface }}
      >
        <StoreHeader
          title={screenTitles[current]}
          back={!!screenTitles[current]}
          showSearch={current !== "Account"}
          onBack={() => {
            if (nav.canGoBack()) nav.goBack();
            else selectTab("Store");
          }}
          onTab={selectTab}
          onFavorites={() => nav.navigate("Favorites")}
          onLogin={() => nav.navigate("Login")}
        />
        <Stack.Navigator
          initialRouteName="Main"
          screenOptions={{
            headerShown: false,
            headerStyle: { backgroundColor: c.surface },
            headerTintColor: c.text,
            headerTitleStyle: { fontFamily: "VazirBold", fontSize: 17 },
            headerTitleAlign: "center",
            contentStyle: { backgroundColor: c.bg },
          }}
        >
          <Stack.Screen
            name="Favorites"
            component={FavoritesScreen}
            options={{ title: "علاقه‌مندی‌ها" }}
          />
          <Stack.Screen
            name="Orders"
            component={OrdersScreen}
            options={{ title: "سفارش‌های من" }}
          />
          <Stack.Screen
            name="Management"
            component={ManagementScreen}
            options={{ title: "پنل مدیریت" }}
          />
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Product"
            component={ProductScreen}
            options={{ title: "جزئیات محصول" }}
          />
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: "ورود / ثبت‌نام" }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ title: "اطلاعات حساب" }}
          />
          <Stack.Screen
            name="Checkout"
            component={CheckoutScreen}
            options={{ title: "ثبت سفارش" }}
          />
          <Stack.Screen
            name="Order"
            component={OrderScreen}
            options={{ title: "جزئیات سفارش" }}
          />
          <Stack.Screen
            name="Wallet"
            component={WalletScreen}
            options={{ title: "کیف پول" }}
          />
          <Stack.Screen
            name="Credit"
            component={CreditScreen}
            options={{ title: "پرونده اعتباری" }}
          />
          <Stack.Screen
            name="CreditApply"
            component={CreditApplyScreen}
            options={{ title: "درخواست اعتبار" }}
          />
          <Stack.Screen
            name="Documents"
            component={DocumentsScreen}
            options={{ title: "تکمیل مدارک" }}
          />
          <Stack.Screen
            name="Discounts"
            component={DiscountsScreen}
            options={{ title: "تخفیف‌های من" }}
          />
          <Stack.Screen
            name="Connections"
            component={ConnectionsScreen}
            options={{ title: "پیام‌رسان‌ها" }}
          />
          <Stack.Screen
            name="Support"
            component={SupportScreen}
            options={{ title: "پشتیبانی" }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: "تنظیمات" }}
          />
          <Stack.Screen
            name="Terms"
            component={TermsScreen}
            options={{ title: "شرایط و قوانین" }}
          />
          <Stack.Screen
            name="CatalogExport"
            component={CatalogScreen}
            options={{ title: "کاتالوگ" }}
          />
        </Stack.Navigator>
        {current !== "Management" ? (
          <CustomerTabBar active={activeTab} onSelect={selectTab} />
        ) : null}
      </SafeAreaView>
    </NavigationContainer>
  );
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <View
        style={{
          flex: 1,
          padding: 32,
          justifyContent: "center",
          backgroundColor: "#f4f7fa",
        }}
      >
        <Text style={{ textAlign: "right", fontSize: 18, color: "#102a43" }}>
          خطایی در نمایش اپ رخ داد. اپ را ببندید و دوباره باز کنید. اطلاعات حساب
          در سرور محفوظ است.
        </Text>
      </View>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const [fonts, error] = useFonts({
    Vazir: require("./assets/Vazirmatn-Regular.ttf"),
    VazirBold: require("./assets/Vazirmatn-Bold.ttf"),
  });
  if (!fonts && !error)
    return <View style={{ flex: 1, backgroundColor: "#f4f7fa" }} />;
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StateProvider>
            <BrowseProvider>
              <Navigation />
            </BrowseProvider>
          </StateProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
