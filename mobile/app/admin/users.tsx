import { useState } from "react";
import { View } from "react-native";
import { useDemo } from "../../ui/demo";
import { Btn, Card, Chip, Field, S, Shell, T } from "../../ui/components";
export default function Users() {
  const d = useDemo(),
    [q, setQ] = useState(""),
    [f, setF] = useState("الكل");
  const rows = d.accounts.filter(
    (a) =>
      (a.email + a.name).toLowerCase().includes(q.trim().toLowerCase()) &&
      (f === "الكل" || (f === "معلّق") === a.suspended),
  );
  return (
    <Shell admin nav title="إدارة المستخدمين">
      <Field
        label="بحث"
        placeholder="ابحث باسم المستخدم أو البريد..."
        value={q}
        onChangeText={setQ}
      />
      <View style={S.wrap}>
        {["الكل", "نشط", "معلّق"].map((x) => (
          <Chip key={x} label={x} active={x === f} onPress={() => setF(x)} />
        ))}
      </View>
      {rows.map((a) => (
        <Card key={a.email}>
          <T bold>{a.name}</T>
          <T>{a.email}</T>
          <T>{a.suspended ? "معلّق" : "نشط"}</T>
          <Btn
            kind={a.suspended ? "mint" : "soft"}
            label={a.suspended ? "إعادة تفعيل" : "تعليق الحساب"}
            onPress={() =>
              d.setAccounts((v) =>
                v.map((x) =>
                  x.email === a.email ? { ...x, suspended: !x.suspended } : x,
                ),
              )
            }
          />
        </Card>
      ))}
      {!rows.length && <T>لا توجد نتائج مطابقة.</T>}
    </Shell>
  );
}
