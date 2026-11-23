import { View } from "react-native";
import { Btn, Logo, Shell, T, go, replace } from "../ui/components";
export default function Welcome() {
  return (
    <Shell>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 22,
          gap: 16,
        }}
      >
        <View style={{ alignItems: "center" }}>
          <Logo size={205} />
        </View>
        <T center bold size={40}>
          أهلًا بك في عون
        </T>
        <T center>
          منصتك الأولى للتعرّف على جاهزية الأماكن العامة ومرافق الوصول الشامل قبل
          وصولك.
        </T>
        <View style={{ gap: 10, marginTop: 28 }}>
          <Btn label="تسجيل الدخول" onPress={() => go("/login")} />
          <Btn
            label="إنشاء حساب جديد"
            kind="outline"
            onPress={() => go("/register")}
          />
          <Btn
            label="المتابعة كزائر"
            kind="soft"
            onPress={() => replace("/home")}
          />
        </View>
      </View>
    </Shell>
  );
}
