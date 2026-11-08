"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { playSound } from "@/lib/sound";
import { supabase, type MissionPin } from "@/lib/supabase";
import { avatarSvg } from "@/components/avatar";
import { ROLE, RoleBadge, type Card } from "@/components/VolunteerCard";

type Vehicle = { id: string; call_sign: string; status: string; wear: number; certification: string; equipment: string[];
  lent_to: string | null; lent_from: string | null; base_lat: number | null; base_lng: number | null; transfer_only?: boolean; long_emergency?: boolean;
  fuel_liters?: number; electric?: boolean | null; battery_pct?: number; range_km?: number | null; automedica?: boolean; moto?: boolean; boat?: boolean; ordinaria?: boolean; aib?: boolean; moor_lat?: number | null; moor_lng?: number | null };

const MAX_KM = 25; // oltre questa distanza dalla sede il mezzo non può prendere il servizio
function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, r = Math.PI / 180;
  const x = Math.sin((bLat - aLat) * r / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin((bLng - aLng) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
type Equip = { code: string; provides: string[] };

const CERT_RANK: Record<string, number> = { trasporto: 0, base: 1, avanzata_rianimazione: 2 };
const RANK: Record<string, number> = { soccorritore_base: 1, soccorritore_avanzato: 2, infermiere: 2, caposervizio: 3, medico: 3, autista: 0, bagnino: 0, aib: 0 };

// Gruppi per la scelta dei soccorritori, nell'ordine mostrato.
const CREW_GROUPS: { key: string; label: string; match: (c: Card) => boolean }[] = [
  { key: "bagnino", label: "🛟 Bagnini", match: (c) => c.role === "bagnino" },
  { key: "aib", label: "🔥 Antincendio (AIB)", match: (c) => c.role === "aib" },
  { key: "socc_av", label: "💉 Soccorritori avanzati", match: (c) => c.role === "soccorritore_avanzato" },
  { key: "socc_base", label: "🩹 Soccorritori base", match: (c) => c.role === "soccorritore_base" },
  { key: "autista_base", label: "🚗 Autisti base", match: (c) => c.role === "autista" && !c.avanzato },
  { key: "autista_av", label: "🚑 Autisti avanzati", match: (c) => c.role === "autista" && !!c.avanzato },
  { key: "infermiere", label: "🩺 Infermieri", match: (c) => c.role === "infermiere" },
  { key: "medico", label: "⚕️ Medici", match: (c) => c.role === "medico" },
  { key: "caposervizio", label: "⭐ Caposervizio", match: (c) => c.role === "caposervizio" },
];
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
  // se il servizio chiede il medico serve proprio un medico (non basta un caposervizio)
  if (crew.filter((c) => c.role === "medico").length < (required.medico ?? 0)) missing.push("medico");
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
  if (m.includes("MISSING_ROLE:medico")) return "Questo servizio richiede un medico nell'equipaggio.";
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
  if (m.includes("SEA_ONLY_BOAT")) return "🌊 In mare ci va solo la barca: l'ambulanza può andare solo al porto a prendere il paziente della tua barca.";
  if (m.includes("BOAT_ONLY_SEA")) return "⛵ La barca fa solo servizi in mare.";
  if (m.includes("FIRE_NEEDS_AIB")) return "🔥 All'incendio può andare solo un mezzo antincendio boschivo (AIB).";
  if (m.includes("AIB_ONLY_FIRE")) return "🔥 Il mezzo antincendio va solo sugli incendi boschivi.";
  if (m.includes("AIB_CREW")) return "🔥 Sul mezzo antincendio servono almeno 2 persone, con almeno 1 volontario AIB.";
  if (m.includes("TRANSFER_NEEDS_LONG")) return "🔁 I trasferimenti li fa solo un'ambulanza a passo lungo.";
  if (m.includes("DIMISSIONE_NEEDS_ORDINARIA")) return "🚗 Dimissioni e trasporti ordinari li fa solo una macchina ordinaria.";
  if (m.includes("BOAT_CREW")) return "⛵ Sulla barca servono 1 bagnino e 1 o 2 soccorritori, niente medici.";
  if (m.includes("BAGNINO_ONLY_BOAT")) return "🛟 I bagnini montano solo sulle barche, non sui mezzi di terra.";
  if (m.includes("HELI_NOT_ACTIVE")) return "🚁 L'elisoccorso non è attivo: attivalo pagando (resta attivo 10 minuti).";
  if (m.includes("HELI_ALREADY_ACTIVE")) return "🚁 L'elisoccorso è già attivo: mandalo su un servizio.";
  if (m.includes("HELI_ONLY_EMERGENCY")) return "🚁 L'elisoccorso va solo sulle emergenze (anche in mare).";
  if (m.includes("TOO_LATE")) return "🚁 Troppo tardi: qualcuno è già arrivato sul posto.";
  if (m.includes("MOTO_CREW")) return "🛵 Sulla moto vanno solo 1 o 2 soccorritori.";
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
  const crewRef = useRef<HTMLDivElement>(null);
  // elisoccorso a pagamento: si attiva per 10 minuti, vale per un solo servizio
  const [heli, setHeli] = useState<{ price: number; active_until: string | null; funds: number } | null>(null);
  const loadHeli = () => supabase.rpc("heli_status").then(({ data }) => setHeli(((data as { price: number; active_until: string | null; funds: number }[]) ?? [])[0] ?? null));
  useEffect(() => { loadHeli(); }, []);
  // la mia automedica è sul servizio e aspetta un'ambulanza: posso mandarla anche a servizio pieno
  const waiting = !!mission.my_automedica_waiting;
  useEffect(() => {
    // ricarica mezzi e volontari ogni 10 s: chi esce dal PS diventa subito selezionabile
    const loadAll = async () => {
      const [v, e, c] = await Promise.all([
        supabase.from("my_fleet").select("id,call_sign,status,wear,certification,equipment,lent_to,lent_from,base_lat,base_lng,transfer_only,long_emergency,fuel_liters,electric,battery_pct,range_km,automedica,moto,boat,ordinaria,aib,moor_lat,moor_lng").order("call_sign"),
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
    if (v.transfer_only && !v.long_emergency && mission.transport !== "trasferimento") return "solo trasferimenti (passo lungo)";
    const isOrdinario = mission.category === "ordinario" && mission.transport !== "trasferimento";
    if (mission.transport === "trasferimento" && !v.transfer_only) return "per i trasferimenti serve un passo lungo";
    if (isOrdinario && !v.ordinaria) return "dimissioni/ordinari: serve una macchina ordinaria";
    if (v.ordinaria && !isOrdinario) return "la macchina ordinaria fa solo dimissioni e ordinari";
    const fire = mission.category === "grande_evento" && !mission.event_id && mission.venue === "AIB";
    if (fire && !v.aib) return "all'incendio va solo un mezzo antincendio (AIB)";
    if (v.aib && !fire) return "il mezzo antincendio va solo sugli incendi boschivi";
    const sea = mission.category === "mare";
    if (v.boat && !sea) return "solo servizi in mare";
    if (sea && !v.boat && !waiting) return "in mare va solo la barca";
    if (v.boat) {
      if (v.moor_lat != null && v.moor_lng != null) {
        const d = km(v.moor_lat, v.moor_lng, mission.lat, mission.lng);
        if (d > 40) return `troppo lontana dall'ormeggio (${Math.round(d)} km)`;
      }
      if (v.status !== "disponibile") return v.status === "in_servizio" ? "in servizio" : v.status === "manutenzione" ? "in officina" : "non disponibile";
      if (v.wear >= 80) return "da revisionare";
      if ((v.fuel_liters ?? 99) < 5) return "senza carburante: fai il pieno";
      return null;
    }
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
  const sortedVehicles = vehicles.filter((v) => !v.transfer_only || mission.transport === "trasferimento" || v.long_emergency).sort((a, b) =>
    (vehicleProblem(a) ? 1 : 0) - (vehicleProblem(b) ? 1 : 0) || (a.boat ? 0 : 1) - (b.boat ? 0 : 1) || (a.automedica ? 1 : 0) - (b.automedica ? 1 : 0) || distOf(a) - distOf(b));

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

  // appena scelgo il mezzo, scorre in basso alla scelta dei soccorritori (comodo con tante ambulanze)
  useEffect(() => {
    if (vehicleId && userPicked) crewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  const required = mission.required_roles ?? {};
  const crewCards = cards.filter((c) => crew.includes(c.id));
  const isAm = !!vehicles.find((v) => v.id === vehicleId)?.automedica;
  const isMoto = !!vehicles.find((v) => v.id === vehicleId)?.moto;
  const isBoat = !!vehicles.find((v) => v.id === vehicleId)?.boat;
  const isAib = !!vehicles.find((v) => v.id === vehicleId)?.aib;
  const SOCC = ["soccorritore_base", "soccorritore_avanzato"];
  const seaSocc = crewCards.filter((c) => SOCC.includes(c.role)).length;
  const aibCount = crewCards.filter((c) => c.role === "aib").length;
  const missing = isAib
    ? [...(crewCards.length < 2 ? ["almeno 2 persone"] : []),
       ...(aibCount < 1 ? ["1 volontario AIB"] : []),
       ...(crewCards.some((c) => c.role !== "aib" && !SOCC.includes(c.role)) ? ["solo AIB e soccorritori"] : [])]
    : isBoat
    ? [...(crewCards.some((c) => c.role === "bagnino") ? [] : ["1 bagnino"]),
       ...(seaSocc >= 1 && seaSocc <= 2 ? [] : ["1 o 2 soccorritori"]),
       ...(crewCards.some((c) => c.role !== "bagnino" && !SOCC.includes(c.role)) ? ["solo bagnino e soccorritori"] : [])]
    : isMoto
    ? [...(crewCards.length === 0 ? ["1 soccorritore"] : []), ...(crewCards.some((c) => !SOCC.includes(c.role)) ? ["solo soccorritori"] : [])]
    : isAm
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
    setCrew((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= (isAm ? 2 : isBoat ? 3 : 4) ? cur : [...cur, id]);
  }

  // Equipaggio automatico: per ogni posto richiesto, il volontario pronto più riposato del grado giusto
  function autoCrew() {
    const pool = [...available];
    if (isMoto) {
      const s1 = pool.find((c) => c.role === "soccorritore_base") ?? pool.find((c) => c.role === "soccorritore_avanzato");
      setCrew(s1 ? [s1.id] : []);
      return;
    }
    if (isBoat) {
      // barca: 1 bagnino + 1 soccorritore avanzato
      const b = pool.find((c) => c.role === "bagnino");
      const s = pool.find((c) => c.role === "soccorritore_base") ?? pool.find((c) => c.role === "soccorritore_avanzato");
      setCrew([b, s].filter(Boolean).map((c) => c!.id));
      return;
    }
    if (isAib) {
      // incendio: 2 volontari AIB
      const picked = pool.filter((c) => c.role === "aib").slice(0, 2);
      setCrew(picked.map((c) => c.id));
      return;
    }
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
    // prima i medici richiesti (un caposervizio non basta)
    for (let i = 0; i < (required.medico ?? 0); i++) take((c) => c.role === "medico");
    const slots = Object.entries(required).filter(([r]) => r !== "autista" && r !== "medico")
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

  async function activateHeli() {
    if (!heli) return;
    if (!window.confirm(`Attivare l'elisoccorso per ${Number(heli.price).toLocaleString("it-IT")} €?\n\nPer 10 minuti puoi mandare tutti gli elicotteri che vuoi, su qualsiasi servizio: arrivano prima di tutti e vincono a tavolino. Poi va ripagato.`)) return;
    setBusy(true); setError(null);
    const { error } = await supabase.rpc("activate_heli");
    setBusy(false);
    if (error) { setError(error.message.includes("INSUFFICIENT_FUNDS") ? "Non hai abbastanza soldi per l'elisoccorso." : claimError(error.message)); return; }
    loadHeli();
  }
  async function sendHeli() {
    setBusy(true); setError(null);
    const { data, error } = await supabase.rpc("call_helicopter", { p_mission: mission.id });
    setBusy(false);
    if (error) { setError(claimError(error.message)); return; }
    const arr = new Date((data as { arrives_at: string }).arrives_at);
    onClaimed(`🚁 Elisoccorso in volo! Sul posto alle ${arr.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}: il servizio è tuo.`);
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
    playSound("dispatch");
    onClaimed(`${v?.boat ? "⛵" : v?.moto ? "🛵" : v?.automedica ? "🩺" : "🚑"} ${v?.call_sign} in partenza! Arrivo sul posto alle ${arr.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}.`);
  }

  const canGo = !!vehicleId && crew.length > 0 && missing.length === 0 && !busy && (secondsLeft > 0 || contest || support || companion) && !full;
  const isEvent = mission.category === "grande_evento";
  const isFire = isEvent && !mission.event_id && mission.venue === "AIB";
  const isMaxi = isEvent && !mission.event_id && mission.venue !== "AIB";
  const code = isFire ? { label: "🔥 Incendio boschivo", color: "#C2410C" }
    : isMaxi ? { label: "🆘 Maxi-emergenza", color: "#DC2626" }
    : isEvent ? { label: "Grande evento · postazione", color: "#7C3AED" } : CODE[mission.code];

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
            {isEvent && <div style={{ fontSize: 13, opacity: 0.9 }}>{(isMaxi || isFire) ? mission.description : `${mission.venue} · ${mission.description}`}</div>}
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
        {(mission.category === "emergenza_118" || mission.category === "mare") && heli && (() => {
          const left = heli.active_until ? Math.max(0, Math.floor((new Date(heli.active_until).getTime() - now) / 1000)) : 0;
          return (
            <div style={{ background: "linear-gradient(135deg,#FFF7ED,#FFEDD5)", border: "2px solid #EA580C", borderRadius: 12, padding: 10, marginBottom: 12, fontSize: 13 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <img src="/vehicles/h-pegaso-map.png" alt="" style={{ width: 64, height: "auto" }} />
                <div style={{ flex: 1 }}>
                  <strong>🚁 Elisoccorso Avincis</strong><br />
                  Velocissimo, va ovunque: arriva prima di tutti e <strong>vince a tavolino</strong>, porta il paziente in ospedale e torna alla sua base.
                  Attivo per 10 minuti: in quel tempo <strong>tutti gli elicotteri Avincis sono tuoi</strong>, mandane quanti vuoi.
                </div>
              </div>
              {left > 0 ? (
                <button disabled={busy} onClick={sendHeli}
                        style={{ ...btn, width: "100%", marginTop: 8, background: "#EA580C" }}>
                  🚁 Manda l&apos;elisoccorso qui · attivo ancora {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
                </button>
              ) : (
                <button disabled={busy || Number(heli.funds) < Number(heli.price)} onClick={activateHeli}
                        style={{ ...btn, width: "100%", marginTop: 8, background: "#9A3412", opacity: Number(heli.funds) < Number(heli.price) ? 0.5 : 1 }}>
                  Attiva per 10 minuti · {Number(heli.price).toLocaleString("it-IT")} € (metà dei tuoi soldi)
                </button>
              )}
              {left <= 0 && Number(heli.funds) < Number(heli.price) && (
                <div style={{ marginTop: 6, color: "#9A3412" }}>
                  Costa metà dei soldi in cassa, minimo 3 milioni: in cassa hai {Number(heli.funds).toLocaleString("it-IT")} €, non bastano.
                </div>
              )}
            </div>
          );
        })()}
        {waiting && mission.category !== "mare" && (
          <div style={{ background: "#EFF6FF", border: "2px solid #2563EB", borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13 }}>
            🩺 <strong>La tua automedica è sul servizio e aspetta un&apos;ambulanza.</strong> Mandane una: entra anche se il servizio è pieno
            e prende metà premio. {mission.code === "rosso" ? "Poi l'automedica la segue in ospedale." : "Appena arriva, l'automedica si libera."}
          </div>
        )}
        {isBoat && (
          <div style={{ background: "#E0F2FE", borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13, color: "#0C4A6E" }}>
            ⛵ <strong>Barca:</strong> parte dall&apos;ormeggio, recupera il paziente in mare e lo porta al porto più vicino,
            dove aspetta una tua ambulanza (max 15 minuti, altrimenti niente premio). A bordo almeno 1 autista e 1 soccorritore.
          </div>
        )}
        {mission.category === "mare" && waiting && (
          <div style={{ background: "#E0F2FE", borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13, color: "#0C4A6E" }}>
            🚑 La tua barca porta il paziente al porto: manda un&apos;ambulanza <strong>al porto</strong> a prenderlo.
          </div>
        )}
        {isAm && !waiting && (
          <div style={{ background: "#FEE2E2", borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13, color: "#7F1D1D" }}>
            {isMoto ? <>🛵 <strong>Moto:</strong> a bordo 1 o 2 soccorritori (il secondo è facoltativo).</> : <>🩺 <strong>Automedica:</strong> a bordo 1 autista + 1 medico.</>} Arriva prima e si prende lo slot, poi aspetta una tua ambulanza
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
            {Object.entries(isMoto ? { soccorritore_base: 1 } : isAm ? { autista: 1, medico: 1 } : isBoat ? { bagnino: 1, soccorritore_base: 1 } : isAib ? { aib: 2 } : required).map(([r, n]) => (
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
        {vehicles.length > 0 && sortedVehicles.every((v) => vehicleProblem(v)) && (() => {
          // Aiuto: nessun mezzo va bene -> spiego che cosa serve per questo tipo di servizio
          const fire = mission.category === "grande_evento" && !mission.event_id && mission.venue === "AIB";
          const need = mission.transport === "trasferimento" ? "un'ambulanza a passo lungo (Garage → categoria passi lunghi). Fa solo trasferimenti e paga +25%."
            : mission.category === "ordinario" ? "una macchina ordinaria (Garage → 🚗 Ordinarie), oppure converti un'ambulanza in «solo ordinari» per 8.000 €."
            : mission.category === "mare" ? "una barca ormeggiata entro 40 km, con a bordo 1 bagnino e 1 soccorritore avanzato."
            : fire ? "un mezzo antincendio (Garage → 🔥 Antincendio) con almeno 2 persone, di cui 1 volontario AIB."
            : "un'ambulanza libera entro 20 km dalla sua sede, con gasolio, revisionata e con i presidi richiesti.";
          const busy = sortedVehicles.filter((v) => ["in servizio", "in officina", "da revisionare"].includes(vehicleProblem(v) ?? "")).length;
          return (
            <div style={{ background: "#EFF6FF", color: "#1E3A8A", borderRadius: 10, padding: "8px 10px", fontSize: 13, marginBottom: 8 }}>
              💡 <strong>Nessun tuo mezzo può partire.</strong> Per questo servizio serve {need}
              {busy > 0 && <> {busy === 1 ? "Un mezzo adatto è" : `${busy} mezzi sono`} occupati o in officina: riprova tra poco.</>}
              <br /><span style={{ opacity: 0.8 }}>Il motivo per ogni mezzo è scritto a destra, in grigio.</span>
            </div>
          );
        })()}
        <div style={{ display: "grid", gap: 6 }}>
          {sortedVehicles.map((v, i) => {
            const prob = vehicleProblem(v);
            const sel = vehicleId === v.id;
            return (
              <button key={v.id} disabled={!!prob} onClick={() => { setVehicleId(v.id); setUserPicked(true); }}
                      style={{ textAlign: "left", padding: 10, borderRadius: 10, cursor: prob ? "not-allowed" : "pointer",
                               background: sel ? "#111" : "#fff", color: sel ? "#fff" : prob ? "#999" : "#111",
                               border: sel ? "2px solid #111" : "1px solid #ddd", display: "flex", justifyContent: "space-between" }}>
                <strong>{v.boat ? "⛵ " : v.moto ? "🛵 " : v.automedica ? "🩺 " : ""}{v.call_sign}{v.lent_from && <span style={{ fontWeight: 400, fontSize: 12 }}> · 🤝 da {v.lent_from}</span>}</strong>
                <span style={{ fontSize: 12 }}>{prob ?? (sel && eta ? `${eta.km} km · ${eta.minutes} min` : `${distOf(v) < 999 ? `${distOf(v).toFixed(1).replace(".", ",")} km` : "idoneo"}${i === 0 ? " · più vicina" : ""}`)}</span>
              </button>
            );
          })}
        </div>

        {/* Equipaggio */}
        <div ref={crewRef} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0 6px", scrollMarginTop: 8 }}>
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
        {(() => {
          const card = (c: Card) => {
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
          };
          return (
            <div style={{ display: "grid", gap: 12 }}>
              {CREW_GROUPS.map((g) => {
                const list = available.filter(g.match);
                if (!list.length) return null;
                return (
                  <div key={g.key}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".4px", margin: "0 2px 5px" }}>
                      {g.label} <span style={{ color: "#9ca3af" }}>({list.length})</span>
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>{list.map(card)}</div>
                  </div>
                );
              })}
            </div>
          );
        })()}
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
