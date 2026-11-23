import { useState } from "react";
import { View } from "react-native";
import { useDemo } from "../ui/demo";
import {
  Btn,
  C,
  Card,
  Chip,
  Field,
  Icon,
  Message,
  S,
  Shell,
  T,
  go,
  replace,
} from "../ui/components";
export default function Profile() {
  const d = useDemo();
  const [editing, setEdit] = useState(false),
    [name, setName] = useState(d.user?.name ?? "");
  return (
    <Shell nav title="حسابي والإعدادات">
      <Card style={{ alignItems: "center", padding: 23 }}>
        <Icon name="user" size={44} />
        <T size={23} bold>
          {d.user?.name ?? "زائر"}
        </T>
        <T>{d.email ?? ""}</T>
      </Card>
      {d.user ? (
        <Card>
          <Btn
            kind="soft"
            label="تعديل الملف الشخصي"
            onPress={() => setEdit(!editing)}
          />
          {editing && (
            <>
              <Field label="الاسم الكامل" value={name} onChangeText={setName} />
              <Btn
                label="حفظ التعديلات"
                disabled={!name.trim()}
                onPress={() => {
                  d.setAccounts((all) =>
                    all.map((a) =>
                      a.email === d.email ? { ...a, name: name.trim() } : a,
                    ),
                  );
                  d.setReviews((all) =>
                    all.map((r) =>
                      r.author === d.email ? { ...r, name: name.trim() } : r,
                    ),
                  );
                  setEdit(false);
                }}
              />
            </>
          )}
        </Card>
      ) : (
        <Btn label="تسجيل الدخول" onPress={() => go("/login")} />
      )}
      <Card>
        <T bold>لغة التطبيق</T>
        <View style={S.row}>
          <Chip
            label="عربي"
            active={d.lang === "ar"}
            onPress={() => d.setLang("ar")}
          />
          <Chip
            label="English"
            active={d.lang === "en"}
            onPress={() => d.setLang("en")}
          />
        </View>
      </Card>
      {d.user && (
        <>
          <Btn
            kind="outline"
            label="استعادة كلمة المرور"
            onPress={() => go("/reset")}
          />
          <Btn
            kind="soft"
            label="تسجيل الخروج"
            onPress={() => {
              d.setEmail(null);
              replace("/welcome");
            }}
          />
        </>
      )}
    </Shell>
  );
}
