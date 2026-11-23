import { Stack } from "expo-router";
export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "عون" }} />
      <Stack.Screen
        name="places/[id]"
        options={{ title: "تفاصيل المكان", headerBackTitle: "البحث" }}
      />
    </Stack>
  );
}
