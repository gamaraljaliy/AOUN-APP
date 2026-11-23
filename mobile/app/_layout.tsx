import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  BalooBhaijaan2_700Bold,
  BalooBhaijaan2_800ExtraBold,
} from "@expo-google-fonts/baloo-bhaijaan-2";
import { IBMPlexSansArabic_400Regular } from "@expo-google-fonts/ibm-plex-sans-arabic";
import { DemoProvider } from "../ui/demo";
export default function Layout() {
  const [loaded, error] = useFonts({
    BalooBold: BalooBhaijaan2_700Bold,
    BalooExtra: BalooBhaijaan2_800ExtraBold,
    Plex: IBMPlexSansArabic_400Regular,
  });
  if (!loaded && !error) return null;
  return (
    <DemoProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "white" },
        }}
      />
    </DemoProvider>
  );
}
