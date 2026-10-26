import React from "react";
import { Pressable, TextInput, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useStore } from "./state";
import { Row, Txt, useColors } from "./ui";
import { useBrowse } from "./browse";

type Icon = React.ComponentProps<typeof Ionicons>["name"];
export const customerTabs = [
  { name: "Store", label: "صفحه اصلی", icon: "home-outline" },
  { name: "Categories", label: "دسته‌بندی‌ها", icon: "grid-outline" },
  { name: "Search", label: "جستجو", icon: "search-outline" },
  { name: "Cart", label: "سبد خرید", icon: "bag-outline" },
  { name: "Account", label: "حساب کاربری", icon: "person-outline" },
] as const;
export type CustomerTab = (typeof customerTabs)[number]["name"];
export function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: Icon;
  label: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} color={c.muted} size={21} />
    </Pressable>
  );
}
export function StoreHeader({
  title,
  back,
  showSearch = true,
  onBack,
  onTab,
  onFavorites,
  onLogin,
}: {
  title?: string;
  back: boolean;
  showSearch?: boolean;
  onBack: () => void;
  onTab: (tab: CustomerTab) => void;
  onFavorites: () => void;
  onLogin: () => void;
}) {
  const c = useColors();
  const store = useStore();
  const browse = useBrowse();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.3;
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
      }}
    >
      <Row style={{ justifyContent: "space-between", gap: 4 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="تماس مارکت؛ صفحه اصلی"
          onPress={() => onTab("Store")}
        >
          <Image
            source={require("../assets/logo.png")}
            contentFit="contain"
            style={{ width: compact ? 78 : 96, height: 36 }}
          />
        </Pressable>
        <IconButton
          icon={c.bg === "#08111e" ? "sunny-outline" : "moon-outline"}
          label="تغییر روشنایی"
          onPress={() => store.setTheme(c.bg === "#08111e" ? "light" : "dark")}
        />
        <IconButton
          icon="heart-outline"
          label="علاقه‌مندی‌ها"
          onPress={onFavorites}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            store.user ? "رفتن به حساب کاربری" : "ورود / ثبت‌نام"
          }
          onPress={() => (store.user ? onTab("Account") : onLogin())}
          style={{
            backgroundColor: c.primary,
            borderRadius: 999,
            minHeight: 44,
            paddingHorizontal: 12,
            flex: 1,
            maxWidth: 210,
            justifyContent: "center",
          }}
        >
          <Row style={{ justifyContent: "center", gap: 6 }}>
            <Ionicons name="person-outline" size={16} color={c.onPrimary} />
            <Txt size={12} bold color={c.onPrimary} numberOfLines={1}>
              {store.user
                ? `${store.user.name || "حساب"} ${store.user.lastName || ""}`.trim()
                : compact
                  ? "ورود"
                  : "ورود / ثبت‌نام"}
            </Txt>
          </Row>
        </Pressable>
      </Row>
      {!back && showSearch ? (
        <Row
          style={{
            backgroundColor: c.subtle,
            borderRadius: 999,
            paddingHorizontal: 14,
            gap: 8,
          }}
        >
          <Ionicons name="search-outline" color={c.muted} size={20} />
          <TextInput
            accessibilityLabel="جستجو"
            placeholder="جستجو بر اساس نام محصول، مدل، برند..."
            placeholderTextColor={c.muted}
            value={browse.search}
            onChangeText={browse.setSearch}
            returnKeyType="search"
            onSubmitEditing={() => onTab("Search")}
            onFocus={() => onTab("Search")}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 44,
              color: c.text,
              fontFamily: "Vazir",
              fontSize: 13,
              textAlign: "right",
            }}
          />
          {browse.search ? (
            <IconButton
              icon="close"
              label="پاک کردن جستجو"
              onPress={() => browse.setSearch("")}
            />
          ) : null}
        </Row>
      ) : back ? (
        <Row>
          <IconButton icon="chevron-forward" label="بازگشت" onPress={onBack} />
          <Txt bold size={15}>
            {title}
          </Txt>
        </Row>
      ) : null}
    </View>
  );
}
export function CustomerTabBar({
  active,
  onSelect,
}: {
  active: CustomerTab;
  onSelect: (tab: CustomerTab) => void;
}) {
  const c = useColors();
  const { lines } = useStore();
  const count = lines.reduce((sum, line) => sum + line.qty, 0);
  return (
    <Row
      style={{
        gap: 0,
        borderTopWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
        minHeight: 64,
        paddingHorizontal: 4,
      }}
    >
      {customerTabs.map((item) => (
        <Pressable
          key={item.name}
          accessibilityRole="tab"
          accessibilityLabel={item.label}
          accessibilityState={{ selected: active === item.name }}
          onPress={() => onSelect(item.name)}
          style={{
            flex: 1,
            minHeight: 64,
            paddingVertical: 6,
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 4,
              bottom: 4,
              width: 48,
              borderRadius: 14,
              backgroundColor: active === item.name ? c.soft : "transparent",
            }}
          />
          <View>
            <Ionicons
              name={item.icon}
              size={24}
              color={active === item.name ? c.primary : c.muted}
            />
            {item.name === "Cart" && count > 0 ? (
              <View
                style={{
                  position: "absolute",
                  right: -7,
                  top: -4,
                  borderRadius: 10,
                  backgroundColor: c.primary,
                  minWidth: 17,
                  alignItems: "center",
                  paddingHorizontal: 3,
                }}
              >
                <Txt color={c.onPrimary} size={9}>
                  {count.toLocaleString("fa-IR")}
                </Txt>
              </View>
            ) : null}
          </View>
          <Txt
            size={10}
            color={active === item.name ? c.primary : c.muted}
            style={{ textAlign: "center" }}
          >
            {item.label}
          </Txt>
        </Pressable>
      ))}
    </Row>
  );
}
