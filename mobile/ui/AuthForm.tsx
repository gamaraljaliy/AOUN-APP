import { useState } from "react";
import { Pressable, View } from "react-native";
import { useAuth } from "../auth/context";
import { db, readProfile, errorText } from "../services/supabase";
import * as Linking from "expo-linking";
import { ConfirmationResend } from "./ConfirmationResend";
import { useDemo } from "./demo";
import {
  Btn,
  C,
  Chip,
  Field,
  FieldError,
  useCopy,
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
  const auth = useAuth();
  const { lang } = useDemo();
  const [role, setRole] = useState<"member" | "admin">("member");
  const [busy, setBusy] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<
    "ready" | "profile-error" | "confirmation" | null
  >(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const tr = useCopy();
  const [attempted, setAttempted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
  const key = email.trim().toLowerCase();
  const rules = [
    { label: "٨ أحرف على الأقل", met: password.length >= 8 },
    { label: "حرف إنجليزي كبير (A–Z)", met: /[A-Z]/.test(password) },
    { label: "رقم واحد على الأقل (0–9)", met: /[0-9]/.test(password) },
  ];
  const errors = {
    name: reg && !name.trim() ? "أدخل الاسم الكامل." : "",
    email: !key
      ? "أدخل البريد الإلكتروني."
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)
        ? "أدخل بريدًا إلكترونيًا صحيحًا."
        : "",
    password:
      !reset && !password
        ? "أدخل كلمة المرور."
        : reg && rules.some((rule) => !rule.met)
          ? "أكمل شروط كلمة المرور أدناه."
          : "",
    confirm:
      reg && !confirm
        ? "أعد كتابة كلمة المرور."
        : reg && confirm !== password
          ? "كلمتا المرور غير متطابقتين."
          : "",
    consent: reg && !consent ? "الموافقة مطلوبة لإنشاء الحساب." : "",
  };
  async function submit() {
    setAttempted(true);
    setMsg("");
    if (busy || registrationResult || Object.values(errors).some(Boolean)) return;
    setNeedsConfirmation(false);
    setBusy(true);
    try {
      const client = db();
      const redirectTo = Linking.createURL("auth/callback");
      if (reset) {
        const { error } = await client.auth.resetPasswordForEmail(key, {
          redirectTo: Linking.createURL("auth/callback", {
            queryParams: { flow: "recovery" },
          }),
        });
        if (error) throw error;
        setMsg("إذا كان البريد مسجلًا، سيصلك رابط استعادة كلمة المرور.");
        return;
      }
      const result = reg
        ? await client.auth.signUp({
            email: key,
            password,
            options: {
              data: { display_name: name.trim() },
              emailRedirectTo: redirectTo,
            },
          })
        : await client.auth.signInWithPassword({ email: key, password });
      if (result.error) {
        const code = result.error.code;
        setNeedsConfirmation(code === "email_not_confirmed");
        setMsg(
          reg && (code === "user_already_exists" || code === "email_exists")
            ? "هذا البريد مسجل بالفعل. سجّلي الدخول أو استعيدي كلمة المرور."
            : code === "invalid_credentials"
              ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
              : code === "email_not_confirmed"
                ? "يلزم تأكيد البريد لهذا الحساب قبل تسجيل الدخول."
                : code === "weak_password"
                  ? "كلمة المرور لا تستوفي شروط الحماية. راجعي الشروط وحاولي مجددًا."
                  : reg
                    ? "تعذّر إنشاء الحساب. تحققي من البيانات وحاولي مجددًا."
                    : "تعذّر تسجيل الدخول. حاولي مجددًا.",
        );
        return;
      }
      if (!result.data.session) {
        if (reg) {
          setPassword("");
          setConfirm("");
          setRegistrationResult("confirmation");
        } else setMsg("تعذّر تسجيل الدخول. حاولي مجددًا.");
        return;
      }
      let profile: Awaited<ReturnType<typeof readProfile>>;
      try {
        profile = await readProfile(result.data.session.user.id);
      } catch (error) {
        if (!reg) throw error;
        setPassword("");
        setConfirm("");
        setRegistrationResult("profile-error");
        return;
      }
      if (profile.status !== "active") {
        await auth.signOut();
        setMsg("الحساب معلّق. تواصلي مع إدارة التطبيق.");
        return;
      }
      if (login && profile.role !== role) {
        await auth.signOut();
        setMsg("اختاري نوع الحساب المطابق لحسابك.");
        return;
      }
      if (reg) {
        setPassword("");
        setConfirm("");
        setRegistrationResult("ready");
        return;
      }
      replace(profile.role === "admin" ? "/admin/places" : "/home");
    } catch (error) {
      setMsg(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  function eye(shown: boolean, toggle: () => void) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr(
          shown ? "إخفاء كلمة المرور" : "إظهار كلمة المرور",
        )}
        style={{
          minWidth: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
        onPress={toggle}
      >
        <Icon name={shown ? "eye" : "eyeOff"} size={19} />
      </Pressable>
    );
  }
  if (registrationResult) {
    const ready = registrationResult === "ready";
    const pending = registrationResult === "confirmation";
    return (
      <Shell brand>
        <View style={{ gap: 18, paddingVertical: 32 }}>
          <T center bold size={28}>
            {pending
              ? "تحققي من بريدك لإكمال التسجيل"
              : ready
                ? "تم إنشاء الحساب بنجاح"
                : "تم إنشاء الحساب، لكن تعذّر تحميل ملفك."}
          </T>
          <T center color={C.muted}>
            {pending
              ? "راجعي بريدك وافتحي أحدث رابط تأكيد على الجهاز والمتصفح نفسيهما لإكمال التسجيل."
              : ready
                ? "حسابك جاهز. يمكنك الآن استخدام عون."
                : "سجّلي الدخول بالمعلومات نفسها للمحاولة مجددًا."}
          </T>
          {pending && (
            <>
              <ConfirmationResend email={key} />
              <T center color={C.muted}>
                إذا كان لديك حساب سابق بهذا البريد، سجّلي الدخول.
              </T>
            </>
          )}
          <Btn
            label={ready ? "متابعة إلى التطبيق" : "العودة إلى تسجيل الدخول"}
            onPress={() => replace(ready ? "/home" : "/login")}
          />
        </View>
      </Shell>
    );
  }
  const title = login
    ? "تسجيل الدخول"
    : reg
      ? "انضم إلى عون"
      : "نسيت كلمة المرور؟";
  return (
    <Shell
      brand={reg || reset}
      title={reg ? title : undefined}
      onBack={() => back(reset ? "/login" : "/welcome")}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-start",
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
                ? "أدخل بريدك الإلكتروني المسجل لاستعادة كلمة المرور."
                : "سجّل دخولك لزيارة مفضلاتك وتقييمات الوصول."}
            </T>
          </View>
        )}
        {login && (
          <View style={{ gap: 8 }}>
            <T bold>نوع الحساب</T>
<View
  style={{
    flexDirection: lang === "ar" ? "row-reverse" : "row",
    gap: 8,
  }}
>              {(["member", "admin"] as const).map((option) => (
                <Chip
                  key={option}
                  label={option === "admin" ? "مشرف" : "مستخدم"}
                  active={role === option}
                  onPress={() => {
                    if (!busy) {
                      setRole(option);
                      setMsg("");
                    }
                  }}
                />
              ))}
            </View>
          </View>
        )}
        {reg && (
          <Field
            icon="user"
            error={attempted ? errors.name : undefined}
            label="الاسم الكامل"
            value={name}
            onChangeText={setName}
          />
        )}
        <Field
          icon="mail"
          error={attempted ? errors.email : undefined}
          label="البريد الإلكتروني"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          placeholder="name@example.com"
          onChangeText={(value) => {
            setEmail(value);
            setMsg("");
            setNeedsConfirmation(false);
          }}
        />
        {!reset && (
          <>
            <Field
              label="كلمة المرور"
              icon="lock"
              error={attempted ? errors.password : undefined}
              trailing={eye(visible, () => setVisible(!visible))}
              secureTextEntry={!visible}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setMsg("");
              }}
            />
          </>
        )}
        {reg && (
          <>
            <Field
              label="تأكيد كلمة المرور"
              icon="lock"
              error={attempted ? errors.confirm : undefined}
              trailing={eye(showConfirm, () => setShowConfirm(!showConfirm))}
              secureTextEntry={!showConfirm}
              value={confirm}
              onChangeText={setConfirm}
            />
            <View style={{ gap: 4 }}>
              {rules.map((rule) => (
                <T
                  key={rule.label}
                  size={14}
                  color={rule.met ? "#16704D" : C.muted}
                >
                  {(rule.met ? "✓  " : "○  ") + tr(rule.label)}
                </T>
              ))}
            </View>
            <Chip
              label="أوافق على إنشاء حساب وحفظ بيانات ملفي الشخصي"
              active={consent}
              onPress={() => setConsent(!consent)}
            />
            <FieldError text={attempted ? errors.consent : undefined} />
          </>
        )}
        {login && (
          <Link label="نسيت كلمة المرور؟" onPress={() => go("/reset")} />
        )}
        <Message text={msg} />
        {needsConfirmation && <ConfirmationResend key={key} email={key} />}
        <Btn
          label={
            login ? title : reg ? "إنشاء حساب في عون" : "إرسال رابط الاستعادة"
          }
          disabled={busy}
          onPress={submit}
        />
        {login && (
          <>
            <Btn
              kind="soft"
              label="المتابعة كزائر دون تسجيل"
              onPress={async () => {
                try {
                  if (auth.session) await auth.signOut();
                  replace("/home");
                } catch (error) {
                  setMsg(errorText(error));
                }
              }}
            />
            <Link label="إنشاء حساب جديد" onPress={() => go("/register")} />
          </>
        )}
        {!login && (
          <View
            style={
              reset ? { marginTop: "auto", paddingVertical: 14 } : undefined
            }
          >
            <Link
              label="العودة إلى تسجيل الدخول"
              onPress={() => replace("/login")}
            />
          </View>
        )}
      </View>
    </Shell>
  );
}
