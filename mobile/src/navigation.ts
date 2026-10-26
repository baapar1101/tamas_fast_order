import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { NavigatorScreenParams } from "@react-navigation/native";
type MainTabs = {
  Store: undefined;
  Categories: undefined;
  Search: undefined;
  Cart: undefined;
  Account: undefined;
};
export type RootRoutes = {
  Main: NavigatorScreenParams<MainTabs> | undefined;
  Product: { id: string };
  Login: undefined;
  Profile: undefined;
  Checkout: undefined;
  Order: { id: number };
  Wallet: undefined;
  Credit: undefined;
  CreditApply: undefined;
  Documents: undefined;
  Discounts: undefined;
  Connections: undefined;
  Support: undefined;
  Settings: undefined;
  CatalogExport: undefined;
  Terms: undefined;
  Favorites: undefined;
  Orders: undefined;
  Management: undefined;
};
export type ScreenProps<K extends keyof RootRoutes> = NativeStackScreenProps<
  RootRoutes,
  K
>;
