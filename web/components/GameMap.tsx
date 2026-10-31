"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { supabase, type MissionPin } from "@/lib/supabase";

const CODE_COLOR: Record<MissionPin["code"], string> = {
  nessuno: "#3B82F6", verde: "#16A34A", giallo: "#EAB308", rosso: "#DC2626",
};

export default function GameMap() {
  const [missions, setMissions] = useState<MissionPin[]>([]);

  async function load() {
    const { data } = await supabase.from("missions_map").select("*");
    setMissions((data as MissionPin[]) ?? []);
  }

  useEffect(() => {
    load();
    // Realtime: ogni cambio su missions ricarica i pin per tutti i giocatori
    const ch = supabase
      .channel("missions-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "missions" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <MapContainer center={[43.5485, 10.3106]} zoom={12} style={{ height: "100vh", width: "100%" }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {missions.map((m) => (
        <CircleMarker
          key={m.id}
          center={[m.lat, m.lng]}
          radius={10}
          pathOptions={{ color: CODE_COLOR[m.code], fillOpacity: 0.8 }}
        >
          <Popup>
            <strong>{m.title}</strong><br />
            Slot: {m.slots_taken}/{m.slots_total} · Premio: {m.reward_funds} €<br />
            Scade: {new Date(m.expires_at).toLocaleTimeString("it-IT")}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
