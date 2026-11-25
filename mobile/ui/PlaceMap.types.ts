export type MapPin = { id: number; name: string; lat: number; lon: number };
export type PlaceMapProps = {
  pins: MapPin[];
  center: { lat: number; lon: number };
  selected?: number;
  onSelect: (id: number) => void;
  height: number;
};
