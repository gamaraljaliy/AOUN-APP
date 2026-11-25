import { useRef, useState } from "react";
import { Linking, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { remove } from "../services/admin";
import { errorText } from "../services/supabase";
import type { Detail } from "../services/places";
import {
  Btn,
  C,
  Card,
  Icon,
  Message,
  S,
  Shell,
  Round,
  T,
  Title,
  go,
} from "./components";
import { statusNames, useDemo } from "./demo";
import { levelLabels, LiveFavoriteButton } from "./places";
import { placeFormPath } from "./placeTarget";

export function PlaceDetails({
  place,
  live,
  localPhoto,
}: {
  place: Detail;
  live: boolean;
  localPhoto?: boolean;
}) {
  const d = useDemo();
  const [message, setMessage] = useState("");
  const canManage = live && d.admin;
  const [actions, setActions] = useState<"closed" | "open" | "confirm">("closed");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const deleteLock = useRef(false);
  async function deletePlace() {
    if (!canManage || deleteLock.current) return;
    deleteLock.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      await remove("places", place.id);
      router.dismissTo("/admin/places");
    } catch (error) {
      setDeleteError(errorText(error));
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  }
  const name = d.lang === "ar" ? place.name_ar : place.name_en;
  const category = d.lang === "ar" ? place.category_ar : place.category_en;
  const description =
    d.lang === "ar" ? place.description_ar : place.description_en;
  const sessionReviews = d.reviews.filter(
    (r) => !!r.live === live && r.placeId === place.id,
  );
  const mine = sessionReviews.find((r) => r.author === d.email);
  const reviews = [
    ...sessionReviews.map((r) => ({
      key: "session-" + r.id,
      name: r.name,
      score: r.score,
      text: r.text,
      photos: r.photos,
    })),
    ...place.reviews.map((r) => ({
      key: "api-" + r.id,
      name: r.display_name,
      score: r.score,
      text: r.review_text,
      photos: r.photo_paths.filter((uri) => /^https?:\/\//i.test(uri)),
    })),
  ];
  const avg = reviews.length
    ? reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length
    : place.average_rating;
  const photo = localPhoto
    ? require("../assets/images/library.png")
    : /^https?:\/\//i.test(place.photo_path ?? "")
      ? { uri: place.photo_path! }
      : null;
  function openForm(action: string) {
    go(d.user ? placeFormPath(place.id, action, live, name) : "/login");
  }
  return (
    <Shell title={name} action={canManage ? (
      <Round icon="edit" label="إجراءات المكان" onPress={() => {
        if (deleting) return;
        setDeleteError("");
        setActions(actions === "closed" ? "open" : "closed");
      }} />
    ) : undefined}>
      {canManage && actions !== "closed" && (
        <Card>
          {actions === "open" ? (
            <>
              <Btn label="تعديل" onPress={() => go("/admin/place?id=" + place.id)} />
              <Btn label="حذف" kind="outline" onPress={() => setActions("confirm")} />
            </>
          ) : (
            <>
              <T bold>حذف المكان وبياناته المرتبطة؟</T>
              <Message text={deleteError} />
              <Btn label="تأكيد حذف المكان" kind="danger" disabled={deleting} onPress={deletePlace} />
              <Btn label="إلغاء" kind="soft" disabled={deleting} onPress={() => setActions("closed")} />
            </>
          )}
        </Card>
      )}
      {photo ? (
        <Image
          source={photo}
          style={{ height: 230, width: "100%", borderRadius: 24 }}
          contentFit="cover"
          accessibilityLabel={name}
        />
      ) : (
        <Card
          style={{ alignItems: "center", padding: 26, backgroundColor: C.soft }}
        >
          <Icon name="building" size={44} />
          <T>{category}</T>
        </Card>
      )}
      <View style={S.row}>
        <Icon name="marker" />
        <View style={{ flex: 1 }}>
          <T>{place.address || category}</T>
        </View>
        <T bold>{"★ " + (avg?.toFixed(1) ?? "—")}</T>
      </View>
      {description && <T>{description}</T>}
      {live ? (
        <LiveFavoriteButton place={place} />
      ) : (
        <Btn
          kind="soft"
          icon="heart"
          label={
            d.email && d.favorites[d.email]?.includes(place.id)
              ? "إزالة من المفضلة"
              : "حفظ في المفضلة"
          }
          onPress={() => (d.user ? d.toggleFavorite(place.id) : go("/login"))}
        />
      )}
      <Title>التفاصيل</Title>
      <Card>
        <T bold size={20}>
          {levelLabels[place.level ?? ""] ?? "بانتظار المراجعة"}
        </T>
        {place.facilities.map((f) => (
          <View
            key={f.id}
            style={[
              S.row,
              { backgroundColor: C.gray, borderRadius: 16, padding: 10 },
            ]}
          >
            <Icon name={f.status === "available" ? "check" : "building"} />
            <View style={{ flex: 1 }}>
              <T bold>{d.lang === "ar" ? f.name_ar : f.name_en}</T>
              <T size={14}>{statusNames[f.status ?? "unknown"]}</T>
            </View>
          </View>
        ))}
      </Card>
      {place.latitude != null && place.longitude != null && (
        <Btn
          icon="map"
          label="الموقع"
          onPress={() =>
            Linking.openURL(
              `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`,
            ).catch(() => setMessage("تعذّر فتح الخرائط."))
          }
        />
      )}
      <Message text={message} />
      <Btn
        icon="flag"
        label="الإبلاغ عن مشكلة"
        kind="outline"
        onPress={() => openForm("report")}
      />
      <Title>تجارب الوصول</Title>
      <Btn
        icon="edit"
        label={mine ? "تعديل التقييم" : "إضافة تجربة وصول"}
        onPress={() => openForm(mine ? "edit-rating" : "rating")}
      />
      {!reviews.length && <T>لا توجد مراجعات بعد.</T>}
      {reviews.map((r) => (
        <Card key={r.key}>
          <T bold>{r.name}</T>
          <T>{"★".repeat(r.score)}</T>
          {!!r.text && <T>{r.text}</T>}
          {r.photos.map((uri) => (
            <Image
              key={uri}
              source={{ uri }}
              style={{ height: 120, borderRadius: 12 }}
              contentFit="cover"
            />
          ))}
        </Card>
      ))}
    </Shell>
  );
}
