import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { searchPlaces, type Place } from "../services/places";
import { facilityNames, useDemo } from "./demo";
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
  go,
} from "./components";
import { LivePlaceCard } from "./places";

const categories = ["الكل", "مركز تسوق", "مقهى", "مرافق عامة", "مطعم"];

function initialFacilities(ids?: string, legacyIndex?: string) {
  const values = ids
    ? ids.split(",").map(Number)
    : legacyIndex
      ? [Number(legacyIndex) + 1]
      : [];
  return [
    ...new Set(
      values.filter(
        (id) => Number.isInteger(id) && id >= 1 && id <= facilityNames.length,
      ),
    ),
  ];
}

export function PlaceSearch({ advanced = false }: { advanced?: boolean }) {
  const { lang, setLang } = useDemo();
  const params = useLocalSearchParams<{
    q?: string;
    ids?: string;
    facility?: string;
  }>();
  const [query, setQuery] = useState(params.q ?? "");
  const [term, setTerm] = useState(query.trim());
  const [ids, setIds] = useState(() =>
    initialFacilities(params.ids, params.facility),
  );
  const [category, setCategory] = useState("الكل");
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, retry] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    searchPlaces(term, ids, controller.signal)
      .then((results) => {
        if (!controller.signal.aborted) setPlaces(results);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [term, ids, attempt]);

  function toggleFacility(id: number) {
    setTerm(query.trim());
    setIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  const rows =
    category === "الكل"
      ? places
      : places.filter((place) => place.category_ar === category);
  return (
    <Shell
      brand={!advanced}
      title={advanced ? "البحث والفلترة" : undefined}
      nav
      action={
        advanced ? (
          <Round
            icon="globe"
            label="لغة التطبيق"
            onPress={() => setLang(lang === "ar" ? "en" : "ar")}
          />
        ) : undefined
      }
    >
      <View style={S.row}>
        <View style={{ flex: 1 }}>
          <Field
            icon="search"
            label="البحث عن مكان"
            placeholder="ابحث عن مكان..."
            value={query}
            onChangeText={setQuery}
            maxLength={150}
            returnKeyType="search"
            onSubmitEditing={() => setTerm(query.trim())}
          />
        </View>
        {!advanced && (
          <Round
            icon="sort"
            label="البحث والفلترة"
            onPress={() =>
              go(
                "/search?q=" +
                  encodeURIComponent(query) +
                  "&ids=" +
                  ids.join(","),
              )
            }
          />
        )}
      </View>
      <View>
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator
          style={{ direction: lang === "ar" ? "rtl" : "ltr" }}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        >
          {facilityNames.map((name, index) => (
            <Chip
              key={name}
              label={name}
              active={ids.includes(index + 1)}
              onPress={() => toggleFacility(index + 1)}
            />
          ))}
        </ScrollView>
      </View>
      {advanced && (
        <>
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
          <Title>نتائج البحث</Title>
        </>
      )}
      {loading ? (
        <ActivityIndicator accessibilityLabel="جارٍ تحميل الأماكن" />
      ) : error ? (
        <Card>
          <T>تعذّر تحميل الأماكن.</T>
          <Btn label="إعادة المحاولة" onPress={() => retry((n) => n + 1)} />
        </Card>
      ) : rows.length ? (
        rows.map((place) => <LivePlaceCard key={place.id} place={place} />)
      ) : (
        <T>لا توجد نتائج مطابقة.</T>
      )}
    </Shell>
  );
}
