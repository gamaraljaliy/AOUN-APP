import { coordinateError } from "../ui/validation";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import * as Location from "expo-location";
import { useLocalSearchParams } from "expo-router";
import { useDemo } from "../ui/demo";
import {
  Btn,
  C,
  Card,
  Chip,
  Field,
  Icon,
  Message,
  S,
  Shell,
  T,
  go,
} from "../ui/components";
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
  const [map, setMap] = useState(true),
    [id, setId] = useState(Number(params.place)),
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
  const pinById = new Map(pins.map((pin) => [pin.place_id, pin]));
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
  const minLat = Math.min(...rows.map((x) => x.lat)),
    maxLat = Math.max(...rows.map((x) => x.lat)),
    minLon = Math.min(...rows.map((x) => x.lon)),
    maxLon = Math.max(...rows.map((x) => x.lon));
  return (
    <Shell nav title="الخريطة">
      <View style={S.row}>
        <Chip label="الخريطة" active={map} onPress={() => setMap(true)} />
        <Chip label="القائمة" active={!map} onPress={() => setMap(false)} />
      </View>
      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <Card>
          <T>تعذّر تحميل الأماكن.</T>
          <Btn label="إعادة المحاولة" onPress={() => retry((n) => n + 1)} />
        </Card>
      ) : map && !rows.length ? (
        <Card>
          <T>لا توجد أماكن بإحداثيات مسجلة لعرضها على الخريطة.</T>
          <Btn label="القائمة" onPress={() => setMap(false)} />
        </Card>
      ) : map ? (
        <>
          <View
            style={{
              height: 300,
              borderRadius: 18,
              backgroundColor: "#EFF3F1",
              overflow: "hidden",
            }}
          >
            {Array.from({ length: 20 }, (_, i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  left: ((i % 4) * 26 - 4 + "%") as `${number}%`,
                  top: (Math.floor(i / 4) * 23 - 5 + "%") as `${number}%`,
                  width: "24%",
                  height: "20%",
                  borderRadius: 5,
                  borderWidth: 2,
                  borderColor: "white",
                  backgroundColor: i % 4 === 0 ? "#AFDCD1" : "#E3EBE7",
                }}
              />
            ))}
            {rows.map((x) => (
              <Pressable
                key={x.id}
                accessibilityRole="button"
                accessibilityLabel={x.name}
                onPress={() => setId(x.id)}
                style={{
                  position: "absolute",
                  left: (8 +
                    (70 * (x.lon - minLon)) / (maxLon - minLon || 1) +
                    "%") as `${number}%`,
                  top: (10 +
                    (65 * (maxLat - x.lat)) / (maxLat - minLat || 1) +
                    "%") as `${number}%`,
                  backgroundColor: x.id === p?.id ? C.lav : "white",
                  padding: 9,
                  borderRadius: 24,
                }}
              >
                <Icon name="marker" />
              </Pressable>
            ))}
          </View>
          {p && <LivePlaceCard place={p.place} />}
        </>
      ) : (
        [
          ...rows.map((row) => row.place),
          ...places.filter((place) => !pinById.has(place.id)),
        ].map((place) => <LivePlaceCard key={place.id} place={place} />)
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
