"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase, type MissionPin, type BasePin, type Organization } from "@/lib/supabase";
import FactionEmblem, { emblemSvg } from "@/components/FactionEmblem";
import MissionPanel from "@/components/MissionPanel";

type Assignment = {
  id: string; status: string; assigned_at: string; arrives_at: string; completes_at: string;
  completed_at: string | null; reward_funds: number | null; title: string; code: MissionPin["code"];
  call_sign: string; base_lat: number; base_lng: number; lat: number; lng: number;
};

// Ambulanza in movimento: lampeggia se in viaggio, ferma sul posto durante l'intervento
function ambulanceIcon(onScene: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="font-size:26px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));
           ${onScene ? "" : "animation:amb-blink .6s steps(1) infinite"}">🚑</div>`,
    iconSize: [30, 30], iconAnchor: [15, 15],
  });
}

const REQ: Record<string, string> = {
  ecg: "cardiomonitor (ECG)", defib: "defibrillatore", spinale: "tavola spinale adulti",
  spinale_ped: "tavola spinale pediatrica", collare: "collari cervicali", ked: "KED",
  cucchiaio: "barella a cucchiaio", steccobende: "steccobende",
};

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MissionPin | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  async function refreshOrg() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from("organizations")
      .select("id,name,type,funds,reputation").eq("owner_id", session.user.id).maybeSingle();
    if (data) setOrg(data as Organization);
  }

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? null : t)), 6000);
  }

  // Le mie missioni: animazione dell'ambulanza e avviso a fine servizio
  useEffect(() => {
    let prev = new Map<string, string>();
    async function loadAssignments() {
      const { data } = await supabase.from("my_assignments").select("*");
      const list = (data as Assignment[]) ?? [];
      for (const a of list) {
        if (prev.get(a.id) && prev.get(a.id) !== "conclusa" && a.status === "conclusa") {
          showToast(`✅ ${a.call_sign} rientrato: ${a.title.split(" — ")[0]} · +${(a.reward_funds ?? 0).toLocaleString("it-IT")} €`);
          refreshOrg();
        }
      }
      prev = new Map(list.map((a) => [a.id, a.status]));
      setAssignments(list);
    }
    loadAssignments();
    const t1 = setInterval(loadAssignments, 20_000);
    const t2 = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

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
      const { data: prof } = await supabase.from("profiles").select("is_admin").eq("id", session.user.id).maybeSingle();
      setIsAdmin(!!prof?.is_admin);
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
              <button onClick={() => router.push("/squadra")}
                      style={{ border: "none", background: "#1E3A8A", color: "#fff", borderRadius: 8,
                               padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>👥 Squadra</button>
              {isAdmin && (
                <button onClick={() => router.push("/admin")}
                        style={{ border: "none", background: "#7C3AED", color: "#fff", borderRadius: 8,
                                 padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>🛠️ Admin</button>
              )}
              <button onClick={() => router.push("/negozio")}
                      style={{ border: "none", background: "#111", color: "#fff", borderRadius: 8,
                               padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>🛒 Presidi</button>
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
              Slot: {m.slots_taken}/{m.slots_total} · Premio: {m.reward_funds.toLocaleString("it-IT")} €<br />
              {m.requires?.length > 0 && <>Richiede: {m.requires.map((r) => REQ[r] ?? r).join(", ")}<br /></>}
              Scade: {new Date(m.expires_at).toLocaleTimeString("it-IT")}
              {org && m.status === "aperta" && m.slots_taken < m.slots_total && (
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => setSelected(m)}
                          style={{ width: "100%", border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer",
                                   background: CODE_COLOR[m.code], color: "#fff", fontWeight: 700 }}>🚨 Prendi servizio</button>
                </div>
              )}
            </Popup>
          </CircleMarker>
        ))}

        {assignments.filter((a) => a.status !== "conclusa" && now < new Date(a.completes_at).getTime() + 60_000).map((a) => {
          const t0 = new Date(a.assigned_at).getTime(), t1 = new Date(a.arrives_at).getTime();
          const p = Math.min(1, Math.max(0, (now - t0) / Math.max(1, t1 - t0)));
          const lat = a.base_lat + (a.lat - a.base_lat) * p, lng = a.base_lng + (a.lng - a.base_lng) * p;
          const onScene = p >= 1;
          const left = Math.max(0, Math.round(((onScene ? new Date(a.completes_at).getTime() : t1) - now) / 60000));
          return (
            <Marker key={a.id} position={[lat, lng]} icon={ambulanceIcon(onScene)}>
              <Popup>
                <strong>{a.call_sign}</strong><br />
                {a.title}<br />
                {onScene ? `Sul posto · libero tra ${left} min` : `In viaggio · arrivo tra ${left} min`}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <style>{`@keyframes amb-blink { 0% { filter: drop-shadow(0 0 6px #3b82f6) } 50% { filter: drop-shadow(0 0 6px #ef4444) } }`}</style>

      {selected && (
        <MissionPanel mission={selected} onClose={() => setSelected(null)}
                      onClaimed={(text) => { setSelected(null); showToast(text); setTimeout(() => {
                        supabase.from("my_assignments").select("*").then(({ data }) => setAssignments((data as Assignment[]) ?? []));
                      }, 300); }} />
      )}

      {toast && (
        <div style={{ position: "absolute", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 1200,
                      background: "#111", color: "#fff", padding: "12px 18px", borderRadius: 12, fontWeight: 600,
                      boxShadow: "0 6px 24px rgba(0,0,0,.35)", maxWidth: "90vw", textAlign: "center" }}>{toast}</div>
      )}
    </div>
  );
}
