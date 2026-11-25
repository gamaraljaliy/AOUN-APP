import { db } from "./supabase";
export type Account = {
  id: string;
  display_name: string;
  email: string;
  role: string;
  status: string;
};
export type Category = { id: number; name_ar: string; name_en: string };
export type FacilityState =
  "available" | "unavailable" | "not_applicable" | null;
export type AdminPlace = {
  id: number;
  name_ar: string;
  name_en: string;
  category_id: number;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  place_facilities: { facility_id: number; status: FacilityState }[];
};
export type AdminReport = {
  id: number;
  place_id: number;
  issue_type: string;
  description: string;
  status: string;
  status_updated_at: string;
  admin_response: string | null;
  places: { name_ar: string; name_en: string } | null;
};
export type AdminReview = {
  id: number;
  place_id: number;
  user_id: string;
  score: number;
  review_text: string | null;
  profiles: { display_name: string } | null;
  places: { name_ar: string; name_en: string } | null;
};
export async function accounts(): Promise<Account[]> {
  const rows: Account[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await db()
      .rpc("admin_accounts")
      .order("id")
      .range(start, start + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export async function list<T>(table: string, columns = "*"): Promise<T[]> {
  // Fetch every page; PostgREST defaults to a maximum of 1,000 rows per request.
  const rows: T[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await db()
      .from(table)
      .select(columns)
      .order("id")
      .range(start, start + 499);
    if (error) throw error;
    rows.push(...(data as T[]));
    if (data.length < 500) return rows;
  }
}
export async function setAccountStatus(id: string, status: string) {
  const { error } = await db().rpc("set_account_status", {
    target_user: id,
    new_status: status,
  });
  if (error) throw error;
}
export async function setReportStatus(
  id: number,
  previous: string,
  status: string,
  response: string | null = null,
) {
  const { error } = await db()
    .from("reports")
    .update({ status, admin_response: response })
    .eq("id", id)
    .eq("status", previous)
    .select("id")
    .single();
  if (error) throw error;
}
export async function remove(table: "places" | "ratings", id: number) {
  const { error } = await db()
    .from(table)
    .delete()
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
}
export async function savePlace(
  id: number | null,
  place: Omit<AdminPlace, "id" | "place_facilities">,
  facilities: FacilityState[],
) {
  const { error } = await db().rpc("admin_save_place", {
    target_id: id,
    place_data: place,
    facility_states: facilities,
  });
  if (error) throw error;
}
