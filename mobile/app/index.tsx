import { useEffect } from "react";
import { View, useWindowDimensions } from "react-native";
import { Logo, T, replace } from "../ui/components";
export default function Splash() {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width * 0.74, height * 0.36);
  useEffect(() => {
    const id = setTimeout(() => replace("/welcome"), 1500);
    return () => clearTimeout(id);
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
      <Logo size={size} />
      <T
        size={size * 0.36}
        bold
        style={{ fontFamily: "BalooExtra", lineHeight: size * 0.5 }}
      >
        عون
      </T>
    </View>
  );
}
