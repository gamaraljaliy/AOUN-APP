import React, { useState, useEffect, useRef } from "react";
import { router, type Href } from "expo-router";
import {
  ActivityIndicator,
  Button,
  Pressable,
  TextInput,
  View,
  Text,
} from "react-native";
import { Page } from "../components/Page";
import { s } from "../theme/styles";
import { getPlacesData, type Place } from "../services/places";
const facilities = [
  "منحدرات",
  "مصاعد",
  "دورات مياه مهيأة",
  "مواقف مخصصة",
  "مداخل مهيأة",
  "بلاط ملموس",
  "لوحات برايل",
  "تنبيهات مرئية",
  "حلقات سمعية",
];

export default function SearchScreen() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [rows, setRows] = useState<Place[] | null>(null);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(false);
  const last = useRef<string | null>(null),
    current = useRef<AbortController | null>(null);
  useEffect(() => () => current.current?.abort(), []);
  async function load(path: string) {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    last.current = path;
    setLoading(true);
    setError(false);
    setRows(null);
    try {
      const result = await getPlacesData<Place[]>(path, controller.signal);
      if (!controller.signal.aborted) setRows(result);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  function search() {
    void load(
      "/places?q=" +
        encodeURIComponent(q) +
        selected.map((id) => "&facility=" + id).join(""),
    );
  }
  return (
    <Page>
      {" "}
      <Text accessibilityRole="header" style={s.title}>
        البحث في عون
      </Text>
      <TextInput
        accessibilityLabel="اسم المكان أو الفئة"
        placeholder="اسم المكان أو الفئة"
        style={s.input}
        value={q}
        onChangeText={setQ}
        onSubmitEditing={search}
      />
      <Text style={s.label}>المرافق المطلوبة</Text>
      <View style={s.filters}>
        {facilities.map((name, i) => {
          const id = i + 1,
            checked = selected.includes(id);
          return (
            <Pressable
              key={id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              onPress={() =>
                setSelected((prev) =>
                  prev.includes(id)
                    ? prev.filter((x) => x !== id)
                    : [...prev, id],
                )
              }
              style={[s.chip, checked && s.active]}
            >
              <Text style={{ color: checked ? "white" : "#173e36" }}>
                {checked ? "✓ " : ""}
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Button title="بحث" onPress={search} />
      {loading && <ActivityIndicator accessibilityLabel="جارٍ التحميل" />}
      {error && (
        <>
          <Text accessibilityRole="alert" style={s.label}>
            تعذّر تحميل البيانات. تحققي من الاتصال.
          </Text>
          <Button
            title="إعادة المحاولة"
            onPress={() => last.current !== null && void load(last.current)}
          />
        </>
      )}
      {rows?.length === 0 && !loading && !error && (
        <Text style={s.label}>لا توجد أماكن تطابق بحثك.</Text>
      )}
      {rows?.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          onPress={() => router.push(("/places/" + p.id) as Href)}
        >
          <Text style={s.item}>
            {p.name_ar} · {p.category_ar}
          </Text>
        </Pressable>
      ))}
    </Page>
  );
}
