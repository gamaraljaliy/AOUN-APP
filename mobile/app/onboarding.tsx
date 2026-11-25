import { WelcomeMotion } from "../ui/WelcomeMotion";
import { useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Btn, C, Icon, Shell, T, replace } from "../ui/components";
import { useDemo } from "../ui/demo";
import { guideSteps, onboardingKey } from "../ui/guide";

export default function Onboarding() {
  const [index, setIndex] = useState(0);
  const finishing = useRef(false);
  const { lang } = useDemo();
  const { width, height } = useWindowDimensions();
  const size = Math.min(170, width * 0.36, height * 0.23);
  const step = guideSteps[index];
  async function finish() {
    if (finishing.current) return;
    finishing.current = true;
    try {
      await AsyncStorage.setItem(onboardingKey, "1");
    } catch {
      // Storage may be unavailable in private browsing. Still allow entry.
    }
    replace("/welcome");
  }
  return (
    <Shell>
      <View style={{ alignSelf: lang === "ar" ? "flex-start" : "flex-end" }}>
        <Btn label="تخطي" kind="soft" onPress={finish} />
      </View>
      <WelcomeMotion
        key={step.title}
        horizontalOffset={lang === "ar" ? -24 : 24}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          paddingVertical: 16,
        }}
      >
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: C.pale,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={step.icon} size={size * 0.46} />
        </View>
        <View
          accessibilityLiveRegion="polite"
          style={{ gap: 10, maxWidth: 420 }}
        >
          <T center bold size={28}>
            {step.title}
          </T>
          <T center color={C.muted}>
            {step.body}
          </T>
        </View>
      </WelcomeMotion>
      <View
        accessible
        accessibilityLabel={
          lang === "ar"
            ? `الخطوة ${index + 1} من ${guideSteps.length}`
            : `Step ${index + 1} of ${guideSteps.length}`
        }
        style={{
          flexDirection: lang === "ar" ? "row-reverse" : "row",
          justifyContent: "center",
          gap: 6,
        }}
      >
        {guideSteps.map((item, i) => (
          <View
            key={item.icon}
            style={{
              width: i === index ? 22 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === index ? C.navy : C.line,
            }}
          />
        ))}
      </View>
      {index === guideSteps.length - 1 ? (
        <Btn label="ابدأ استخدام عون" onPress={finish} />
      ) : (
        <Btn
          label="التالي"
          onPress={() =>
            setIndex((i) => Math.min(i + 1, guideSteps.length - 1))
          }
        />
      )}
    </Shell>
  );
}
