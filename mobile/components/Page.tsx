import { PropsWithChildren } from "react";
import { ScrollView } from "react-native";
import { s } from "../theme/styles";
export function Page({ children }: PropsWithChildren) {
  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.body}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
