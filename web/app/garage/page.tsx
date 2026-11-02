"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase, friendlyError, livery, type Organization } from "@/lib/supabase";
import { ModelImage, BuilderLogo } from "@/components/VehicleArt";
import FactionEmblem, { FACTION_STYLES } from "@/components/FactionEmblem";
import EquipmentIcon from "@/components/EquipmentIcon";

type Model = { id: string; name: string; base_cost: number; speed_factor: number;
  base_reliability: number; base_durability: number; image_url: string | null; description: string | null;
  tank_liters: number; consumption_l100: number; electric?: boolean; range_km?: number | null; ability_label?: string | null };
type Builder = { id: string; name: string; cost: number; value_score: number; reliability: number;
  durability: number; certification: Cert; bonus: Record<string, number>; logo_url: string | null; description: string | null };
type Equip = { code: string; slot: string; category: string; name: string; cost: number; provides: string[];
  effects: { reward_mult?: number; on?: string; fatigue_mult?: number }; description: string | null; image_url: string | null; sort: number; starter: boolean };
type Base = { id: string; name: string; vehicle_capacity: number; is_headquarters: boolean };
type Vehicle = { id: string; call_sign: string; base_id: string; model_id: string; builder_id: string;
  certification: Cert; reliability: number; durability: number; value_score: number; wear: number;
  status: "disponibile" | "in_servizio" | "manutenzione" | "fuori_servizio"; maintenance_until: string | null; equipment: string[];
  speed_level?: number; fuel_liters: number; battery_pct?: number };
const SPEED_COST = [6000, 12000, 24000];
type Cert = "trasporto" | "base" | "avanzata_rianimazione";

const CERT: Record<Cert, { label: string; color: string }> = {
  trasporto: { label: "Trasporto", color: "#3B82F6" },
  base: { label: "Emergenza", color: "#EAB308" },
  avanzata_rianimazione: { label: "Rianimazione", color: "#DC2626" },
};
const STATUS: Record<Vehicle["status"], string> = {
  disponibile: "Disponibile", in_servizio: "In servizio", manutenzione: "In manutenzione", fuori_servizio: "🏷️ All'asta (Ambulanze usate)",
};
// Gruppi di presidi: scelta singola per slot, oppure multipla (immobilizzazione)
const GROUPS: { key: string; title: string; required: boolean; multi: boolean }[] = [
  { key: "monitor", title: "Defibrillatore / cardiomonitor", required: true, multi: false },
  { key: "barella", title: "Barella", required: true, multi: false },
  { key: "borsoni", title: "Borsoni emergenza", required: false, multi: false },
  { key: "massaggiatore", title: "Massaggiatore automatico", required: false, multi: false },
  { key: "immobilizzazione", title: "Immobilizzazione", required: false, multi: true },
];
const CAN: Record<string, string> = {
  emergenza: "Emergenze 118", defib: "Codici rossi", ecg: "Servizi ECG",
  spinale: "Incidenti stradali", ked: "Incastrati", spinale_ped: "Traumi pediatrici",
  cucchiaio: "Cadute dall'alto", steccobende: "Fratture",
};
const euro = (n: number) => n.toLocaleString("it-IT") + " €";
const litri = (n: number) => (Math.round(n * 10) / 10).toLocaleString("it-IT") + " L";
const RISERVA = 5; // sotto questi litri il mezzo non parte

const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 980, margin: "0 auto", padding: 16 };
const box: CSSProperties = { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)" };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 };
const btn: CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "none", background: "#111", color: "#fff",
  fontWeight: 600, cursor: "pointer", fontSize: 15 };

function Bar({ label, value, color = "#111" }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><span>{label}</span><span>{Math.round(value)}</span></div>
      <div style={{ height: 6, background: "#eee", borderRadius: 3 }}>
        <div style={{ width: `${Math.min(100, value)}%`, height: 6, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function Pill({ cert }: { cert: Cert }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, color: "#fff",
                        background: CERT[cert].color }}>{CERT[cert].label}</span>;
}

export default function Garage() {
  const router = useRouter();
  const [org, setOrg] = useState<Organization | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [equip, setEquip] = useState<Equip[]>([]);
  const [picked, setPicked] = useState<Partial<Record<string, string>>>({});
  const [shop, setShop] = useState(false);
  const [modelId, setModelId] = useState<string | null>(null);
  const [builderId, setBuilderId] = useState<string | null>(null);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [callSign, setCallSign] = useState("");
  const [qty, setQty] = useState(1);
  const [power, setPower] = useState<"gasolio" | "elettrica">("gasolio");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [fuelStock, setFuelStock] = useState(0);
  const [fuelPrice, setFuelPrice] = useState<{ price_eur: number; source: string | null } | null>(null);
  const [liters, setLiters] = useState(100);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); return; }
    const { data: o } = await supabase.from("organizations").select("id,name,type,funds,reputation,logo_url")
      .eq("owner_id", session.user.id).maybeSingle();
    if (!o) { router.replace("/onboarding"); return; }
    setOrg(o as Organization);
    const [m, b, bs, v, e, fs, fp] = await Promise.all([
      supabase.from("vehicle_models").select("*").eq("is_active", true).order("base_cost"),
      supabase.from("builders").select("*").eq("is_active", true).order("cost"),
      supabase.from("bases").select("id,name,vehicle_capacity,is_headquarters").eq("org_id", o.id).order("built_at"),
      supabase.from("vehicles").select("*").eq("org_id", o.id).order("created_at"),
      supabase.from("equipment").select("*").order("slot").order("sort"),
      supabase.from("organizations").select("fuel_stock").eq("id", o.id).maybeSingle(),
      supabase.from("fuel_prices").select("price_eur,source").eq("fuel", "gasolio").maybeSingle(),
    ]);
    setFuelStock(Number(fs.data?.fuel_stock ?? 0));
    setFuelPrice(fp.data ? { price_eur: Number(fp.data.price_eur), source: fp.data.source } : null);
    setEquip((e.data as Equip[]) ?? []);
    setModels((m.data as Model[]) ?? []);
    setBuilders((b.data as Builder[]) ?? []);
    setBases((bs.data as Base[]) ?? []);
    setVehicles((v.data as Vehicle[]) ?? []);
    if (bs.data?.length) setBaseId((cur) => cur ?? (bs.data as Base[])[0].id);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const model = models.find((m) => m.id === modelId);
  const builder = builders.find((b) => b.id === builderId);
  const pickedCodes = Object.values(picked).filter(Boolean) as string[];
  const firstVehicle = vehicles.length === 0;
  const priceOf = (e: Equip) => (firstVehicle && e.starter ? 0 : e.cost);
  const eqCost = equip.filter((e) => pickedCodes.includes(e.code)).reduce((t, e) => t + priceOf(e), 0);
  const total = (model?.base_cost ?? 0) + (builder?.cost ?? 0) + eqCost;
  const ready = !!model && !!builder && !!picked.monitor && !!picked.barella;
  const caps = Array.from(new Set(equip.filter((e) => pickedCodes.includes(e.code)).flatMap((e) => e.provides)));
  const eqName = (c: string) => equip.find((e) => e.code === c)?.name ?? c;
  const stripe = FACTION_STYLES.find((s) => s.type === org?.type)?.colors[0] ?? "#F97316";
  const byId = useMemo(() => ({
    model: Object.fromEntries(models.map((m) => [m.id, m])),
    builder: Object.fromEntries(builders.map((b) => [b.id, b])),
    base: Object.fromEntries(bases.map((b) => [b.id, b])),
  }), [models, builders, bases]);

  function openShop() {
    setShop(true); setMsg(null); setModelId(null); setBuilderId(null);
    setPicked(vehicles.length === 0
      ? { monitor: "dae", barella: "barella_std", borsoni: "borsoni", spinale: "spinale", collari: "collari" }
      : { monitor: "dae", barella: "barella_std", borsoni: "borsoni" });
    setCallSign(`Alfa ${vehicles.length + 1}`);
  }

  // sigle per più mezzi uguali: "Alfa 1", "Alfa 2"… (se finisce con un numero lo incrementa)
  function signs(base: string, n: number) {
    const b = base.trim(); const m = b.match(/^(.*?)(\d+)$/);
    return Array.from({ length: n }, (_, i) => {
      if (i === 0) return b;
      return m ? `${m[1]}${Number(m[2]) + i}` : `${b.slice(0, 17)} ${i + 1}`;
    });
  }

  async function buy() {
    if (!ready || !model || !builder || !baseId) return;
    setBusy(true); setMsg(null);
    const list = signs(callSign, qty);
    const done: string[] = [];
    let err: string | null = null;
    for (const cs of list) {
      const { error } = await supabase.rpc("buy_vehicle", {
        p_model_id: model.id, p_builder_id: builder.id, p_base_id: baseId, p_call_sign: cs,
        p_equipment: pickedCodes,
      });
      if (error) { err = `${cs}: ${garageError(error.message)}`; break; }
      done.push(cs);
    }
    setBusy(false);
    if (!done.length) { setMsg({ ok: false, text: err ?? "Errore" }); return; }
    setMsg({ ok: !err, text: (done.length === 1 ? `${done[0]} è in garage!` : `${done.length} ambulanze in garage: ${done.join(", ")}`)
      + (err ? ` — fermato: ${err}` : "") });
    setShop(false); setQty(1);
    load();
  }


  // Cambia il nome dell'ambulanza (deve essere unico tra tutti i giocatori)
  async function rename(v: Vehicle) {
    const name = window.prompt("Nuovo nome dell'ambulanza (2-20 caratteri):", v.call_sign);
    if (name === null || name.trim() === v.call_sign) return;
    setMsg(null);
    const { error } = await supabase.rpc("rename_vehicle", { p_vehicle: v.id, p_name: name });
    if (error) { setMsg({ ok: false, text: garageError(error.message) }); return; }
    setMsg({ ok: true, text: `Ora si chiama ${name.trim().replace(/\s+/g, " ")}.` });
    load();
  }

  // Sposta l'ambulanza in un'altra delle tue sedi
  async function move(v: Vehicle, baseId: string) {
    if (baseId === v.base_id) return;
    setMsg(null);
    const { error } = await supabase.rpc("move_vehicle", { p_vehicle: v.id, p_base: baseId });
    if (error) {
      const m = error.message;
      setMsg({ ok: false, text: m.includes("VEHICLE_BUSY") ? "È in servizio: spostala quando si libera."
        : m.includes("VEHICLE_LENT") ? "È in prestito a un alleato: riprendila prima."
        : garageError(m) });
      return;
    }
    setMsg({ ok: true, text: `${v.call_sign} ora è a ${byId.base[baseId]?.name}.` });
    load();
  }

  // Potenziamento velocità: più veloce in strada e sul posto (3 livelli)
  async function upgradeSpeed(v: Vehicle) {
    const lvl = v.speed_level ?? 0;
    if (lvl >= 3) return;
    const cost = SPEED_COST[lvl];
    if (!window.confirm(`Potenziare ${v.call_sign} al livello ${lvl + 1} per ${cost.toLocaleString("it-IT")} €?\n\n+12% velocità in strada e -12% di tempo sul posto per ogni livello.`)) return;
    setMsg(null);
    const { error } = await supabase.rpc("upgrade_vehicle_speed", { p_vehicle: v.id });
    if (error) { setMsg({ ok: false, text: garageError(error.message) }); return; }
    setMsg({ ok: true, text: `⚡ ${v.call_sign} ora è al livello ${lvl + 1}: più veloce!` });
    load();
  }

  // Benzinaio: compra gasolio per la cisterna dell'associazione
  async function buyFuel() {
    if (!liters || liters < 1) return;
    setMsg(null);
    const { data, error } = await supabase.rpc("buy_fuel", { p_liters: Math.floor(liters) });
    if (error) { setMsg({ ok: false, text: garageError(error.message) }); return; }
    const r = data as { liters: number; cost: number };
    setMsg({ ok: true, text: `⛽ Comprati ${litri(r.liters)} di gasolio per ${euro(r.cost)}.` });
    load();
  }

  // Pieno dalla cisterna: a un mezzo o a tutti
  async function refuel(v: Vehicle | null) {
    setMsg(null);
    const { data, error } = await supabase.rpc("refuel", { p_vehicle: v?.id ?? null });
    if (error) { setMsg({ ok: false, text: garageError(error.message) }); return; }
    setMsg({ ok: true, text: `⛽ ${v ? v.call_sign : "Mezzi"}: messi ${litri(Number(data))} nel serbatoio.` });
    load();
  }

  // Mette il mezzo all'asta nella sezione "Ambulanze usate"
  async function sell(v: Vehicle) {
    setMsg(null);
    const { data: mv } = await supabase.rpc("vehicle_market_value", { p_vehicle: v.id });
    const market = Number(mv ?? 0);
    const txt = window.prompt(
      `Vendi ${v.call_sign} all'asta.\nValore di mercato: ${euro(market)}.\n` +
      `Se in 30 minuti nessuno fa offerte, la ritira il concessionario a ${euro(Math.round(market * 0.6))} (60%).\n\nPrezzo di partenza (€):`,
      String(Math.round(market * 0.8)));
    if (txt === null) return;
    const price = parseInt(txt.replace(/[^0-9]/g, ""), 10);
    if (!price || price < 1) { setMsg({ ok: false, text: "Prezzo non valido." }); return; }
    const { error } = await supabase.rpc("create_auction", { p_vehicle: v.id, p_start_price: price, p_minutes: 30 });
    if (error) { setMsg({ ok: false, text: error.message.includes("VEHICLE_BUSY") ? "Il mezzo deve essere libero in sede (non in servizio, in officina o in prestito)." : garageError(error.message) }); return; }
    setMsg({ ok: true, text: `🏷️ ${v.call_sign} è all'asta per 30 minuti in "Ambulanze usate".` });
    load();
  }

  async function maintain(v: Vehicle) {
    setMsg(null);
    const { error } = await supabase.rpc("start_maintenance", { p_vehicle_id: v.id });
    if (error) { setMsg({ ok: false, text: garageError(error.message) }); return; }
    setMsg({ ok: true, text: `${v.call_sign} è in officina.` });
    load();
  }

  if (!org) return <main style={shell} />;

  return (
    <main style={shell}>
      {/* Testata */}
      <div style={{ background: "#111", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={() => router.push("/")} style={{ ...btn, background: "#333", padding: "8px 12px" }}>← Mappa</button>
          <FactionEmblem type={org.type} size={32} logo={org.logo_url} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Garage · {org.name}</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>{euro(org.funds)}</div>
          </div>
          <button onClick={() => router.push("/sedi")} style={{ ...btn, background: "#333" }}>🏠 Sedi</button>
          <button onClick={() => router.push("/negozio")} style={{ ...btn, background: "#333" }}>🛒 Presidi</button>
          <button onClick={() => router.push("/usate")} style={{ ...btn, background: "#333" }}>🏷️ Usate</button>
          {!shop && <button onClick={openShop} style={{ ...btn, background: "#F97316" }}>+ Nuovo mezzo</button>}
        </div>
      </div>

      <div style={wrap}>
        {msg && (
          <div style={{ ...box, marginBottom: 12, background: msg.ok ? "#effaf1" : "#fff1f1",
                        color: msg.ok ? "#166534" : "#a00" }}>{msg.text}</div>
        )}

        {/* Acquisto */}
        {shop && (
          <div style={{ ...box, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>Nuovo mezzo</h2>
              <button onClick={() => setShop(false)} style={{ ...btn, background: "#eee", color: "#111" }}>Annulla</button>
            </div>

            <h3 style={{ marginBottom: 8 }}>1. Modello</h3>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {([["gasolio", "⛽ Gasolio"], ["elettrica", "⚡ Elettriche"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => { setPower(k); setModelId(null); }}
                        style={{ ...btn, padding: "8px 14px", background: power === k ? (k === "elettrica" ? "#16A34A" : "#111") : "#e5e5e0",
                                 color: power === k ? "#fff" : "#111" }}>{l}</button>
              ))}
            </div>
            {power === "elettrica" && (
              <div style={{ fontSize: 13, background: "#DCFCE7", color: "#166534", borderRadius: 10, padding: 10, marginBottom: 10 }}>
                ⚡ Niente gasolio: si ricaricano in <strong>1 minuto</strong> quando sono ferme in sede, pagando la corrente al prezzo reale (0,74 €/kWh, circa 30 € per un pieno).
                Hanno però poca autonomia: se il servizio (andata e ritorno) è più lungo della carica rimasta, non partono.
              </div>
            )}
            <div style={grid}>
              {models.filter((m) => (power === "elettrica") === !!m.electric).map((m) => (
                <button key={m.id} onClick={() => setModelId(m.id)}
                        style={{ ...box, textAlign: "left", cursor: "pointer",
                                 border: modelId === m.id ? "3px solid #111" : "1px solid #e5e5e0" }}>
                  <div style={{ textAlign: "center" }}><ModelImage name={m.name} url={livery(m.image_url, org.type)} stripe={stripe} /></div>
                  <div style={{ fontWeight: 700, marginTop: 6 }}>{m.name}</div>
                  <div style={{ fontSize: 13, color: "#666", minHeight: 34 }}>{m.description}</div>
                  {m.ability_label && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1E40AF", background: "#EFF6FF", borderRadius: 8, padding: "4px 8px", margin: "4px 0" }}>
                      {m.ability_label}
                    </div>
                  )}
                  <Bar label="Velocità" value={m.speed_factor * 80} color="#3B82F6" />
                  <Bar label="Affidabilità" value={m.base_reliability} color="#16A34A" />
                  <Bar label="Durata" value={m.base_durability} color="#9333EA" />
                  {m.electric && <Bar label={`Autonomia ${m.range_km ?? 0} km`} value={Math.min(100, ((m.range_km ?? 0) / 150) * 100)} color="#16A34A" />}
                  <div style={{ fontWeight: 700, marginTop: 8 }}>{euro(m.base_cost)}</div>
                </button>
              ))}
            </div>

            <h3 style={{ marginBottom: 8 }}>2. Allestitore</h3>
            <div style={grid}>
              {builders.map((b) => (
                <button key={b.id} onClick={() => setBuilderId(b.id)}
                        style={{ ...box, textAlign: "left", cursor: "pointer",
                                 border: builderId === b.id ? "3px solid #111" : "1px solid #e5e5e0" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <BuilderLogo name={b.name} url={b.logo_url} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{b.name}</div>
                      <Pill cert={b.certification} />
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "#666", marginTop: 8, minHeight: 34 }}>{b.description}</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    Affidabilità +{b.reliability} · Durata +{b.durability}
                    {b.bonus?.reward_mult ? ` · Ricompense +${Math.round(b.bonus.reward_mult * 100)}%` : ""}
                  </div>
                  <div style={{ fontWeight: 700, marginTop: 8 }}>{euro(b.cost)}</div>
                </button>
              ))}
            </div>

            <h3 style={{ marginBottom: 8 }}>3. Presidi</h3>
            {firstVehicle && (
              <div style={{ background: "#effaf1", color: "#166534", borderRadius: 10, padding: 10, fontSize: 14, marginBottom: 12 }}>
                🎁 <strong>Primo mezzo:</strong> DAE, barella standard, borsoni, tavola spinale e collari sono inclusi gratis.
                Se vuoi qualcosa di meglio, gli upgrade si pagano.
              </div>
            )}
            {GROUPS.map(({ key, title, required, multi }) => {
              const opts = equip.filter((e) => (multi ? e.category === key : e.slot === key));
              if (!opts.length) return null;
              const card = (e: Equip, on: boolean, onClick: () => void) => (
                <button key={e.code} onClick={onClick}
                        style={{ ...box, padding: 12, textAlign: "left", cursor: "pointer",
                                 border: on ? "3px solid #111" : "1px solid #e5e5e0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <EquipmentIcon code={e.code} url={e.image_url} size={48} />
                    {multi && <span style={{ fontSize: 20 }}>{on ? "✅" : "⬜"}</span>}
                  </div>
                  <div style={{ fontWeight: 700 }}>{e.name}</div>
                  <div style={{ fontSize: 13, color: "#666", margin: "4px 0" }}>{e.description}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: priceOf(e) === 0 ? "#166534" : undefined }}>
                    {priceOf(e) === 0 ? "Incluso" : euro(e.cost)}
                  </div>
                </button>
              );
              return (
                <div key={key} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                    {title} {required ? <span style={{ color: "#DC2626" }}>*</span>
                      : <span style={{ color: "#888", fontWeight: 400 }}>{multi ? "(scegli quelli che vuoi)" : "(facoltativo)"}</span>}
                  </div>
                  <div style={grid}>
                    {!required && !multi && (
                      <button onClick={() => setPicked((p) => ({ ...p, [key]: undefined }))}
                              style={{ ...box, padding: 12, textAlign: "left", cursor: "pointer",
                                       border: !picked[key] ? "3px solid #111" : "1px solid #e5e5e0" }}>
                        <div style={{ fontWeight: 700 }}>Nessuno</div>
                        <div style={{ fontSize: 13, color: "#666" }}>0 €</div>
                      </button>
                    )}
                    {opts.map((e) => multi
                      ? card(e, !!picked[e.slot], () => setPicked((p) => ({ ...p, [e.slot]: p[e.slot] ? undefined : e.code })))
                      : card(e, picked[key] === e.code, () => setPicked((p) => ({ ...p, [key]: e.code }))))}
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: 14, background: "#f6f6f4", borderRadius: 10, padding: 10 }}>
              <strong>Questo mezzo potrà fare:</strong> Trasporti
              {caps.filter((c) => CAN[c]).map((c) => ` · ${CAN[c]}`).join("")}
              {!caps.includes("ecg") && caps.includes("emergenza") &&
                <div style={{ color: "#a16207", marginTop: 4 }}>Con il solo DAE non puoi fare i servizi ECG: serve un cardiomonitor.</div>}
            </div>

            <h3 style={{ marginBottom: 8 }}>4. Sigla e sede</h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input value={callSign} onChange={(e) => setCallSign(e.target.value)} maxLength={20} placeholder="Sigla (es. Alfa 1)"
                     style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", fontSize: 15, flex: "1 1 180px" }} />
              <select value={qty} onChange={(e) => setQty(Number(e.target.value))} title="Quante ambulanze uguali"
                      style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", fontSize: 15, flex: "0 0 auto" }}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? "1 mezzo" : `${n} mezzi uguali`}</option>)}
              </select>
              {bases.length > 1 && (
                <select value={baseId ?? ""} onChange={(e) => setBaseId(e.target.value)}
                        style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", fontSize: 15, flex: "1 1 180px" }}>
                  {bases.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16,
                          borderTop: "1px solid #eee", paddingTop: 12, gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 13, color: "#666" }}>Totale{qty > 1 && ` (${qty} × ${euro(total)})`}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: total * qty > org.funds ? "#DC2626" : "#111" }}>{euro(total * qty)}</div>
                {qty > 1 && <div style={{ fontSize: 12, color: "#666" }}>Sigle: {signs(callSign, qty).join(", ")}</div>}
              </div>
              <button onClick={buy} disabled={!ready || busy || total * qty > org.funds}
                      style={{ ...btn, background: "#F97316", opacity: !ready || busy || total * qty > org.funds ? 0.4 : 1 }}>
                {busy ? "Acquisto…" : total * qty > org.funds ? "Fondi insufficienti" : qty > 1 ? `Compra ${qty}` : "Compra"}
              </button>
            </div>
          </div>
        )}

        {/* Benzinaio */}
        {(() => {
          const cap = 1000 * Math.max(1, bases.length);
          const price = fuelPrice?.price_eur ?? 0;
          const room = Math.max(0, Math.floor(cap - fuelStock));
          const qtyL = Math.min(Math.max(0, Math.floor(liters || 0)), room);
          const cost = Math.ceil(qtyL * price);
          const needFull = vehicles.filter((v) => !byId.model[v.model_id]?.electric).reduce((t, v) => t + Math.max(0, (byId.model[v.model_id]?.tank_liters ?? 80) - v.fuel_liters), 0);
          return (
            <div style={{ ...box, marginTop: 16, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                <h2 style={{ margin: 0 }}>⛽ Benzinaio</h2>
                <span style={{ fontSize: 14 }}>Gasolio self: <strong>{price.toLocaleString("it-IT", { minimumFractionDigits: 3 })} €/L</strong></span>
              </div>
              {fuelPrice?.source && <div style={{ fontSize: 12, color: "#888" }}>Prezzo reale · {fuelPrice.source}</div>}
              <Bar label={`Cisterna: ${litri(fuelStock)} su ${litri(cap)}`} value={(fuelStock / cap) * 100} color="#0EA5E9" />
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                {[50, 100, 250, 500].map((n) => (
                  <button key={n} onClick={() => setLiters(n)}
                          style={{ ...btn, padding: "6px 10px", fontSize: 13, background: liters === n ? "#0EA5E9" : "#eee", color: liters === n ? "#fff" : "#111" }}>
                    {n} L
                  </button>
                ))}
                <input type="number" min={1} max={room} value={liters} onChange={(e) => setLiters(Number(e.target.value))}
                       style={{ width: 90, padding: "7px 8px", borderRadius: 8, border: "1px solid #ccc", fontSize: 14 }} />
                <span style={{ fontSize: 14 }}>litri</span>
                <button onClick={buyFuel} disabled={qtyL < 1 || cost > org.funds}
                        style={{ ...btn, background: "#0EA5E9", opacity: qtyL < 1 || cost > org.funds ? 0.4 : 1 }}>
                  Compra {litri(qtyL)} · {euro(cost)}
                </button>
              </div>
              {liters > room && <div style={{ fontSize: 12, color: "#a00", marginTop: 4 }}>La cisterna ha posto solo per {litri(room)}.</div>}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                <button onClick={() => refuel(null)} disabled={fuelStock <= 0 || needFull <= 0}
                        style={{ ...btn, opacity: fuelStock <= 0 || needFull <= 0 ? 0.4 : 1 }}>
                  Pieno a tutti i mezzi
                </button>
                <span style={{ fontSize: 13, color: "#666" }}>
                  {needFull > 0 ? `Servono ${litri(needFull)} per riempire tutti i serbatoi.` : "Tutti i serbatoi sono pieni."}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                Ogni servizio consuma gasolio in base ai km. Sotto {RISERVA} litri il mezzo resta in sede. In modalità automatica il pieno si fa da solo dalla cisterna.
              </div>
            </div>
          );
        })()}

        {/* I miei mezzi */}
        <h2>I tuoi mezzi</h2>
        {vehicles.length === 0 ? (
          <div style={{ ...box, textAlign: "center", color: "#666" }}>
            Il garage è vuoto. Compra il primo mezzo per iniziare a prendere servizi.
          </div>
        ) : (
          <div style={grid}>
            {vehicles.map((v) => {
              const m = byId.model[v.model_id];
              const b = byId.builder[v.builder_id];
              const cost = Math.round(v.wear * v.value_score * 2);
              return (
                <div key={v.id} style={box}>
                  <div style={{ textAlign: "center" }}><ModelImage name={m?.name ?? ""} url={livery(m?.image_url, org.type)} stripe={stripe} height={80} /></div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <strong style={{ fontSize: 17 }}>
                      {v.call_sign}{" "}
                      <button onClick={() => rename(v)} title="Cambia nome"
                              style={{ border: "none", background: "#f1f1f1", borderRadius: 6, padding: "2px 6px", cursor: "pointer", fontSize: 13 }}>✏️</button>
                    </strong>
                    <Pill cert={v.certification} />
                  </div>
                  <div style={{ fontSize: 13, color: "#666" }}>{m?.name} · {b?.name}</div>
                  <div style={{ fontSize: 13, color: "#666", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    🏠 {bases.length > 1 ? (
                      <select value={v.base_id} onChange={(e) => move(v, e.target.value)}
                              style={{ fontSize: 13, padding: "3px 6px", borderRadius: 8, border: "1px solid #ccc", background: "#fff" }}>
                        {bases.map((bs) => <option key={bs.id} value={bs.id}>{bs.name}</option>)}
                      </select>
                    ) : byId.base[v.base_id]?.name}
                  </div>
                  {(() => {
                    const lvl = v.speed_level ?? 0;
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>⚡ Velocità</span>
                        <span style={{ display: "inline-flex", gap: 3 }}>
                          {[0, 1, 2].map((i) => (
                            <span key={i} style={{ width: 18, height: 8, borderRadius: 3, background: i < lvl ? "#F97316" : "#e5e5e0" }} />
                          ))}
                        </span>
                        {lvl < 3 ? (
                          <button onClick={() => upgradeSpeed(v)}
                                  style={{ border: "none", background: "#F97316", color: "#fff", borderRadius: 8, padding: "4px 10px",
                                           fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            Migliora · {SPEED_COST[lvl].toLocaleString("it-IT")} €
                          </button>
                        ) : <span style={{ fontSize: 12, color: "#15803D", fontWeight: 700 }}>Massimo! 🏁</span>}
                      </div>
                    );
                  })()}
                  {v.equipment?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "6px 0" }}>
                      {v.equipment.map((c) => (
                        <span key={c} title={eqName(c)} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11,
                                                                 background: "#f0f0ec", borderRadius: 6, padding: "2px 6px" }}>
                          <EquipmentIcon code={c} url={equip.find((e) => e.code === c)?.image_url} size={18} />{eqName(c)}
                        </span>
                      ))}
                    </div>
                  )}
                  <Bar label="Affidabilità" value={v.reliability} color="#16A34A" />
                  <Bar label="Durata" value={v.durability} color="#9333EA" />
                  <Bar label="Usura" value={v.wear} color={v.wear >= 80 ? "#DC2626" : v.wear >= 50 ? "#EAB308" : "#999"} />
                  {m?.electric ? (() => {
                    const pct = Math.max(0, Math.min(100, Number(v.battery_pct ?? 100)));
                    const km = Math.round((pct / 100) * (m.range_km ?? 0));
                    return (
                      <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>{pct < 100 ? "🔌" : "🔋"} Batteria{pct < 100 && v.status !== "in_servizio" ? " · in ricarica" : ""}</span>
                          <span>{Math.round(pct)}% · {km} / {m.range_km ?? 0} km</span>
                        </div>
                        <div style={{ height: 6, background: "#eee", borderRadius: 3 }}>
                          <div style={{ width: `${pct}%`, height: 6, borderRadius: 3,
                                        background: pct < 20 ? "#DC2626" : pct < 50 ? "#EAB308" : "#16A34A" }} />
                        </div>
                        <div style={{ color: "#15803D", marginTop: 3 }}>⚡ Si ricarica in 1 minuto in sede · 0,74 €/kWh</div>
                      </div>
                    );
                  })() : (() => {
                    const tank = m?.tank_liters ?? 80;
                    const pct = (v.fuel_liters / tank) * 100;
                    return (
                      <>
                        <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>⛽ Gasolio{v.fuel_liters < RISERVA ? " · IN RISERVA" : ""}</span>
                            <span>{litri(v.fuel_liters)} / {tank} L</span>
                          </div>
                          <div style={{ height: 6, background: "#eee", borderRadius: 3 }}>
                            <div style={{ width: `${Math.min(100, pct)}%`, height: 6, borderRadius: 3,
                                          background: v.fuel_liters < RISERVA ? "#DC2626" : pct < 25 ? "#EAB308" : "#0EA5E9" }} />
                          </div>
                        </div>
                        {v.fuel_liters < tank - 0.5 && v.status !== "in_servizio" && (
                          <button onClick={() => refuel(v)} disabled={fuelStock <= 0}
                                  style={{ ...btn, width: "100%", marginTop: 8, background: v.fuel_liters < RISERVA ? "#DC2626" : "#0EA5E9",
                                           opacity: fuelStock <= 0 ? 0.4 : 1 }}>
                            {fuelStock <= 0 ? "Cisterna vuota: compra gasolio" : `Fai il pieno · ${litri(Math.min(tank - v.fuel_liters, fuelStock))}`}
                          </button>
                        )}
                      </>
                    );
                  })()}
                  <div style={{ fontSize: 13, marginTop: 8 }}>
                    {STATUS[v.status]}
                    {v.status === "manutenzione" && v.maintenance_until &&
                      ` fino alle ${new Date(v.maintenance_until).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`}
                  </div>
                  {v.status === "disponibile" && v.wear > 0 && (
                    <button onClick={() => maintain(v)} disabled={cost > org.funds}
                            style={{ ...btn, width: "100%", marginTop: 8, background: v.wear >= 80 ? "#DC2626" : "#111",
                                     opacity: cost > org.funds ? 0.4 : 1 }}>
                      Manutenzione · {euro(cost)}
                    </button>
                  )}
                  {v.status === "disponibile" && (
                    <button onClick={() => sell(v)}
                            style={{ ...btn, width: "100%", marginTop: 8, background: "#fff", color: "#B45309", border: "1px solid #B45309" }}>
                      🏷️ Vendi all&apos;asta
                    </button>
                  )}
                  {v.status === "fuori_servizio" && (
                    <button onClick={() => router.push("/usate")}
                            style={{ ...btn, width: "100%", marginTop: 8, background: "#B45309" }}>🏷️ Vedi l&apos;asta</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function garageError(m: string) {
  if (m.includes("BASE_FULL")) return "Il garage della sede è pieno: potenzia la sede o costruiscine un'altra.";
  if (m.includes("NEED_ONE_MONITOR")) return "Scegli un defibrillatore o un cardiomonitor.";
  if (m.includes("NEED_ONE_STRETCHER")) return "Scegli una barella.";
  if (m.includes("BAD_CALL_SIGN")) return "Il nome deve avere tra 2 e 20 caratteri.";
  if (m.includes("CALL_SIGN_TAKEN") || m.includes("vehicles_call_sign_unique"))
    return "Questo nome è già usato da un'altra ambulanza: scegline uno diverso.";
  if (m.includes("VEHICLE_BUSY")) return "Il mezzo è impegnato.";
  if (m.includes("MAX_LEVEL")) return "È già al livello massimo.";
  if (m.includes("TANK_TOO_SMALL")) return `La cisterna è quasi piena: c'è posto solo per ${m.split("TANK_TOO_SMALL:")[1]?.split(/\D/)[0] ?? "pochi"} litri.`;
  if (m.includes("NO_FUEL_STOCK")) return "La cisterna è vuota: compra prima il gasolio al benzinaio.";
  if (m.includes("TANK_FULL")) return "Il serbatoio è già pieno.";
  if (m.includes("BAD_LITERS")) return "Scegli quanti litri comprare.";
  if (m.includes("buy_vehicle") || m.includes("function")) return "Il garage non è ancora attivo nel database.";
  return friendlyError(m);
}
