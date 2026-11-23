export type Place = {
  id: number;
  name_ar: string;
  category_ar: string;
  level: string | null;
};
export type Detail = Place & {
  name_en: string;
  category_en: string;
  address: string | null;
  description_ar: string | null;
  description_en: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_path: string | null;
  average_rating: number | null;

  facilities: {
    id: number;
    name_ar: string;
    name_en: string;
    status: "available" | "unavailable" | "not_applicable" | null;
  }[];

  reviews: {
    id: number;
    place_id: number;
    display_name: string;
    score: number;
    review_text: string | null;
    photo_paths: string[];
    created_at: string;
  }[];
};
const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

export async function getPlacesData<T>(
  path: string,
  signal: AbortSignal,
): Promise<T> {
  if (!base) throw new Error("Missing API URL");
  const response = await fetch(base + path, { signal });
  if (!response.ok) throw new Error("Request failed");
  return response.json();
}
export function searchPlaces(
  query: string,
  facilityIds: number[],
  signal: AbortSignal,
): Promise<Place[]> {
  const params = new URLSearchParams();
  params.set("q", query.trim());

  for (const id of facilityIds) {
    params.append("facility", String(id));
  }

  return getPlacesData<Place[]>(`/places?${params.toString()}`, signal);
}

export function getPlaceDetails(
  placeId: number,
  signal: AbortSignal,
): Promise<Detail> {
  return getPlacesData<Detail>(`/places/${placeId}`, signal);
}