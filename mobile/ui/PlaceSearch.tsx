import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { searchPlaces, type Place } from "../services/places";
import { facilityNames, useDemo } from "./demo";
import { Btn, Card, Chip, Field, Round, S, Shell, T } from "./components";
import { LivePlaceCard } from "./places";

import { initialFacilities } from "./placeFilters";

export function PlaceSearch({ advanced = false }: { advanced?: boolean }) {
  const { lang } = useDemo();
  const params = useLocalSearchParams<{
    q?: string;
    ids?: string;
    facility?: string;
    category?: string;
  }>();
  const [query, setQuery] = useState(params.q ?? "");
  const [term, setTerm] = useState(query.trim());
  const ids = useMemo(
    () => initialFacilities(params.ids, params.facility),
    [params.ids, params.facility],
  );
  const category = params.category || "الكل";
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
    const next = ids.includes(id)
      ? ids.filter((value) => value !== id)
      : [...ids, id];
    router.setParams({ ids: next.join(","), facility: "" });
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
    >
      <View
        style={[
          S.row,
          { flexDirection: lang === "en" ? "row" : "row-reverse" },
        ]}
      >
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
        <Round
          icon="sort"
          label="البحث والفلترة"
          onPress={() =>
            router.push({
              pathname: "/filters",
              params: {
                from: advanced ? "/search" : "/home",
                ids: ids.join(","),
                category,
                q: query,
              },
            })
          }
        />
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
