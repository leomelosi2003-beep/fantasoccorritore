"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { supabase, configError, type MissionPin } from "@/lib/supabase";

const CODE_COLOR: Record<MissionPin["code"], string> = {
  nessuno: "#3B82F6", verde: "#16A34A", giallo: "#EAB308", rosso: "#DC2626",
};

function Notice({ text }: { text: string }) {
  return (
    <div style={{ position: "absolute", top: 12, left: 12, right: 12, zIndex: 1000,
                  background: "#fff3f3", color: "#900", border: "1px solid #e99",
                  padding: "10px 14px", borderRadius: 8, fontFamily: "sans-serif" }}>
      {text}
    </div>
  );
}

export default function GameMap() {
  const [missions, setMissions] = useState<MissionPin[]>([]);
  const [error, setError] = useState<string | null>(configError);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    async function load() {
      const { data, error } = await client.from("missions_map").select("*");
      if (error) { setError(`Errore Supabase: ${error.message}`); return; }
      setError(null);
      setMissions((data as MissionPin[]) ?? []);
    }

    load();
    // Realtime: ogni cambio su missions ricarica i pin per tutti i giocatori
    const ch = client
      .channel("missions-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "missions" }, load)
      .subscribe();
    const poll = setInterval(load, 30_000);
    return () => { client.removeChannel(ch); clearInterval(poll); };
  }, []);

  return (
    <div style={{ position: "relative" }}>
      {error && <Notice text={error} />}
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
    </div>
  );
}
