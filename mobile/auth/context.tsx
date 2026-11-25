import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { db, supabase, readProfile, type Profile } from "../services/supabase";

function useAuthState() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const revision = useRef(0);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let alive = true;
    async function apply(next: Session | null) {
      const version = ++revision.current;
      setSession(next);
      setProfile(null);
      setLoading(true);
      setError("");
      try {
        const p = next ? await readProfile(next.user.id) : null;
        if (alive && version === revision.current) setProfile(p);
      } catch {
        if (alive && version === revision.current)
          setError("تعذّر تحميل بيانات الحساب. أعيدي تسجيل الدخول.");
      } finally {
        if (alive && version === revision.current) setLoading(false);
      }
    }
    // Do not await Supabase calls inside the auth callback (auth lock).
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      void apply(next);
    });
    const state = AppState.addEventListener("change", (value) => {
      if (value === "active") {
        supabase!.auth.startAutoRefresh();
        void supabase!.auth
          .getSession()
          .then(({ data }) => apply(data.session));
      } else supabase!.auth.stopAutoRefresh();
    });
    supabase.auth.startAutoRefresh();
    return () => {
      alive = false;
      revision.current++;
      data.subscription.unsubscribe();
      state.remove();
      supabase!.auth.stopAutoRefresh();
    };
  }, []);
  async function signOut() {
    const { error } = await db().auth.signOut({ scope: "local" });
    if (error) throw error;
    setProfile(null);
    setSession(null);
  }
  async function saveProfile(
    changes: Partial<Pick<Profile, "display_name" | "preferred_language">>,
  ) {
    if (!session || changes.display_name === "")
      throw new Error("Invalid profile");
    const version = revision.current;
    const { data, error } = await db()
      .from("profiles")
      .update(changes)
      .eq("id", session.user.id)
      .select("*")
      .single();
    if (error) throw error;
    if (version === revision.current) setProfile(data);
  }
  return {
    session,
    profile,
    loading,
    error,
    signOut,
    saveProfile,
    admin: profile?.role === "admin" && profile.status === "active",
  };
}
const Context = createContext<ReturnType<typeof useAuthState> | null>(null);
export function AuthProvider({ children }: React.PropsWithChildren) {
  const auth = useAuthState();
  return <Context.Provider value={auth}>{children}</Context.Provider>;
}
export function useAuth() {
  const auth = useContext(Context);
  if (!auth) throw new Error("AuthProvider missing");
  return auth;
}
