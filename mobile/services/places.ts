export type Place = {
  id: number;
  name_ar: string;
  category_ar: string;
  level: string | null;
};
export type Detail = Place & {
  facilities: { id: number; name_ar: string; status: string | null }[];
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
