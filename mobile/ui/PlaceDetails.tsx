import { useRef, useState } from "react";
import { ActivityIndicator, Linking, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { remove } from "../services/admin";
import { errorText } from "../services/supabase";
import type { Detail } from "../services/places";
import { reviewPhotoUri } from "../services/reviewPhotos";
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
import { useOwnRating } from "./useOwnRating";

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
  const ownRating = useOwnRating(live ? place.id : undefined);
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
  const sessionReviews = live
    ? []
    : d.reviews.filter((r) => !r.live && r.placeId === place.id);
  const mine = ownRating.result?.status === "ready" && ownRating.result.rating;
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
      photos: r.photo_paths.flatMap((path) => reviewPhotoUri(r.id, path) ?? []),
    })),
  ];
  const avg = !live && reviews.length
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
      {live && <LiveFavoriteButton place={place} />}
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
      {live && (
        ownRating.loading ? (
          <ActivityIndicator />
        ) : ownRating.result?.status === "error" ? (
          <>
            <Message text="تعذّر تحميل تقييمك." />
            <Btn label="إعادة المحاولة" kind="soft" onPress={ownRating.retry} />
          </>
        ) : ownRating.signedIn && !ownRating.session ? (
          <Message text={ownRating.authError || "التقييم متاح للأعضاء النشطين."} />
        ) : (
          <Btn
            icon="edit"
            label={mine ? "تعديل التقييم" : "إضافة تجربة وصول"}
            onPress={() => go(ownRating.session
              ? placeFormPath(place.id, mine ? "edit-rating" : "rating", true, name)
              : "/login")}
          />
        )
      )}
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
              cachePolicy="none"
              style={{ height: 120, borderRadius: 12 }}
              contentFit="cover"
            />
          ))}
        </Card>
      ))}
    </Shell>
  );
}
