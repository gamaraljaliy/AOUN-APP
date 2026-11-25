import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, Pressable } from "react-native";
import { useAuth } from "../auth/context";
import { db, errorText } from "../services/supabase";
import { Btn, Card, Message, Shell, T, go } from "./components";
import { useDemo } from "./demo";
import { placeFormPath } from "./placeTarget";

type Kind = "reports" | "ratings";
type Row = {
  id: number;
  place_id: number;
  places: { name_ar: string; name_en: string } | null;
  score?: number;
  review_text?: string;
  description?: string;
  status?: string;
  admin_response?: string;
};
const statuses: Record<string, string> = {
  submitted: "تم الإرسال", under_review: "قيد المراجعة", resolved: "تم الحل", rejected: "مرفوض",
};

export function MemberActivity({kind}: {kind: Kind}) {
  const {profile, loading} = useAuth();
  const title = kind === "ratings" ? "تقييماتي" : "بلاغاتي";
  return (
    <Shell title={title}>
      {loading ? <ActivityIndicator /> : profile?.role === "member" && profile.status === "active"
        ? <ActivityList key={profile.id} userId={profile.id} kind={kind} />
        : <Btn label="تسجيل الدخول" onPress={() => go("/login")} />}
    </Shell>
  );
}

function ActivityList({kind, userId}: {kind: Kind; userId: string}) {
  const {lang} = useDemo();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    async function load() {
      setError("");
      setRows(null);
      const fields = kind === "ratings" ? "score,review_text" : "description,status,admin_response";
      const result: Row[] = [];
      for (let offset = 0; ; offset += 100) {
        const {data, error} = await db().from(kind)
          .select("id,place_id,places(name_ar,name_en)," + fields)
          .eq("user_id", userId).order("id", {ascending: false})
          .range(offset, offset + 99).abortSignal(controller.signal).returns<Row[]>();
        if (controller.signal.aborted) return;
        if (error) throw error;
        result.push(...data);
        if (data.length < 100) break;
      }
      setRows(result);
    }
    load().catch(e => { if (!controller.signal.aborted) setError(errorText(e)); });
    return () => controller.abort();
  }, [kind, userId, attempt]));
  if (error) return <><Message text={error} /><Btn label="إعادة المحاولة" onPress={() => setAttempt(v => v + 1)} /></>;
  if (!rows) return <ActivityIndicator />;
  if (!rows.length) return <T>{kind === "ratings" ? "ما عندك تقييمات حتى الآن." : "ما عندك بلاغات حتى الآن."}</T>;
  return rows.map(row => {
    const name = (lang === "ar" ? row.places?.name_ar : row.places?.name_en) || String(row.place_id);
    if (kind === "ratings") return (
      <Pressable key={row.id} accessibilityRole="button"
        onPress={() => go(placeFormPath(row.place_id, "edit-rating", true, name) + "&from=activity")}>
        <Card><T bold>{name}</T><T>{"★".repeat(row.score ?? 0)}</T>
          {!!row.review_text && <T>{row.review_text}</T>}
        </Card>
      </Pressable>
    );
    return <Card key={row.id}><T bold>{name}</T><T>{row.description}</T>
      <T bold>{statuses[row.status ?? ""]}</T>
      {!!row.admin_response && <><T bold>{row.status === "rejected" ? "سبب الرفض" : "حل البلاغ"}</T><T>{row.admin_response}</T></>}
    </Card>;
  });
}
