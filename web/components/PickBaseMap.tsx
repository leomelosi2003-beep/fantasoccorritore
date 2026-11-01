"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Circle, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabase";

type Point = { lat: number; lng: number };
const MIN_DIST = 500; // metri dalle sedi delle altre associazioni

function meters(a: Point, b: Point) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function ClickHandler({ onPick }: { onPick: (p: Point) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

// Mappa per scegliere dove costruire la sede: un click piazza il segnaposto.
// Le sedi degli altri hanno un cerchio grigio di 500 m dove non si può costruire.
export default function PickBaseMap({ value, color, onPick, height = 320 }: {
  value: Point | null; color: string; onPick: (p: Point) => void; height?: number;
}) {
  const [others, setOthers] = useState<(Point & { org_id: string })[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: o } = await supabase.from("organizations").select("id").eq("owner_id", session.user.id).maybeSingle();
        setMe(o?.id ?? null);
      }
      const { data } = await supabase.from("bases_map").select("org_id,lat,lng");
      setOthers((data as (Point & { org_id: string })[]) ?? []);
    })();
  }, []);

  const blocked = others.filter((b) => b.org_id !== me);
  const mine = others.filter((b) => b.org_id === me);

  function pick(p: Point) {
    const msg = blocked.some((b) => meters(b, p) < MIN_DIST) ? "Troppo vicino a un'altra associazione: servono almeno 500 m (zone grigie)."
      : null;
    if (msg) { setWarn(msg); setTimeout(() => setWarn((w) => (w === msg ? null : w)), 2500); return; }
    setWarn(null);
    onPick(p);
  }

  return (
    <div style={{ position: "relative" }}>
      <MapContainer center={[43.5485, 10.3106]} zoom={12}
                    style={{ height, width: "100%", borderRadius: 12 }}>
        <TileLayer attribution="&copy; OpenStreetMap contributors"
                   url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickHandler onPick={pick} />
        {blocked.map((b, i) => (
          <Circle key={i} center={[b.lat, b.lng]} radius={MIN_DIST}
                  pathOptions={{ color: "#6B7280", weight: 1, fillColor: "#6B7280", fillOpacity: 0.25 }} />
        ))}
        {mine.map((b, i) => (
          <CircleMarker key={`d${i}`} center={[b.lat, b.lng]} radius={7}
                        pathOptions={{ color: "#fff", weight: 2, fillColor: "#2563EB", fillOpacity: 1 }} />
        ))}
        {value && (
          <CircleMarker center={[value.lat, value.lng]} radius={12}
                        pathOptions={{ color: "#111", weight: 3, fillColor: color, fillOpacity: 1 }} />
        )}
      </MapContainer>
      {warn && (
        <div style={{ position: "absolute", left: 8, right: 8, bottom: 8, zIndex: 1000, background: "#B91C1C", color: "#fff",
                      borderRadius: 10, padding: "8px 12px", fontSize: 14, fontWeight: 600, textAlign: "center" }}>
          {warn}
        </div>
      )}
    </div>
  );
}
