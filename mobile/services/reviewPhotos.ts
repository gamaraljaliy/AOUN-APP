import type { Session } from "@supabase/supabase-js";
import { File as NativeFile } from "expo-file-system";
import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";
import { db } from "./supabase";

export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const bucket = "review-photos";
const api = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
const keyPattern = /^[1-9][0-9]{0,18}\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/;

export type SelectedPhoto = { uri: string; bytes: ArrayBuffer };
export type PreparedPhoto = { key: string; proof: string; mime: string; bytes: ArrayBuffer };

export function isManagedPhoto(path: string, ratingId?: number) {
  return keyPattern.test(path) && (ratingId === undefined || path.startsWith(ratingId + "/"));
}

export function reviewPhotoUri(ratingId: number, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  if (api && isManagedPhoto(path, ratingId))
    return api + "/review-photos/" + ratingId + "?key=" + encodeURIComponent(path);
  return undefined;
}

export function imageMime(bytes: ArrayBuffer) {
  if (!bytes.byteLength || bytes.byteLength > MAX_PHOTO_BYTES) return undefined;
  const prefix = new Uint8Array(bytes, 0, Math.min(8, bytes.byteLength));
  if ([0xff, 0xd8, 0xff].every((byte, i) => prefix[i] === byte)) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => prefix[i] === byte)) return "image/png";
  return undefined;
}

export async function readSelectedPhoto(asset: ImagePickerAsset): Promise<SelectedPhoto> {
  const file = Platform.OS === "web" ? asset.file : new NativeFile(asset.uri);
  if (!file || file.size > MAX_PHOTO_BYTES || (asset.fileSize ?? 0) > MAX_PHOTO_BYTES)
    throw new Error("Review photo exceeds the limit or cannot be read");
  const bytes = await file.arrayBuffer();
  if (!imageMime(bytes)) throw new Error("Unsupported review photo");
  return { uri: asset.uri, bytes };
}

function authorization(session: Session) {
  return "Bearer " + session.access_token;
}

function storage(session: Session) {
  return db().storage.from(bucket).setHeader("Authorization", authorization(session));
}

export async function prepareReviewPhoto(
  session: Session, ratingId: number, photo: SelectedPhoto, signal: AbortSignal,
): Promise<PreparedPhoto | null> {
  if (!api || !imageMime(photo.bytes)) throw new Error("Review photo preparation unavailable");
  const response = await fetch(api + "/review-photos/" + ratingId + "/prepare", {
    method: "POST",
    headers: { Authorization: authorization(session), "Content-Type": "application/octet-stream" },
    body: photo.bytes,
    signal,
  });
  if (response.status === 413 || response.status === 422) return null;
  if (!response.ok) throw new Error("Review photo validation failed");
  const key = response.headers.get("X-Review-Photo-Key");
  const proof = response.headers.get("X-Review-Photo-Proof");
  const mime = response.headers.get("Content-Type");
  const bytes = await response.arrayBuffer();
  if (!key || !isManagedPhoto(key, ratingId) || !proof || !/^[0-9a-f]{64}$/.test(proof) ||
      !mime || !["image/jpeg", "image/png"].includes(mime) || imageMime(bytes) !== mime ||
      mime !== (key.endsWith(".jpg") ? "image/jpeg" : "image/png"))
    throw new Error("Invalid prepared review photo");
  return { key, proof, mime, bytes };
}

export async function uploadReviewPhoto(session: Session, photo: PreparedPhoto) {
  const objects = storage(session);
  try {
    const { data, error } = await objects.upload(photo.key, photo.bytes, {
      contentType: photo.mime, upsert: false, cacheControl: "0",
      metadata: { aoun_proof: photo.proof },
    });
    if (!error && data?.path === photo.key) return;
  } catch {
    // A thrown transport error can also leave a committed object.
  }
  // A lost response or duplicate-key retry can mean the immutable upload already exists.
  const existing = await objects.info(photo.key);
  const info = existing.data;
  if (info?.name === photo.key && info.bucketId === bucket &&
      info.metadata?.aounProof === photo.proof && info.size === photo.bytes.byteLength &&
      info.contentType === photo.mime && !info.isDeleteMarker) return;
  throw new Error("Review photo upload could not be confirmed");
}

export async function verifyUploadedReviewPhoto(
  session: Session, ratingId: number, key: string, signal: AbortSignal,
) {
  if (!api || !isManagedPhoto(key, ratingId)) throw new Error("Review photo verification unavailable");
  const response = await fetch(
    api + "/review-photos/" + ratingId + "/verify?key=" + encodeURIComponent(key),
    { method: "POST", headers: { Authorization: authorization(session) }, signal },
  );
  if (response.status === 413 || response.status === 422) return false;
  if (response.status !== 204) throw new Error("Review photo verification was not confirmed");
  return true;
}

function arrayLiteral(paths: string[]) {
  return "{" + paths.map((path) => '"' + path.replace(/["\\]/g, "\\$&") + '"').join(",") + "}";
}

export async function attachReviewPhotos(
  session: Session, ratingId: number, previous: string[], next: string[], signal: AbortSignal,
) {
  const { data, error } = await db().from("ratings")
    .update({ photo_paths: next })
    .eq("id", ratingId)
    .eq("user_id", session.user.id)
    .eq("photo_paths", arrayLiteral(previous))
    .select("id,photo_paths")
    .abortSignal(signal)
    .maybeSingle()
    .setHeader("Authorization", authorization(session))
    .retry(false);
  if (error || data?.id !== ratingId || JSON.stringify(data.photo_paths) !== JSON.stringify(next))
    throw new Error("Review photo attachment could not be confirmed");
}

export async function retireAndRemoveReviewPhoto(
  session: Session, ratingId: number, key: string, signal: AbortSignal,
) {
  if (!isManagedPhoto(key, ratingId) || signal.aborted) return;
  const retirement = await db().rpc("retire_review_photo", { target_key: key })
    .abortSignal(signal)
    .setHeader("Authorization", authorization(session));
  if (retirement.error || signal.aborted) throw new Error("Review photo retirement failed");
  const objects = storage(session);
  const removed = await objects.remove([key]);
  if (!removed.error && removed.data.some((entry) => entry.name === key)) return;
  // Storage may hide inaccessible keys as missing. Only a returned deletion confirms cleanup.
  throw new Error("Review photo removal could not be confirmed");
}
