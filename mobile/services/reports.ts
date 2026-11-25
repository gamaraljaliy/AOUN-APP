import type { Session } from "@supabase/supabase-js";
import { db } from "./supabase";

export const reportIssues = [
  { value: "incorrect", label: "معلومة خاطئة" },
  { value: "missing", label: "معلومة ناقصة" },
  { value: "outdated", label: "معلومة قديمة" },
] as const;

export type IssueType = (typeof reportIssues)[number]["value"];

export function isReportIssue(value: string): value is IssueType {
  return reportIssues.some((issue) => issue.value === value);
}

export function validReportPlace(id: number) {
  return Number.isInteger(id) && id > 0 && id <= 2147483647;
}

export type ReportPlace = { id: number; name_ar: string; name_en: string };

export async function getReportPlace(
  id: number,
  legacyName: string | undefined,
  signal: AbortSignal,
): Promise<ReportPlace | null> {
  if (!validReportPlace(id)) return null;
  const catalog = () => db().from("places").select("id,name_ar,name_en");
  if (legacyName === undefined) {
    const { data, error } = await catalog().eq("id", id).abortSignal(signal).maybeSingle();
    if (error) throw error;
    return data;
  }
  if (!legacyName) return null;

  // Search both exact names across the catalog. Demo IDs are not catalog IDs.
  const [arabic, english] = await Promise.all([
    catalog().eq("name_ar", legacyName).limit(2).abortSignal(signal),
    catalog().eq("name_en", legacyName).limit(2).abortSignal(signal),
  ]);
  if (arabic.error) throw arabic.error;
  if (english.error) throw english.error;
  const matches = new Map<number, ReportPlace>();
  for (const place of [...arabic.data, ...english.data]) matches.set(place.id, place);
  return matches.size === 1 ? (matches.values().next().value ?? null) : null;
}

export type ReportDraft = { issue: IssueType; description: string };

export async function latestReportId(session: Session, placeId: number) {
  const { data, error } = await db()
    .from("reports")
    .select("id")
    .eq("user_id", session.user.id)
    .eq("place_id", placeId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle()
    .setHeader("Authorization", "Bearer " + session.access_token);
  if (error) throw error;
  const id = data?.id ?? 0;
  if (!Number.isSafeInteger(id) || id < 0) throw new Error("Invalid report ID");
  return id;
}

export async function findSubmittedReport(
  session: Session,
  placeId: number,
  previousId: number,
  draft: ReportDraft,
) {
  const limit = 51;
  const { data, error } = await db()
    .from("reports")
    .select("id,description")
    .eq("user_id", session.user.id)
    .eq("place_id", placeId)
    .eq("issue_type", draft.issue)
    .gt("id", previousId)
    .order("id")
    .limit(limit)
    .setHeader("Authorization", "Bearer " + session.access_token);
  if (error) throw error;
  return data.length < limit &&
    data.filter(({ description }) => description === draft.description).length === 1;
}

export type ReportResult = "submitted" | "rejected" | "uncertain";

const rejectedInsertCodes = new Set([
  "42501", // RLS or database privileges
  "23502", "23503", "23514", // Required fields, foreign key, and check constraints
  "PGRST301", "PGRST303", // Invalid or expired JWT
]);

export async function submitReport(
  session: Session,
  placeId: number,
  issue: IssueType,
  description: string,
  signal?: AbortSignal,
): Promise<ReportResult> {
  const text = description.trim();
  if (!session?.user.id || !session.access_token ||
      !validReportPlace(placeId) || !isReportIssue(issue) || !text || signal?.aborted)
    return "rejected";

  const insert = db()
    .from("reports")
    .insert({ place_id: placeId, issue_type: issue, description: text })
    .select("id,status");
  if (signal) insert.abortSignal(signal);
  const { data, error, status } = await insert
    .single()
    .setHeader("Authorization", "Bearer " + session.access_token)
    .retry(false);

  if (error) {
    // Retry only when Supabase explicitly rejected the insert.
    return status >= 400 && status < 500 && rejectedInsertCodes.has(error.code)
      ? "rejected"
      : "uncertain";
  }
  return data?.id > 0 && data.status === "submitted" ? "submitted" : "uncertain";
}
