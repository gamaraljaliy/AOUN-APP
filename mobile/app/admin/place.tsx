import { useCallback, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { db, errorText } from "../../services/supabase";
import {
  list,
  savePlace,
  type AdminPlace,
  type Category,
  type FacilityState,
} from "../../services/admin";
import { useAdminData, AdminFeedback } from "../../ui/admin";
import { facilityNames, statusNames } from "../../ui/demo";
import {
  Btn,
  Chip,
  Field,
  Message,
  S,
  Shell,
  T,
  replace,
} from "../../ui/components";
export default function PlaceForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const load = useCallback(async () => {
    const categories = await list<Category>("categories");
    let place: AdminPlace | null = null;
    if (id) {
      if (!/^\d+$/.test(id)) throw new Error("Invalid place");
      const { data, error } = await db()
        .from("places")
        .select("*,place_facilities(facility_id,status)")
        .eq("id", Number(id))
        .single();
      if (error) throw error;
      place = data;
    }
    return { categories, place };
  }, [id]);
  const state = useAdminData(load);
  return (
    <Shell admin title="إضافة / تعديل مكان">
      <AdminFeedback state={state} />
      {!state.loading && state.data && (
        <Editor
          key={id ?? "new"}
          place={state.data.place}
          categories={state.data.categories}
        />
      )}
    </Shell>
  );
}
function Editor({
  place,
  categories,
}: {
  place: AdminPlace | null;
  categories: Category[];
}) {
  const [nameAr, setNameAr] = useState(place?.name_ar ?? ""),
    [nameEn, setNameEn] = useState(place?.name_en ?? "");
  const [category, setCategory] = useState<number | null>(
    place?.category_id ?? null,
  );
  const [address, setAddress] = useState(place?.address ?? ""),
    [lat, setLat] = useState(place?.latitude?.toString() ?? ""),
    [lon, setLon] = useState(place?.longitude?.toString() ?? "");
  const [facilities, setFacilities] = useState<FacilityState[]>(
    facilityNames.map(
      (_, i) =>
        place?.place_facilities.find((f) => f.facility_id === i + 1)?.status ??
        null,
    ),
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function save() {
    if (busy) return;
    if (!nameAr.trim() || !nameEn.trim() || !category) {
      setMessage("أدخلي اسم المكان باللغتين واختاري الفئة.");
      return;
    }
    const latitude = lat.trim() ? Number(lat) : null,
      longitude = lon.trim() ? Number(lon) : null;
    if (
      (latitude === null) !== (longitude === null) ||
      (latitude !== null &&
        (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) ||
      (longitude !== null &&
        (!Number.isFinite(longitude) || Math.abs(longitude) > 180))
    ) {
      setMessage("أدخلي إحداثيين صالحين معًا، أو اتركيهما فارغين.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await savePlace(
        place?.id ?? null,
        {
          name_ar: nameAr.trim(),
          name_en: nameEn.trim(),
          category_id: category,
          address: address.trim() || null,
          latitude,
          longitude,
        },
        facilities,
      );
      replace("/admin/places");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Message text={message} />
      <Field
        label="اسم المكان بالعربية"
        value={nameAr}
        onChangeText={setNameAr}
      />
      <Field
        label="اسم المكان بالإنجليزية"
        value={nameEn}
        onChangeText={setNameEn}
      />
      <T bold>الفئة</T>
      <View style={S.wrap}>
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={c.name_ar}
            active={category === c.id}
            onPress={() => setCategory(c.id)}
          />
        ))}
      </View>
      <Field label="العنوان" value={address} onChangeText={setAddress} />
      <Field
        label="خط العرض (اختياري)"
        value={lat}
        onChangeText={setLat}
        keyboardType="numbers-and-punctuation"
      />
      <Field
        label="خط الطول (اختياري)"
        value={lon}
        onChangeText={setLon}
        keyboardType="numbers-and-punctuation"
      />
      <T bold>مرافق الإتاحة</T>
      <View style={S.wrap}>
        {facilityNames.map((name, i) => (
          <Chip
            key={name}
            label={name + " · " + statusNames[facilities[i] ?? "unknown"]}
            active={facilities[i] === "available"}
            onPress={() => {
              const states: FacilityState[] = [
                null,
                "available",
                "unavailable",
                "not_applicable",
              ];
              setFacilities((old) =>
                old.map((v, j) =>
                  i === j ? states[(states.indexOf(v) + 1) % states.length] : v,
                ),
              );
            }}
          />
        ))}
      </View>
      <Btn disabled={busy} label="حفظ بيانات المكان" onPress={save} />
    </>
  );
}
