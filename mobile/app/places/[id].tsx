import React, { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Text, ActivityIndicator, Button } from "react-native";
import { Page } from "../../components/Page";
import { s } from "../../theme/styles";
import { getPlacesData, type Detail } from "../../services/places";
const levels: Record<string, string> = {
  accessible: "مهيأ",
  partially_accessible: "مهيأ جزئيًا",
  not_accessible: "غير مهيأ",
};
const statuses: Record<string, string> = {
  available: "متوفر",
  unavailable: "غير متوفر",
  not_applicable: "لا ينطبق",
};

export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    setDetail(null);
    getPlacesData<Detail>(
      "/places/" + encodeURIComponent(id),
      controller.signal,
    )
      .then((place) => {
        if (!controller.signal.aborted) setDetail(place);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [id, attempt]);
  return (
    <Page>
      {error ? (
        <>
          <Text accessibilityRole="alert">تعذّر تحميل تفاصيل المكان.</Text>
          <Button
            title="إعادة المحاولة"
            onPress={() => setAttempt((n) => n + 1)}
          />
        </>
      ) : detail ? (
        <>
          {" "}
          <Text accessibilityRole="header" style={s.title}>
            {detail.name_ar}
          </Text>
          <Text style={s.label}>
            {detail.category_ar} ·{" "}
            {levels[detail.level ?? ""] ?? "بانتظار مراجعة المسؤول"}
          </Text>
          {detail.facilities.map((f) => (
            <Text key={f.id} style={s.item}>
              {f.name_ar} — {statuses[f.status ?? ""] ?? "غير مسجّل"}
            </Text>
          ))}
        </>
      ) : (
        <ActivityIndicator accessibilityLabel="جارٍ التحميل" />
      )}
    </Page>
  );
}
