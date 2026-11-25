import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { useAuth } from "../auth/context";
import { listFavorites, setFavorite } from "../services/favorites";
import type { Place } from "../services/places";
import { createFavoritesState, type FavoritesSnapshot } from "./state";

type ScopedFavorites = {
  ownerId: string;
  state: ReturnType<typeof createFavoritesState>;
};

function useFavoritesState() {
  const { session, profile, loading: authLoading, error: authError } = useAuth();
  const userId = session?.user.id;
  const memberId =
    profile?.id === userId && profile?.role === "member" && profile.status === "active"
      ? userId
      : undefined;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const scope = useRef<ScopedFavorites | null>(null);
  const [result, setResult] = useState<{
    ownerId: string;
    snapshot: FavoritesSnapshot;
  } | null>(null);
  const current = result?.ownerId === memberId ? result?.snapshot : undefined;

  useEffect(() => {
    if (!memberId) {
      setResult(null);
      return;
    }

    function activeSession() {
      const account = sessionRef.current;
      if (!account || account.user.id !== memberId)
        throw new Error("Favorites session changed");
      return account;
    }

    const state = createFavoritesState({
      load: (signal) => listFavorites(activeSession(), signal),
      write: (id, saved, signal) => setFavorite(activeSession(), id, saved, signal),
      publish: (snapshot) => setResult({ ownerId: memberId, snapshot }),
    });
    scope.current = { ownerId: memberId, state };

    return () => {
      state.stop();
      scope.current = null;
    };
  }, [memberId]);

  function retry() {
    if (scope.current && scope.current.ownerId === memberId)
      void scope.current.state.retry();
  }

  function toggle(place: Place) {
    if (scope.current && scope.current.ownerId === memberId)
      void scope.current.state.toggle(place);
  }

  return {
    signedIn: !!userId,
    member: !!memberId,
    authError,
    loading: authLoading || (!!memberId && (!current || current.status === "loading")),
    loadError: current?.status === "error",
    places: current?.places ?? [],
    pendingId: current?.pendingId,
    failedIds: current?.failedIds,
    retry,
    toggle,
  };
}

const FavoritesContext = createContext<ReturnType<typeof useFavoritesState> | null>(null);

export function FavoritesProvider({ children }: PropsWithChildren) {
  const favorites = useFavoritesState();
  return (
    <FavoritesContext.Provider value={favorites}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const favorites = useContext(FavoritesContext);
  if (!favorites) throw new Error("FavoritesProvider missing");
  return favorites;
}
