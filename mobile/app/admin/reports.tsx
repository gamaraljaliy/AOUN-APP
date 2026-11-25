import { useDemo } from "../../ui/demo";
import { useState } from "react";
import { View } from "react-native";
import { list, setReportStatus, type AdminReport } from "../../services/admin";
import { useAdminData, AdminFeedback } from "../../ui/admin";
import { Btn, Card, Chip, S, Shell, T } from "../../ui/components";
const statuses: Record<string, string> = {
  submitted: "تم الإرسال",
  under_review: "قيد المراجعة",
  resolved: "تم الحل",
  rejected: "مرفوض",
};
const kinds: Record<string, string> = {
  incorrect: "معلومة خاطئة",
  missing: "معلومة ناقصة",
  outdated: "معلومة قديمة",
};
const load = () => list<AdminReport>("reports", "*,places(name_ar,name_en)");
export default function Reports() {
  const { lang } = useDemo();
  const state = useAdminData(load),
    [filter, setFilter] = useState("all");
  const rows = (state.data ?? []).filter(
    (r) => filter === "all" || r.status === filter,
  );
  return (
    <Shell admin nav title="مراجعة البلاغات">
      <AdminFeedback state={state} />
      <View style={S.wrap}>
        {Object.entries({ all: "الكل", ...statuses }).map(([v, l]) => (
          <Chip
            key={v}
            label={l}
            active={filter === v}
            onPress={() => setFilter(v)}
          />
        ))}
      </View>
      {rows.map((r) => (
        <Card key={r.id}>
          <T bold>{kinds[r.issue_type]}</T>
          <T>
            {(lang === "en" ? r.places?.name_en : r.places?.name_ar) ??
              String(r.place_id)}
          </T>
          <T>{r.description}</T>
          <T>{statuses[r.status]}</T>
          {!["resolved", "rejected"].includes(r.status) &&
            Object.entries(statuses)
              .filter(([v]) => v !== "submitted" && v !== r.status)
              .map(([v, l]) => (
                <Btn
                  key={v}
                  disabled={state.busy}
                  label={l}
                  onPress={() =>
                    void state.mutate(() => setReportStatus(r.id, r.status, v))
                  }
                />
              ))}
        </Card>
      ))}
      {!state.loading && !state.error && !rows.length && (
        <T>لا توجد بلاغات بهذه الحالة.</T>
      )}
    </Shell>
  );
}
