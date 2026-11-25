import type { OwnRating } from "../services/reviews";

export function ratingOwner(
  userId: string | undefined,
  activeMember: boolean,
  profileUnavailable: boolean,
  previousOwner: string | undefined,
) {
  return activeMember || (profileUnavailable && userId === previousOwner)
    ? userId
    : undefined;
}

type Intent = {
  rating: OwnRating | null;
  score: number;
  text: string;
};

type Draft = Intent & {
  status: "editing" | "pending" | "uncertain" | "complete";
  feedback?: "failed" | "changed";
};

type Requests = {
  write: (intent: Intent) => Promise<void>;
  read: () => Promise<OwnRating | null>;
  isCurrent: () => boolean;
};

export function createReviewDraft(rating: OwnRating | null, deleting: boolean) {
  let draft: Draft = {
    rating,
    score: rating?.score ?? 0,
    text: rating?.review_text ?? "",
    status: "editing",
  };
  let unconfirmed: Intent | undefined;
  const listeners = new Set<() => void>();

  function update(changes: Partial<Draft>) {
    draft = { ...draft, ...changes };
    listeners.forEach((listener) => listener());
  }

  async function reconcile(intent: Intent, requests: Requests) {
    try {
      const actual = await requests.read();
      if (!requests.isCurrent()) return;
      const applied = deleting
        ? actual === null
        : actual !== null && (!intent.rating || actual.id === intent.rating.id) &&
          actual.score === intent.score && actual.review_text === (intent.text.trim() || null);
      unconfirmed = undefined;
      if (applied) {
        update({ status: "complete" });
        return true;
      }
      const changed = actual?.id !== intent.rating?.id ||
        actual?.score !== intent.rating?.score ||
        actual?.review_text !== intent.rating?.review_text;
      update({
        status: "editing",
        rating: actual,
        feedback: changed ? "changed" : "failed",
      });
    } catch {
      if (requests.isCurrent()) update({ status: "uncertain" });
    }
  }

  async function submit(requests: Requests) {
    if (!requests.isCurrent()) return;
    if (draft.status === "uncertain" && unconfirmed) {
      update({ status: "pending" });
      return reconcile(unconfirmed, requests);
    }
    if (draft.status !== "editing" || (deleting && (!draft.rating || draft.feedback === "changed")))
      return;

    const intent = { rating: draft.rating, score: draft.score, text: draft.text };
    update({ status: "pending", feedback: undefined });
    try {
      await requests.write(intent);
      if (requests.isCurrent()) {
        update({ status: "complete" });
        return true;
      }
    } catch {
      if (!requests.isCurrent()) return;
      unconfirmed = intent;
      return reconcile(intent, requests);
    }
  }

  return {
    getSnapshot: () => draft,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setScore(score: number) {
      if (draft.status === "editing") update({ score });
    },
    setText(text: string) {
      if (draft.status === "editing") update({ text });
    },
    submit,
  };
}
