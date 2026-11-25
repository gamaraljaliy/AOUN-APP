import type { PreparedPhoto, SelectedPhoto } from "../services/reviewPhotos";

type Requests = {
  current: () => boolean;
  prepare: (photo: SelectedPhoto) => Promise<PreparedPhoto | null>;
  upload: (photo: PreparedPhoto) => Promise<void>;
  verify: (photo: PreparedPhoto) => Promise<boolean>;
  read: () => Promise<string[] | null>;
  attach: (previous: string[], next: string[]) => Promise<void>;
  cleanup: (path: string) => Promise<void>;
};

export type PhotoSaveResult = "saved" | "cleanup-pending" | "retry" | "conflict" | "invalid" | "stopped";

function samePaths(left: string[] | null, right: string[]) {
  return left !== null && left.length === right.length &&
    left.every((path, index) => path === right[index]);
}

export function createReviewPhotoWorkflow(
  previous: string[], removed: string[], selected: SelectedPhoto[],
  deleting: boolean,
) {
  const slotFor = (photo: SelectedPhoto) => ({
    photo, prepared: undefined as PreparedPhoto | undefined,
    uploaded: false, verified: false, rejected: false,
  });
  const staged = selected.map(slotFor);
  const cleanup = new Set(removed);
  let committed = deleting;
  let running = false;
  let terminalConflict = false;

  async function run(requests: Requests): Promise<PhotoSaveResult> {
    if (running || !requests.current()) return "stopped";
    if (terminalConflict) return "conflict";
    if (staged.some(({ rejected }) => rejected)) return "invalid";
    running = true;
    try {
      if (!committed) {
        const actual = await requests.read();
        if (!requests.current()) return "stopped";
        const ready = staged.every(({ verified }) => verified);
        const kept = previous.filter((path) => !removed.includes(path));
        const desired = () => [...kept, ...staged.map(({ prepared }) => prepared!.key)];
        if (ready && samePaths(actual, desired())) {
          committed = true;
        } else if (!samePaths(actual, previous)) {
          // Another edit won. Retirement refuses to remove anything now attached.
          for (const slot of staged) {
            if (!requests.current()) return "stopped";
            if (slot.prepared && !actual?.includes(slot.prepared.key)) {
              try { await requests.cleanup(slot.prepared.key); } catch { /* orphan sweep */ }
            }
          }
          terminalConflict = true;
          return "conflict";
        } else {
          for (const slot of staged) {
            if (!requests.current()) return "stopped";
            if (!slot.prepared) {
              const prepared = await requests.prepare(slot.photo);
              if (!requests.current()) return "stopped";
              if (!prepared) {
                slot.rejected = true;
                return "invalid";
              }
              slot.prepared = prepared;
            }
            if (!slot.uploaded) {
              await requests.upload(slot.prepared);
              slot.uploaded = true;
            }
            if (!requests.current()) return "stopped";
            if (!slot.verified) {
              slot.verified = await requests.verify(slot.prepared);
              if (!requests.current()) return "stopped";
              if (!slot.verified) {
                slot.rejected = true;
                return "invalid";
              }
            }
          }
          if (!requests.current()) return "stopped";
          const next = desired();
          try {
            await requests.attach(previous, next);
          } catch {
            if (!requests.current()) return "stopped";
            if (!samePaths(await requests.read(), next)) return "retry";
          }
          if (!requests.current()) return "stopped";
          committed = true;
        }
      }
      for (const path of cleanup) {
        if (!requests.current()) return "stopped";
        try {
          await requests.cleanup(path);
          cleanup.delete(path);
        } catch {
          // Retrying retirement and removal for this key is safe.
        }
      }
      return cleanup.size ? "cleanup-pending" : "saved";
    } catch {
      return requests.current() ? "retry" : "stopped";
    } finally {
      running = false;
    }
  }

  return {
    run,
    isRejected: (photo: SelectedPhoto) => staged.some((slot) => slot.photo === photo && slot.rejected),
    hasRejected: () => staged.some(({ rejected }) => rejected),
    addReplacement(photo: SelectedPhoto) {
      if (!running && !committed && !terminalConflict) staged.push(slotFor(photo));
    },
    removeRejected(photo: SelectedPhoto) {
      if (running) return false;
      const index = staged.findIndex((slot) => slot.photo === photo && slot.rejected);
      if (index < 0) return false;
      const [removedSlot] = staged.splice(index, 1);
      if (removedSlot.uploaded && removedSlot.prepared) cleanup.add(removedSlot.prepared.key);
      return true;
    },
  };
}
