import { useState } from "react";
import { Pressable, View } from "react-native";
import * as Location from "expo-location";
import { useLocalSearchParams } from "expo-router";
import { distance, useDemo } from "../ui/demo";
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
import { PlaceCard } from "../ui/places";
import { openMap } from "../ui/location";
export default function Nearby() {
  const d = useDemo();
  const params = useLocalSearchParams<{ place?: string }>();
  const [map, setMap] = useState(true),
    [id, setId] = useState(Number(params.place) || d.places[0]?.id),
    [manual, setManual] = useState(false),
    [lat, setLat] = useState(""),
    [lon, setLon] = useState(""),
    [msg, setMsg] = useState("");
  const rows = [...d.places].sort(
    (a, b) =>
      distance(d.origin.lat, d.origin.lon, a) -
      distance(d.origin.lat, d.origin.lon, b),
  );
  const p = d.places.find((x) => x.id === id) ?? rows[0];
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
  function save() {
    const a = Number(lat),
      b = Number(lon);
    if (
      !lat.trim() ||
      !lon.trim() ||
      !Number.isFinite(a) ||
      !Number.isFinite(b) ||
      Math.abs(a) > 90 ||
      Math.abs(b) > 180
    ) {
      setMsg("أدخلي إحداثيات صحيحة.");
      return;
    }
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
      {map ? (
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
          {p && <PlaceCard p={p} compact />}
        </>
      ) : (
        rows.map((x) => <PlaceCard p={x} key={x.id} compact />)
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
              value={lat}
              onChangeText={setLat}
              keyboardType="numbers-and-punctuation"
            />
            <Field
              label="خط الطول"
              value={lon}
              onChangeText={setLon}
              keyboardType="numbers-and-punctuation"
            />
            <Btn label="اعتماد الموقع" onPress={save} />
          </>
        )}
        <Message text={msg} />
      </Card>
      {p && (
        <Btn
          label="فتح الموقع في تطبيق الخرائط"
          onPress={() => openMap(p).catch(() => setMsg("تعذّر فتح الخرائط."))}
        />
      )}
    </Shell>
  );
}
