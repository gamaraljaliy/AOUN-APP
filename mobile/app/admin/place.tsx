import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  type Availability,
  facilityNames,
  statusNames,
  useDemo,
} from "../../ui/demo";
import {
  Btn,
  Chip,
  Field,
  Message,
  S,
  Shell,
  T,
  Title,
  replace,
} from "../../ui/components";
export default function PlaceForm() {
  const d = useDemo(),
    { id } = useLocalSearchParams<{ id?: string }>(),
    p = d.places.find((x) => x.id === Number(id));
  const [name, setName] = useState(p?.name ?? ""),
    [category, setCategory] = useState(p?.category ?? ""),
    [address, setAddress] = useState(p?.address ?? ""),
    [lat, setLat] = useState(p ? String(p.lat) : ""),
    [lon, setLon] = useState(p ? String(p.lon) : ""),
    [facilities, setFacilities] = useState<Availability[]>(
      p?.facilities ?? facilityNames.map(() => "unknown"),
    ),
    [msg, setMsg] = useState("");
  function save() {
    if (
      !name.trim() ||
      !category.trim() ||
      !address.trim() ||
      !lat.trim() ||
      !lon.trim() ||
      !Number.isFinite(Number(lat)) ||
      !Number.isFinite(Number(lon)) ||
      Math.abs(Number(lat)) > 90 ||
      Math.abs(Number(lon)) > 180
    ) {
      setMsg("أكملي بيانات المكان وأدخلي إحداثيات صحيحة.");
      return;
    }
    const data = {
      ...p,
      id: p?.id ?? Date.now(),
      name: name.trim(),
      category: category.trim(),
      address: address.trim(),
      lat: Number(lat),
      lon: Number(lon),
      facilities,
    };
    d.setPlaces((v) =>
      p ? v.map((x) => (x.id === p.id ? data : x)) : [...v, data],
    );
    replace("/admin/places");
  }
  return (
    <Shell admin title="إضافة / تعديل مكان">
      <Field label="اسم المكان" value={name} onChangeText={setName} />
      <Field label="الفئة" value={category} onChangeText={setCategory} />
      <Field label="العنوان" value={address} onChangeText={setAddress} />
      <View style={S.row}>
        <View style={{ flex: 1 }}>
          <Field label="خط العرض" value={lat} onChangeText={setLat} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="خط الطول" value={lon} onChangeText={setLon} />
        </View>
      </View>
      <Title>مرافق الإتاحة</Title>
      <T size={14}>اضغطي على المرفق لتغيير حالته.</T>
      <View style={S.wrap}>
        {facilityNames.map((n, i) => (
          <Chip
            key={n}
            label={n + " · " + statusNames[facilities[i]]}
            active={facilities[i] === "available"}
            onPress={() => {
              const keys = Object.keys(statusNames) as Availability[];
              setFacilities((all) =>
                all.map((v, j) =>
                  j === i ? keys[(keys.indexOf(v) + 1) % keys.length] : v,
                ),
              );
            }}
          />
        ))}
      </View>
      <Message text={msg} />
      <Btn label="حفظ بيانات المكان" onPress={save} />
    </Shell>
  );
}
