import { useState } from "react";
import { View } from "react-native";
import { useAuth } from "../auth/context";
import { useDemo } from "../ui/demo";
import { errorText } from "../services/supabase";
import {
  Btn,
  Card,
  Chip,
  Field,
  Icon,
  Message,
  S,
  Shell,
  T,
  go,
  replace,
} from "../ui/components";
export default function Profile() {
  const auth = useAuth(),
    d = useDemo();
  const [editing, setEditing] = useState(false),
    [name, setName] = useState("");
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save() {
    if (!name.trim()) {
      setMessage("أدخل الاسم الكامل.");
      return;
    }
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await auth.saveProfile(name, language);
      d.setLang(language);
      setEditing(false);
      setMessage("تم حفظ التعديلات.");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell nav title="حسابي والإعدادات">
      <Message
        text={
          message ||
          auth.error ||
          (auth.profile?.status === "suspended" ? "الحساب معلّق." : "")
        }
      />
      <Card>
        <Icon name="user" size={44} />
        <T bold>{auth.profile?.display_name ?? "زائر"}</T>
        <T>{auth.session?.user.email ?? ""}</T>
      </Card>
      {auth.loading ? (
        <T>جارٍ التحميل…</T>
      ) : (
        auth.profile?.status === "active" && (
          <Card>
            <Btn
              label="تعديل الملف الشخصي"
              onPress={() => {
                setName(auth.profile!.display_name);
                setLanguage(auth.profile!.preferred_language);
                setEditing(!editing);
              }}
            />
            {editing && (
              <>
                <Field
                  label="الاسم الكامل"
                  value={name}
                  onChangeText={setName}
                />
                <View style={S.row}>
                  {(["ar", "en"] as const).map((l) => (
                    <Chip
                      key={l}
                      label={l === "ar" ? "عربي" : "English"}
                      active={language === l}
                      onPress={() => setLanguage(l)}
                    />
                  ))}
                </View>
                <Btn label="حفظ التعديلات" disabled={busy} onPress={save} />
              </>
            )}
          </Card>
        )
      )}
      <Card>
        <T bold>لغة التطبيق</T>
        <View style={S.row}>
          <Chip
            label="عربي"
            active={d.lang === "ar"}
            onPress={() => d.setLang("ar")}
          />
          <Chip
            label="English"
            active={d.lang === "en"}
            onPress={() => d.setLang("en")}
          />
        </View>
      </Card>
      {auth.session ? (
        <>
          <Btn label="استعادة كلمة المرور" onPress={() => go("/reset")} />
          {auth.admin && (
            <Btn label="الإدارة" onPress={() => go("/admin/places")} />
          )}
          <Btn
            label="تسجيل الخروج"
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await auth.signOut();
                replace("/welcome");
              } catch (error) {
                setMessage(errorText(error));
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      ) : (
        <Btn label="تسجيل الدخول" onPress={() => go("/login")} />
      )}
    </Shell>
  );
}
