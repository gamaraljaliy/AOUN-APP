import { useState } from "react";
import { View } from "react-native";
import { usePlaceTarget } from "../../../ui/placeTarget";
import { useDemo } from "../../../ui/demo";
import {
  Btn,
  C,
  Icon,
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
  const d = useDemo();
  const { place: p, live, details } = usePlaceTarget();
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
          <Btn label="العودة إلى المكان" onPress={() => replace(details)} />
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
          <Card style={{ backgroundColor: C.soft }}>
            <View style={S.row}>
              <Icon name="shield" />
              <T bold>بلاغك يساعد الآخرين</T>
            </View>
            <T size={14}>يراجع فريق عون البلاغ لتحديث معلومات المكان.</T>
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
                  live,
                  placeName: live ? p.name : undefined,
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
