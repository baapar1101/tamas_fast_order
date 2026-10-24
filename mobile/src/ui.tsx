import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useStore } from "./state";
import { money, publicUrl } from "./domain";
export const palette = {
  light: {
    bg: "#f4f7fa",
    surface: "#ffffff",
    text: "#102a43",
    muted: "#64788c",
    border: "#dce5ed",
    primary: "#087f92",
    soft: "#e7f4f6",
    danger: "#b42332",
    success: "#177750",
  },
  dark: {
    bg: "#080f1c",
    surface: "#121f31",
    text: "#edf5ff",
    muted: "#a3b6ca",
    border: "#2d4056",
    primary: "#57c6d6",
    soft: "#173440",
    danger: "#ff9b9b",
    success: "#7bdbb2",
  },
};
export function useColors() {
  const system = useColorScheme();
  const { theme } = useStore();
  return palette[
    theme === "system" ? (system === "dark" ? "dark" : "light") : theme
  ];
}
export function Txt({
  children,
  bold = false,
  muted = false,
  size = 14,
  color,
  style,
  ...rest
}: {
  children: React.ReactNode;
  bold?: boolean;
  muted?: boolean;
  size?: number;
  color?: string;
  style?: import("react-native").StyleProp<import("react-native").TextStyle>;
} & import("react-native").TextProps) {
  const c = useColors();
  return (
    <Text
      {...rest}
      style={[
        {
          color: color || (muted ? c.muted : c.text),
          fontFamily: bold ? "VazirBold" : "Vazir",
          fontSize: size,
          lineHeight: size * 1.65,
          textAlign: "right",
          writingDirection: "rtl",
          flexShrink: 1,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const c = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: 20,
          padding: 18,
          gap: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Page({
  children,
  refresh,
  refreshing = false,
}: {
  children: React.ReactNode;
  refresh?: () => void;
  refreshing?: boolean;
}) {
  const c = useColors();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: 36,
          width: "100%",
          maxWidth: 840,
          alignSelf: "center",
        }}
        refreshControl={
          refresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={c.primary}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function Button({
  label,
  onPress,
  busy = false,
  disabled = false,
  secondary = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy || disabled, busy }}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: c.primary,
        backgroundColor: secondary ? c.surface : c.primary,
        opacity: disabled || busy?.valueOf() ? 0.5 : pressed ? 0.8 : 1,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row-reverse",
        gap: 8,
      })}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? c.primary : c.bg} />
      ) : icon ? (
        <Ionicons name={icon} size={20} color={secondary ? c.primary : c.bg} />
      ) : null}
      <Txt
        bold
        color={secondary ? c.primary : c.bg}
        style={{ textAlign: "center" }}
      >
        {label}
      </Txt>
    </Pressable>
  );
}
export function Field({ label, ...props }: { label: string } & TextInputProps) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Txt bold size={13}>
        {label}
      </Txt>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...props}
        style={[
          {
            fontFamily: "Vazir",
            fontSize: 15,
            color: c.text,
            textAlign: "right",
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            minHeight: 50,
            backgroundColor: c.surface,
            paddingVertical: 10,
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function Select({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 6, flexGrow: 1, flexBasis: 140 }}>
      <Txt bold size={13}>
        {label}
      </Txt>
      <View
        style={{
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 12,
          backgroundColor: c.surface,
          overflow: "hidden",
        }}
      >
        <Picker
          accessibilityLabel={label}
          selectedValue={value}
          onValueChange={(v) => onChange(String(v))}
          enabled={!disabled}
          style={{ color: c.text, height: 54 }}
          dropdownIconColor={c.muted}
          mode="dialog"
        >
          {options.map((o) => (
            <Picker.Item
              key={o.value}
              label={o.label}
              value={o.value}
              fontFamily="Vazir"
            />
          ))}
        </Picker>
      </View>
    </View>
  );
}
export function Notice({
  text,
  error = false,
}: {
  text?: string;
  error?: boolean;
}) {
  const c = useColors();
  if (!text) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        padding: 12,
        borderRadius: 12,
        backgroundColor: c.soft,
        borderRightWidth: 3,
        borderRightColor: error ? c.danger : c.primary,
      }}
    >
      <Txt color={error ? c.danger : c.text}>{text}</Txt>
    </View>
  );
}
export function Money({
  amount,
  size = 18,
}: {
  amount: number;
  size?: number;
}) {
  const c = useColors();
  return (
    <Txt bold size={size} color={c.primary}>
      {money(amount)}
    </Txt>
  );
}
export function Photo({
  url,
  height = 170,
}: {
  url?: string | null;
  height?: number;
}) {
  const c = useColors();
  const uri = publicUrl(url);
  return (
    <View
      style={{
        height,
        backgroundColor: "#ffffff",
        borderRadius: 14,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          contentFit="contain"
          style={{ width: "100%", height: "100%" }}
          cachePolicy="memory-disk"
          transition={150}
          accessibilityLabel="تصویر محصول"
        />
      ) : (
        <Ionicons name="image-outline" size={40} color={c.muted} />
      )}
    </View>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <Txt bold size={19}>
        {title}
      </Txt>
      {description && <Txt muted>{description}</Txt>}
      {action}
    </Card>
  );
}
export function Loading() {
  const c = useColors();
  return (
    <View style={{ padding: 32, alignItems: "center", gap: 12 }}>
      <ActivityIndicator size="large" color={c.primary} />
      <Txt muted>در حال دریافت اطلاعات…</Txt>
    </View>
  );
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const running = useRef(false);
  const run = async (
    fn: () => Promise<unknown>,
    message = "عملیات با موفقیت انجام شد.",
  ) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await fn();
      if (result !== false) setSuccess(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطایی رخ داد.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return {
    busy,
    error,
    success,
    run,
    reset: () => {
      setError("");
      setSuccess("");
    },
    feedback: (
      <>
        <Notice text={error} error />
        <Notice text={success} />
      </>
    ),
  };
}
export function confirm(title: string, message: string, fn: () => void) {
  Alert.alert(title, message, [
    { text: "انصراف", style: "cancel" },
    { text: "تأیید", onPress: fn },
  ]);
}
export const styles = StyleSheet.create({
  wrap: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 12 },
  separator: { height: 1, backgroundColor: "#dce5ed" },
});
