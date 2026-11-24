import { useLocalSearchParams } from "expo-router";
import { useDemo } from "./demo";

export function usePlaceTarget() {
  const { id, source, name } = useLocalSearchParams<{
    id: string;
    source?: string;
    name?: string;
  }>();
  const d = useDemo();
  const live = source === "live";
  const place =
    live && name
      ? { id: Number(id), name }
      : !live
        ? d.places.find((p) => p.id === Number(id))
        : undefined;
  return {
    id,
    live,
    place,
    details: (live ? "/live-places/" : "/places/") + id,
    form: (action: string) =>
      placeFormPath(Number(id), action, live, place?.name ?? ""),
  };
}
export function placeFormPath(
  id: number,
  action: string,
  live: boolean,
  name: string,
) {
  return (
    "/places/" +
    id +
    "/" +
    action +
    (live ? "?source=live&name=" + encodeURIComponent(name) : "")
  );
}
