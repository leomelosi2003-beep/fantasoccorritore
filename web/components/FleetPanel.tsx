"use client";

import { useEffect, useState } from "react";
import { supabase, livery } from "@/lib/supabase";

type Vehicle = {
  id: string; call_sign: string; status: string; wear: number; lent_to: string | null; lent_from: string | null;
  maintenance_until: string | null; vehicle_image: string | null; base_name: string | null; fuel_liters?: number; tank_liters?: number; electric?: boolean | null; battery_pct?: number; range_km?: number | null;
};
type Job = { id: string; vehicle_id: string; title: string; status: string; assigned_at: string; completes_at: string; arrives_at: string;
  route_ends_at: string; hospital: string | null; transport?: string | null;
  route: { lat: number; lng: number; t: string; label: string }[] | null };
type LentInfo = { vehicle_id: string; borrower: string; ends_at: string; earned: number; services: number;
  last_amount: number | null; last_at: string | null; job_title: string | null; job_completes_at: string | null; job_reward: number | null };
type Row = { v: Vehicle; color: string; text: string; timer: string | null; order: number; job?: Job; away?: boolean };
type HospitalOption = { id: string; name: string; minutes: number; current: boolean; specialized: boolean };

// Si può cambiare ospedale finché l'ambulanza non è arrivata in ospedale
function canChangeHospital(j: Job, now: number) {
  if (!j.route?.length || !j.transport || j.transport === "trasferimento" || j.transport === "dimissione") return false;
  const sceneEnd = Math.max(...j.route.filter((p) => p.label === "Sul posto").map((p) => new Date(p.t).getTime()));
  const arrive = j.route.map((p) => ({ ...p, ms: new Date(p.t).getTime() }))
    .find((p) => p.label !== "Sul posto" && p.label !== "Sede" && p.ms > sceneEnd);
  return !!arrive && now < arrive.ms;
}

// Conto alla rovescia mm:ss (o h:mm:ss)
function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0"), ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Elenco delle mie ambulanze con il tempo che manca per liberarsi
export default function FleetPanel({ jobs, now, refreshKey, onChanged, orgType, onLocate }: {
  jobs: Job[]; now: number; refreshKey: number; onChanged: (msg: string) => void; orgType?: string;
  onLocate?: (vehicleId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // manutenzione a tutti i mezzi fermi in sede
  const [mq, setMq] = useState<{ vehicles: number; cost: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    supabase.rpc("maintenance_all_quote").then(({ data }) => setMq(((data as { vehicles: number; cost: number }[]) ?? [])[0] ?? null));
  }, [open, refreshKey]);
  async function maintainAll() {
    if (!mq || !mq.vehicles) return;
    if (!window.confirm(`Mandare in officina ${mq.vehicles} mezzi fermi in sede per ${Number(mq.cost).toLocaleString("it-IT")} €?\n\nTornano come nuovi dopo pochi minuti.`)) return;
    const { data, error } = await supabase.rpc("maintenance_all");
    if (error) { onChanged("Errore: " + error.message); return; }
    const r = ((data as { vehicles: number; cost: number }[]) ?? [])[0];
    onChanged(r && r.vehicles ? `🔧 ${r.vehicles} mezzi in officina · ${Number(r.cost).toLocaleString("it-IT")} €` : "Nessun mezzo da riparare (o soldi insufficienti).");
    setMq(null);
  }
  const [picking, setPicking] = useState<string | null>(null); // id del servizio
  const [options, setOptions] = useState<HospitalOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function openPicker(jobId: string) {
    if (picking === jobId) { setPicking(null); return; }
    setPicking(jobId); setOptions([]); setErr(null);
    const { data } = await supabase.rpc("hospital_options", { p_assignment: jobId });
    setOptions((data as HospitalOption[]) ?? []);
  }

  // Annulla il viaggio verso il servizio (solo prima di arrivare sul posto): l'ambulanza è subito libera
  async function cancelTrip(job: Job) {
    if (!window.confirm(`Annullare il viaggio verso "${job.title.split(" — ")[0]}"? L'ambulanza torna libera subito, senza premio.`)) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("cancel_assignment", { p_assignment: job.id });
    setBusy(false);
    if (error) { setErr(error.message.includes("ALREADY_ON_SCENE") ? "È già arrivata sul posto: non si può più annullare." : "Non riesco ad annullare."); return; }
    onChanged("↩️ Viaggio annullato: l'ambulanza è libera, scegli un altro servizio sulla mappa.");
  }

  async function choose(jobId: string, h: HospitalOption) {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("change_hospital", { p_assignment: jobId, p_hospital: h.id });
    setBusy(false);
    if (error) {
      setErr(error.message.includes("ALREADY_AT_HOSPITAL") ? "È già arrivata in ospedale." : "Non si può cambiare ospedale per questo servizio.");
      return;
    }
    setPicking(null);
    onChanged(`🏥 Nuova destinazione: ${h.name}`);
  }
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [lent, setLent] = useState<Record<string, LentInfo>>({});

  useEffect(() => {
    supabase.from("my_fleet")
      .select("id,call_sign,status,wear,lent_to,lent_from,maintenance_until,vehicle_image,base_name,fuel_liters,tank_liters,electric,battery_pct,range_km")
      .order("call_sign")
      .then(({ data }) => setFleet((data as Vehicle[]) ?? []));
  }, [refreshKey]);

  // guadagni delle ambulanze prestate: solo con il pannello aperto, ogni 20 secondi
  useEffect(() => {
    if (!open) return;
    const load = () => supabase.from("my_lent_vehicles").select("*").then(({ data }) =>
      setLent(Object.fromEntries(((data as LentInfo[]) ?? []).map((x) => [x.vehicle_id, x]))));
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [open]);

  // ultimo servizio di ogni mezzo
  const lastJob = new Map<string, Job>();
  for (const j of jobs) {
    const cur = lastJob.get(j.vehicle_id);
    if (!cur || j.assigned_at > cur.assigned_at) lastJob.set(j.vehicle_id, j);
  }

  const rows: Row[] = fleet.map((v): Row => {
    const j = lastJob.get(v.id);
    const freeAt = j ? new Date(j.completes_at).getTime() : 0;
    const homeAt = j ? new Date(j.route_ends_at).getTime() : 0;
    if (v.lent_to) return { v, color: "#B45309", text: `🤝 Prestata a ${v.lent_to}`, timer: null, order: 3 };
    if (v.status === "fuori_servizio") return { v, color: "#B45309", text: "🏷️ All'asta (Ambulanze usate)", timer: null, order: 3 };
    if (v.status === "manutenzione" && v.maintenance_until)
      return { v, color: "#6B7280", text: "🔧 In officina", timer: countdown(new Date(v.maintenance_until).getTime() - now), order: 2 };
    if (j && freeAt > now)
      return { v, color: "#DC2626", text: j.title.split(" — ")[0] + (j.hospital ? ` → ${j.hospital}` : ""),
               timer: countdown(freeAt - now), order: 0, job: j };
    if (j && homeAt > now)
      return { v, color: "#15803D", text: `↩️ Libera ma ancora fuori · rientra tra ${countdown(homeAt - now)}`, timer: null, order: 1, away: true };
    if (v.wear >= 80) return { v, color: "#B45309", text: "⚠️ Da revisionare", timer: null, order: 2 };
    if (!v.electric && (v.fuel_liters ?? 99) < 5) return { v, color: "#DC2626", text: "⛽ Senza gasolio: non parte, fai il pieno", timer: null, order: 2 };
    if (v.electric && Number(v.battery_pct ?? 100) < 100)
      return { v, color: "#15803D", text: `🔌 In ricarica in sede (1 minuto)${v.base_name ? ` · ${v.base_name}` : ""}`, timer: null, order: 1 };
    return { v, color: "#15803D", text: `✅ Libera in sede${v.base_name ? ` · ${v.base_name}` : ""}`, timer: null, order: 1 };
  }).sort((a, b) => a.order - b.order || (a.v.call_sign > b.v.call_sign ? 1 : -1));

  const inService = rows.filter((r) => r.order === 0).length;
  // liberi davvero: fermi in sede (o all'ormeggio) e pronti a partire
  const atBase = rows.filter((r) => r.order === 1 && !r.away).length;
  const away = rows.filter((r) => r.order === 1 && r.away).length;

  return (
    <div className="fs-fleet">
      <button className={`fs-fleet-ico${open ? " open" : ""}`} onClick={() => setOpen(!open)} title="I tuoi mezzi" aria-label="I tuoi mezzi">
        🚑
        {rows.length > 0 && <span className="fs-fleet-badge">{atBase}</span>}
      </button>
      {open && (
        <div className="fs-fleet-list">
          <div className="fs-fleet-head">
            <span className="fs-fleet-head-t">🚑 I tuoi mezzi</span>
            <span className="fs-fleet-head-sub"><strong>{atBase}</strong>/{rows.length} in sede{away ? ` · ${away} in rientro` : ""}{inService ? ` · ${inService} in servizio` : ""}</span>
          </div>
          {mq && mq.vehicles > 0 && (
            <div style={{ padding: "8px 10px", borderBottom: "1px solid #f0f0f0" }}>
              <button onClick={maintainAll}
                      style={{ width: "100%", border: "none", background: "#6B7280", color: "#fff", borderRadius: 8, padding: "8px 10px",
                               fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                🔧 Manutenzione a tutti · {mq.vehicles} mezzi in sede · {Number(mq.cost).toLocaleString("it-IT")} €
              </button>
            </div>
          )}
          {rows.length === 0 && <div style={{ padding: 12, color: "#666", fontSize: 14 }}>Nessuna ambulanza: comprala nel Garage.</div>}
          {rows.map(({ v, color, text, timer, job }) => (
            <div key={v.id} style={{ borderTop: "1px solid #f0f0f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}>
              {v.vehicle_image
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={(livery(v.vehicle_image, v.lent_from ? null : orgType) ?? "").replace(/\.png$/, "-map.png")} alt="" style={{ width: 46, height: "auto", flexShrink: 0 }} />
                : <span style={{ fontSize: 24 }}>🚑</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {v.call_sign}{v.lent_from && <span style={{ fontWeight: 400, fontSize: 11, color: "#15803D" }}> · da {v.lent_from}</span>}
                  </span>
                  {v.electric && (
                    <span title={`Batteria: ${Math.round(Number(v.battery_pct ?? 0))}% · circa ${Math.round(Number(v.battery_pct ?? 0) / 100 * (v.range_km ?? 0))} km di autonomia`}
                          style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
                                   color: Number(v.battery_pct ?? 0) < 25 ? "#DC2626" : Number(v.battery_pct ?? 0) < 60 ? "#B45309" : "#15803D" }}>
                      {Number(v.battery_pct ?? 0) < 100 ? "🔌" : "🔋"} {Math.round(Number(v.battery_pct ?? 0))}%
                    </span>
                  )}
                  {!v.electric && v.fuel_liters != null && (
                    <span title={`Gasolio: ${Math.round(Number(v.fuel_liters))} L su ${v.tank_liters ?? 80} L`}
                          style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
                                   color: Number(v.fuel_liters) < 5 ? "#DC2626" : Number(v.fuel_liters) / Number(v.tank_liters ?? 80) < 0.25 ? "#B45309" : "#555" }}>
                      ⛽ {Math.round(Number(v.fuel_liters))} L
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{text}</div>
                {lent[v.id] && (() => {
                  const L = lent[v.id];
                  const fresh = L.last_at && now - new Date(L.last_at).getTime() < 60_000;
                  return (
                    <div style={{ marginTop: 4, background: "#effaf1", borderRadius: 8, padding: "5px 8px", fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                        <span>💶 Guadagnato: <strong style={{ color: "#15803D" }}>{L.earned.toLocaleString("it-IT")} €</strong> · {L.services} servizi</span>
                        {fresh && L.last_amount && <strong style={{ color: "#15803D" }}>+{L.last_amount.toLocaleString("it-IT")} € ✨</strong>}
                      </div>
                      {L.job_title && L.job_completes_at && new Date(L.job_completes_at).getTime() > now ? (
                        <div style={{ color: "#DC2626", fontWeight: 700 }}>
                          🚨 {L.job_title.split(" — ")[0]} · +{Math.round((L.job_reward ?? 0) * 0.1).toLocaleString("it-IT")} € tra {countdown(new Date(L.job_completes_at).getTime() - now)}
                        </div>
                      ) : <div style={{ color: "#666" }}>In attesa di un servizio · rientra alle {new Date(L.ends_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</div>}
                    </div>
                  );
                })()}
              </div>
              {timer && (
                <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 800, fontSize: 17, color, textAlign: "right" }}>
                  ⏱ {timer}
                </div>
              )}
            </div>
            {job && onLocate && (job.status === "in_viaggio" || job.status === "sul_posto" || timer) && (
              <div style={{ padding: "0 10px 6px" }}>
                <button onClick={() => onLocate(v.id)}
                        style={{ border: "1px solid #2563EB", background: "#2563EB", color: "#fff", borderRadius: 8, padding: "5px 10px",
                                 fontSize: 12, fontWeight: 700, cursor: "pointer" }}>📍 Localizza</button>
              </div>
            )}
            {job && job.status === "in_viaggio" && now < new Date(job.arrives_at).getTime() && (
              <div style={{ padding: "0 10px 6px" }}>
                <button onClick={() => cancelTrip(job)} disabled={busy}
                        style={{ border: "1px solid #6B7280", background: "#fff", color: "#374151", borderRadius: 8, padding: "5px 10px",
                                 fontSize: 12, fontWeight: 700, cursor: "pointer" }}>↩️ Annulla viaggio</button>
              </div>
            )}
            {job && canChangeHospital(job, now) && (
              <div style={{ padding: "0 10px 8px" }}>
                <button onClick={() => openPicker(job.id)}
                        style={{ border: "1px solid #DC2626", background: picking === job.id ? "#DC2626" : "#fff",
                                 color: picking === job.id ? "#fff" : "#DC2626", borderRadius: 8, padding: "5px 10px",
                                 fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🏥 Cambia ospedale</button>
                {picking === job.id && (
                  <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                    {options.length === 0 && <div style={{ fontSize: 12, color: "#888" }}>Caricamento…</div>}
                    {options.map((h) => (
                      <button key={h.id} disabled={busy || h.current} onClick={() => choose(job.id, h)}
                              style={{ textAlign: "left", border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px",
                                       background: h.current ? "#f3f3f3" : "#fff", cursor: h.current ? "default" : "pointer", fontSize: 13 }}>
                        <strong>{h.name}</strong> · {h.minutes} min
                        {h.current ? " · attuale" : !h.specialized ? <span style={{ color: "#B45309" }}> · non specializzato</span> : ""}
                      </button>
                    ))}
                    {err && <div style={{ fontSize: 12, color: "#B91C1C" }}>{err}</div>}
                  </div>
                )}
              </div>
            )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
