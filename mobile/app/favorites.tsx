import { ActivityIndicator } from "react-native";
import { useFavorites } from "../favorites/context";
import { Btn, Message, Shell, T, Title, go, useCopy } from "../ui/components";
import { LivePlaceCard } from "../ui/places";

export default function Favorites() {
  const favorites = useFavorites();
  const tr = useCopy();
  let content;
  if (favorites.loading) {
    content = <ActivityIndicator accessibilityLabel={tr("جارٍ تحميل المفضلة")} />;
  } else if (!favorites.signedIn) {
    content = (
      <Btn label="تسجيل الدخول لحفظ الأماكن" onPress={() => go("/login")} />
    );
  } else if (favorites.authError) {
    content = <Message text={favorites.authError} />;
  } else if (!favorites.member) {
    content = <T>المفضلة متاحة للأعضاء النشطين.</T>;
  } else if (favorites.loadError) {
    content = (
      <>
        <Message text="تعذّر تحميل المفضلة." />
        <Btn label="إعادة المحاولة" onPress={favorites.retry} />
      </>
    );
  } else if (favorites.places.length === 0) {
    content = <T>قائمة المفضلة فارغة.</T>;
  } else {
    content = favorites.places.map((place) => (
      <LivePlaceCard key={place.id} place={place} />
    ));
  }

  return (
    <Shell title="المفضلة" nav>
      <Title>الأماكن المحفوظة</Title>
      {content}
    </Shell>
  );
}
