"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase, type MissionPin, type BasePin, type Organization } from "@/lib/supabase";
import FactionEmblem, { emblemSvg } from "@/components/FactionEmblem";

const CODE_COLOR: Record<MissionPin["code"], string> = {
  nessuno: "#3B82F6", verde: "#16A34A", giallo: "#EAB308", rosso: "#DC2626",
};

// Icona della sede: lo stemma della fazione su un cerchio bianco
function baseIcon(type: BasePin["org_type"], mine: boolean) {
  const svg = emblemSvg(type, mine ? 30 : 22);
  const s = mine ? 44 : 34;
  return L.divIcon({
    className: "",
    html: `<div style="width:${s}px;height:${s}px;border-radius:50%;background:#fff;display:flex;
           align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.4);
           border:${mine ? "3px solid #111" : "1px solid #999"}">${svg}</div>`,
    iconSize: [s, s], iconAnchor: [s / 2, s / 2],
  });
}

export default function GameMap() {
  const router = useRouter();
  const [missions, setMissions] = useState<MissionPin[]>([]);
  const [bases, setBases] = useState<BasePin[]>([]);
  const [org, setOrg] = useState<Organization | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sessione: se sei loggato ma senza associazione vai all'onboarding
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoggedIn(false); return; }
      setLoggedIn(true);
      const { data } = await supabase.from("organizations")
        .select("id,name,type,funds,reputation").eq("owner_id", session.user.id).maybeSingle();
      if (!data) { router.replace("/onboarding"); return; }
      setOrg(data as Organization);
    })();
  }, [router]);

  useEffect(() => {
    async function load() {
      const [m, b] = await Promise.all([
        supabase.from("missions_map").select("*"),
        supabase.from("bases_map").select("*"),
      ]);
      if (m.error) { setError(`Errore Supabase: ${m.error.message}`); return; }
      setError(null);
      setMissions((m.data as MissionPin[]) ?? []);
      if (!b.error) setBases((b.data as BasePin[]) ?? []);
    }
    load();
    const ch = supabase
      .channel("map-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "missions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "bases" }, load)
      .subscribe();
    const poll = setInterval(load, 30_000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div style={{ position: "relative", fontFamily: "system-ui, sans-serif" }}>
      {/* Barra in alto */}
      <div style={{ position: "absolute", top: 10, left: 56, right: 10, zIndex: 1000, display: "flex",
                    justifyContent: "flex-end", gap: 8, pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto", background: "#fff", borderRadius: 12, padding: "6px 10px",
                      boxShadow: "0 2px 8px rgba(0,0,0,.2)", display: "flex", alignItems: "center", gap: 10 }}>
          {org ? (
            <>
              <FactionEmblem type={org.type} size={30} />
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{org.name}</div>
                <div style={{ fontSize: 12, color: "#555" }}>{org.funds.toLocaleString("it-IT")} € · ⭐ {org.reputation}</div>
              </div>
              <button onClick={() => router.push("/garage")}
                      style={{ border: "none", background: "#F97316", color: "#fff", borderRadius: 8,
                               padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>🚑 Garage</button>
              <button onClick={logout} style={{ border: "none", background: "#eee", borderRadius: 8,
                                                padding: "6px 8px", cursor: "pointer", fontSize: 12 }}>Esci</button>
            </>
          ) : loggedIn === false ? (
            <button onClick={() => router.push("/login")}
                    style={{ border: "none", background: "#111", color: "#fff", borderRadius: 8,
                             padding: "8px 14px", cursor: "pointer", fontWeight: 600 }}>Accedi / Registrati</button>
          ) : (
            <span style={{ fontSize: 13, color: "#666" }}>…</span>
          )}
        </div>
      </div>

      {error && (
        <div style={{ position: "absolute", top: 64, left: 12, right: 12, zIndex: 1000, background: "#fff3f3",
                      color: "#900", border: "1px solid #e99", padding: "10px 14px", borderRadius: 8 }}>{error}</div>
      )}

      <MapContainer center={[43.5485, 10.3106]} zoom={12} style={{ height: "100vh", width: "100%" }}>
        <TileLayer attribution="&copy; OpenStreetMap contributors"
                   url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {bases.map((b) => (
          <Marker key={b.id} position={[b.lat, b.lng]} icon={baseIcon(b.org_type, b.org_id === org?.id)}>
            <Popup>
              <strong>{b.name}</strong><br />
              {b.org_name} · livello {b.level}{b.is_headquarters ? " · sede centrale" : ""}
            </Popup>
          </Marker>
        ))}

        {missions.map((m) => (
          <CircleMarker key={m.id} center={[m.lat, m.lng]} radius={10}
                        pathOptions={{ color: CODE_COLOR[m.code], fillOpacity: 0.8 }}>
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
