import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Platform } from "react-native";
import { db, readProfile } from "../../services/supabase";
import { Btn, Message, Shell, replace } from "../../ui/components";

export default function Callback() {
  // Router params cover both cold-start links and links opened while the app is running.
  const {
    code,
    flow,
    error: linkError,
  } = useLocalSearchParams<{ code?: string; flow?: string; error?: string }>();
  const handled = useRef(false);
  const [message, setMessage] = useState("جارٍ التحقق من الرابط…");
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    void (async () => {
      try {
        if (!code || linkError) throw new Error("Invalid link");
        const { data, error } = await db().auth.exchangeCodeForSession(code);
        if (error || !data.session) throw error;
        if (Platform.OS === "web")
          window.history.replaceState({}, "", window.location.pathname);
        const profile = await readProfile(data.session.user.id);
        if (profile.status !== "active") {
          await db().auth.signOut({ scope: "local" });
          throw new Error("Suspended");
        }
        replace(
          flow === "recovery"
            ? "/update-password"
            : profile.role === "admin"
              ? "/admin/places"
              : "/home",
        );
      } catch {
        setMessage(
          "الرابط غير صالح أو انتهت صلاحيته. اطلبي رابطًا جديدًا وافتحيه على الجهاز والمتصفح اللذين طلبتِ منهما الرابط.",
        );
      }
    })();
  }, [code, flow, linkError]);
  return (
    <Shell title="التحقق من البريد">
      <Message text={message} />
      <Btn label="إرسال رابط استعادة جديد" onPress={() => replace("/reset")} />
      <Btn label="العودة إلى الدخول" onPress={() => replace("/login")} />
    </Shell>
  );
}
