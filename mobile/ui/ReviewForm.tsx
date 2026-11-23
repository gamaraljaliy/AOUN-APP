import { useState } from "react";
import { View, Pressable } from "react-native";
import { Image } from "expo-image";
import * as Picker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useDemo } from "./demo";
import {
  Btn,
  C,
  Card,
  Field,
  Icon,
  Link,
  Message,
  S,
  Shell,
  T,
  Title,
  go,
  replace,
  Round,
} from "./components";
export function ReviewForm({ edit = false }: { edit?: boolean }) {
  const d = useDemo(),
    { id } = useLocalSearchParams<{ id: string }>();
  const place = d.places.find((p) => p.id === Number(id));
  const previous = d.reviews.find(
    (r) => r.author === d.email && r.placeId === Number(id),
  );
  const [score, setScore] = useState(previous?.score ?? 0),
    [text, setText] = useState(previous?.text ?? ""),
    [photos, setPhotos] = useState(previous?.photos ?? []),
    [msg, setMsg] = useState("");
  async function photo(camera: boolean) {
    try {
      if (camera && !(await Picker.requestCameraPermissionsAsync()).granted) {
        setMsg("يتطلب التصوير إذن الكاميرا.");
        return;
      }
      const action = camera
        ? Picker.launchCameraAsync
        : Picker.launchImageLibraryAsync;
      const result = await action({ mediaTypes: ["images"], quality: 0.65 });
      if (!result.canceled)
        setPhotos((v) => Array.from(new Set([...v, result.assets[0].uri])));
    } catch {
      setMsg("تعذّر فتح الصور على هذا الجهاز.");
    }
  }
  function save() {
    if (!score) {
      setMsg("اختاري تقييمًا من ١ إلى ٥.");
      return;
    }
    if (!d.user || !place) return;
    const r = {
      id: previous?.id ?? Date.now(),
      author: d.user.email,
      name: d.user.name,
      placeId: place.id,
      score,
      text: text.trim(),
      photos,
    };
    d.setReviews((v) => [
      ...v.filter((x) => !(x.placeId === r.placeId && x.author === r.author)),
      r,
    ]);
    replace("/places/" + place.id);
  }
  return (
    <Shell
      title={edit ? "تعديل التقييم" : "إضافة تجربة وصول"}
      action={
        edit && previous ? (
          <Round
            icon="trash"
            label="حذف التقييم"
            onPress={() => go("/places/" + id + "/delete-rating")}
          />
        ) : undefined
      }
    >
      {!d.user || !place ? (
        <Btn label="تسجيل الدخول" onPress={() => go("/login")} />
      ) : (
        <>
          <Card>
            <Title>التقييم العام لسهولة الوصول</Title>
            <T size={14}>{place.name}</T>
            <View
              style={[
                S.row,
                {
                  justifyContent: "space-around",
                  padding: 9,
                  backgroundColor: C.soft,
                  borderRadius: 20,
                },
              ]}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={n + " من 5"}
                  accessibilityState={{ selected: score === n }}
                  onPress={() => setScore(n)}
                >
                  <T size={30}>{n <= score ? "★" : "☆"}</T>
                </Pressable>
              ))}
            </View>
          </Card>
          <Card>
            <Field
              label="تفاصيل التجربة وملاحظات الزيارة"
              multiline
              maxLength={300}
              value={text}
              onChangeText={setText}
              placeholder="كيف كانت تجربتك؟"
            />
            <T size={12}>{text.length + " / 300"}</T>
          </Card>
          <Card>
            <Title>توثيق بالصور للتسهيلات والمداخل</Title>
            <View style={S.row}>
              <View style={{ flex: 1 }}>
                <Btn
                  kind="soft"
                  label="التقاط بالكاميرا"
                  icon="camera"
                  onPress={() => photo(true)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Btn
                  kind="soft"
                  label="رفع من المعرض"
                  icon="gallery"
                  onPress={() => photo(false)}
                />
              </View>
            </View>
            {photos.map((uri) => (
              <View key={uri}>
                <Image source={{ uri }} style={{ height: 120 }} />
                <Link
                  label="إزالة الصورة"
                  onPress={() => setPhotos((p) => p.filter((x) => x !== uri))}
                />
              </View>
            ))}
          </Card>
          <Message text={msg} />
          <Btn label={edit ? "حفظ التعديلات" : "نشر التقييم"} onPress={save} />
        </>
      )}
    </Shell>
  );
}
