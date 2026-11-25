import { useDemo } from "../../ui/demo";
import { useState } from "react";
import { list, remove, type AdminReview } from "../../services/admin";
import { useAdminData, AdminFeedback } from "../../ui/admin";
import { Btn, Card, Shell, T } from "../../ui/components";
const load = () =>
  list<AdminReview>(
    "ratings",
    "*,profiles(display_name),places(name_ar,name_en)",
  );
export default function Reviews() {
  const { lang } = useDemo();
  const state = useAdminData(load),
    [selected, setSelected] = useState<number | null>(null);
  return (
    <Shell admin nav title="إدارة المراجعات">
      <AdminFeedback state={state} />
      {(state.data ?? []).map((r) => (
        <Card key={r.id}>
          <T bold>{r.profiles?.display_name ?? "مستخدم"}</T>
          <T>
            {(lang === "en" ? r.places?.name_en : r.places?.name_ar) ??
              String(r.place_id)}
          </T>
          <T>{"★".repeat(r.score)}</T>
          <T>{r.review_text ?? ""}</T>
          {selected === r.id ? (
            <>
              <Btn
                kind="danger"
                disabled={state.busy}
                label="تأكيد حذف المراجعة"
                onPress={async () => {
                  if (await state.mutate(() => remove("ratings", r.id)))
                    setSelected(null);
                }}
              />
              <Btn label="إلغاء" onPress={() => setSelected(null)} />
            </>
          ) : (
            <Btn
              label="حذف المراجعة المخالفة"
              onPress={() => setSelected(r.id)}
            />
          )}
        </Card>
      ))}
      {!state.loading && !state.error && !state.data?.length && (
        <T>لا توجد مراجعات بعد.</T>
      )}
    </Shell>
  );
}
