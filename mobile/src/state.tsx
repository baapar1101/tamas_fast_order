import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { AppState, Alert } from "react-native";
import {
  QueryClient,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import type {
  AuthStateDTO,
  UserDTO,
  ProductDTO,
  Warehouse,
} from "@tamas/shared";
import { api, session } from "./api";
import { changeCart, restoreCart, type CartLine } from "./domain";
import { clearPrivateCache } from "./files";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: { retry: false },
  },
});
const TOKEN = "tamas.native.session.v1";
type State = {
  user: UserDTO | null;
  ready: boolean;
  authError: string;
  complete: boolean;
  login: (a: AuthStateDTO) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  lines: CartLine[];
  setQty: (p: ProductDTO, w: Warehouse, qty: number) => void;
  removeLines: (ids: string[]) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  theme: "system" | "light" | "dark";
  setTheme: (v: State["theme"]) => void;
  loginCount: number;
};
const Context = createContext<State | null>(null);
export function StateProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [complete, setComplete] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [theme, setTheme] = useState<State["theme"]>("system");
  const [storageReady, setStorageReady] = useState(false);
  const scope = useRef("guest");
  const [loginCount, setLoginCount] = useState(0);
  const clear = useCallback(async () => {
    session.set(null);
    scope.current = "guest";
    setUser(null);
    setComplete(false);
    setLines([]);
    setFavorites([]);
    await queryClient.cancelQueries();
    queryClient.clear();
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN),
      SecureStore.deleteItemAsync("tamas.chat"),
      SecureStore.deleteItemAsync("tamas.push.enabled"),
      clearPrivateCache(),
      Notifications.cancelAllScheduledNotificationsAsync(),
      Notifications.dismissAllNotificationsAsync(),
    ]);
  }, []);
  const refresh = useCallback(async () => {
    if (!session.token()) return;
    const res =
      await api.get<Omit<AuthStateDTO, "token" | "isNew">>("/auth/me");
    if (scope.current !== String(res.user.id)) {
      scope.current = String(res.user.id);
      const cart = await AsyncStorage.getItem(`tamas.cart.${scope.current}`);
      const fav = await AsyncStorage.getItem(`tamas.favs.${scope.current}`);
      try {
        setLines(restoreCart(JSON.parse(cart || "[]")));
      } catch {
        setLines([]);
      }
      try {
        const f: unknown = JSON.parse(fav || "[]");
        setFavorites(
          Array.isArray(f)
            ? f.filter((v): v is string => typeof v === "string")
            : [],
        );
      } catch {
        setFavorites([]);
      }
    }
    setUser(res.user);
    setComplete(res.complete);
    setAuthError("");
  }, []);
  useEffect(() => {
    session.onExpired(() => {
      void clear().catch(() => {});
      Alert.alert("ورود مجدد", "نشست شما منقضی شده است. دوباره وارد شوید.");
    });
    const unNet = NetInfo.addEventListener((s) =>
      onlineManager.setOnline(
        s.isConnected !== false && s.isInternetReachable !== false,
      ),
    );
    const sub = AppState.addEventListener("change", (s) => {
      focusManager.setFocused(s === "active");
    });
    void (async () => {
      try {
        const t = await SecureStore.getItemAsync(TOKEN);
        session.set(t);
        if (t) {
          try {
            const a = await api.get<AuthStateDTO>("/auth/me");
            setUser(a.user);
            setComplete(a.complete);
            scope.current = String(a.user.id);
          } catch (e) {
            setAuthError((e as Error).message);
          }
        }
        const [cart, favs, pref] = await AsyncStorage.multiGet([
          `tamas.cart.${scope.current}`,
          `tamas.favs.${scope.current}`,
          "tamas.theme",
        ]);
        try {
          setLines(restoreCart(JSON.parse(cart?.[1] || "[]")));
        } catch {
          setLines([]);
        }
        try {
          const f: unknown = JSON.parse(favs?.[1] || "[]");
          setFavorites(
            Array.isArray(f)
              ? f.filter((v): v is string => typeof v === "string")
              : [],
          );
        } catch {
          setFavorites([]);
        }
        if (pref?.[1] === "dark" || pref?.[1] === "light") setTheme(pref[1]);
      } catch {
        setAuthError("خواندن نشست امن ممکن نشد. دوباره وارد شوید.");
      } finally {
        setReady(true);
        setStorageReady(true);
      }
    })();
    return () => {
      unNet();
      sub.remove();
    };
  }, [clear]);
  useEffect(() => {
    if (storageReady)
      void AsyncStorage.setItem(
        `tamas.cart.${scope.current}`,
        JSON.stringify(lines),
      );
  }, [lines, storageReady, user?.id]);
  useEffect(() => {
    if (storageReady)
      void AsyncStorage.setItem(
        `tamas.favs.${scope.current}`,
        JSON.stringify(favorites),
      );
  }, [favorites, storageReady, user?.id]);
  useEffect(() => {
    if (storageReady) void AsyncStorage.setItem("tamas.theme", theme);
  }, [theme, storageReady]);
  const login = async (a: AuthStateDTO) => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await clearPrivateCache();
    await SecureStore.setItemAsync(TOKEN, a.token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    session.set(a.token);
    const guest = scope.current === "guest";
    scope.current = String(a.user.id);
    const cart = await AsyncStorage.getItem(`tamas.cart.${scope.current}`);
    const favs = await AsyncStorage.getItem(`tamas.favs.${scope.current}`);
    if (cart) {
      try {
        setLines(restoreCart(JSON.parse(cart)));
      } catch {
        setLines([]);
      }
    } else if (!guest) setLines([]);
    try {
      const f: unknown = JSON.parse(favs || "[]");
      setFavorites(
        Array.isArray(f)
          ? f.filter((v): v is string => typeof v === "string")
          : [],
      );
    } catch {
      setFavorites([]);
    }
    setUser(a.user);
    setComplete(a.complete);
    setAuthError("");
    setLoginCount((n) => n + 1);
  };
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      await clear();
    }
  };
  return (
    <Context.Provider
      value={{
        user,
        complete,
        ready,
        authError,
        login,
        logout,
        refresh,
        lines,
        favorites,
        theme,
        setTheme,
        loginCount,
        setQty: (p, w, n) => setLines((v) => changeCart(v, p, w, n)),
        removeLines: (ids) =>
          setLines((v) => v.filter((l) => !ids.includes(l.product.productId))),
        toggleFavorite: (id) =>
          setFavorites((v) =>
            v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
          ),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const c = useContext(Context);
  if (!c) throw new Error("StateProvider required");
  return c;
}
