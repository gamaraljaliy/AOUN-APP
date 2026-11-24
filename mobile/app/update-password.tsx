import { useState } from "react";
import { useAuth } from "../auth/context";
import { db, errorText } from "../services/supabase";
import { Btn, Field, Message, Shell, replace } from "../ui/components";
export default function UpdatePassword() {
  const auth = useAuth();
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save() {
    if (busy) return;
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      password !== confirm
    ) {
      setMessage(
        "أدخلي كلمة مرور متطابقة من ٨ أحرف على الأقل، تتضمن حرفًا إنجليزيًا كبيرًا ورقمًا.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await db().auth.updateUser({ password });
      if (error) throw error;
      await auth.signOut();
      replace("/login");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell title="تعيين كلمة المرور">
      <Message text={message || auth.error} />
      {auth.loading ? (
        <Message text="جارٍ التحقق…" />
      ) : auth.profile?.status === "active" ? (
        <>
          <Field
            label="كلمة المرور الجديدة"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Field
            label="تأكيد كلمة المرور"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
          />
          <Btn
            label="حفظ كلمة المرور والعودة للدخول"
            disabled={busy}
            onPress={save}
          />
          <Btn
            label="متابعة إلى التطبيق"
            onPress={() => replace(auth.admin ? "/admin/places" : "/home")}
          />
        </>
      ) : (
        <Btn
          label="اطلبي رابط استعادة جديدًا"
          onPress={() => replace("/reset")}
        />
      )}
    </Shell>
  );
}
