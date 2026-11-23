import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { searchPlaces, type Place } from "../services/places";
import { facilityNames, useDemo } from "../ui/demo";
import {
  Btn, Card, Chip, Field, Round, S, Shell, T, Title, go,
} from "../ui/components";

const categories = ["الكل", "مركز تسوق", "مقهى", "مرافق عامة", "مطعم"];

export default function Search() {
  const { lang, setLang } = useDemo();
  const { facility } = useLocalSearchParams<{ facility?: string }>();

  // الرئيسية ترسل موضع المرفق بدءًا من 0، وقاعدة البيانات ترقّمه بدءًا من 1.
  const index = Number(facility);
  const initialIds =
    Number.isInteger(index) && index >= 0 && index < facilityNames.length
      ? [index + 1]
      : [];

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("الكل");
  const [ids, setIds] = useState<number[]>(initialIds);

  const [applied, setApplied] = useState({
    query: "",
    category: "الكل",
    ids: initialIds,
  });

  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(false);

      try {
        const results = await searchPlaces(
          applied.query,
          applied.ids,
          controller.signal,
        );
        if (!controller.signal.aborted) setPlaces(results);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [applied, attempt]);

  function applyFilters() {
    setApplied({ query: query.trim(), category, ids: [...ids] });
  }

  function toggleFacility(id: number) {
    setIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  const rows = places.filter(
    (place) =>
      applied.category === "الكل" || place.category_ar === applied.category,
  );

  return (
    <Shell
      nav
      title="البحث والفلترة"
      action={
        <Round
          icon="globe"
          label="لغة التطبيق"
          onPress={() => setLang(lang === "ar" ? "en" : "ar")}
        />
      }
    >
      <Field
        label="بحث"
        placeholder="ابحث عن اسم مكان أو فئة..."
        value={query}
        onChangeText={setQuery}
        maxLength={150}
        returnKeyType="search"
        onSubmitEditing={applyFilters}
      />

      <View style={S.wrap}>
        {categories.map((item) => (
          <Chip
            key={item}
            label={item}
            active={category === item}
            onPress={() => setCategory(item)}
          />
        ))}
      </View>

      <Card>
        <Title>تصفية حسب مرافق الإتاحة</Title>
        <T size={14}>اختر مرفقًا واحدًا أو أكثر</T>

        <View style={S.wrap}>
          {facilityNames.map((name, i) => (
            <Chip
              key={name}
              label={name}
              active={ids.includes(i + 1)}
              onPress={() => toggleFacility(i + 1)}
            />
          ))}
        </View>

        <Btn label="تطبيق الفلاتر" onPress={applyFilters} />
      </Card>

      <Title>نتائج البحث</Title>

      {loading ? (
        <ActivityIndicator accessibilityLabel="جارٍ تحميل الأماكن" />
      ) : error ? (
        <Card>
          <T>تعذّر تحميل الأماكن.</T>
          <Btn
            label="إعادة المحاولة"
            onPress={() => setAttempt((n) => n + 1)}
          />
        </Card>
      ) : rows.length === 0 ? (
        <T>لا توجد نتائج مطابقة.</T>
      ) : (
        rows.map((place) => (
          <Card key={place.id}>
            <T bold size={20}>{place.name_ar}</T>
            <T>{place.category_ar}</T>
            <Btn
              label="عرض التفاصيل"
              kind="soft"
              onPress={() => go(`/live-places/${place.id}`)}
            />
          </Card>
        ))
      )}
    </Shell>
  );
}