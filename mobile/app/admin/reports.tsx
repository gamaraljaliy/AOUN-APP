import { useDemo } from "../../ui/demo";
import { useState } from "react";
import { View } from "react-native";
import { list, setReportStatus, type AdminReport } from "../../services/admin";
import { useAdminData, AdminFeedback } from "../../ui/admin";
import { Btn, Card, Chip, Field, S, Shell, T } from "../../ui/components";
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
  const [decision, setDecision] = useState<{id: number; status: string; note: string} | null>(null);
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
          {r.admin_response && <T>{r.admin_response}</T>}
          {decision?.id === r.id ? (
            <>
              <Field label={decision.status === "resolved" ? "حل البلاغ" : "سبب الرفض"}
                value={decision.note} multiline onChangeText={(note) => setDecision({...decision, note})} />
              <Btn label="حفظ" disabled={state.busy || !decision.note.trim()} onPress={async () => {
                if (await state.mutate(() => setReportStatus(r.id, r.status, decision.status, decision.note.trim()))) setDecision(null);
              }} />
              <Btn label="إلغاء" kind="soft" disabled={state.busy} onPress={() => setDecision(null)} />
            </>
          ) : !["resolved", "rejected"].includes(r.status) &&
            Object.entries(statuses)
              .filter(([v]) => v !== "submitted" && v !== r.status)
              .map(([v, l]) => (
                <Btn
                  key={v}
                  disabled={state.busy}
                  label={l}
                  onPress={() =>
                    v === "under_review" ? void state.mutate(() => setReportStatus(r.id, r.status, v)) : setDecision({id: r.id, status: v, note: ""})
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
