import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
import { Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: Platform.OS === "web" ? undefined : AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
          lock: processLock,
        },
      })
    : null;
export function db() {
  if (!supabase) throw new Error("إعداد اتصال Supabase غير مكتمل.");
  return supabase;
}
export type Profile = {
  id: string;
  display_name: string;
  preferred_language: "ar" | "en";
  role: "member" | "admin";
  status: "active" | "suspended";
};
export async function readProfile(id: string): Promise<Profile> {
  const { data, error } = await db()
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}
export function errorText(error: unknown) {
  if (
    error instanceof Error &&
    error.message === "إعداد اتصال Supabase غير مكتمل."
  )
    return error.message;
  return "تعذّر إكمال العملية. تحققي من الاتصال والبيانات وصلاحية حسابك ثم حاولي مجددًا.";
}
