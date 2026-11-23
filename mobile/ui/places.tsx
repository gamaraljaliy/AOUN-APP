import { View } from "react-native";
import { Btn, C, Card, Chip, Icon, Round, S, T, go } from "./components";
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
  const ratings = d.reviews.filter((r) => r.placeId === p.id),
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
        <Btn label="الموقع" onPress={() => go("/nearby?place=" + p.id)} />
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
