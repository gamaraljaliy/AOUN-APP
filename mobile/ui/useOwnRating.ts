import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/context";
import { getOwnRating, type OwnRating } from "../services/reviews";
import { ratingOwner } from "./reviewDraft";

type Result = {
  ownerId: string;
  placeId: number;
  attempt: number;
} & (
  | { status: "ready"; rating: OwnRating | null; signal: AbortSignal }
  | { status: "error" }
);

export function useOwnRating(placeId: number | undefined) {
  const { session, profile, loading, error } = useAuth();
  const userId = session?.user.id;
  const member = !!userId && profile?.id === userId &&
    profile.role === "member" && profile.status === "active";
  const previousOwner = useRef<string | undefined>(undefined);
  const ownerId = ratingOwner(userId, member, loading || !!error, previousOwner.current);
  useEffect(() => {
    previousOwner.current = ownerId;
  }, [ownerId]);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const account = sessionRef.current;
    if (!account || !ownerId || account.user.id !== ownerId || placeId === undefined) {
      setResult(null);
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    const key = { ownerId, placeId, attempt };
    getOwnRating(account, placeId, signal)
      .then((rating) => {
        if (!signal.aborted) setResult({ ...key, status: "ready", rating, signal });
      })
      .catch(() => {
        if (!signal.aborted) setResult({ ...key, status: "error" });
      });
    return () => controller.abort();
  }, [ownerId, placeId, attempt]);

  const current = result && result.ownerId === ownerId &&
    result.placeId === placeId && result.attempt === attempt ? result : null;
  return {
    session: ownerId ? session : null,
    canSubmit: member && !loading,
    signedIn: !!userId,
    authError: error,
    loading: !current && (loading || (!!ownerId && placeId !== undefined)),
    result: current,
    retry: () => setAttempt((value) => value + 1),
  };
}
