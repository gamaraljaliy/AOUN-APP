import type { Session } from "@supabase/supabase-js";
import { db } from "./supabase";

export type OwnRating = {
  id: number;
  score: number;
  review_text: string | null;
  photo_paths?: string[];
};

export class ReviewConflict extends Error {
  constructor(readonly reason: "duplicate" | "unconfirmed") {
    super(reason);
  }
}

function authorization(session: Session) {
  return "Bearer " + session.access_token;
}

export async function getOwnRating(
  session: Session,
  placeId: number,
  signal: AbortSignal,
): Promise<OwnRating | null> {
  const { data, error } = await db()
    .from("ratings")
    .select("id,score,review_text,photo_paths")
    .eq("user_id", session.user.id)
    .eq("place_id", placeId)
    .abortSignal(signal)
    .maybeSingle()
    .setHeader("Authorization", authorization(session));
  if (error) throw error;
  return data;
}

export function validReviewScore(score: number) {
  return Number.isInteger(score) && score >= 1 && score <= 5;
}

export async function saveRating(
  session: Session,
  placeId: number,
  ratingId: number | undefined,
  score: number,
  text: string,
  signal: AbortSignal,
) {
  if (!validReviewScore(score)) throw new RangeError("Invalid rating score");

  const changes = { score, review_text: text.trim() || null };
  const table = db().from("ratings");
  const query = ratingId === undefined
    ? table.insert({ place_id: placeId, ...changes })
    : table.update(changes)
        .eq("user_id", session.user.id)
        .eq("place_id", placeId)
        .eq("id", ratingId);
  const { data, error } = await query
    .select("id")
    .abortSignal(signal)
    .maybeSingle()
    .setHeader("Authorization", authorization(session));
  if (ratingId === undefined && error?.code === "23505")
    throw new ReviewConflict("duplicate");
  if (error) throw error;
  if (!data || (ratingId !== undefined && data.id !== ratingId))
    throw new ReviewConflict("unconfirmed");
  return data.id as number;
}

export async function deleteRating(
  session: Session,
  placeId: number,
  ratingId: number,
  signal: AbortSignal,
) {
  const { data, error } = await db()
    .from("ratings")
    .delete()
    .eq("user_id", session.user.id)
    .eq("place_id", placeId)
    .eq("id", ratingId)
    .select("id,photo_paths")
    .abortSignal(signal)
    .maybeSingle()
    .setHeader("Authorization", authorization(session));
  if (error) throw error;
  if (data?.id !== ratingId) throw new ReviewConflict("unconfirmed");
  return data.photo_paths as string[] | undefined;
}
