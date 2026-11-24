import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { getPlaceDetails, type Detail } from "../../services/places";
import { Btn, Message, Shell } from "../../ui/components";
import { PlaceDetails } from "../../ui/PlaceDetails";
export default function LivePlaceDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [place, setPlace] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(false);
      setPlace(null);

      try {
        const result = await getPlaceDetails(Number(id), controller.signal);
        if (!controller.signal.aborted) setPlace(result);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [id, attempt]);

  if (loading) {
    return (
      <Shell title="تفاصيل المكان">
        <ActivityIndicator accessibilityLabel="جارٍ تحميل تفاصيل المكان" />
      </Shell>
    );
  }

  if (error || !place) {
    return (
      <Shell title="تفاصيل المكان">
        <Message text="تعذّر تحميل تفاصيل المكان." />
        <Btn
          label="إعادة المحاولة"
          onPress={() => setAttempt((value) => value + 1)}
        />
      </Shell>
    );
  }

  return <PlaceDetails place={place} live />;
}
