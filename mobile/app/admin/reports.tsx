import { useState } from "react";
import { View } from "react-native";
import { useDemo } from "../../ui/demo";
import { Btn, Card, Chip, S, Shell, T, Title } from "../../ui/components";
export default function Reports() {
  const d = useDemo(),
    [filter, setFilter] = useState("الكل"),
    [id, select] = useState<number | null>(null),
    [next, setNext] = useState("");
  const rows = d.reports.filter(
    (r) => filter === "الكل" || r.status === filter,
  );
  const report = rows.find((r) => r.id === id);
  return (
    <Shell admin nav title="مراجعة البلاغات">
      <View style={S.wrap}>
        {["الكل", "تم الإرسال", "قيد المراجعة", "تم الحل", "مرفوض"].map((f) => (
          <Chip
            label={f}
            key={f}
            active={filter === f}
            onPress={() => {
              setFilter(f);
              select(null);
            }}
          />
        ))}
      </View>
      {rows.map((r) => (
        <Card key={r.id}>
          <Title>{r.kind}</Title>
          <T>{r.placeName ?? d.places.find((p) => p.id === r.placeId)?.name}</T>
          <T>{r.text}</T>
          <Chip
            label={r.status}
            onPress={() => {
              select(r.id);
              setNext("");
            }}
          />
          {r.status !== "تم الحل" && r.status !== "مرفوض" && (
            <Btn
              kind="soft"
              label="تغيير حالة البلاغ"
              onPress={() => {
                select(r.id);
                setNext("");
              }}
            />
          )}
        </Card>
      ))}
      {!rows.length && <T>لا توجد بلاغات بهذه الحالة.</T>}
      {report && report.status !== "تم الحل" && report.status !== "مرفوض" && (
        <Card>
          <Title>تغيير حالة البلاغ</Title>
          <View style={S.wrap}>
            {["قيد المراجعة", "تم الحل", "مرفوض"]
              .filter((x) => x !== report.status)
              .map((x) => (
                <Chip
                  key={x}
                  label={x}
                  active={next === x}
                  onPress={() => setNext(x)}
                />
              ))}
          </View>
          <Btn
            disabled={!next}
            label="حفظ الحالة الجديدة"
            onPress={() => {
              d.setReports((v) =>
                v.map((r) => (r.id === id ? { ...r, status: next } : r)),
              );
              select(null);
              setNext("");
            }}
          />
        </Card>
      )}
    </Shell>
  );
}
