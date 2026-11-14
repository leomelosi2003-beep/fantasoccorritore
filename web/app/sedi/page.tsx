"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { gameConfirm } from "@/lib/confirm";
import BasePerksPanel from "@/components/BasePerksPanel";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { supabase, friendlyError, type Organization } from "@/lib/supabase";

const PickBaseMap = dynamic(() => import("@/components/PickBaseMap"), { ssr: false });

type Base = { id: string; name: string; vehicle_capacity: number; is_headquarters: boolean; level: number;
  rented: boolean; rent_daily: number | null; rent_buy_price: number | null; rent_debt: number; rent_paid_until: string | null; color: string | null;
  org_id?: string; collab_org?: string | null; owner_name?: string; twin_name?: string | null };
type Prices = { owned: number; buy: number; rent_daily: number };

const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 760, margin: "0 auto", padding: 16 };
const box: CSSProperties = { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)", marginBottom: 14 };
const btn: CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "none", background: "#111", color: "#fff",
  fontWeight: 700, cursor: "pointer", fontSize: 15 };
const euro = (n: number) => n.toLocaleString("it-IT") + " €";

// Il prezzo vero arriva dal server (my_base_prices): prima sede gratis, poi 300.000 € + 150.000 € per sede, max 3 milioni
const baseCost = (owned: number) => (owned === 0 ? 0 : Math.min(3000000, 300000 + 150000 * (owned - 1)));
const ERR: Record<string, string> = {
  INSUFFICIENT_FUNDS: "Non hai abbastanza soldi.", RENT_DEBT: "Prima paga l'affitto arretrato.",
  VEHICLES_BUSY: "Aspetta che i mezzi di questa sede rientrino.", RENTED_BASE: "Le sedi in affitto non si possono vendere: prima riscattala.",
  TOO_CLOSE_TO_OTHER_BASE: "Troppo vicino alla sede di un'altra associazione (servono 500 m).",
};
const err = (m: string) => Object.entries(ERR).find(([k]) => m.includes(k))?.[1] ?? friendlyError(m);
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
  const [prices, setPrices] = useState<Prices | null>(null);
  const [custom, setCustom] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); return; }
    const { data: o } = await supabase.from("organizations").select("id,name,type,funds,reputation,logo_url")
      .eq("owner_id", session.user.id).maybeSingle();
    if (!o) { router.replace("/onboarding"); return; }
    setOrg(o as Organization);
    const [bs, vs, pr] = await Promise.all([
      supabase.from("bases").select("id,name,vehicle_capacity,is_headquarters,level,rented,rent_daily,rent_buy_price,rent_debt,rent_paid_until,color,org_id,collab_org")
        .or(`org_id.eq.${o.id},collab_org.eq.${o.id}`).order("built_at"),
      supabase.from("my_fleet").select("base_id,boat,mine").eq("mine", true),
      supabase.rpc("my_base_prices"),
    ]);
    if (pr.data) setPrices(pr.data as Prices);
    const list = (bs.data as Base[]) ?? [];
    // nomi delle associazioni gemelle (sedi condivise) e mezzi di entrambe nelle sedi condivise
    const ids = Array.from(new Set(list.flatMap((b) => [b.org_id, b.collab_org]).filter((x): x is string => !!x && x !== o.id)));
    const names: Record<string, string> = {};
    if (ids.length) { const { data: on } = await supabase.from("organizations").select("id,name").in("id", ids); for (const r of (on as { id: string; name: string }[]) ?? []) names[r.id] = r.name; }
    setBases(list.map((b) => ({ ...b, owner_name: b.org_id !== o.id ? names[b.org_id ?? ""] : undefined, twin_name: b.collab_org && b.collab_org !== o.id ? names[b.collab_org] : null }))
      .sort((a, b) => Number(a.org_id !== o.id) - Number(b.org_id !== o.id)));
    const count: Record<string, number> = {};
    // la barca sta all'ormeggio: non occupa posti in garage
    for (const v of (vs.data as { base_id: string; boat?: boolean }[]) ?? []) if (!v.boat) count[v.base_id] = (count[v.base_id] ?? 0) + 1;
    const shared = list.filter((b) => b.collab_org).map((b) => b.id);
    if (shared.length) {
      const [sv, bm] = await Promise.all([supabase.from("vehicles").select("base_id,model_id,org_id,status").in("base_id", shared), supabase.from("vehicle_models").select("id").eq("boat", true)]);
      const boats = new Set(((bm.data as { id: string }[]) ?? []).map((m) => m.id));
      for (const id of shared) count[id] = 0;
      for (const v of (sv.data as { base_id: string; model_id: string; status: string }[]) ?? []) if (!boats.has(v.model_id) && v.status !== "fuori_servizio") count[v.base_id] = (count[v.base_id] ?? 0) + 1;
    }
    setParked(count);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const cost = prices?.buy ?? baseCost(bases.length);
  const rentDaily = prices?.rent_daily ?? Math.max(9000, Math.round(cost * 0.03));

  async function buy() {
    if (!point || !org) return;
    const n = name.trim() || `Sede ${bases.length + 1}`;
    if (!(await gameConfirm(`Comprare la sede "${n}" per ${euro(cost)}?`))) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("build_base", { p_name: n, p_lng: point.lng, p_lat: point.lat });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: err(error.message) }); return; }
    setMsg({ ok: true, text: `🏠 ${n} aperta! Ora puoi parcheggiarci nuove ambulanze dal Garage.` });
    setPoint(null); setName(""); setMapKey((k) => k + 1);
    load();
  }

  async function rent() {
    if (!point || !org) return;
    const n = name.trim() || `Sede ${bases.length + 1}`;
    if (!(await gameConfirm(`Affittare la sede "${n}"?\n\nPaghi ${euro(rentDaily)} al giorno (addebitati ogni ora), il primo giorno subito.\nPuoi riscattarla quando vuoi per ${euro(cost)} oppure restituirla.\nSe non hai i soldi per l'affitto, i mezzi di quella sede non partono finché non paghi.`))) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("rent_base", { p_name: n, p_lng: point.lng, p_lat: point.lat });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: err(error.message) }); return; }
    setMsg({ ok: true, text: `🔑 ${n} presa in affitto (${euro(rentDaily)} al giorno).` });
    setPoint(null); setName(""); setMapKey((k) => k + 1);
    load();
  }

  async function baseAction(fn: string, b: Base, confirm: string, ok: string) {
    if (!(await gameConfirm(confirm))) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc(fn, { p_base: b.id });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: err(error.message) }); return; }
    setMsg({ ok: true, text: ok });
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
          <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>Con ⚙️ Personalizza amplia il garage e aggiungi pannelli solari, caldaia, area volontari, officina, centrale radio, bar sociale e colore: rendono ogni ora o migliorano mezzi e volontari.</div>
          {msg && <div style={{ color: msg.ok ? "#15803D" : "#B91C1C", margin: "6px 0", fontWeight: 600 }}>{msg.text}</div>}
          {bases.map((b) => (
            <div key={b.id} style={{ padding: "8px 0", borderTop: "1px solid #f0f0f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 22, background: b.color ?? "transparent", borderRadius: 8, padding: b.color ? "0 4px" : 0 }}>{b.is_headquarters ? "🏛️" : "🏠"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{b.name}</div>
                {b.owner_name && <div style={{ fontSize: 12, color: "#0E7490", fontWeight: 700 }}>🤝 Sede di {b.owner_name}, condivisa con te: puoi ampliarla, migliorarla e metterci i tuoi mezzi</div>}
                {b.twin_name && <div style={{ fontSize: 12, color: "#0E7490", fontWeight: 700 }}>🤝 Condivisa con {b.twin_name}: anche lui può ampliarla e metterci i suoi mezzi</div>}
                <div style={{ fontSize: 13, color: "#666" }}>{b.is_headquarters ? "Sede centrale · " : ""}Livello {b.level} · 🚑 {parked[b.id] ?? 0}/{b.vehicle_capacity} posti</div>
                {b.rented && !b.owner_name && (
                  <div style={{ fontSize: 12, marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ background: "#EDE9FE", color: "#5B21B6", borderRadius: 999, padding: "1px 8px", fontWeight: 800 }}>🔑 In affitto · {euro(b.rent_daily ?? 0)}/giorno</span>
                    {b.rent_debt > 0 && <span style={{ color: "#B91C1C", fontWeight: 800 }}>⚠️ Affitto non pagato: {euro(b.rent_debt)} · i mezzi non partono</span>}
                    {b.rent_debt > 0 && <button disabled={busy || org.funds < b.rent_debt} onClick={() => baseAction("pay_base_rent_debt", b, `Pagare ${euro(b.rent_debt)} di affitto arretrato per ${b.name}?`, `✅ Affitto di ${b.name} pagato.`)}
                                              style={{ ...btn, fontSize: 12, padding: "4px 8px", background: "#B91C1C" }}>Paga</button>}
                    <button disabled={busy || org.funds < (b.rent_buy_price ?? 0) + b.rent_debt} onClick={() => baseAction("buyout_base", b, `Riscattare ${b.name} per ${euro((b.rent_buy_price ?? 0) + b.rent_debt)}?\n\nDiventa tua e non paghi più l'affitto.`, `🏠 ${b.name} ora è tua!`)}
                            style={{ ...btn, fontSize: 12, padding: "4px 8px", background: "#5B21B6", opacity: org.funds < (b.rent_buy_price ?? 0) + b.rent_debt ? 0.4 : 1 }}>Riscatta · {euro((b.rent_buy_price ?? 0) + b.rent_debt)}</button>
                    <button disabled={busy} onClick={() => baseAction("release_base", b, `Restituire ${b.name}?\n\nI mezzi e i volontari di questa sede tornano alla sede principale e non paghi più l'affitto.`, `🔑 ${b.name} restituita.`)}
                            style={{ ...btn, fontSize: 12, padding: "4px 8px", background: "#fff", color: "#5B21B6", border: "1px solid #5B21B6" }}>Restituisci</button>
                  </div>
                )}
              </div>
              {b.level < MAX_LEVEL ? (
                <button disabled={busy || org.funds < UPGRADE[b.level]} onClick={() => upgrade(b)}
                        title="Ogni livello aggiunge un posto per le ambulanze"
                        style={{ ...btn, fontSize: 13, padding: "8px 10px", background: "#15803D", whiteSpace: "nowrap",
                                 opacity: busy || org.funds < UPGRADE[b.level] ? 0.4 : 1 }}>
                  ⬆️ +1 posto · {euro(UPGRADE[b.level])}
                </button>
              ) : <span style={{ fontSize: 12, fontWeight: 700, color: "#B45309" }}>⭐ Livello massimo</span>}
              {!b.is_headquarters && !b.rented && !b.owner_name && (
                <button disabled={busy} onClick={() => sellBase(b)} title="Metti la sede all'asta"
                        style={{ ...btn, fontSize: 13, padding: "8px 10px", background: "#fff", color: "#B45309", border: "1px solid #B45309" }}>🏷️</button>
              )}
              <button onClick={() => setCustom(custom === b.id ? null : b.id)} title="Personalizza la sede"
                      style={{ ...btn, fontSize: 13, padding: "8px 10px", background: custom === b.id ? "#111" : "#7C3AED" }}>⚙️ Personalizza</button>
            </div>
            {custom === b.id && <BasePerksPanel base={b} funds={org.funds} onChange={load} />}
            </div>
          ))}
        </div>

        <div style={box}>
          <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Nuova sede: compra o affitta</div>
          <div style={{ fontSize: 14, color: "#555", marginBottom: 10 }}>
            🏠 <strong>Compra</strong>: {euro(cost)} una volta sola. Più sedi hai, più costa la prossima (massimo 3.000.000 €).
            <br />🔑 <strong>Affitta</strong>: {euro(rentDaily)} al giorno, addebitati ogni ora. Puoi riscattarla per {euro(cost)} o restituirla quando vuoi.
            Ogni sede ha i suoi posti per le ambulanze e le fa partire più vicino ai servizi.
            <br />Tocca la mappa (i pallini blu sono le tue sedi): serve stare <span style={{ color: "#6B7280" }}>almeno 500 m dalle sedi degli altri</span> (zone grigie).
          </div>
          <PickBaseMap key={mapKey} value={point} color="#F97316" onPick={setPoint} height={360} />
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={`Sede ${bases.length + 1}`}
                 style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc", fontSize: 16, margin: "12px 0", boxSizing: "border-box" }} />
          {msg && <div style={{ color: msg.ok ? "#15803D" : "#B91C1C", marginBottom: 10, fontWeight: 600 }}>{msg.text}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button disabled={!point || busy || org.funds < cost} onClick={buy}
                    style={{ ...btn, flex: 1, minWidth: 200, padding: 14, opacity: !point || busy || org.funds < cost ? 0.4 : 1 }}>
              {busy ? "Attendi…" : org.funds < cost ? `Per comprare servono ${euro(cost)}` : !point ? "Scegli il punto sulla mappa" : `🏠 Compra · ${euro(cost)}`}
            </button>
            {bases.length > 0 && (
              <button disabled={!point || busy || org.funds < rentDaily} onClick={rent}
                      style={{ ...btn, flex: 1, minWidth: 200, padding: 14, background: "#5B21B6", opacity: !point || busy || org.funds < rentDaily ? 0.4 : 1 }}>
                {busy ? "Attendi…" : !point ? "Scegli il punto sulla mappa" : `🔑 Affitta · ${euro(rentDaily)}/giorno`}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
