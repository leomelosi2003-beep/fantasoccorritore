"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { gameConfirm } from "@/lib/confirm";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { supabase, friendlyError, type Organization } from "@/lib/supabase";

const PickBaseMap = dynamic(() => import("@/components/PickBaseMap"), { ssr: false });

type Base = { id: string; name: string; vehicle_capacity: number; is_headquarters: boolean; level: number };

const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 760, margin: "0 auto", padding: 16 };
const box: CSSProperties = { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)", marginBottom: 14 };
const btn: CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "none", background: "#111", color: "#fff",
  fontWeight: 700, cursor: "pointer", fontSize: 15 };
const euro = (n: number) => n.toLocaleString("it-IT") + " €";

// Stesso calcolo del server: la prima è gratis, poi 5.000 € e ogni sede costa il 60% in più della precedente
const baseCost = (owned: number) => (owned === 0 ? 0 : Math.round(5000 * Math.pow(1.6, owned - 1)));
// Stesso calcolo del server (base_upgrade_cost): ogni livello aggiunge 1 posto ambulanza
const UPGRADE: Record<number, number> = { 1: 8000, 2: 14000, 3: 22000, 4: 32000, 5: 45000, 6: 60000, 7: 80000, 8: 100000, 9: 125000 };
const MAX_LEVEL = 10;

export default function Sedi() {
  const router = useRouter();
  const [org, setOrg] = useState<Organization | null>(null);
  const [bases, setBases] = useState<Base[]>([]);
  const [parked, setParked] = useState<Record<string, number>>({});
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mapKey, setMapKey] = useState(0);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); return; }
    const { data: o } = await supabase.from("organizations").select("id,name,type,funds,reputation,logo_url")
      .eq("owner_id", session.user.id).maybeSingle();
    if (!o) { router.replace("/onboarding"); return; }
    setOrg(o as Organization);
    const [bs, vs] = await Promise.all([
      supabase.from("bases").select("id,name,vehicle_capacity,is_headquarters,level").eq("org_id", o.id).order("built_at"),
      supabase.from("my_fleet").select("base_id,boat,mine").eq("mine", true),
    ]);
    setBases((bs.data as Base[]) ?? []);
    const count: Record<string, number> = {};
    // la barca sta all'ormeggio: non occupa posti in garage
    for (const v of (vs.data as { base_id: string; boat?: boolean }[]) ?? []) if (!v.boat) count[v.base_id] = (count[v.base_id] ?? 0) + 1;
    setParked(count);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const cost = baseCost(bases.length);

  async function buy() {
    if (!point || !org) return;
    const n = name.trim() || `Sede ${bases.length + 1}`;
    if (!(await gameConfirm(`Comprare la sede "${n}" per ${euro(cost)}?`))) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("build_base", { p_name: n, p_lng: point.lng, p_lat: point.lat });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: friendlyError(error.message) }); return; }
    setMsg({ ok: true, text: `🏠 ${n} aperta! Ora puoi parcheggiarci nuove ambulanze dal Garage.` });
    setPoint(null); setName(""); setMapKey((k) => k + 1);
    load();
  }

  async function upgrade(b: Base) {
    const c = UPGRADE[b.level];
    if (!c || !(await gameConfirm(`Ampliare "${b.name}" al livello ${b.level + 1} (${b.vehicle_capacity + 1} posti) per ${euro(c)}?`))) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("upgrade_base", { p_base: b.id });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message.includes("MAX_LEVEL") ? "La sede è già al livello massimo."
        : error.message.includes("INSUFFICIENT_FUNDS") ? "Non hai abbastanza soldi." : friendlyError(error.message) });
      return;
    }
    setMsg({ ok: true, text: `⬆️ ${b.name} ampliata: ora ha ${b.vehicle_capacity + 1} posti per le ambulanze.` });
    load();
  }

  async function sellBase(b: Base) {
    if ((parked[b.id] ?? 0) > 0) { setMsg({ ok: false, text: `Prima sposta le ambulanze da ${b.name} (dal Garage).` }); return; }
    const { data: mv } = await supabase.rpc("base_market_value", { p_base: b.id });
    const market = Number(mv ?? 8000);
    const txt = window.prompt(`Vendi ${b.name} all'asta (30 minuti).\nValore: ${euro(market)}. Se nessuno offre, la ritira l'agenzia a ${euro(Math.round(market * 0.6))}.\n\nPrezzo di partenza (€):`,
      String(Math.round(market * 0.8)));
    if (txt === null) return;
    const price = parseInt(txt.replace(/[^0-9]/g, ""), 10);
    if (!price) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("create_base_auction", { p_base: b.id, p_start_price: price, p_minutes: 30 });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message.includes("BASE_NOT_EMPTY") ? "Prima sposta tutte le ambulanze da questa sede."
        : error.message.includes("IS_HQ") ? "La sede principale non si può vendere."
        : error.message.includes("duplicate") ? "Questa sede è già all'asta." : friendlyError(error.message) });
      return;
    }
    setMsg({ ok: true, text: `🏷️ ${b.name} è all'asta per 30 minuti in "Usato e aste".` });
  }

  if (!org) return <main style={shell} />;

  return (
    <main style={shell}>
      <div style={{ background: "#111", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={() => router.push("/")} style={{ ...btn, background: "#333", padding: "8px 12px", fontWeight: 600 }}>← Mappa</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800 }}>🏠 Le tue sedi</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>{euro(org.funds)}</div>
          </div>
          <button onClick={() => router.push("/garage")} style={{ ...btn, background: "#F97316", padding: "8px 12px" }}>🚑 Garage</button>
        </div>
      </div>

      <div style={wrap}>
        <div style={box}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>Le tue sedi</div>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>Amplia una sede per avere più posti per le ambulanze (fino al livello {MAX_LEVEL}, {MAX_LEVEL + 2} posti).</div>
          {msg && <div style={{ color: msg.ok ? "#15803D" : "#B91C1C", margin: "6px 0", fontWeight: 600 }}>{msg.text}</div>}
          {bases.map((b) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #f0f0f0" }}>
              <span style={{ fontSize: 22 }}>{b.is_headquarters ? "🏛️" : "🏠"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{b.name}</div>
                <div style={{ fontSize: 13, color: "#666" }}>{b.is_headquarters ? "Sede centrale · " : ""}Livello {b.level} · 🚑 {parked[b.id] ?? 0}/{b.vehicle_capacity} posti</div>
              </div>
              {b.level < MAX_LEVEL ? (
                <button disabled={busy || org.funds < UPGRADE[b.level]} onClick={() => upgrade(b)}
                        title="Ogni livello aggiunge un posto per le ambulanze"
                        style={{ ...btn, fontSize: 13, padding: "8px 10px", background: "#15803D", whiteSpace: "nowrap",
                                 opacity: busy || org.funds < UPGRADE[b.level] ? 0.4 : 1 }}>
                  ⬆️ +1 posto · {euro(UPGRADE[b.level])}
                </button>
              ) : <span style={{ fontSize: 12, fontWeight: 700, color: "#B45309" }}>⭐ Livello massimo</span>}
              {!b.is_headquarters && (
                <button disabled={busy} onClick={() => sellBase(b)} title="Metti la sede all'asta"
                        style={{ ...btn, fontSize: 13, padding: "8px 10px", background: "#fff", color: "#B45309", border: "1px solid #B45309" }}>🏷️</button>
              )}
            </div>
          ))}
        </div>

        <div style={box}>
          <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Compra una nuova sede</div>
          <div style={{ fontSize: 14, color: "#555", marginBottom: 10 }}>
            Prezzo: <strong>{euro(cost)}</strong>. Più sedi hai, più costa la prossima.
            Ogni sede ha i suoi posti per le ambulanze e le fa partire più vicino ai servizi.
            <br />Tocca la mappa (i pallini blu sono le tue sedi): serve stare <span style={{ color: "#6B7280" }}>almeno 500 m dalle sedi degli altri</span> (zone grigie).
          </div>
          <PickBaseMap key={mapKey} value={point} color="#F97316" onPick={setPoint} height={360} />
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={`Sede ${bases.length + 1}`}
                 style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc", fontSize: 16, margin: "12px 0", boxSizing: "border-box" }} />
          {msg && <div style={{ color: msg.ok ? "#15803D" : "#B91C1C", marginBottom: 10, fontWeight: 600 }}>{msg.text}</div>}
          <button disabled={!point || busy || org.funds < cost} onClick={buy}
                  style={{ ...btn, width: "100%", padding: 14, opacity: !point || busy || org.funds < cost ? 0.4 : 1 }}>
            {busy ? "Attendi…" : org.funds < cost ? `Servono ${euro(cost)}` : !point ? "Scegli il punto sulla mappa" : `🏠 Compra sede · ${euro(cost)}`}
          </button>
        </div>
      </div>
    </main>
  );
}
