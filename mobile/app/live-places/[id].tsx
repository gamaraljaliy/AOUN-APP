import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { getPlaceDetails, type Detail } from "../../services/places";
import { Btn, C, Card, Message, S, Shell, T, Title } from "../../ui/components";
import { statusNames, useDemo } from "../../ui/demo";

import { levelLabels } from "../../ui/places";

export default function LivePlaceDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { lang } = useDemo();

  const [place, setPlace] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [mapMessage, setMapMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(false);
      setPlace(null);
      setMapMessage("");

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

  const name = lang === "en" ? place.name_en : place.name_ar;
  const category = lang === "en" ? place.category_en : place.category_ar;
  const description =
    lang === "en" ? place.description_en : place.description_ar;

  return (
    <Shell title={name}>
      <Card>
        <Title>{name}</Title>
        <T color={C.muted}>{category}</T>
        {description && <T>{description}</T>}
        {place.address && <T size={14}>{place.address}</T>}
        <T bold>{levelLabels[place.level ?? ""] ?? "بانتظار المراجعة"}</T>
      </Card>

      <Title>مرافق الإتاحة</Title>
      <Card>
        {place.facilities.map((facility) => (
          <View
            key={facility.id}
            style={[S.row, { justifyContent: "space-between" }]}
          >
            <T>{lang === "en" ? facility.name_en : facility.name_ar}</T>
            <T size={14} color={C.muted}>
              {statusNames[facility.status ?? "unknown"]}
            </T>
          </View>
        ))}
      </Card>

      {place.latitude !== null && place.longitude !== null && (
        <Btn
          label="فتح الموقع في تطبيق الخرائط"
          onPress={() => {
            const coordinates = `${place.latitude},${place.longitude}`;
            void Linking.openURL(
              `https://www.google.com/maps/search/?api=1&query=${coordinates}`,
            ).catch(() => setMapMessage("تعذّر فتح الخرائط."));
          }}
        />
      )}
      {mapMessage !== "" && <Message text={mapMessage} />}

      <Title>تجارب الوصول</Title>
      {place.average_rating !== null && (
        <T bold>{`★ ${place.average_rating.toFixed(1)} / 5`}</T>
      )}

      {place.reviews.length === 0 ? (
        <T>لا توجد مراجعات بعد.</T>
      ) : (
        place.reviews.map((review) => (
          <Card key={review.id}>
            <T bold>{review.display_name}</T>
            <T>{`${review.score} / 5`}</T>
            {review.review_text && <T>{review.review_text}</T>}
          </Card>
        ))
      )}
    </Shell>
  );
}
