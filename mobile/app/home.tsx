import { LivePlaceCard } from "../ui/places";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { searchPlaces, type Place } from "../services/places";
import {
  Btn,
  Card,
  Chip,
  Field,
  Round,
  S,
  Shell,
  T,
  go,
} from "../ui/components";

import { facilityNames } from "../ui/demo";

export default function Home() {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(false);

    async function load() {
      try {
        const results = await searchPlaces(query.trim(), [], controller.signal);
        if (!controller.signal.aborted) setPlaces(results);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    const timer = setTimeout(() => void load(), query.trim() ? 300 : 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, attempt]);

  return (
    <Shell brand nav>
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
          />
        </View>

        <Round
          icon="sort"
          label="البحث والفلترة"
          onPress={() => go("/search")}
        />
      </View>

      <View style={S.wrap}>
        {facilityNames.map((name, index) => (
          <Chip
            key={name}
            label={name}
            onPress={() => go(`/search?facility=${index}`)}
          />
        ))}
      </View>

      {loading ? (
        <ActivityIndicator accessibilityLabel="جارٍ تحميل الأماكن" />
      ) : error ? (
        <Card>
          <T>تعذّر تحميل الأماكن.</T>
          <Btn
            label="إعادة المحاولة"
            onPress={() => setAttempt((value) => value + 1)}
          />
        </Card>
      ) : places.length === 0 ? (
        <T>لا توجد نتائج مطابقة.</T>
      ) : (
        places.map((place) => <LivePlaceCard key={place.id} place={place} />)
      )}
    </Shell>
  );
}
