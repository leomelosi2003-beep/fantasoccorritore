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
      const { data: o } = await supabase.from("organizations").select("id,auto_enabled,auto_codes,auto_reserve,auto_steal_red,auto_max_km,auto_refill,auto_paid_until")
        .eq("owner_id", session.user.id).maybeSingle();
      if (o) {
        setEnabled(!!o.auto_enabled); setCodes(o.auto_codes ?? []); setReserve(o.auto_reserve ?? 0); setSteal(!!o.auto_steal_red); setMaxKm(o.auto_max_km ?? 10); setRefill(!!o.auto_refill); setPaidUntil(o.auto_paid_until ?? null);
        const { count } = await supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("org_id", o.id);
        setFleet(count ?? 0);
      }
      supabase.rpc("my_auto_hour_cost").then(({ data }) => setHourCost(typeof data === "number" ? data : null));
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
                    💶 Costa <strong>{hourCost != null ? `${hourCost.toLocaleString("it-IT")} €` : "…"} all&apos;ora</strong> (500 € + 0,1% del patrimonio dell&apos;associazione),
                    pagati all&apos;inizio di ogni ora. Se finiscono i soldi si spegne da sola.
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
              </div>
              <select value={maxKm} disabled={busy} onChange={async (e) => {
                        const km = Number(e.target.value); setMaxKm(km); setBusy(true);
                        const { error } = await supabase.rpc("set_auto_max_km", { p_km: km });
                        setBusy(false);
                        setMsg(error ? { ok: false, text: "Non riesco a salvare, riprova." } : { ok: true, text: `📍 Solo servizi entro ${km} km.` });
                      }}
                      style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", fontSize: 15 }}>
                {[3, 5, 8, 10, 15, 20, 25].map((k) => <option key={k} value={k}>{k} km{k === 10 ? " (consigliato)" : ""}</option>)}
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
