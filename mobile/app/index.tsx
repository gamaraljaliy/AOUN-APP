import { WelcomeMotion } from "../ui/WelcomeMotion";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onboardingKey } from "../ui/guide";
import { useEffect } from "react";
import { View, useWindowDimensions } from "react-native";
import { Logo, T, replace } from "../ui/components";
export default function Splash() {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width * 0.74, height * 0.36);
  useEffect(() => {
    let active = true;
    const seen = AsyncStorage.getItem(onboardingKey).catch(() => null);
    const id = setTimeout(async () => {
      const completed = await seen;
      if (active) replace(completed === "1" ? "/welcome" : "/onboarding");
    }, 1500);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, []);
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "white",
      }}
    >
      <WelcomeMotion style={{ alignItems: "center" }}>
        <Logo size={size} />
        <T
          size={size * 0.36}
          bold
          style={{ fontFamily: "BalooExtra", lineHeight: size * 0.5 }}
        >
          عون
        </T>
      </WelcomeMotion>
    </View>
  );
}
