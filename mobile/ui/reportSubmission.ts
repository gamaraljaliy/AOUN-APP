import type { ReportDraft, ReportResult } from "../services/reports";

type State = "editing" | "submitting" | "checking" | ReportResult;
type Attempt = { draft: ReportDraft; previousId: number };

export function createReportSubmissions() {
  let owner: string | undefined;
  let generation = 0;
  const accounts = new Map<string, Map<number, ReturnType<typeof createEntry>>>();

  function createEntry(ownerId: string) {
    let state: State = "editing";
    let attempt: Attempt | undefined;
    const listeners = new Set<() => void>();

    function update(next: State) {
      state = next;
      listeners.forEach((listener) => listener());
    }

    return {
      getSnapshot: () => state,
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
      },
      onSignOut() {
        if (state === "submitting" || state === "checking")
          update(attempt ? "uncertain" : "rejected");
      },
      startNew() {
        if (owner === ownerId && state === "submitted") update("editing");
      },
      async submit(
        account: { userId: string; activeMember: boolean },
        draft: ReportDraft,
        baseline: () => Promise<number>,
        send: (draft: ReportDraft) => Promise<ReportResult>,
      ) {
        if (owner !== ownerId || account.userId !== ownerId || !account.activeMember ||
            (state !== "editing" && state !== "rejected"))
          return;

        const version = generation;
        const current = () => owner === ownerId && generation === version;
        const payload = { ...draft, description: draft.description.trim() };
        update("submitting");
        let previousId;
        try {
          previousId = await baseline();
        } catch {
          if (current()) update("rejected"); // No insert was attempted.
          return;
        }
        if (!current()) return;

        attempt = { draft: payload, previousId };
        let result: ReportResult;
        try {
          result = await send(payload);
        } catch {
          result = "uncertain";
        }
        if (!current()) return;
        if (result !== "uncertain") attempt = undefined;
        update(result);
      },
      async reconcile(userId: string, find: (attempt: Attempt) => Promise<boolean>) {
        if (owner !== ownerId || userId !== ownerId || state !== "uncertain" || !attempt)
          return;
        const version = generation;
        update("checking");
        let found = false;
        try {
          found = await find(attempt);
        } catch {
          // A failed or inconclusive read leaves the original attempt unresolved.
        }
        if (owner !== ownerId || generation !== version) return;
        if (found) attempt = undefined;
        update(found ? "submitted" : "uncertain");
      },
    };
  }

  return {
    setOwner(next: string | undefined) {
      if (owner === next) return;
      const previous = owner;
      owner = next;
      generation++;
      if (previous) accounts.get(previous)?.forEach((entry) => entry.onSignOut());
    },
    forPlace(ownerId: string, placeId: number) {
      let places = accounts.get(ownerId);
      if (!places) {
        places = new Map();
        accounts.set(ownerId, places);
      }
      let entry = places.get(placeId);
      if (!entry) {
        entry = createEntry(ownerId);
        places.set(placeId, entry);
      }
      return entry;
    },
  };
}
