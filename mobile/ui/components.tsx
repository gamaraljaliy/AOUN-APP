import React from "react";
import { useAuth } from "../auth/context";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { router, usePathname, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { icons, type IconName } from "./icons";
import { useDemo } from "./demo";
import { english } from "./language";
import { colors as C } from "../theme/colors";
export { C };
export function go(path: string) {
  router.push(path as Href);
}
export function replace(path: string) {
  router.replace(path as Href);
}
export function back(fallback = "/home") {
  if (router.canGoBack()) router.back();
  else replace(fallback);
}
export function useCopy() {
  const { lang } = useDemo();
  return (s: string) => (lang === "en" ? (english[s] ?? s) : s);
}
export function T({
  children,
  size = 16,
  bold = false,
  color = C.navy,
  center = false,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  bold?: boolean;
  color?: string;
  center?: boolean;
  style?: TextStyle;
}) {
  const tr = useCopy();
  const { lang } = useDemo();
  return (
    <Text
      style={[
        {
          fontFamily: bold ? "BalooBold" : "Plex",
          fontSize: size,
          color,
          textAlign: center ? "center" : lang === "en" ? "left" : "right",
          writingDirection: lang === "ar" ? "rtl" : "ltr",
        },
        style,
      ]}
    >
      {typeof children === "string" ? tr(children) : children}
    </Text>
  );
}
export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <Image
      source={icons[name]}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessible={false}
    />
  );
}
export function Logo({ size = 120 }: { size?: number }) {
  return (
    <Image
      source={require("../assets/images/aoun-mark.png")}
      contentFit="contain"
      style={{ width: size * 0.89, height: size }}
      accessibilityLabel="عون"
    />
  );
}
export function Btn({
  label,
  onPress,
  kind = "primary",
  icon,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "soft" | "mint" | "danger" | "outline";
  icon?: IconName;
  disabled?: boolean;
}) {
  const bg = {
    primary: C.navy,
    soft: C.soft,
    mint: C.mint,
    danger: C.red,
    outline: "#fff",
  }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => [
        S.btn,
        {
          backgroundColor: bg,
          borderColor: kind === "outline" ? C.navy : bg,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon && <Icon name={icon} size={18} />}
      <T
        bold
        center
        color={kind === "primary" || kind === "danger" ? "white" : C.navy}
      >
        {label}
      </T>
    </Pressable>
  );
}
export function Link({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ padding: 7 }}
    >
      <T center bold>
        {label}
      </T>
    </Pressable>
  );
}
export function Round({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={useCopy()(label)}
      accessibilityRole="button"
      onPress={onPress}
      style={S.round}
    >
      <Icon name={icon} />
    </Pressable>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[S.card, style]}>{children}</View>;
}
export function Chip({
  label,
  onPress,
  active = false,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[S.chip, { backgroundColor: active ? C.mint : C.gray }]}
    >
      <T size={14} center>
        {label}
      </T>
    </Pressable>
  );
}
export function FieldError({ text }: { text?: string }) {
  return text ? (
    <View accessibilityRole="alert">
      <T size={14} color={C.red}>
        {text}
      </T>
    </View>
  ) : null;
}
export function Field({
  label,
  error,
  trailing,
  icon,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  icon?: IconName;
  trailing?: React.ReactNode;
}) {
  const tr = useCopy();
  const { lang } = useDemo();
  return (
    <View style={{ gap: 5 }}>
      <T bold size={15}>
        {label}
      </T>
      <View style={[S.inputRow, { flexDirection: lang === "ar" ? "row-reverse" : "row" }, error ? { borderColor: C.red } : undefined]}>
        {icon && <Icon name={icon} size={18} />}
        <TextInput
          {...props}
          accessibilityHint={error ? tr(error) : undefined}
          accessibilityLabel={tr(label)}
          placeholder={props.placeholder && tr(props.placeholder)}
          placeholderTextColor={C.muted}
          style={[
            S.field,
            { textAlign: lang === "ar" ? "right" : "left" },
            props.multiline && { height: 105, textAlignVertical: "top" },
            props.style,
          ]}
        />
        {trailing}
      </View>
      <FieldError text={error} />
    </View>
  );
}
export function Title({ children }: { children: string }) {
  return (
    <T size={22} bold>
      {children}
    </T>
  );
}
export function Message({ text }: { text: string }) {
  return text ? (
    <View
      accessibilityLiveRegion="polite"
      style={{ padding: 10, backgroundColor: C.soft, borderRadius: 10 }}
    >
      <T>{text}</T>
    </View>
  ) : null;
}
const tabs: [string, string, IconName][] = [
  ["/home", "الرئيسية", "home"],
  ["/nearby", "الخريطة", "map"],
  ["/favorites", "المفضلة", "heart"],
  ["/profile", "حسابي", "user"],
];
const adminTabs: [string, string, IconName][] = [
  ["/admin/places", "الأماكن", "building"],
  ["/admin/reports", "البلاغات", "flag"],
  ["/admin/reviews", "المراجعات", "chat"],
  ["/admin/users", "المستخدمون", "people"],
];
export function Shell({
  title,
  children,
  nav = false,
  admin = false,
  action,
  onBack,
  brand = false,
}: {
  title?: string;
  children: React.ReactNode;
  nav?: boolean;
  admin?: boolean;
  action?: React.ReactNode;
  onBack?: () => void;
  brand?: boolean;
}) {
  const path = usePathname();
  const d = useDemo();
  const auth = useAuth();
  if (admin && auth.loading)
    return (
      <SafeAreaView style={S.page}>
        <View style={S.body}>
          <T>جارٍ التحقق من الحساب…</T>
        </View>
      </SafeAreaView>
    );
  if (admin && !d.admin)
    return (
      <SafeAreaView style={S.page}>
        <View style={S.body}>
          <T>سجّلي الدخول بحساب مسؤول نشط.</T>
          <Btn label="تسجيل الدخول" onPress={() => replace("/login")} />
        </View>
      </SafeAreaView>
    );
  const direction = { flexDirection: d.lang === "ar" ? "row-reverse" : "row" } as const;
  return (
    <SafeAreaView style={S.page}>
      {(title || brand || onBack) && (
        <View style={[S.header, direction]}>
          {brand ? (
            <View style={[S.row, direction, { flex: 1 }]}>
              <Logo size={46} />
              <T size={33} bold>
                {title ?? "عون"}
              </T>
              <View style={{ flex: 1 }}>
                {nav && d.user && (
                  <T bold size={16}>
                    {d.lang === "ar"
                      ? `أهلًا، ${d.user.name}`
                      : `Hello, ${d.user.name}`}
                  </T>
                )}
              </View>
              {onBack && <Round icon="back" label="رجوع" onPress={onBack} />}
            </View>
          ) : (
            <>
              <Round
                icon="back"
                label="رجوع"
                onPress={onBack ?? (() => back())}
              />
              <View style={{ flex: 1 }}>
                <T center bold size={25}>
                  {title}
                </T>
              </View>
              {action ?? <View style={{ width: 44 }} />}
            </>
          )}
        </View>
      )}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={S.body}
      >
        {children}
      </ScrollView>
      {nav && (
        <View style={[S.tabs, direction]}>
          {(admin ? adminTabs : tabs).map(([url, label, icon]) => (
            <Pressable
              key={url}
              accessibilityRole="tab"
              accessibilityState={{ selected: path === url }}
              style={[
                S.tab,
                path === url && { backgroundColor: C.soft, borderRadius: 24 },
              ]}
              onPress={() => {
                if (path !== url) replace(url);
              }}
            >
              <Icon name={icon} />
              <T size={12} bold={path === url}>
                {label}
              </T>
            </Pressable>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}
export const S = StyleSheet.create({
  page: { flex: 1, backgroundColor: "white" },
  body: {
    width: "100%",
    alignSelf: "center",
    maxWidth: 620,
    paddingHorizontal: 18,
    paddingVertical: 15,
    gap: 14,
    flexGrow: 1,
  },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 9 },
  wrap: { flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" },
  header: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 620,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F4F5FA",
    alignItems: "center",
    justifyContent: "center",
  },
  btn: {
    borderRadius: 15,
    borderWidth: 1,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row-reverse",
    gap: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    backgroundColor: "white",
  },
  chip: {
    borderRadius: 18,
    minHeight: 40,
    paddingHorizontal: 13,
    justifyContent: "center",
  },
  inputRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#FBFBFD",
  },
  field: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    padding: 11,
    fontSize: 16,
    fontFamily: "Plex",
    color: C.ink,
    textAlign: "right",
  },
  tabs: {
    alignSelf: "center",
    maxWidth: 440,
    width: "88%",
    backgroundColor: C.lav,
    borderRadius: 32,
    flexDirection: "row-reverse",
    paddingVertical: 7,
    marginVertical: 8,
  },
  tab: { alignItems: "center", flex: 1, gap: 2 },
});
