import { useState } from "react";
import { View } from "react-native";
import { list, type AdminPlace } from "../../services/admin";
import { AdminFeedback, useAdminData } from "../../ui/admin";
import { Btn, Card, Field, Shell, T, go } from "../../ui/components";
import { useDemo } from "../../ui/demo";

type PlaceRow = Pick<AdminPlace, "id" | "name_ar" | "name_en" | "address">;
const load = () => list<PlaceRow>("places", "id,name_ar,name_en,address");

export default function Places() {
  const { lang } = useDemo();
  const state = useAdminData(load);
  const [q, setQ] = useState("");
  const rows = (state.data ?? []).filter((p) =>
    (p.name_ar + p.name_en).toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <Shell admin nav title="إدارة الأماكن">
      <View style={{ flexDirection: lang === "ar" ? "row-reverse" : "row", alignItems: "flex-end", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field label="البحث عن مكان" value={q} onChangeText={setQ} />
        </View>
        <Btn label="إضافة مكان" onPress={() => go("/admin/place")} />
      </View>
      <AdminFeedback state={state} />
      {rows.map((p) => (
        <Card key={p.id}>
          <T bold>{lang === "en" ? p.name_en : p.name_ar}</T>
          <T>{p.address ?? ""}</T>
          <Btn label="تفاصيل المكان" onPress={() => go("/live-places/" + p.id)} />
        </Card>
      ))}
      {!state.loading && !state.error && !rows.length && (
        <T>لا توجد نتائج مطابقة.</T>
      )}
    </Shell>
  );
}
