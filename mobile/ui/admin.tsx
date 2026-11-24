import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../auth/context";
import { errorText } from "../services/supabase";
import { Btn, Message } from "./components";

export function useAdminData<T>(load: () => Promise<T>) {
  const auth = useAuth();
  const [data, setData] = useState<T | null>(null),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const generation = useRef(0),
    locked = useRef(false);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    if (!auth.admin) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const next = await load();
      if (version === generation.current) setData(next);
    } catch (e) {
      if (version === generation.current) {
        setData(null);
        setError(errorText(e));
      }
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [auth.admin, auth.session?.user.id, load]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        generation.current++;
      };
    }, [refresh]),
  );
  async function mutate(action: () => Promise<unknown>): Promise<boolean> {
    if (locked.current || !auth.admin) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return {
    data: auth.admin ? data : null,
    loading,
    error,
    busy,
    refresh,
    mutate,
  };
}
export function AdminFeedback({
  state,
}: {
  state: { loading: boolean; error: string; refresh: () => Promise<void> };
}) {
  return (
    <>
      <Message text={state.loading ? "جارٍ التحميل…" : state.error} />
      {state.error ? (
        <Btn label="إعادة المحاولة" onPress={() => void state.refresh()} />
      ) : null}
    </>
  );
}
