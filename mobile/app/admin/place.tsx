import { coordinateError } from "../../ui/validation";
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
    [attempted, setAttempted] = useState(false);
  const errors = {
    name: name.trim() ? "" : "أدخل اسم المكان.",
    category: category.trim() ? "" : "أدخل فئة المكان.",
    address: address.trim() ? "" : "أدخل العنوان.",
    lat: coordinateError(lat, 90),
    lon: coordinateError(lon, 180),
  };
  function save() {
    setAttempted(true);
    if (Object.values(errors).some(Boolean)) return;
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
      <Field
        label="اسم المكان"
        error={attempted ? errors.name : undefined}
        value={name}
        onChangeText={setName}
      />
      <Field
        label="الفئة"
        error={attempted ? errors.category : undefined}
        value={category}
        onChangeText={setCategory}
      />
      <Field
        label="العنوان"
        error={attempted ? errors.address : undefined}
        value={address}
        onChangeText={setAddress}
      />
      <View style={S.row}>
        <View style={{ flex: 1 }}>
          <Field
            label="خط العرض"
            error={attempted ? errors.lat : undefined}
            value={lat}
            onChangeText={setLat}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="خط الطول"
            error={attempted ? errors.lon : undefined}
            value={lon}
            onChangeText={setLon}
          />
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
      <Btn label="حفظ بيانات المكان" onPress={save} />
    </Shell>
  );
}
