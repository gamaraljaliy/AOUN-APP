import { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { facilityNames, level, statusNames, useDemo } from "../../ui/demo";
import {
  Btn,
  C,
  Card,
  Icon,
  Message,
  S,
  Shell,
  T,
  Title,
  go,
} from "../../ui/components";
import { openMap } from "../../ui/location";
export default function Details() {
  const d = useDemo(),
    { id } = useLocalSearchParams<{ id: string }>();
  const p = d.places.find((x) => x.id === Number(id));
  const [msg, setMsg] = useState("");
  if (!p)
    return (
      <Shell title="تفاصيل المكان">
        <T>المكان غير موجود.</T>
      </Shell>
    );
  const reviews = d.reviews.filter((r) => r.placeId === p.id),
    mine = reviews.find((r) => r.author === d.email);
  const avg = reviews.length
    ? (reviews.reduce((v, r) => v + r.score, 0) / reviews.length).toFixed(1)
    : "—";
  return (
    <Shell title={p.name}>
      {p.photo ? (
        <Image
          source={require("../../assets/images/library.png")}
          style={{ width: "100%", height: 275, borderRadius: 26 }}
          contentFit="cover"
          accessibilityLabel={p.name}
        />
      ) : (
        <Card
          style={{ alignItems: "center", padding: 42, backgroundColor: C.soft }}
        >
          <Icon name="building" size={48} />
          <T bold>{p.category}</T>
        </Card>
      )}
      <View style={S.row}>
        <Icon name="marker" />
        <View style={{ flex: 1 }}>
          <T size={14}>{p.address}</T>
        </View>
        <T bold>{"★ " + avg}</T>
      </View>
      <Title>التفاصيل</Title>
      <Card>
        <T bold size={20}>
          {level(p)}
        </T>
        {p.facilities.map((v, i) => (
          <View
            key={i}
            style={[
              S.row,
              { backgroundColor: C.gray, padding: 10, borderRadius: 18 },
            ]}
          >
            <Icon name={v === "available" ? "check" : "building"} size={18} />
            <View style={{ flex: 1 }}>
              <T bold>{facilityNames[i]}</T>
              <T size={13} color={C.muted}>
                {statusNames[v]}
              </T>
            </View>
          </View>
        ))}
      </Card>
      <Btn
        label="الموقع"
        onPress={() => openMap(p).catch(() => setMsg("تعذّر فتح الخرائط."))}
      />
      <Btn
        label={
          d.email && d.favorites[d.email]?.includes(p.id)
            ? "إزالة من المفضلة"
            : "حفظ في المفضلة"
        }
        kind="soft"
        onPress={() => (d.user ? d.toggleFavorite(p.id) : go("/login"))}
      />
      <Title>تجارب الوصول</Title>
      {reviews.length ? (
        reviews.map((r) => (
          <Card key={r.id}>
            <T bold>{r.name}</T>
            <T>{"★".repeat(r.score)}</T>
            <T>{r.text}</T>
            {r.photos.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={{ height: 120, borderRadius: 12 }}
                contentFit="cover"
              />
            ))}
          </Card>
        ))
      ) : (
        <T>لا توجد مراجعات بعد.</T>
      )}
      <Btn
        label={mine ? "تعديل التقييم" : "إضافة تجربة وصول"}
        onPress={() =>
          go(
            d.user
              ? "/places/" + p.id + "/" + (mine ? "edit-rating" : "rating")
              : "/login",
          )
        }
      />
      <Btn
        label="الإبلاغ عن مشكلة"
        kind="outline"
        onPress={() => go(d.user ? "/places/" + p.id + "/report" : "/login")}
      />
      <Message text={msg} />
    </Shell>
  );
}
