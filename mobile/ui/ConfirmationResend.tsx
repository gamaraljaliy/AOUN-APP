import { useState } from "react";
import { View } from "react-native";
import * as Linking from "expo-linking";
import { db, errorText } from "../services/supabase";
import { Btn, Field, Message } from "./components";

export function ConfirmationResend({ email }: { email?: string }) {
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function resend() {
    if (busy) return;
    const value = (email ?? address).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setMessage("أدخل بريدًا إلكترونيًا صحيحًا.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await db().auth.resend({
        type: "signup",
        email: value,
        options: { emailRedirectTo: Linking.createURL("auth/callback") },
      });
      if (error) {
        setMessage(
          error.code === "over_email_send_rate_limit"
            ? "انتظري قليلًا قبل طلب رسالة تأكيد أخرى."
            : errorText(error),
        );
        return;
      }
      setMessage(
        "إذا كان الحساب بحاجة إلى تأكيد، سيصلك رابط جديد. افتحي أحدث رابط على الجهاز والمتصفح نفسيهما.",
      );
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 12 }}>
      {email === undefined && (
        <Field
          label="البريد الإلكتروني"
          keyboardType="email-address"
          autoCapitalize="none"
          value={address}
          onChangeText={setAddress}
        />
      )}
      <Message text={message} />
      <Btn label="إعادة إرسال رابط التأكيد" disabled={busy} onPress={resend} />
    </View>
  );
}
