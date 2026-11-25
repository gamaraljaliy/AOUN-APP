import { useDemo } from "../../ui/demo";
import { useState } from "react";
import { useAuth } from "../../auth/context";
import { list, remove, type AdminPlace } from "../../services/admin";
import { useAdminData, AdminFeedback } from "../../ui/admin";
import {
  Btn,
  Card,
  Field,
  Message,
  Shell,
  T,
  go,
  replace,
} from "../../ui/components";
const load = () =>
  list<AdminPlace>("places", "*,place_facilities(facility_id,status)");
export default function Places() {
  const { lang } = useDemo();
  const state = useAdminData(load),
    auth = useAuth();
  const [q, setQ] = useState(""),
    [selected, setSelected] = useState<number | null>(null),
    [message, setMessage] = useState("");
  const rows = (state.data ?? []).filter((p) =>
    (p.name_ar + p.name_en).toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <Shell admin nav title="إدارة الأماكن">
      <AdminFeedback state={state} />
      <Message text={message} />
      <Field label="البحث عن مكان" value={q} onChangeText={setQ} />
      {rows.map((p) => (
        <Card key={p.id}>
          <T bold>{lang === "en" ? p.name_en : p.name_ar}</T>
          <T>{p.address ?? ""}</T>
          <Btn label="تعديل" onPress={() => go("/admin/place?id=" + p.id)} />
          <Btn label="عرض المكان" onPress={() => go("/live-places/" + p.id)} />
          {selected === p.id ? (
            <>
              <T>حذف المكان وبياناته المرتبطة؟</T>
              <Btn
                disabled={state.busy}
                kind="danger"
                label="تأكيد حذف المكان"
                onPress={async () => {
                  if (await state.mutate(() => remove("places", p.id)))
                    setSelected(null);
                }}
              />
              <Btn label="إلغاء" onPress={() => setSelected(null)} />
            </>
          ) : (
            <Btn label="حذف" onPress={() => setSelected(p.id)} />
          )}
        </Card>
      ))}
      {!state.loading && !state.error && !rows.length && (
        <T>لا توجد نتائج مطابقة.</T>
      )}
      <Btn label="إضافة مكان جديد" onPress={() => go("/admin/place")} />
      <Btn label="حسابي" onPress={() => go("/profile")} />
      <Btn
        label="تسجيل الخروج"
        onPress={async () => {
          try {
            await auth.signOut();
            replace("/welcome");
          } catch {
            setMessage("تعذّر تسجيل الخروج. حاولي مجددًا.");
          }
        }}
      />
    </Shell>
  );
}
