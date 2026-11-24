import { Btn, Shell, T, Title, go } from "../ui/components";
import { useDemo } from "../ui/demo";
import { LivePlaceCard, PlaceCard } from "../ui/places";
export default function Favorites() {
  const d = useDemo();
  const rows = d.places.filter(
    (p) => d.email && d.favorites[d.email]?.includes(p.id),
  );
  return (
    <Shell title="المفضلة" nav>
      <Title>الأماكن المحفوظة</Title>
      {!d.user ? (
        <Btn label="تسجيل الدخول لحفظ الأماكن" onPress={() => go("/login")} />
      ) : rows.length || d.liveFavorites.length ? (
        <>
          {d.liveFavorites.map((place) => (
            <LivePlaceCard key={place.id} place={place} />
          ))}
          {rows.map((p) => (
            <PlaceCard key={p.id} p={p} compact favorite />
          ))}
        </>
      ) : (
        <T>قائمة المفضلة فارغة.</T>
      )}
    </Shell>
  );
}
