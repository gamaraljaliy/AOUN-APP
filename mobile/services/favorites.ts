import type { Session } from "@supabase/supabase-js";
import type { Place } from "./places";
import { db } from "./supabase";

const pageSize = 100;

export async function listFavorites(session: Session, signal: AbortSignal) {
  const client = db();
  const places: Place[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data: favorites, error } = await client
      .from("favorites")
      .select("place_id")
      .eq("user_id", session.user.id)
      .order("place_id")
      .range(offset, offset + pageSize - 1)
      .setHeader("Authorization", "Bearer " + session.access_token)
      .abortSignal(signal);
    if (error) throw error;
    if (!favorites.length) return places;

    const { data: summaries, error: summaryError } = await client
      .from("place_summary")
      .select("id,name_ar,name_en,category_ar,category_en,level,photo_path")
      .in("id", favorites.map(({ place_id }) => place_id))
      .order("id")
      .abortSignal(signal);
    if (summaryError) throw summaryError;

    for (const place of summaries) {
      const path = place.photo_path?.trim();
      const photo_path =
        path && !/^https?:\/\//i.test(path)
          ? client.storage
              .from("place-photos")
              .getPublicUrl(path.replace(/^\/+/, "").replace(/^place-photos\//, ""))
              .data.publicUrl
          : path || null;
      places.push({ ...place, photo_path });
    }
    if (favorites.length < pageSize) return places;
  }
}

export async function setFavorite(
  session: Session,
  placeId: number,
  saved: boolean,
  signal: AbortSignal,
) {
  const table = db().from("favorites");
  // Pin writes to this account even if Auth switches sessions before fetch.
  const authorization = "Bearer " + session.access_token;
  if (saved) {
    const { error } = await table
      .insert({ place_id: placeId })
      .setHeader("Authorization", authorization)
      .abortSignal(signal);
    if (error && error.code !== "23505") throw error;
    return;
  }

  const { data, error } = await table
    .delete()
    .eq("user_id", session.user.id)
    .eq("place_id", placeId)
    .select("place_id")
    .abortSignal(signal)
    .maybeSingle()
    .setHeader("Authorization", authorization);
  if (error) throw error;
  if (data?.place_id !== placeId)
    throw new Error("Favorite removal was not confirmed");
}
