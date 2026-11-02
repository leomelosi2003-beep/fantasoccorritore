"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { supabase, type MissionPin } from "@/lib/supabase";
import { avatarSvg } from "@/components/avatar";
import { ROLE, RoleBadge, type Card } from "@/components/VolunteerCard";

type Vehicle = { id: string; call_sign: string; status: string; wear: number; certification: string; equipment: string[];
  lent_to: string | null; lent_from: string | null; base_lat: number | null; base_lng: number | null; transfer_only?: boolean;
  fuel_liters?: number; electric?: boolean | null; battery_pct?: number; range_km?: number | null; automedica?: boolean };

const MAX_KM = 25; // oltre questa distanza dalla sede il mezzo non può prendere il servizio
function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, r = Math.PI / 180;
  const x = Math.sin((bLat - aLat) * r / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin((bLng - aLng) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
type Equip = { code: string; provides: string[] };

const CERT_RANK: Record<string, number> = { trasporto: 0, base: 1, avanzata_rianimazione: 2 };
const RANK: Record<string, number> = { soccorritore_base: 1, soccorritore_avanzato: 2, infermiere: 2, caposervizio: 3, medico: 3, autista: 0 };
const REQ: Record<string, string> = {
  ecg: "cardiomonitor", defib: "defibrillatore", spinale: "tavola spinale adulti", spinale_ped: "spinale pediatrica",
  collare: "collari", ked: "KED", cucchiaio: "barella a cucchiaio", steccobende: "steccobende", emergenza: "borsoni",
};
const CODE: Record<string, { label: string; color: string }> = {
  nessuno: { label: "Ordinario", color: "#3B82F6" }, verde: { label: "Codice verde", color: "#16A34A" },
  giallo: { label: "Codice giallo", color: "#CA8A04" }, rosso: { label: "Codice rosso", color: "#DC2626" },
};
const btn: CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "none", background: "#111", color: "#fff",
  fontWeight: 600, cursor: "pointer", fontSize: 15 };

function ready(c: Card) {
  if (c.state === "scaduta" || c.state === "in_servizio" || c.lent_to) return false;
  if (c.rest_until && new Date(c.rest_until) > new Date()) return false;
  return true;
}

// Controlla i ruoli richiesti con la gerarchia (caposervizio > avanzato > base)
function roleCheck(required: Record<string, number>, crew: Card[]) {
  const missing: string[] = [];
  const autisti = crew.filter((c) => c.role === "autista").length;
  if (autisti < (required.autista ?? 0)) missing.push("autista");
  // l'autista avanzato conta anche come soccorritore avanzato
  const ranks = crew.filter((c) => c.role !== "autista" || c.avanzato).map((c) => c.role === "autista" ? 2 : RANK[c.role]);
  if (crew.length > 0 && crew.length < 2) missing.push("almeno 2 persone");
  for (const k of [3, 2, 1]) {
    const need = Object.entries(required).filter(([r]) => r !== "autista" && RANK[r] >= k).reduce((t, [, n]) => t + n, 0);
    const have = ranks.filter((x) => x >= k).length;
    if (have < need) missing.push(k === 3 ? "caposervizio" : k === 2 ? "soccorritore_avanzato" : "soccorritore_base");
  }
  return Array.from(new Set(missing));
}

function claimError(m: string) {
  if (m.includes("MISSION_FULL_OR_CLOSED")) return "Troppo tardi: il servizio è stato preso da qualcun altro o è scaduto.";
  if (m.includes("ALREADY_ON_MISSION")) return "Hai già un mezzo su questo servizio.";
  if (m.includes("NO_CHARGE")) return "🔋 Batteria insufficiente per andata e ritorno: aspetta che si ricarichi in sede (1 minuto).";
  if (m.includes("TRANSFER_ONLY")) return "Questo mezzo a passo lungo fa solo trasferimenti.";
  if (m.includes("TOO_MANY_OWN")) return "Hai già 5 mezzi su questo servizio: è il massimo.";
  if (m.includes("MISSION_LOCKED")) return "🔒 Servizio bloccato: un'altra associazione ci ha già mandato due mezzi.";
  if (m.includes("CARD_TOO_TIRED")) return "Qualcuno dell'equipaggio è troppo stanco per questo servizio.";
  if (m.includes("CARD_RESTING")) return "Qualcuno dell'equipaggio è ancora a riposo.";
  if (m.includes("CARD_BUSY")) return "Qualcuno dell'equipaggio è già in servizio.";
  if (m.includes("CARD_EXPIRED")) return "Qualcuno dell'equipaggio ha il contratto scaduto.";
  if (m.includes("MISSING_ROLE")) return "Mancano dei ruoli nell'equipaggio.";
  if (m.includes("MISSING_EQUIPMENT")) return "Il mezzo non ha i presidi richiesti.";
  if (m.includes("CERTIFICATION_TOO_LOW")) return "Il mezzo non è abilitato all'emergenza (servono i borsoni).";
  if (m.includes("NO_FUEL")) return "Il mezzo è in riserva: fai il pieno nel Garage (⛽ Benzinaio).";
  if (m.includes("VEHICLE_NEEDS_MAINTENANCE")) return "Il mezzo è troppo usurato: portalo in manutenzione.";
  if (m.includes("VEHICLE_BUSY")) return "Il mezzo è già impegnato.";
  if (m.includes("TOO_FAR")) return "Servizio troppo lontano: serve una sede entro 25 km.";
  if (m.includes("TOO_FEW_CREW")) return "Servono almeno 2 persone a bordo.";
  if (m.includes("TOO_MANY_CREW")) return "Al massimo 4 persone a bordo.";
  if (m.includes("MISSION_WON_BY_AUTOMEDICA")) return "🩺 Troppo tardi: l'automedica di un'altra associazione è già sul posto e ha vinto il servizio.";
  if (m.includes("AUTOMEDICA_CREW")) return "🩺 Sull'automedica servono esattamente 1 autista e 1 medico.";
  if (m.includes("AUTOMEDICA_ONLY_EMERGENCY")) return "🩺 L'automedica va solo su codici gialli e rossi.";
  return m;
}

export default function MissionPanel({ mission, onClose, onClaimed }: {
  mission: MissionPin; onClose: () => void; onClaimed: (text: string) => void;
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [equip, setEquip] = useState<Equip[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [crew, setCrew] = useState<string[]>([]);
  const [eta, setEta] = useState<{ km: number; minutes: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const reloadRef = useRef<() => Promise<void>>(async () => {});
  // la mia automedica è sul servizio e aspetta un'ambulanza: posso mandarla anche a servizio pieno
  const waiting = !!mission.my_automedica_waiting;
  useEffect(() => {
    // ricarica mezzi e volontari ogni 10 s: chi esce dal PS diventa subito selezionabile
    const loadAll = async () => {
      const [v, e, c] = await Promise.all([
        supabase.from("my_fleet").select("id,call_sign,status,wear,certification,equipment,lent_to,lent_from,base_lat,base_lng,transfer_only,fuel_liters,electric,battery_pct,range_km,automedica").order("call_sign"),
        supabase.from("equipment").select("code,provides"),
        supabase.from("my_cards").select("*"),
      ]);
      setVehicles((v.data as Vehicle[]) ?? []);
      setEquip((e.data as Equip[]) ?? []);
      setCards(((c.data as Card[]) ?? []).filter((x) => x.state !== "scaduta"));
    };
    reloadRef.current = loadAll;
    loadAll();
    const r = setInterval(loadAll, 20_000);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); clearInterval(r); };
  }, []);

  const provides = (eq: string[]) => new Set(equip.filter((e) => eq.includes(e.code)).flatMap((e) => e.provides));
  function vehicleProblem(v: Vehicle): string | null {
    if (v.lent_to) return `prestata a ${v.lent_to}`;
    if (v.transfer_only && mission.transport !== "trasferimento") return "solo trasferimenti (passo lungo)";
    if (v.automedica && (mission.category !== "emergenza_118" || !["giallo", "rosso"].includes(mission.code) || mission.transport === "trasferimento"))
      return "automedica: solo gialli e rossi";
    if (v.automedica && waiting) return "la tua automedica è già qui: manda un'ambulanza";
    if (v.base_lat != null && v.base_lng != null) {
      const d = km(v.base_lat, v.base_lng, mission.lat, mission.lng);
      if (d > MAX_KM) return `troppo lontana (${Math.round(d)} km dalla sede)`;
    }
    if (v.status !== "disponibile") return v.status === "in_servizio" ? "in servizio" : v.status === "manutenzione" ? "in officina" : v.status === "fuori_servizio" ? "all'asta" : "non disponibile";
    if (v.wear >= 80) return "da revisionare";
    if (!v.electric && (v.fuel_liters ?? 99) < 5) return "senza gasolio: fai il pieno";
    if (v.electric && v.base_lat != null && v.base_lng != null && mission.transport !== "trasferimento") {
      const need = km(v.base_lat, v.base_lng, mission.lat, mission.lng) * 2 * 1.3;
      const have = (Number(v.battery_pct ?? 0) / 100) * (v.range_km ?? 0);
      if (need > have) return `batteria scarica: ${Math.round(have)} km, ne servono ${Math.round(need)}`;
    }
    if (v.automedica) return null; // ECG e defibrillatore già a bordo
    if (CERT_RANK[v.certification] < CERT_RANK[mission.min_certification ?? "trasporto"])
      return "solo trasporti";
    const p = provides(v.equipment);
    const miss = mission.requires.filter((r) => !p.has(r));
    if (miss.length) return "manca: " + miss.map((r) => REQ[r] ?? r).join(", ");
    return null;
  }

  useEffect(() => {
    if (!vehicleId) { setEta(null); return; }
    supabase.rpc("travel_estimate", { p_mission_id: mission.id, p_vehicle_id: vehicleId })
      .then(({ data }) => setEta(data as { km: number; minutes: number }));
  }, [vehicleId, mission.id]);

  // distanza in linea d'aria dalla sede del mezzo al servizio
  const distOf = (v: Vehicle) => v.base_lat != null && v.base_lng != null ? km(v.base_lat, v.base_lng, mission.lat, mission.lng) : 999;
  // mezzi ordinati: prima quelli disponibili, dal più vicino al più lontano
  // i mezzi solo-trasferimenti non compaiono nemmeno sui servizi di emergenza
  const sortedVehicles = vehicles.filter((v) => !v.transfer_only || mission.transport === "trasferimento").sort((a, b) =>
    (vehicleProblem(a) ? 1 : 0) - (vehicleProblem(b) ? 1 : 0) || (a.automedica ? 1 : 0) - (b.automedica ? 1 : 0) || distOf(a) - distOf(b));

  // scegli automaticamente il mezzo disponibile più vicino (e cambia se quello scelto non è più disponibile)
  const [userPicked, setUserPicked] = useState(false);
  useEffect(() => {
    if (!vehicles.length) return;
    const cur = vehicles.find((v) => v.id === vehicleId);
    if (userPicked && cur && !vehicleProblem(cur)) return;
    const best = sortedVehicles.find((v) => !vehicleProblem(v));
    if (best && best.id !== vehicleId) setVehicleId(best.id);
    if (!best && vehicleId) setVehicleId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles, equip]);

  const required = mission.required_roles ?? {};
  const crewCards = cards.filter((c) => crew.includes(c.id));
  const isAm = !!vehicles.find((v) => v.id === vehicleId)?.automedica;
  const missing = isAm
    ? [...(crewCards.filter((c) => c.role === "autista").length !== 1 ? ["1 autista"] : []),
       ...(crewCards.filter((c) => c.role === "medico").length !== 1 ? ["1 medico"] : []),
       ...(crewCards.length > 2 ? ["solo 2 persone"] : [])]
    : roleCheck(required, crewCards);
  const secondsLeft = Math.max(0, Math.floor((new Date(mission.expires_at).getTime() - now) / 1000));
  // corsa al servizio: posti pieni ma nessuno ancora arrivato → si può partire lo stesso, vince chi arriva prima
  const support = false; // mezzi di supporto tolti: chi arriva primo si aggiudica il posto
  const contest = !!mission.contestable && !support;
  const companion = waiting && !isAm; // ambulanza che va a dare il cambio alla mia automedica
  const full = mission.slots_taken >= mission.slots_total && !contest && !support && !companion;

  const available = useMemo(() => cards.filter(ready).sort((a, b) => b.energy - a.energy), [cards]);
  const unavailable = cards.filter((c) => !ready(c));

  function toggle(id: string) {
    setCrew((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= (isAm ? 2 : 4) ? cur : [...cur, id]);
  }

  // Equipaggio automatico: per ogni posto richiesto, il volontario pronto più riposato del grado giusto
  function autoCrew() {
    const pool = [...available];
    if (isAm) {
      const d = pool.find((c) => c.role === "autista" && !c.avanzato) ?? pool.find((c) => c.role === "autista");
      const m = pool.find((c) => c.role === "medico");
      setCrew([d, m].filter(Boolean).map((c) => c!.id));
      return;
    }
    const chosen: Card[] = [];
    const take = (pred: (c: Card) => boolean) => {
      const i = pool.findIndex(pred);
      if (i >= 0) chosen.push(pool.splice(i, 1)[0]);
    };
    const needAdv = (required.soccorritore_avanzato ?? 0) > 0;
    for (let i = 0; i < (required.autista ?? 0); i++) {
      if (needAdv) take((c) => c.role === "autista" && !!c.avanzato);
      if (chosen.length <= i) take((c) => c.role === "autista");
    }
    const slots = Object.entries(required).filter(([r]) => r !== "autista")
      .flatMap(([r, n]) => Array(n).fill(RANK[r])).sort((a, b) => b - a);
    // ogni autista avanzato copre un posto da avanzato
    for (const c of chosen) if (c.avanzato) { const j = slots.lastIndexOf(2); if (j >= 0) slots.splice(j, 1); }
    for (const rank of slots) {
      // preferisci il grado esatto, poi uno superiore
      const exact = pool.findIndex((c) => c.role !== "autista" && RANK[c.role] === rank);
      if (exact >= 0) { chosen.push(pool.splice(exact, 1)[0]); continue; }
      const before = chosen.length;
      take((c) => c.role !== "autista" && RANK[c.role] > rank);
      // mancano soccorritori: un altro autista avanzato fa da soccorritore
      if (chosen.length === before && rank <= 2) take((c) => c.role === "autista" && !!c.avanzato);
    }
    setCrew(chosen.map((c) => c.id));
  }

  async function claim() {
    if (!vehicleId) return;
    setBusy(true); setError(null);
    const { data, error } = await supabase.rpc("claim_mission",
      { p_mission_id: mission.id, p_vehicle_id: vehicleId, p_card_ids: crew });
    setBusy(false);
    if (error) {
      if (error.message.includes("VEHICLE_BUSY") || error.message.includes("CARD_BUSY")) {
        // mezzo o volontari appena presi (di solito dalla modalità automatica): aggiorno e scelgo il successivo
        const name = vehicles.find((x) => x.id === vehicleId)?.call_sign;
        await reloadRef.current();
        setUserPicked(false); setVehicleId(null);
        setError(`${error.message.includes("VEHICLE_BUSY") ? `${name ?? "Il mezzo"} è appena partito (probabilmente con la modalità automatica)` : "Un volontario è appena partito"}: ho aggiornato l'elenco, controlla e riprova.`);
        return;
      }
      setError(claimError(error.message)); return;
    }
    const v = vehicles.find((x) => x.id === vehicleId);
    const arr = new Date((data as { arrives_at: string }).arrives_at);
    onClaimed(`${v?.automedica ? "🩺" : "🚑"} ${v?.call_sign} in partenza! Arrivo sul posto alle ${arr.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}.`);
  }

  const canGo = !!vehicleId && crew.length > 0 && missing.length === 0 && !busy && (secondsLeft > 0 || contest || support || companion) && !full;
  const isEvent = mission.category === "grande_evento";
  const code = isEvent ? { label: "Grande evento · postazione", color: "#7C3AED" } : CODE[mission.code];

  return (
    <div style={{ position: "absolute", zIndex: 1100, right: 0, top: 0, bottom: 0, width: "min(420px, 100%)",
                  background: "#fff", boxShadow: "-6px 0 24px rgba(0,0,0,.25)", display: "flex", flexDirection: "column",
                  fontFamily: "system-ui, sans-serif" }}>
      {/* Testata */}
      <div style={{ background: code.color, color: "#fff", padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9, textTransform: "uppercase" }}>{code.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{mission.title}</div>
            {isEvent && <div style={{ fontSize: 13, opacity: 0.9 }}>{mission.venue} · {mission.description}</div>}
          </div>
          <button onClick={onClose} style={{ ...btn, background: "rgba(0,0,0,.25)", padding: "4px 10px" }}>✕</button>
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 14, flexWrap: "wrap" }}>
          <span>💶 {mission.reward_funds.toLocaleString("it-IT")} €</span>
          <span>🚑 {mission.slots_taken}/{mission.slots_total} mezzi</span>
          <span>⏱️ {contest ? "corsa in atto" : secondsLeft > 0 ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` : "scaduto"}</span>
        </div>
      </div>

      <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
        {waiting && (
          <div style={{ background: "#EFF6FF", border: "2px solid #2563EB", borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13 }}>
            🩺 <strong>La tua automedica è sul servizio e aspetta un&apos;ambulanza.</strong> Mandane una: entra anche se il servizio è pieno
            e prende metà premio. {mission.code === "rosso" ? "Poi l'automedica la segue in ospedale." : "Appena arriva, l'automedica si libera."}
          </div>
        )}
        {isAm && !waiting && (
          <div style={{ background: "#FEE2E2", borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13, color: "#7F1D1D" }}>
            🩺 <strong>Automedica:</strong> a bordo 1 autista + 1 medico. Arriva prima e si prende lo slot, poi aspetta una tua ambulanza
            (max 15 minuti, altrimenti rientra senza premio). {mission.code === "rosso" ? "Sul rosso segue l'ambulanza in ospedale." : "Sul giallo si libera all'arrivo dell'ambulanza."}
          </div>
        )}
        {contest && (() => {
          const theirs = mission.first_arrival ? new Date(mission.first_arrival) : null;
          const mine = eta ? new Date(now + eta.minutes * 60000) : null;
          const ahead = theirs && mine ? mine < theirs : null;
          return (
            <div style={{ background: "#FFF7ED", border: "2px solid #F97316", borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13 }}>
              <strong>⚔️ Servizio già preso da un'altra ambulanza</strong><br />
              Nessuno è ancora arrivato: se arrivi prima tu, il servizio è tuo. Chi arriva dopo torna in sede senza premio.
              {theirs && <><br />🏁 Loro arrivano alle <strong>{theirs.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</strong></>}
              {mine && <> · tu alle <strong>{mine.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</strong></>}
              {ahead !== null && <><br /><strong style={{ color: ahead ? "#15803D" : "#B91C1C" }}>{ahead ? "✅ Arriveresti prima tu!" : "❌ Arriveresti dopo di loro"}</strong></>}
            </div>
          );
        })()}

        {support && (
          <div style={{ background: "#EFF6FF", border: "2px solid #2563EB", borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13 }}>
            <strong>➕ Mezzo di supporto</strong><br />
            Hai già {mission.my_vehicles} {mission.my_vehicles === 1 ? "ambulanza" : "ambulanze"} su questo servizio. Puoi mandarne un&apos;altra per arrivare prima degli altri:
            appena qualcuno arriva sul posto restano <strong>solo i primi {mission.slots_total} arrivati</strong>, le altre tornano in sede senza premio.
            {mission.code === "rosso" && " Sul codice rosso, con due mezzi tuoi il servizio è bloccato agli altri."}
          </div>
        )}

        {contest && (
          <div style={{ background: "#FFEDD5", borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13 }}>
            ⚔️ <strong>Posti già presi, ma nessuno è ancora arrivato.</strong> Se arrivi prima tu ti prendi lo slot:
            l'ultima ambulanza ad arrivare senza posto torna in sede senza ricompensa.
          </div>
        )}

        {/* Requisiti */}
        <div style={{ fontSize: 13, background: "#f6f6f4", borderRadius: 10, padding: 10, marginBottom: 14 }}>
          <strong>Equipaggio:</strong>{" "}
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4, verticalAlign: "middle" }}>
            {Object.entries(isAm ? { autista: 1, medico: 1 } : required).map(([r, n]) => (
              <span key={r} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <strong>{n}×</strong><RoleBadge c={{ role: r as Card["role"] }} small />
              </span>
            ))}
          </span>
          {(required.soccorritore_avanzato ?? 0) >= 2 && <><br /><span style={{ color: "#555" }}>L&apos;autista avanzato vale come uno dei soccorritori avanzati. Infermiere e medico valgono come soccorritori avanzati.</span></>}
          {(mission.code === "rosso" || mission.code === "giallo") && (
            <><br /><span style={{ color: "#9D174D", fontWeight: 600 }}>
              🩺 Bonus premio: {mission.title.startsWith("Arresto cardiaco") ? "infermiere +35%, medico +60% (fino a +100%)"
                : mission.code === "rosso" ? "infermiere +15%, medico +25%" : "infermiere +5%, medico +10%"}
            </span></>
          )}
          {mission.requires.length > 0 && <><br /><strong>Presidi:</strong> {mission.requires.map((r) => REQ[r] ?? r).join(", ")}</>}
        </div>

        {/* Mezzo */}
        <div style={{ fontWeight: 700, marginBottom: 6 }}>1. Mezzo</div>
        {vehicles.length === 0 && <div style={{ color: "#666", fontSize: 14 }}>Non hai mezzi: comprane uno nel garage.</div>}
        <div style={{ display: "grid", gap: 6 }}>
          {sortedVehicles.map((v, i) => {
            const prob = vehicleProblem(v);
            const sel = vehicleId === v.id;
            return (
              <button key={v.id} disabled={!!prob} onClick={() => { setVehicleId(v.id); setUserPicked(true); }}
                      style={{ textAlign: "left", padding: 10, borderRadius: 10, cursor: prob ? "not-allowed" : "pointer",
                               background: sel ? "#111" : "#fff", color: sel ? "#fff" : prob ? "#999" : "#111",
                               border: sel ? "2px solid #111" : "1px solid #ddd", display: "flex", justifyContent: "space-between" }}>
                <strong>{v.automedica && "🩺 "}{v.call_sign}{v.lent_from && <span style={{ fontWeight: 400, fontSize: 12 }}> · 🤝 da {v.lent_from}</span>}</strong>
                <span style={{ fontSize: 12 }}>{prob ?? (sel && eta ? `${eta.km} km · ${eta.minutes} min` : `${distOf(v) < 999 ? `${distOf(v).toFixed(1).replace(".", ",")} km` : "idoneo"}${i === 0 ? " · più vicina" : ""}`)}</span>
              </button>
            );
          })}
        </div>

        {/* Equipaggio */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0 6px" }}>
          <div style={{ fontWeight: 700 }}>2. Equipaggio <span style={{ fontWeight: 400, color: "#888" }}>({crew.length}/4)</span></div>
          <button onClick={autoCrew} style={{ ...btn, fontSize: 12, padding: "6px 10px", background: "#1E3A8A" }}>⚡ Automatico</button>
        </div>
        {missing.length > 0 && crew.length > 0 && (
          <div style={{ fontSize: 12, color: "#B91C1C", marginBottom: 6 }}>
            Manca: {missing.map((r) => ROLE[r as Card["role"]]?.label ?? r).join(", ")}
          </div>
        )}
        {(() => {
          const ep = crewCards.filter((c) => c.rarity === "epica").length, lg = crewCards.filter((c) => c.rarity === "leggendaria").length;
          if (!ep && !lg) return null;
          const money = ep * 10 + lg * 25, time = Math.min(50, ep * 10 + lg * 20);
          return (
            <div style={{ fontSize: 13, fontWeight: 700, background: "linear-gradient(90deg,#FEF3C7,#F5F3FF)", color: "#92400E",
                          borderRadius: 10, padding: "6px 10px", marginBottom: 8 }}>
              ✨ Carte rare a bordo: <span style={{ color: "#15803D" }}>+{money}% soldi</span> · <span style={{ color: "#5B21B6" }}>-{time}% tempo</span>
            </div>
          );
        })()}
        {available.length === 0 && <div style={{ color: "#666", fontSize: 14 }}>Nessun volontario pronto. Apri il pacchetto nella Squadra o aspetta che finiscano il riposo.</div>}
        <div style={{ display: "grid", gap: 6 }}>
          {available.map((c) => {
            const sel = crew.includes(c.id);
            return (
              <button key={c.id} onClick={() => toggle(c.id)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 10, cursor: "pointer",
                               textAlign: "left", background: sel ? "#EFF6FF" : "#fff",
                               border: sel ? "2px solid #2563EB" : "1px solid #ddd" }}>
                <span style={{ lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: c.avatar_url
                  ? `<img src="${c.avatar_url}" width="40" height="40" style="border-radius:8px;object-fit:cover"/>`
                  : avatarSvg(c.volunteer_id, c.gender, c.rarity, 40) }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.first_name} {c.last_name}</div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}><RoleBadge c={c} small />{c.lent_from && ` · 🤝 da ${c.lent_from}`}</div>
                </div>
                <div style={{ width: 54, textAlign: "right", fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: c.energy >= 60 ? "#16A34A" : c.energy >= 30 ? "#CA8A04" : "#DC2626" }}>🔋 {c.services_left ?? 15}/15</div>
                </div>
                <span style={{ fontSize: 18 }}>{sel ? "✅" : "⬜"}</span>
              </button>
            );
          })}
        </div>
        {unavailable.length > 0 && (
          <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
            Non disponibili: {unavailable.map((c) => `${c.first_name} (${c.lent_to ? "prestato" : c.state === "in_servizio" ? "in servizio" : "a riposo"})`).join(", ")}
          </div>
        )}
      </div>

      {/* Partenza */}
      <div style={{ padding: 16, borderTop: "1px solid #eee" }}>
        {error && <div style={{ color: "#B91C1C", fontSize: 14, marginBottom: 8 }}>{error}</div>}
        <button onClick={claim} disabled={!canGo}
                style={{ ...btn, width: "100%", padding: 14, fontSize: 17, background: code.color, opacity: canGo ? 1 : 0.4 }}>
          {busy ? "Invio…" : full ? "Servizio già coperto" : support ? "➕ Manda in supporto" : contest ? "⚔️ Parti e arriva primo!" : secondsLeft <= 0 ? "Servizio scaduto" : isEvent ? "🏟️ Vai in postazione" : "🚨 Parti!"}
        </button>
      </div>
    </div>
  );
}
