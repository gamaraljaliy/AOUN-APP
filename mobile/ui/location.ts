import { Linking } from "react-native";
import type { Place } from "./demo";
export function openMap(p: Place) {
  return Linking.openURL(
    "https://www.google.com/maps/search/?api=1&query=" + p.lat + "," + p.lon,
  );
}
