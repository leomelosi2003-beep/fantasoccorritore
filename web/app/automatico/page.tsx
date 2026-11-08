"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Log = { assigned_at: string; title: string; code: string; call_sign: string; status: string; reward: number | null; completes_at: string };

const CODES = [
  { key: "rosso", label: "Codici rossi", hint: "Incidenti gravi, arresti cardiaci", color: "#DC2626" },
  { key: "giallo", label: "Codici gialli", hint: "Malori, dolori toracici, traumi", color: "#CA8A04" },
  { key: "verde", label: "Codici verdi", hint: "Cadute, fratture", color: "#16A34A" },
  { key: "ordinari", label: "Servizi ordinari", hint: "Dialisi e dimissioni", color: "#3B82F6" },
  { key: "trasferimenti", label: "Trasferimenti", hint: "Tra ospedali, anche fuori regione", color: "#0E7490" },
];
// Turni delle sedi in automatico (migr. 188): bit 1=8-14, 2=14-20, 4=20-24, 8=0-8; H24 = tutti (max 3 sedi)
const SHIFTS = [
  { bit: 1, label: "8–14", icon: "🌅" }, { bit: 2, label: "14–20", icon: "☀️" },
  { bit: 4, label: "20–24", icon: "🌆" }, { bit: 8, label: "0–8", icon: "🌙" },
];
const H24 = 15, MAX_H24 = 3;
const SHIFT_HOURS: Record<number, number> = { 1: 6, 2: 6, 4: 4, 8: 8 };
type Prices = { base_hour: number; now_hour: number; current_shift: number; day_estimate: number };
const CODE_DOT: Record<string, string> = { rosso: "#DC2626", giallo: "#CA8A04", verde: "#16A34A", nessuno: "#3B82F6" };
const STATUS: Record<string, string> = { in_viaggio: "🚑 in viaggio", sul_posto: "📍 sul posto", conclusa: "✅ concluso", annullata: "↩️ annullato" };

const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 760, margin: "0 auto", padding: 16 };
const card: CSSProperties = { background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", padding: 16, marginBottom: 14 };

export default function Automatico() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [reserve, setReserve] = useState(0);
  const [steal, setSteal] = useState(false);
  const [maxKm, setMaxKm] = useState(10);
  const [refill, setRefill] = useState(false);
  const [paidUntil, setPaidUntil] = useState<string | null>(null);
  const [hourCost, setHourCost] = useState<number | null>(null);
  const [fleet, setFleet] = useState(0);
  const [bases, setBases] = useState<{ id: string; name: string; is_headquarters: boolean }[]>([]);
  const [autoBases, setAutoBases] = useState<string[]>([]);
  const [shifts, setShifts] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Prices | null>(null);
  const loadShifts = async () => {
    const [{ data: sh }, { data: pr }] = await Promise.all([
      supabase.from("auto_shifts").select("base_id,shifts"), supabase.rpc("my_auto_prices"),
    ]);
    setShifts(Object.fromEntries(((sh as { base_id: string; shifts: number }[]) ?? []).map((x) => [x.base_id, x.shifts])));
    if (pr) setPrices(pr as Prices);
  };
  const [ambulances, setAmbulances] = useState<{ id: string; call_sign: string; base_name: string | null; only: boolean }[]>([]);
  const [log, setLog] = useState<Log[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadLog() {
    const { data } = await supabase.rpc("my_auto_log");
    setLog((data as Log[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const { data: o } = await supabase.from("organizations").select("id,auto_enabled,auto_codes,auto_reserve,auto_steal_red,auto_max_km,auto_refill,auto_paid_until,auto_base_ids")
        .eq("owner_id", session.user.id).maybeSingle();
      if (o) {
        setEnabled(!!o.auto_enabled); setCodes(o.auto_codes ?? []); setReserve(o.auto_reserve ?? 0); setSteal(!!o.auto_steal_red); setMaxKm(o.auto_max_km ?? 10); setRefill(!!o.auto_refill); setPaidUntil(o.auto_paid_until ?? null);
        setAutoBases(o.auto_base_ids ?? []);
        const [{ count }, { data: bs }] = await Promise.all([
          supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("org_id", o.id),
          supabase.from("bases").select("id,name,is_headquarters").eq("org_id", o.id).order("is_headquarters", { ascending: false }).order("name"),
        ]);
        setFleet(count ?? 0);
        setBases(bs ?? []);
        const [{ data: fl }, { data: flags }] = await Promise.all([
          supabase.from("my_fleet").select("id,call_sign,base_name,mine,automedica,boat,transfer_only").eq("org_id", o.id),
          supabase.from("vehicles").select("id,auto_transport_only").eq("org_id", o.id),
        ]);
        const only = new Set((flags ?? []).filter((f) => f.auto_transport_only).map((f) => f.id as string));
        setAmbulances((fl ?? [])
          .filter((v) => v.mine !== false && !v.automedica && !v.boat && !v.transfer_only)
          .map((v) => ({ id: v.id as string, call_sign: v.call_sign as string, base_name: (v.base_name as string) ?? null, only: only.has(v.id as string) }))
          .sort((a, b) => (a.base_name ?? "").localeCompare(b.base_name ?? "") || a.call_sign.localeCompare(b.call_sign)));
      }
      supabase.rpc("my_auto_hour_cost").then(({ data }) => setHourCost(typeof data === "number" ? data : null));
      loadShifts();
      setLoaded(true);
      loadLog();
    })();
    const t = setInterval(loadLog, 20_000);
    return () => clearInterval(t);
  }, [router]);

  async function save(next: { enabled?: boolean; codes?: string[]; reserve?: number; steal?: boolean }) {
    const e = next.enabled ?? enabled, c = next.codes ?? codes, r = next.reserve ?? reserve, st = next.steal ?? steal;
    setEnabled(e); setCodes(c); setReserve(r); setSteal(st);
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("set_auto_mode", { p_enabled: e, p_codes: c, p_reserve: r, p_steal_red: st });
    setBusy(false);
    if (error) {
      if (e && !enabled) setEnabled(false);
      setMsg({ ok: false, text: error.message.includes("INSUFFICIENT_FUNDS") ? `Servono ${(hourCost ?? 500).toLocaleString("it-IT")} € per attivare la modalità automatica.` : "Non riesco a salvare, riprova." });
      if (error.message.includes("INSUFFICIENT_FUNDS")) setEnabled(false);
      return;
    }
    if (e && (!paidUntil || new Date(paidUntil).getTime() <= Date.now())) setPaidUntil(new Date(Date.now() + 3600_000).toISOString());
    setMsg({ ok: true, text: e ? (c.length ? "🤖 Modalità automatica attiva: salvato." : "Attiva, ma non hai scelto nessun tipo di servizio.") : "Modalità automatica spenta." });
  }

  const toggleCode = (k: string) => save({ codes: codes.includes(k) ? codes.filter((x) => x !== k) : [...codes, k] });

  async function toggleTransportOnly(id: string) {
    const v = ambulances.find((a) => a.id === id);
    if (!v) return;
    const on = !v.only;
    setAmbulances((list) => list.map((a) => (a.id === id ? { ...a, only: on } : a)));
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("set_vehicle_transport_only", { p_vehicle: id, p_on: on });
    setBusy(false);
    if (error) {
      setAmbulances((list) => list.map((a) => (a.id === id ? { ...a, only: !on } : a)));
      setMsg({ ok: false, text: "Non riesco a salvare, riprova." });
      return;
    }
    setMsg({ ok: true, text: on ? `🚐 ${v.call_sign}: solo dimissioni e trasferimenti.` : `🚑 ${v.call_sign}: di nuovo su tutti i servizi.` });
  }

  async function setBaseShifts(id: string, value: number) {
    const prev = shifts[id] ?? 0;
    const h24 = Object.entries(shifts).filter(([b, v]) => b !== id && v === H24).length;
    if (value === H24 && h24 >= MAX_H24) {
      setMsg({ ok: false, text: "Puoi avere al massimo " + MAX_H24 + " sedi H24: togli H24 a un'altra sede prima." });
      return;
    }
    setShifts((s) => ({ ...s, [id]: value })); setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc("set_auto_shifts", { p_base: id, p_shifts: value });
    setBusy(false);
    if (error) {
      setShifts((s) => ({ ...s, [id]: prev }));
      setMsg({ ok: false, text: error.message.includes("TOO_MANY_H24") ? "Al massimo " + MAX_H24 + " sedi H24." : "Non riesco a salvare, riprova." });
      return;
    }
    const d = data as { open_now: string[]; hour_cost: number };
    setAutoBases(d.open_now ?? []); setHourCost(d.hour_cost ?? null);
    const name = bases.find((b) => b.id === id)?.name ?? "Sede";
    setMsg({ ok: true, text: value === 0 ? name + ": chiusa in automatico." : value === H24 ? name + ": aperta H24."
      : name + ": aperta " + SHIFTS.filter((x) => value & x.bit).map((x) => x.label).join(", ") + "." });
    loadShifts();
  }


  return (
    <main style={shell}>
      <div style={{ background: "linear-gradient(135deg,#0F766E,#134E4A)", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={() => router.push("/")} style={{ padding: "8px 12px", borderRadius: 10, border: "none",
                  background: "rgba(0,0,0,.25)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>← Mappa</button>
          <div style={{ fontWeight: 800, fontSize: 18 }}>🤖 Modalità automatica</div>
        </div>
      </div>

      <div style={wrap}>
        {!loaded ? <div style={{ padding: 20, color: "#888", textAlign: "center" }}>Caricamento…</div> : (
          <>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>{enabled ? "Attiva" : "Spenta"}</div>
                  <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
                    La centrale assegna da sola i servizi alle tue ambulanze libere, ogni minuto, anche quando non sei collegato.
                    Sceglie il mezzo più vicino e l&apos;equipaggio più riposato.
                  </div>
                  <div style={{ fontSize: 13, marginTop: 6, fontWeight: 700, color: "#0F766E" }}>
                    💶 Si paga per ogni sede aperta: <strong>{prices ? prices.base_hour.toLocaleString("it-IT") + " €" : "…"} all&apos;ora a sede</strong>.
                    In quest&apos;ora: <strong>{hourCost != null ? hourCost.toLocaleString("it-IT") + " €" : "…"}</strong>
                    {prices && <> · al giorno circa <strong>{Number(prices.day_estimate).toLocaleString("it-IT")} €</strong></>}.
                    Si paga a ogni ora piena; se finiscono i soldi si spegne da sola.
                    {enabled && paidUntil && new Date(paidUntil).getTime() > Date.now() &&
                      <> · Pagata fino alle {new Date(paidUntil).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</>}
                  </div>
                </div>
                <button disabled={busy} onClick={() => save({ enabled: !enabled })} aria-label="Attiva o spegni"
                        style={{ width: 64, height: 36, borderRadius: 18, border: "none", cursor: "pointer", position: "relative",
                                 background: enabled ? "#0F766E" : "#ccc", transition: "background .2s", flexShrink: 0 }}>
                  <span style={{ position: "absolute", top: 4, left: enabled ? 32 : 4, width: 28, height: 28, borderRadius: "50%",
                                 background: "#fff", transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.3)" }} />
                </button>
              </div>
              {msg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: msg.ok ? "#15803D" : "#B91C1C" }}>{msg.text}</div>}
            </div>

            <div style={{ ...card, border: enabled && Object.values(shifts).every((v) => !v) ? "2px solid #DC2626" : undefined }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>🕐 Turni delle sedi</div>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>
                Scegli in quali turni ogni sede lavora in automatico. Fuori turno i suoi mezzi restano a te, da usare a mano.
                <strong> H24</strong> = tutti e 4 i turni: al massimo {MAX_H24} sedi (anche nessuna). Le altre sedi possono fare i turni che vuoi.
                Ogni turno costa {prices ? prices.base_hour.toLocaleString("it-IT") + " €" : "…"} l&apos;ora per sede.
              </div>
              {enabled && Object.values(shifts).every((v) => !v) && <div style={{ fontSize: 12, color: "#B91C1C", fontWeight: 700, marginBottom: 8 }}>Nessuna sede ha un turno: non parte nessun mezzo.</div>}
              <div style={{ display: "grid", gap: 8 }}>
                {bases.map((b) => {
                  const v = shifts[b.id] ?? 0;
                  const isH24 = v === H24;
                  const h24Full = !isH24 && Object.entries(shifts).filter(([id, x]) => id !== b.id && x === H24).length >= MAX_H24;
                  const openNow = prices ? (v & prices.current_shift) !== 0 : false;
                  const hours = SHIFTS.reduce((t, x) => t + ((v & x.bit) ? SHIFT_HOURS[x.bit] : 0), 0);
                  const chip = (on: boolean, now: boolean): CSSProperties => ({ padding: "7px 0", borderRadius: 10, font: "inherit", fontSize: 12.5, fontWeight: 700,
                    cursor: busy ? "default" : "pointer", border: on ? "2px solid #0F766E" : "1px solid #ddd",
                    background: on ? "#0F766E" : "#fff", color: on ? "#fff" : "#555", outline: now ? "2px dashed #F59E0B" : "none", outlineOffset: 1 });
                  return (
                    <div key={b.id} style={{ border: v ? "2px solid #0F766E" : "1px solid #ddd", borderRadius: 12, padding: 10, background: v ? "#f0fdfa" : "#fff" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <strong style={{ flex: 1, minWidth: 0 }}>{b.name}{b.is_headquarters && <span style={{ fontSize: 12, color: "#666", fontWeight: 400 }}> · principale</span>}</strong>
                        {openNow && <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: "#16A34A", borderRadius: 999, padding: "2px 8px" }}>APERTA ORA</span>}
                        {v > 0 && <span style={{ fontSize: 11, color: "#666" }}>{hours} h/giorno</span>}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                        {SHIFTS.map((x) => {
                          const next = v ^ x.bit;
                          const blocked = next === H24 && h24Full;   // completare i 4 turni = H24
                          return (
                            <button key={x.bit} disabled={busy || blocked} onClick={() => setBaseShifts(b.id, next)}
                                    title={blocked ? "Hai già " + MAX_H24 + " sedi H24" : x.bit === prices?.current_shift ? "Turno in corso" : undefined}
                                    style={{ ...chip((v & x.bit) !== 0, x.bit === prices?.current_shift), opacity: blocked ? 0.4 : 1 }}>{x.icon} {x.label}</button>
                          );
                        })}
                        <button disabled={busy || h24Full} onClick={() => setBaseShifts(b.id, isH24 ? 0 : H24)}
                                title={h24Full ? "Hai già " + MAX_H24 + " sedi H24" : undefined}
                                style={{ ...chip(isH24, false), background: isH24 ? "#B45309" : "#fff", border: isH24 ? "2px solid #B45309" : "1px solid #ddd",
                                         opacity: h24Full ? 0.4 : 1, cursor: h24Full ? "not-allowed" : "pointer" }}>H24</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>Il bordo arancione tratteggiato indica il turno in corso.</div>
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>🚐 Ambulanze solo per dimissioni e trasferimenti</div>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>
                Le ambulanze segnate qui, in automatico, prendono solo dialisi, dimissioni e trasferimenti (anche quelli urgenti):
                mai le emergenze. A mano puoi sempre usarle come vuoi.
              </div>
              {ambulances.length === 0 && <div style={{ fontSize: 13, color: "#888" }}>Nessuna ambulanza.</div>}
              <div style={{ display: "grid", gap: 6 }}>
                {ambulances.map((a) => (
                  <button key={a.id} disabled={busy} onClick={() => toggleTransportOnly(a.id)}
                          style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: "8px 12px", borderRadius: 12,
                                   cursor: "pointer", font: "inherit", border: a.only ? "2px solid #0E7490" : "1px solid #ddd",
                                   background: a.only ? "#ecfeff" : "#fff", color: "#111" }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong>{a.call_sign}</strong>
                      {a.base_name && <span style={{ fontSize: 12, color: "#666" }}> · {a.base_name}</span>}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: a.only ? "#0E7490" : "#999" }}>{a.only ? "solo dimissioni e trasferimenti" : "tutti i servizi"}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Quali servizi prendere</div>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>Se ci sono più servizi, la precedenza va ai codici più gravi: rosso, poi giallo, poi verde, poi gli altri.</div>
              <div style={{ display: "grid", gap: 8 }}>
                {CODES.map((c) => {
                  const on = codes.includes(c.key);
                  return (
                    <button key={c.key} disabled={busy} onClick={() => toggleCode(c.key)}
                            style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: "10px 12px", borderRadius: 12,
                                     cursor: "pointer", font: "inherit", border: on ? `2px solid ${c.color}` : "1px solid #ddd",
                                     background: on ? "#f6f6f4" : "#fff", color: "#111" }}>
                      <span style={{ width: 16, height: 16, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>
                        <strong>{c.label}</strong>
                        <span style={{ display: "block", fontSize: 12, color: "#666" }}>{c.hint}</span>
                      </span>
                      <span style={{ fontSize: 20 }}>{on ? "✅" : "⬜"}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ ...card, border: steal ? "2px solid #DC2626" : undefined }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>⚔️ Modalità aggressiva: occupa tutto e ruba i servizi</div>
                  <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
                    Le tue ambulanze partono subito su ogni servizio, senza il minuto di attesa, per non lasciarne agli altri.
                    <br />🔴 <strong>Rosso:</strong> ci manda <strong>due ambulanze</strong>, così il servizio è bloccato e nessuno può più contenderlo.
                    <br />🟡 <strong>Giallo:</strong> se l&apos;ha già preso un altro giocatore ma nessuno è arrivato, ci manda la tua ambulanza più vicina per arrivare prima e soffiarglielo.
                    <br />Vale anche sui rossi presi da altri, tranne quelli già bloccati con due mezzi.
                  </div>
                  {steal && !codes.includes("rosso") && !codes.includes("giallo") && <div style={{ fontSize: 12, color: "#B91C1C", fontWeight: 700, marginTop: 4 }}>Attiva i codici rossi e/o gialli qui sopra.</div>}
                </div>
                <button disabled={busy} onClick={() => save({ steal: !steal })} aria-label="Modalità aggressiva"
                        style={{ width: 64, height: 36, borderRadius: 18, border: "none", cursor: "pointer", position: "relative",
                                 background: steal ? "#DC2626" : "#ccc", transition: "background .2s", flexShrink: 0 }}>
                  <span style={{ position: "absolute", top: 4, left: steal ? 32 : 4, width: 28, height: 28, borderRadius: "50%",
                                 background: "#fff", transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.3)" }} />
                </button>
              </div>
            </div>

            <div style={{ ...card, border: refill ? "2px solid #16A34A" : undefined }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>🔋 Ricarica automatica dei volontari</div>
                  <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
                    Quando mancano autisti o soccorritori per le ambulanze libere, sveglia da solo i volontari a riposo
                    (prima gli autisti) pagando <strong>2.000 € a volontario</strong> (a mano costa 1.500 €).
                    Ne ricarica solo quanti servono per riempire le ambulanze libere.
                  </div>
                </div>
                <button disabled={busy} aria-label="Ricarica automatica" onClick={async () => {
                          const v = !refill; setRefill(v); setBusy(true);
                          const { error } = await supabase.rpc("set_auto_refill", { p_on: v });
                          setBusy(false);
                          setMsg(error ? { ok: false, text: "Non riesco a salvare, riprova." } : { ok: true, text: v ? "🔋 Ricarica automatica attiva." : "Ricarica automatica spenta." });
                        }}
                        style={{ width: 64, height: 36, borderRadius: 18, border: "none", cursor: "pointer", position: "relative",
                                 background: refill ? "#16A34A" : "#ccc", transition: "background .2s", flexShrink: 0 }}>
                  <span style={{ position: "absolute", top: 4, left: refill ? 32 : 4, width: 28, height: 28, borderRadius: "50%",
                                 background: "#fff", transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.3)" }} />
                </button>
              </div>
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>📍 Distanza massima</div>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>
                Prende solo i servizi entro questa distanza dall&apos;ambulanza, e ci manda sempre la tua ambulanza libera più vicina.
                In ogni caso un&apos;ambulanza non esce mai a più di 20 km dalla sua sede: resta nella sua zona.
              </div>
              <select value={maxKm} disabled={busy} onChange={async (e) => {
                        const km = Number(e.target.value); setMaxKm(km); setBusy(true);
                        const { error } = await supabase.rpc("set_auto_max_km", { p_km: km });
                        setBusy(false);
                        setMsg(error ? { ok: false, text: "Non riesco a salvare, riprova." } : { ok: true, text: `📍 Solo servizi entro ${km} km.` });
                      }}
                      style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", fontSize: 15 }}>
                {[3, 5, 8, 10, 15, 20].map((k) => <option key={k} value={k}>{k} km{k === 10 ? " (consigliato)" : ""}</option>)}
              </select>
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Ambulanze da tenere libere</div>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>
                La modalità automatica lascia sempre libere almeno queste ambulanze, così puoi usarle tu a mano.
              </div>
              <select value={reserve} disabled={busy} onChange={(e) => save({ reserve: Number(e.target.value) })}
                      style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", fontSize: 15 }}>
                {Array.from({ length: Math.max(1, fleet) + 1 }, (_, i) => i).map((n) => (
                  <option key={n} value={n}>{n === 0 ? "Nessuna: usa tutte le ambulanze" : `${n} ${n === 1 ? "ambulanza" : "ambulanze"}`}</option>
                ))}
              </select>
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Ultimi servizi presi in automatico</div>
              {log.length === 0 && <div style={{ fontSize: 13, color: "#888" }}>Ancora nessuno.</div>}
              {log.map((l, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i ? "1px solid #f0f0f0" : "none", fontSize: 13 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: CODE_DOT[l.code] ?? "#999", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.title.split(" — ")[0]}</div>
                    <div style={{ color: "#666" }}>
                      {l.call_sign} · {new Date(l.assigned_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} · {STATUS[l.status] ?? l.status}
                    </div>
                  </div>
                  {l.status === "conclusa" && l.reward ? <strong style={{ color: "#15803D" }}>+{l.reward.toLocaleString("it-IT")} €</strong> : null}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
