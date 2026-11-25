import { Image } from "expo-image";
import type { Place as LivePlace } from "../services/places";
import { Linking, Pressable, Text, View } from "react-native";
import {
  Btn,
  C,
  Card,
  Chip,
  Icon,
  Round,
  S,
  T,
  go,
  useCopy,
} from "./components";
import { distance, level, type Place, useDemo } from "./demo";
export function PlaceCard({
  p,
  compact = false,
  favorite = false,
}: {
  p: Place;
  compact?: boolean;
  favorite?: boolean;
}) {
  const d = useDemo();
  const ratings = d.reviews.filter((r) => !r.live && r.placeId === p.id),
    saved = d.email && d.favorites[d.email]?.includes(p.id);
  const avg = ratings.length
    ? (ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length).toFixed(1)
    : "—";
  return (
    <Card>
      <View style={S.row}>
        <Icon name="building" />
        <View style={{ flex: 1 }}>
          <T bold size={20}>
            {p.name}
          </T>
        </View>
        {(!compact || favorite) && (
          <Round
            label={saved ? "إزالة من المفضلة" : "حفظ في المفضلة"}
            icon="heart"
            onPress={() => (d.user ? d.toggleFavorite(p.id) : go("/login"))}
          />
        )}
      </View>
      <T size={14} color={C.muted}>
        {p.category} ·{" "}
        {compact
          ? distance(d.origin.lat, d.origin.lon, p).toFixed(1) + " كم"
          : p.address}
      </T>
      <View style={[S.row, { justifyContent: "space-between" }]}>
        <View
          style={{
            backgroundColor: C.pale,
            borderRadius: 20,
            paddingHorizontal: 18,
            paddingVertical: 4,
          }}
        >
          <T size={14}>{level(p)}</T>
        </View>
        <View
          style={{
            backgroundColor: C.soft,
            borderRadius: 18,
            paddingHorizontal: 15,
          }}
        >
          <T>{"★ " + avg}</T>
        </View>
      </View>
      {!compact && (
        <View style={S.wrap}>
          {p.facilities.slice(0, 2).map((v, i) => (
            <T key={i} size={13} color={C.muted}>
              {["منحدرات", "مصاعد"][i]} ·{" "}
              {v === "available"
                ? "متاح"
                : v === "not_applicable"
                  ? "غير منطبق"
                  : "غير متاح"}
            </T>
          ))}
        </View>
      )}
      <Btn
        label="عرض التفاصيل"
        kind="soft"
        onPress={() => go("/places/" + p.id)}
      />
      {!compact && (
        <Btn
          label="الموقع"
          onPress={() =>
            Linking.openURL(
              `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`,
            )
          }
        />
      )}
    </Card>
  );
}
export function Categories({
  value,
  change,
}: {
  value: string;
  change: (x: string) => void;
}) {
  return (
    <View style={S.wrap}>
      {["الكل", "مرافق عامة", "مقاهي", "مطاعم"].map((x) => (
        <Chip
          key={x}
          label={x}
          active={value === x}
          onPress={() => change(x)}
        />
      ))}
    </View>
  );
}

export const levelLabels: Record<string, string> = {
  accessible: "مهيأ بالكامل",
  partially_accessible: "مهيأ جزئيًا",
  not_accessible: "غير مهيأ",
};

export function LiveFavoriteButton({ place }: { place: LivePlace }) {
  const { user, liveFavorites, toggleLiveFavorite } = useDemo();
  const saved = liveFavorites.some((item) => item.id === place.id);
  const tr = useCopy();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr(saved ? "إزالة من المفضلة" : "حفظ في المفضلة")}
      accessibilityState={{ selected: saved }}
      onPress={() => (user ? toggleLiveFavorite(place) : go("/login"))}
      style={{
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        allowFontScaling={false}
        style={{ fontSize: 29, color: saved ? "#C02E48" : C.muted }}
      >
        {saved ? "♥" : "♡"}
      </Text>
    </Pressable>
  );
}

const levelColors: Record<string, string> = {
  accessible: "#16704D",
  partially_accessible: "#876900",
  not_accessible: C.red,
};

export function LivePlaceCard({ place }: { place: LivePlace }) {
  const { lang } = useDemo();
  const direction = lang === "ar" ? "row-reverse" : "row";
  const name = lang === "en" ? place.name_en || place.name_ar : place.name_ar;
  return (
    <Card style={{ padding: 12, gap: 10 }}>
      <View style={{ flexDirection: direction, alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: "27%",
            maxWidth: 100,
            aspectRatio: 1,
            borderRadius: 12,
            overflow: "hidden",
            backgroundColor: C.soft,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {place.photo_path ? (
            <Image
              source={{ uri: place.photo_path }}
              contentFit="cover"
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <Icon name="building" />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T bold size={18}>
            {name}
          </T>
          <T size={14} color={C.muted}>
            {lang === "en"
              ? place.category_en || place.category_ar
              : place.category_ar}
          </T>
          <T bold size={14} color={levelColors[place.level ?? ""] ?? C.muted}>
            {levelLabels[place.level ?? ""] ?? "بانتظار المراجعة"}
          </T>
        </View>
        <LiveFavoriteButton place={place} />
      </View>
      <Btn label="تفاصيل المكان" onPress={() => go(`/live-places/${place.id}`)} />
    </Card>
  );
}
