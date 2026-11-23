import { useState } from "react";
import { View } from "react-native";
import {
  Btn,
  Card,
  Field,
  Link,
  Round,
  S,
  Shell,
  T,
  Title,
  go,
  replace,
} from "../../ui/components";
import { useDemo } from "../../ui/demo";
export default function Places() {
  const d = useDemo(),
    [q, setQ] = useState(""),
    [deleting, setDelete] = useState<number | null>(null);
  const rows = d.places.filter((p) => p.name.includes(q));
  return (
    <Shell
      admin
      nav
      title="إدارة الأماكن"
      onBack={() => {
        d.setEmail(null);
        replace("/welcome");
      }}
    >
      <Field
        label="بحث"
        placeholder="ابحث عن مكان مسجل..."
        value={q}
        onChangeText={setQ}
      />
      <Title>الأماكن المسجلة</Title>
      {rows.map((p) => (
        <Card key={p.id}>
          <T bold>{p.name}</T>
          <T size={14}>
            {p.category} · {p.address}
          </T>
          <View style={S.row}>
            <Round
              icon="edit"
              label={"تعديل " + p.name}
              onPress={() => go("/admin/place?id=" + p.id)}
            />
            <Round
              icon="trash"
              label={"حذف " + p.name}
              onPress={() => setDelete(p.id)}
            />
            <Link label="عرض المكان" onPress={() => go("/places/" + p.id)} />
          </View>
          {deleting === p.id && (
            <>
              <T>حذف المكان وبياناته المرتبطة؟</T>
              <Btn
                kind="danger"
                label="تأكيد حذف المكان"
                onPress={() => {
                  d.removePlace(p.id);
                  setDelete(null);
                }}
              />
              <Link label="إلغاء" onPress={() => setDelete(null)} />
            </>
          )}
        </Card>
      ))}
      {!rows.length && <T>لا توجد نتائج مطابقة.</T>}
      <Btn label="إضافة مكان جديد" onPress={() => go("/admin/place")} />
      <Link
        label="تسجيل الخروج"
        onPress={() => {
          d.setEmail(null);
          replace("/welcome");
        }}
      />
    </Shell>
  );
}
