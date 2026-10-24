import React, { useEffect, useRef } from "react";
import { Alert, AppState, Linking, Text, View } from "react-native";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { StateProvider, queryClient, useStore } from "./src/state";
import { palette, useColors, Loading } from "./src/ui";
import {
  StoreScreen,
  ProductScreen,
  FavoritesScreen,
  CartScreen,
} from "./src/screens/Store";
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
import { refreshPush } from "./src/notifications";
import type { RootRoutes } from "./src/navigation";
import { api } from "./src/api";
const Stack = createNativeStackNavigator<RootRoutes>();
const Tabs = createBottomTabNavigator();
const nav = createNavigationContainerRef<RootRoutes>();
function MainTabs() {
  const c = useColors(),
    { lines } = useStore();
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const icons: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
    Store: "storefront-outline",
    Favorites: "heart-outline",
    Cart: "bag-outline",
    Orders: "receipt-outline",
    Account: "person-outline",
  };
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: c.bg }}
    >
      <Tabs.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: c.primary,
          tabBarInactiveTintColor: c.muted,
          tabBarStyle: {
            backgroundColor: c.surface,
            borderTopColor: c.border,
            paddingTop: 6,
            minHeight: 64,
          },
          tabBarLabelStyle: {
            fontFamily: "Vazir",
            fontSize: 11,
            paddingBottom: 4,
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={icons[route.name]} size={size} color={color} />
          ),
        })}
      >
        <Tabs.Screen
          name="Store"
          component={StoreScreen}
          options={{ title: "فروشگاه" }}
        />
        <Tabs.Screen
          name="Favorites"
          component={FavoritesScreen}
          options={{ title: "علاقه‌مندی" }}
        />
        <Tabs.Screen
          name="Cart"
          component={CartScreen}
          options={{ title: "سبد خرید", tabBarBadge: count || undefined }}
        />
        <Tabs.Screen
          name="Orders"
          component={OrdersScreen}
          options={{ title: "سفارش‌ها" }}
        />
        <Tabs.Screen
          name="Account"
          component={AccountScreen}
          options={{ title: "حساب من" }}
        />
      </Tabs.Navigator>
    </SafeAreaView>
  );
}
function Navigation() {
  const c = useColors(),
    store = useStore();
  const prompted = useRef(0);
  const handleNotification = (response: Notifications.NotificationResponse) => {
    if (!nav.isReady() || !store.user) return;
    const event = response.notification.request.content.data?.event;
    void queryClient.invalidateQueries();
    if (typeof event === "string" && event.startsWith("order."))
      nav.navigate("Main", { screen: "Orders" });
    else if (typeof event === "string" && event.startsWith("credit."))
      nav.navigate("Credit");
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
    const onActive = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void queryClient.invalidateQueries();
        if (store.user) void store.refresh().catch(() => {});
      }
    });
    const links = Linking.addEventListener("url", ({ url }) => {
      if (!url.startsWith("tamasmarket://")) return;
      void queryClient.invalidateQueries(); /* A deep link is never proof of payment. */
    });
    if (store.user) void refreshPush().catch(() => {});
    return () => {
      received.remove();
      onActive.remove();
      links.remove();
    };
  }, [store.user?.id]);
  if (!store.ready) return <Loading />;
  return (
    <NavigationContainer
      key={store.user?.id || "guest"}
      ref={nav}
      direction="rtl"
      onReady={() => {
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
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.text,
          headerTitleStyle: { fontFamily: "VazirBold", fontSize: 17 },
          headerTitleAlign: "center",
          contentStyle: { backgroundColor: c.bg },
        }}
      >
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
            <Navigation />
          </StateProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
