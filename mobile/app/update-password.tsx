import { useState } from "react";
import { Pressable } from "react-native";
import { useAuth } from "../auth/context";
import { db, errorText } from "../services/supabase";
import {
  Btn,
  Field,
  Icon,
  Message,
  Shell,
  replace,
  useCopy,
} from "../ui/components";
export default function UpdatePassword() {
  const auth = useAuth();
  const tr = useCopy();
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false),
    [confirmVisible, setConfirmVisible] = useState(false);
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
  function eye(label: string, toggle: () => void) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr(label)}
        style={{
          minWidth: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
        onPress={toggle}
      >
        <Icon name="eye" size={19} />
      </Pressable>
    );
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
            secureTextEntry={!passwordVisible}
            trailing={eye(
              passwordVisible
                ? "إخفاء كلمة المرور الجديدة"
                : "إظهار كلمة المرور الجديدة",
              () => setPasswordVisible((visible) => !visible),
            )}
          />
          <Field
            label="تأكيد كلمة المرور"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!confirmVisible}
            trailing={eye(
              confirmVisible
                ? "إخفاء تأكيد كلمة المرور"
                : "إظهار تأكيد كلمة المرور",
              () => setConfirmVisible((visible) => !visible),
            )}
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
