import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useDemo } from "../../../ui/demo";
import {
  Btn,
  Card,
  Chip,
  Field,
  FieldError,
  S,
  Shell,
  T,
  Title,
  go,
  replace,
} from "../../../ui/components";
export default function Report() {
  const d = useDemo(),
    { id } = useLocalSearchParams<{ id: string }>(),
    p = d.places.find((x) => x.id === Number(id));
  const [kind, setKind] = useState(""),
    [text, setText] = useState(""),
    [attempted, setAttempted] = useState(false),
    [sent, setSent] = useState(false);
  return (
    <Shell title="الإبلاغ عن مشكلة">
      {!d.user || !p ? (
        <Btn label="تسجيل الدخول" onPress={() => go("/login")} />
      ) : sent ? (
        <Card>
          <Title>تم إرسال البلاغ</Title>
          <T>يمكن للمسؤول مراجعة البلاغ.</T>
          <Btn
            label="العودة إلى المكان"
            onPress={() => replace("/places/" + id)}
          />
        </Card>
      ) : (
        <>
          <Card>
            <Title>{p.name}</Title>
            <T>بلّغ عن بيانات إتاحة غير صحيحة</T>
          </Card>
          <Card>
            <Title>ما نوع المشكلة؟</Title>
            <View style={S.wrap}>
              {["معلومة خاطئة", "معلومة ناقصة", "معلومة قديمة"].map((x) => (
                <Chip
                  key={x}
                  label={x}
                  active={kind === x}
                  onPress={() => setKind(x)}
                />
              ))}
            </View>
            <FieldError
              text={attempted && !kind ? "اختر نوع المشكلة." : undefined}
            />
          </Card>
          <Card>
            <Field
              error={
                attempted && !text.trim() ? "أدخل وصف المشكلة." : undefined
              }
              label="وصف المشكلة"
              multiline
              value={text}
              onChangeText={setText}
              placeholder="اشرح المعلومة غير الدقيقة أو الناقصة."
            />
          </Card>
          <Btn
            label="إرسال البلاغ"
            onPress={() => {
              if (!kind || !text.trim()) {
                setAttempted(true);
                return;
              }
              d.setReports((r) => [
                ...r,
                {
                  id: Date.now(),
                  placeId: p.id,
                  kind,
                  text: text.trim(),
                  status: "تم الإرسال",
                },
              ]);
              setSent(true);
            }}
          />
        </>
      )}
    </Shell>
  );
}
