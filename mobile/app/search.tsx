import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { distance, facilityNames, useDemo } from "../ui/demo";
import {
  Btn,
  Card,
  Chip,
  Field,
  Round,
  S,
  Shell,
  T,
  Title,
} from "../ui/components";
import { Categories, PlaceCard } from "../ui/places";
export default function Search() {
  const d = useDemo();
  const { facility } = useLocalSearchParams<{ facility?: string }>();
  const initial = facility !== undefined ? [Number(facility)] : [];
  const [q, setQ] = useState(""),
    [category, setCategory] = useState("الكل"),
    [ids, setIds] = useState(initial),
    [sort, setSort] = useState(false);
  const [criteria, apply] = useState({
    q: "",
    category: "الكل",
    ids: initial,
    sort: false,
  });
  const rows = d.places.filter(
    (p) =>
      (p.name + p.category).includes(criteria.q.trim()) &&
      (criteria.category === "الكل" || p.category === criteria.category) &&
      criteria.ids.every((i) => p.facilities[i] === "available"),
  );
  if (criteria.sort)
    rows.sort(
      (a, b) =>
        distance(d.origin.lat, d.origin.lon, a) -
        distance(d.origin.lat, d.origin.lon, b),
    );
  return (
    <Shell
      nav
      title="البحث والفلترة"
      action={
        <Round
          icon="globe"
          label="لغة التطبيق"
          onPress={() => d.setLang(d.lang === "ar" ? "en" : "ar")}
        />
      }
    >
      <Field
        label="بحث"
        placeholder="ابحث عن اسم مكان أو فئة..."
        value={q}
        onChangeText={setQ}
      />
      <Categories value={category} change={setCategory} />
      <Card>
        <Title>تصفية حسب مرافق الإتاحة</Title>
        <T size={14}>اختر مرفقًا واحدًا أو أكثر</T>
        <View style={S.wrap}>
          {facilityNames.map((x, i) => (
            <Chip
              key={x}
              active={ids.includes(i)}
              label={x}
              onPress={() =>
                setIds(
                  ids.includes(i) ? ids.filter((j) => j !== i) : [...ids, i],
                )
              }
            />
          ))}
        </View>
        <Chip
          label="الترتيب حسب المسافة"
          active={sort}
          onPress={() => setSort(!sort)}
        />
        <Btn
          label="تطبيق الفلاتر"
          onPress={() => apply({ q, category, ids: [...ids], sort })}
        />
      </Card>
      <Title>نتائج البحث</Title>
      {rows.length ? (
        rows.map((p) => <PlaceCard key={p.id} p={p} compact />)
      ) : (
        <T>لا توجد نتائج مطابقة.</T>
      )}
    </Shell>
  );
}
