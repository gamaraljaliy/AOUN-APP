import type { Place } from "../services/places";

export type FavoritesSnapshot = {
  places: Place[];
  status: "loading" | "ready" | "error";
  pendingId?: number;
  failedIds: ReadonlySet<number>;
};

type Dependencies = {
  load: (signal: AbortSignal) => Promise<Place[]>;
  write: (id: number, saved: boolean, signal: AbortSignal) => Promise<void>;
  publish: (snapshot: FavoritesSnapshot) => void;
};

export function createFavoritesState({ load, write, publish }: Dependencies) {
  const controller = new AbortController();
  const { signal } = controller;
  let snapshot: FavoritesSnapshot = {
    status: "loading",
    places: [],
    failedIds: new Set(),
  };
  let queue = Promise.resolve();

  function update(changes: Partial<FavoritesSnapshot>) {
    if (signal.aborted) return;
    snapshot = { ...snapshot, ...changes };
    publish(snapshot);
  }

  async function read() {
    update({ status: "loading" });
    try {
      const places = await load(signal);
      update({ places, status: "ready" });
    } catch {
      update({ status: "error" });
    }
  }

  function toggle(place: Place) {
    if (signal.aborted || snapshot.status !== "ready") return queue;
    // Each queued action reads the last confirmed state, regardless of React's
    // render timing. An old account's queued actions stop when its scope closes.
    queue = queue.then(async () => {
      if (signal.aborted) return;
      const saved = snapshot.places.some(({ id }) => id === place.id);
      const failedIds = new Set(snapshot.failedIds);
      failedIds.delete(place.id);
      update({ pendingId: place.id, failedIds });

      try {
        await write(place.id, !saved, signal);
        const places = saved
          ? snapshot.places.filter(({ id }) => id !== place.id)
          : [...snapshot.places, place].sort((a, b) => a.id - b.id);
        update({ places, pendingId: undefined });
      } catch {
        update({
          pendingId: undefined,
          failedIds: new Set([...failedIds, place.id]),
        });
      }
    });
    return queue;
  }

  return {
    ready: read(),
    retry: () => {
      if (!signal.aborted && snapshot.status === "error") return read();
    },
    toggle,
    stop: () => controller.abort(),
  };
}
