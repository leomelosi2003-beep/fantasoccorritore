"use client";

import { MapContainer, TileLayer, CircleMarker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Point = { lat: number; lng: number };

function ClickHandler({ onPick }: { onPick: (p: Point) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

// Mappa per scegliere dove costruire la prima sede: un click piazza il segnaposto.
export default function PickBaseMap({ value, color, onPick }: {
  value: Point | null; color: string; onPick: (p: Point) => void;
}) {
  return (
    <MapContainer center={[43.5485, 10.3106]} zoom={12}
                  style={{ height: 320, width: "100%", borderRadius: 12 }}>
      <TileLayer attribution="&copy; OpenStreetMap contributors"
                 url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickHandler onPick={onPick} />
      {value && (
        <CircleMarker center={[value.lat, value.lng]} radius={12}
                      pathOptions={{ color: "#111", weight: 3, fillColor: color, fillOpacity: 1 }} />
      )}
    </MapContainer>
  );
}
