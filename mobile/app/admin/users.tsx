import { useState } from "react";
import { View } from "react-native";
import { accounts, setAccountStatus } from "../../services/admin";
import { useAdminData, AdminFeedback } from "../../ui/admin";
import { Btn, Card, Chip, Field, S, Shell, T } from "../../ui/components";
export default function Users() {
  const state = useAdminData(accounts);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const rows = (state.data ?? []).filter(
    (a) =>
      (a.display_name + a.email)
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (filter === "all" || a.status === filter),
  );
  return (
    <Shell admin nav title="إدارة المستخدمين">
      <AdminFeedback state={state} />
      <Field
        label="البحث بالاسم أو البريد"
        value={query}
        onChangeText={setQuery}
      />
      <View style={S.wrap}>
        {[
          ["all", "الكل"],
          ["active", "نشط"],
          ["suspended", "معلّق"],
        ].map(([v, l]) => (
          <Chip
            key={v}
            label={l}
            active={filter === v}
            onPress={() => setFilter(v)}
          />
        ))}
      </View>
      {rows.map((a) => (
        <Card key={a.id}>
          <T bold>{a.display_name}</T>
          <T>{a.email}</T>
          <T>{a.status === "active" ? "نشط" : "معلّق"}</T>
          {a.role === "member" ? (
            <Btn
              disabled={state.busy}
              label={a.status === "active" ? "تعليق الحساب" : "إعادة تفعيل"}
              onPress={() =>
                void state.mutate(() =>
                  setAccountStatus(
                    a.id,
                    a.status === "active" ? "suspended" : "active",
                  ),
                )
              }
            />
          ) : (
            <T>مسؤول</T>
          )}
        </Card>
      ))}
      {!state.loading && !state.error && !rows.length && (
        <T>لا توجد نتائج مطابقة.</T>
      )}
    </Shell>
  );
}
