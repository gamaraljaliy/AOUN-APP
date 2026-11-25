import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Platform } from "react-native";
import { db, readProfile } from "../../services/supabase";
import {
  authLinkKind,
  createAuthLinkHandler,
  type AuthLinkResult,
} from "../../services/auth-links";
import { ConfirmationResend } from "../../ui/ConfirmationResend";
import { Btn, Message, Shell, replace } from "../../ui/components";

export default function Callback() {
  const { code, flow, error, error_code } = useLocalSearchParams<{
    code?: string;
    flow?: string;
    error?: string;
    error_code?: string;
  }>();
  const [result, setResult] = useState<AuthLinkResult | null>(null);
  const handleLink = useMemo(
    () =>
      createAuthLinkHandler({
        exchange: async (value) => {
          const { data, error } = await db().auth.exchangeCodeForSession(value);
          if (error || !data.session) throw error ?? new Error("Missing session");
          return data.session.user.id;
        },
        readProfile,
        signOut: async () => {
          await db().auth.signOut({ scope: "local" });
        },
      }),
    [],
  );
  useEffect(() => {
    let current = true;
    setResult(null);
    void handleLink({ code, flow, error: error || error_code }).then((next) => {
      if (!current) return;
      if (next.status !== "link-error" && Platform.OS === "web") {
        // The code has been consumed. Keep the purpose, but remove credentials.
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname +
            (next.kind === "recovery" ? "?flow=recovery" : ""),
        );
      }
      setResult(next);
      if (next.status === "ready") replace(next.destination);
    });
    return () => {
      current = false;
    };
  }, [code, flow, error, error_code, handleLink]);

  const kind = result?.kind ?? authLinkKind(flow);
  const message =
    !result || result.status === "ready"
      ? "جارٍ التحقق من الرابط…"
      : result.status === "suspended"
        ? "الحساب معلّق. تواصلي مع إدارة التطبيق."
        : result.status === "profile-error"
          ? "تم التحقق من الرابط، لكن تعذّر تحميل ملفك. سجّلي الدخول للمحاولة مجددًا."
          : result.reason === "missing"
            ? "رابط التحقق غير مكتمل. افتحي أحدث رابط من بريدك على الجهاز والمتصفح اللذين طلبتِ منهما الرابط."
            : kind === "recovery"
              ? "تعذّر التحقق من رابط الاستعادة. اطلبي رابطًا جديدًا وافتحي أحدث رسالة على الجهاز والمتصفح نفسيهما."
              : "تعذّر التحقق من رابط تأكيد البريد. اطلبي رابط تأكيد جديدًا، أو سجّلي الدخول إذا سبق تأكيد حسابك.";
  return (
    <Shell
      title={kind === "recovery" ? "استعادة كلمة المرور" : "تأكيد البريد الإلكتروني"}
    >
      <Message text={message} />
      {result?.status === "link-error" &&
        (kind === "recovery" ? (
          <Btn label="إرسال رابط استعادة جديد" onPress={() => replace("/reset")} />
        ) : (
          <ConfirmationResend />
        ))}
      <Btn label="العودة إلى الدخول" onPress={() => replace("/login")} />
    </Shell>
  );
}
