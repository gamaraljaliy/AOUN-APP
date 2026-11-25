import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PlaceMapProps } from "./PlaceMap.types";

export default function PlaceMap({
  pins,
  center,
  selected,
  onSelect,
  height,
}: PlaceMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<{
    L: typeof Leaflet;
    map: Leaflet.Map;
  } | null>(null);
  const focus = pins.find((pin) => pin.id === selected) ?? center;
  useEffect(() => {
    let disposed = false;
    let map: Leaflet.Map | undefined;
    void import("leaflet").then((L) => {
      if (disposed || !container.current) return;
      map = L.map(container.current);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      setApi({ L, map });
    });
    return () => {
      disposed = true;
      map?.remove();
    };
  }, []);
  useEffect(() => {
    if (api) api.map.setView([focus.lat, focus.lon], api.map.getZoom() || 13);
  }, [api, focus.lat, focus.lon]);
  useEffect(() => {
    if (!api) return;
    const group = api.L.layerGroup().addTo(api.map);
    pins.forEach((pin) => {
      const title = document.createElement("span");
      title.textContent = pin.name;
      api.L.circleMarker([pin.lat, pin.lon], {
        radius: pin.id === selected ? 11 : 8,
        color: "white",
        fillColor: pin.id === selected ? "#19574B" : "#766AC2",
        fillOpacity: 1,
      })
        .addTo(group)
        .bindTooltip(title)
        .on("click", () => onSelect(pin.id));
    });
    return () => {
      group.remove();
    };
  }, [api, pins, selected, onSelect]);
  return <div ref={container} style={{ width: "100%", height }} />;
}
