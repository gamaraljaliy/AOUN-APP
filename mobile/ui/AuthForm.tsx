import { useState } from "react";
import { View } from "react-native";
import { adminEmail, memberEmail, useDemo } from "./demo";
import {
  Btn,
  C,
  Card,
  Chip,
  Field,
  Icon,
  Link,
  Logo,
  Message,
  Shell,
  T,
  back,
  go,
  replace,
} from "./components";
export function AuthForm({ mode }: { mode: "login" | "register" | "reset" }) {
  const d = useDemo();
  const [email, setEmail] = useState(""),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [visible, setVisible] = useState(false),
    [consent, setConsent] = useState(false),
    [msg, setMsg] = useState("");
  const login = mode === "login",
    reg = mode === "register",
    reset = mode === "reset";
  function submit() {
    const key = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) {
      setMsg("أدخلي بريدًا إلكترونيًا صحيحًا.");
      return;
    }
    if (reset) {
      setMsg(
        "في النسخة التجريبية لا يُرسل بريد. استعملي بيانات الدخول التجريبية.",
      );
      return;
    }
    if (reg) {
      if (
        !name.trim() ||
        password.length < 8 ||
        !/[A-Z]/.test(password) ||
        !/[0-9]/.test(password) ||
        password !== confirm ||
        !consent
      ) {
        setMsg("راجعي الاسم وشروط كلمة المرور والتأكيد والموافقة.");
        return;
      }
      if (d.passwords.current[key]) {
        setMsg("البريد مسجل مسبقًا.");
        return;
      }
      d.passwords.current[key] = password;
      d.setAccounts((a) => [
        ...a,
        { email: key, name: name.trim(), suspended: false },
      ]);
    } else if (
      d.passwords.current[key] !== password ||
      d.accounts.some((a) => a.email === key && a.suspended)
    ) {
      setMsg("تحققي من بيانات الدخول وحالة الحساب.");
      return;
    }
    d.setEmail(key);
    replace(key === adminEmail ? "/admin/places" : "/home");
  }
  const title = login
    ? "تسجيل الدخول"
    : reg
      ? "انضم إلى عون"
      : "نسيت كلمة المرور؟";
  return (
    <Shell title={reg ? title : undefined} onBack={() => back("/welcome")}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 10,
          gap: 15,
        }}
      >
        {!reg && (
          <View style={{ alignItems: "center", gap: 10 }}>
            {reset ? (
              <View
                style={{
                  padding: 30,
                  borderRadius: 70,
                  backgroundColor: C.soft,
                }}
              >
                <Icon name="reset" size={65} />
              </View>
            ) : (
              <Logo size={136} />
            )}
            <T center bold size={32}>
              {title}
            </T>
            <T center color={C.muted}>
              {reset
                ? "أدخل بريدك الإلكتروني المسجل وسنرسل لك رابطًا لإعادة تعيين كلمة المرور."
                : "سجّل دخولك لزيارة مفضلاتك وتقييمات الوصول."}
            </T>
          </View>
        )}
        {reg && (
          <Field label="الاسم الكامل" value={name} onChangeText={setName} />
        )}
        <Field
          label="البريد الإلكتروني"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          placeholder="name@example.com"
          onChangeText={setEmail}
        />
        {!reset && (
          <>
            <Field
              label="كلمة المرور"
              secureTextEntry={!visible}
              value={password}
              onChangeText={setPassword}
            />
            <Link
              label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              onPress={() => setVisible(!visible)}
            />
          </>
        )}
        {reg && (
          <>
            <Field
              label="تأكيد كلمة المرور"
              secureTextEntry={!visible}
              value={confirm}
              onChangeText={setConfirm}
            />
            <T size={13}>٨ أحرف على الأقل، حرف كبير ورقم.</T>
            <Chip
              label="أوافق على استخدام بيانات تجريبية لهذه الجلسة"
              active={consent}
              onPress={() => setConsent(!consent)}
            />
          </>
        )}
        {login && (
          <Link label="نسيت كلمة المرور؟" onPress={() => go("/reset")} />
        )}
        <Message text={msg} />
        <Btn
          label={
            login ? title : reg ? "إنشاء حساب في عون" : "إرسال رابط الاستعادة"
          }
          onPress={submit}
        />
        {login && (
          <>
            <Btn
              kind="soft"
              label="المتابعة كزائر دون تسجيل"
              onPress={() => {
                d.setEmail(null);
                replace("/home");
              }}
            />
            <Link label="إنشاء حساب جديد" onPress={() => go("/register")} />
            <Card>
              <T size={14}>تجربة محلية · اختاري حسابًا لتعبئة بيانات الدخول</T>
              <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                {[
                  [memberEmail, "عضو"],
                  [adminEmail, "مسؤول"],
                ].map(([mail, label]) => (
                  <Chip
                    key={mail}
                    label={label}
                    onPress={() => {
                      setEmail(mail);
                      setPassword("AounDemo1");
                      setMsg("");
                    }}
                  />
                ))}
              </View>
            </Card>
          </>
        )}
        {!login && (
          <Link
            label="العودة إلى تسجيل الدخول"
            onPress={() => replace("/login")}
          />
        )}
      </View>
    </Shell>
  );
}
