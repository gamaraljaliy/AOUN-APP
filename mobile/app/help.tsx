import { useState } from "react";
import { Pressable, View } from "react-native";
import { C, Card, Shell, T, Title, back } from "../ui/components";
import { useDemo } from "../ui/demo";
import { questions } from "../ui/guide";

export default function Help() {
  const [open, setOpen] = useState<number | null>(null);
  const { lang } = useDemo();
  return (
    <Shell title="المساعدة" onBack={() => back("/profile")}>
      <Title>الأسئلة الشائعة</Title>
      {questions.map(([question, answer], i) => (
        <Card key={question}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open === i }}
            onPress={() => setOpen(open === i ? null : i)}
            style={{
              flexDirection: lang === "ar" ? "row-reverse" : "row",
              gap: 12,
              minHeight: 44,
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1 }}>
              <T bold>{question}</T>
            </View>
            <T color={C.muted} size={22}>
              {open === i ? "−" : "+"}
            </T>
          </Pressable>
          {open === i && <T>{answer}</T>}
        </Card>
      ))}
    </Shell>
  );
}
