import { useEffect, useRef } from "react";
import MapView, { Marker } from "react-native-maps";
import type { PlaceMapProps } from "./PlaceMap.types";

export default function PlaceMap({
  pins,
  center,
  selected,
  onSelect,
  height,
}: PlaceMapProps) {
  const map = useRef<MapView>(null);
  const focus = pins.find((pin) => pin.id === selected) ?? center;
  const { lat, lon } = focus;
  useEffect(() => {
    map.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lon,
        latitudeDelta: 0.085,
        longitudeDelta: 0.085,
      },
      300,
    );
  }, [lat, lon]);
  return (
    <MapView
      ref={map}
      style={{ height, width: "100%" }}
      initialRegion={{
        latitude: lat,
        longitude: lon,
        latitudeDelta: 0.085,
        longitudeDelta: 0.085,
      }}
    >
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          coordinate={{ latitude: pin.lat, longitude: pin.lon }}
          title={pin.name}
          pinColor={selected === pin.id ? "#19574B" : "#766AC2"}
          onPress={() => onSelect(pin.id)}
        />
      ))}
    </MapView>
  );
}
