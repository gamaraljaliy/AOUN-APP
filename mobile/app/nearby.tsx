import PlaceMap from "../ui/PlaceMap";
import { coordinateError } from "../ui/validation";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import * as Location from "expo-location";
import { useLocalSearchParams } from "expo-router";
import { useDemo } from "../ui/demo";
import { Btn, Card, Field, Message, Shell, T } from "../ui/components";
import { LivePlaceCard } from "../ui/places";
import {
  searchPlaces,
  getNearbyPlaces,
  type Pin,
  type Place,
} from "../services/places";
export default function Nearby() {
  const d = useDemo();
  const params = useLocalSearchParams<{ place?: string }>();
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(570, Math.max(160, width - 56));
  const strip = useRef<ScrollView>(null);
  const [id, setId] = useState(Number(params.place)),
    [manual, setManual] = useState(false),
    [lat, setLat] = useState(""),
    [lon, setLon] = useState(""),
    [msg, setMsg] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    Promise.all([
      searchPlaces("", [], controller.signal),
      getNearbyPlaces(d.origin.lat, d.origin.lon, controller.signal),
    ])
      .then(([results, coordinates]) => {
        if (controller.signal.aborted) return;
        setPlaces(results);
        setPins(coordinates);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [d.origin.lat, d.origin.lon, attempt]);
  const byId = new Map(places.map((place) => [place.id, place]));

  const rows = pins.flatMap((pin) => {
    const place = byId.get(pin.place_id);
    return place
      ? [
          {
            place,
            id: place.id,
            name:
              d.lang === "ar"
                ? place.name_ar
                : (place.name_en ?? place.name_ar),
            lat: pin.latitude,
            lon: pin.longitude,
          },
        ]
      : [];
  });
  const p = rows.find((row) => row.id === id) ?? rows[0];
  async function locate() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw Error();
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      d.setOrigin({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        label: "موقعي الحالي",
      });
      setMsg("تم تحديث الموقع.");
    } catch {
      setMsg("تعذّر تحديد موقعك. يمكنك اختياره يدويًا.");
      setManual(true);
    }
  }
  const [attempted, setAttempted] = useState(false);
  const latError = coordinateError(lat, 90),
    lonError = coordinateError(lon, 180);
  function save() {
    const a = Number(lat),
      b = Number(lon);
    setAttempted(true);
    if (latError || lonError) return;
    setAttempted(false);
    d.setOrigin({ lat: a, lon: b, label: "موقع يدوي" });
    setManual(false);
    setMsg("تم تحديث الموقع.");
  }
  const selectedIndex = rows.findIndex((row) => row.id === p?.id);
  useEffect(() => {
    if (selectedIndex >= 0)
      strip.current?.scrollTo({
        x: selectedIndex * (cardWidth + 10),
        animated: true,
      });
  }, [selectedIndex, cardWidth]);
  return (
    <Shell nav title="الخريطة">
      <View style={{ borderRadius: 18, overflow: "hidden" }}>
        <PlaceMap
          pins={rows}
          selected={p?.id}
          center={d.origin}
          onSelect={setId}
          height={Math.max(220, Math.min(480, height * 0.47))}
        />
      </View>
      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <Card>
          <T>تعذّر تحميل الأماكن.</T>
          <Btn label="إعادة المحاولة" onPress={() => retry((n) => n + 1)} />
        </Card>
      ) : !rows.length ? (
        <T>لا توجد أماكن بإحداثيات مسجلة لعرضها على الخريطة.</T>
      ) : (
        <ScrollView
          ref={strip}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ direction: "ltr" }}
          contentContainerStyle={{ gap: 10 }}
          snapToInterval={cardWidth + 10}
          decelerationRate="fast"
          onMomentumScrollEnd={(event) => {
            const index = Math.min(
              rows.length - 1,
              Math.max(
                0,
                Math.round(
                  event.nativeEvent.contentOffset.x / (cardWidth + 10),
                ),
              ),
            );
            if (rows[index]) setId(rows[index].id);
          }}
        >
          {rows.map((row) => (
            <View key={row.id} style={{ width: cardWidth }}>
              <LivePlaceCard place={row.place} />
            </View>
          ))}
        </ScrollView>
      )}
      <Card>
        <T bold>{d.origin.label}</T>
        <Btn label="تحديد موقعي تلقائيًا" onPress={locate} />
        <Btn
          label="تحديد موقعي يدويًا"
          kind="soft"
          onPress={() => setManual(!manual)}
        />
        {manual && (
          <>
            <Field
              label="خط العرض"
              error={attempted ? latError : undefined}
              value={lat}
              onChangeText={setLat}
              keyboardType="numbers-and-punctuation"
            />
            <Field
              label="خط الطول"
              error={attempted ? lonError : undefined}
              value={lon}
              onChangeText={setLon}
              keyboardType="numbers-and-punctuation"
            />
            <Btn label="اعتماد الموقع" onPress={save} />
          </>
        )}
        <Message text={msg} />
      </Card>
      {!loading && !error && p && (
        <Btn
          label="فتح الموقع في تطبيق الخرائط"
          onPress={() =>
            Linking.openURL(
              `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`,
            ).catch(() => setMsg("تعذّر فتح الخرائط."))
          }
        />
      )}
    </Shell>
  );
}
