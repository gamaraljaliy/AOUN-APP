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
      await auth.saveProfile({ display_name: name.trim() });
      setEditing(false);
      setMessage("تم حفظ التعديلات.");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function changeLanguage(next: "ar" | "en") {
    if (busy || d.lang === next) return;
    const previous = d.lang;
    d.setLang(next);
    if (auth.profile?.status !== "active") return;
    setBusy(true);
    try {
      await auth.saveProfile({ preferred_language: next });
    } catch (error) {
      d.setLang(previous);
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell nav admin={auth.admin} title="حسابي والإعدادات">
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
            onPress={() => changeLanguage("ar")}
          />
          <Chip
            label="English"
            active={d.lang === "en"}
            onPress={() => changeLanguage("en")}
          />
        </View>
      </Card>
      <Card>
        <Btn kind="soft" label="حول عون" onPress={() => go("/about")} />
        <Btn kind="soft" label="المساعدة" onPress={() => go("/help")} />
      </Card>
      {auth.session ? (
        <>
          <Btn label="استعادة كلمة المرور" onPress={() => go("/reset")} />
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
