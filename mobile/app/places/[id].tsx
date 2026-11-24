import { useLocalSearchParams } from "expo-router";
import { facilityNames, level, useDemo } from "../../ui/demo";
import { Shell, T } from "../../ui/components";
import { PlaceDetails } from "../../ui/PlaceDetails";
import { levelLabels } from "../../ui/places";
export default function Details() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = useDemo();
  const p = d.places.find((item) => item.id === Number(id));
  if (!p)
    return (
      <Shell title="تفاصيل المكان">
        <T>المكان غير موجود.</T>
      </Shell>
    );
  return (
    <PlaceDetails
      live={false}
      localPhoto={p.photo}
      place={{
        id: p.id,
        name_ar: p.name,
        name_en: p.name,
        category_ar: p.category,
        category_en: p.category,
        address: p.address,
        latitude: p.lat,
        longitude: p.lon,
        photo_path: null,
        description_ar: null,
        description_en: null,
        reviews: [],
        average_rating: null,
        level:
          Object.keys(levelLabels).find(
            (key) => levelLabels[key] === level(p),
          ) ?? null,
        facilities: p.facilities.map((status, i) => ({
          id: i + 1,
          name_ar: facilityNames[i],
          name_en: facilityNames[i],
          status: status === "unknown" ? null : status,
        })),
      }}
    />
  );
}
