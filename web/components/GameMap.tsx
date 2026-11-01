"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase, type MissionPin, type BasePin, type Organization } from "@/lib/supabase";
import FactionEmblem, { emblemSvg } from "@/components/FactionEmblem";
import MissionPanel from "@/components/MissionPanel";
import FleetPanel from "@/components/FleetPanel";
import ChatPanel from "@/components/ChatPanel";
import { fetchLeg, getLeg, legKey, pointAt, slice, type LatLng } from "@/components/roads";

type RoutePoint = { lat: number; lng: number; t: string; label: string };
type Hospital = { id: string; name: string; capabilities: string[]; lat: number; lng: number };

// Posizione dell'ambulanza lungo il percorso (sede → posto → ospedale → sede) e cosa sta facendo
function alongRoute(route: RoutePoint[], now: number) {
  const pts = route.map((p) => ({ ...p, ms: new Date(p.t).getTime() }));
  if (now <= pts[0].ms) return { lat: pts[0].lat, lng: pts[0].lng, moving: false, text: "In partenza", until: pts[0].ms, leg: 0, f: 0 };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (now <= b.ms) {
      const f = (now - a.ms) / Math.max(1, b.ms - a.ms);
      const still = a.lat === b.lat && a.lng === b.lng;
      const text = still
        ? (a.label === "Sul posto" ? "Soccorso in corso" : a.label === "A casa del paziente" ? "Accompagna il paziente in casa" : `In ospedale · ${a.label}`)
        : a.label === b.label ? (i > 0 && pts[i - 1].lat === a.lat && pts[i - 1].lng === a.lng ? "Esce dall'ospedale" : "Entra al Pronto Soccorso")
        : b.label === "Sede" ? "Rientro in sede" : b.label === "Sul posto" ? "In viaggio verso il posto"
        : a.label === "Sede" ? `In viaggio verso ${b.label}`
        : b.label === "A casa del paziente" ? "Riporta il paziente a casa" : `Trasporto verso ${b.label}`;
      if (!still) {
        const road = getLeg(legKey(a, b));
        if (road) { const [lat, lng] = pointAt(road, f); return { lat, lng, moving: true, text, until: b.ms, leg: i, f }; }
      }
      return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f, moving: !still, text, until: b.ms, leg: i, f };
    }
  }
  const last = pts[pts.length - 1];
  return { lat: last.lat, lng: last.lng, moving: false, text: "In sede", until: last.ms, leg: pts.length, f: 1 };
}

// Strada ancora da fare: resto del tratto attuale + tratti successivi
function remainingPath(route: RoutePoint[], leg: number, f: number): LatLng[][] {
  const out: LatLng[][] = [];
  for (let i = leg; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1];
    if (a.lat === b.lat && a.lng === b.lng) continue;
    const from = i === leg ? f : 0;
    const road = getLeg(legKey(a, b));
    out.push(road ? slice(road, from) : [[a.lat + (b.lat - a.lat) * from, a.lng + (b.lng - a.lng) * from], [b.lat, b.lng]]);
  }
  return out;
}

const hospitalIcon = L.divIcon({
  className: "",
  html: `<div style="width:30px;height:30px;border-radius:8px;background:#fff;border:2px solid #DC2626;display:flex;
         align-items:center;justify-content:center;font-size:18px;box-shadow:0 1px 4px rgba(0,0,0,.4)">🏥</div>`,
  iconSize: [30, 30], iconAnchor: [15, 15],
});

type Assignment = {
  id: string; status: string; assigned_at: string; arrives_at: string; completes_at: string;
  completed_at: string | null; reward_funds: number | null; title: string; code: MissionPin["code"];
  call_sign: string; base_lat: number; base_lng: number; lat: number; lng: number;
  route: RoutePoint[] | null; hospital: string | null; vehicle_image: string | null;
  vehicle_id: string; route_ends_at: string; transport: string | null;
};

type OtherAmbulance = {
  id: string; status: string; assigned_at: string; arrives_at: string; completes_at: string; route: RoutePoint[] | null;
  title: string; code: MissionPin["code"]; call_sign: string; vehicle_image: string | null;
  org_id: string; org_name: string; org_type: BasePin["org_type"]; logo_url: string | null; hospital: string | null;
  vehicle_id: string; route_ends_at: string;
  base_lat: number; base_lng: number; lat: number; lng: number;
};

type UpcomingEvent = { id: string; title: string; kind: string; starts_at: string; show_at: string | null;
  time_confirmed: boolean; venue: string; slots: number; reward_funds: number; lat: number; lng: number };
const KIND_ICON: Record<string, string> = { calcio: "⚽", basket: "🏀", concerto: "🎤", teatro: "🎭", altro: "🎪" };

// Icona dei grandi eventi: emoji del tipo su cerchio (viola se prenotabile, grigio se apre più tardi)
function eventIcon(kind: string, open: boolean) {
  const s = open ? 40 : 32;
  return L.divIcon({
    className: "",
    html: `<div style="width:${s}px;height:${s}px;border-radius:50%;display:flex;align-items:center;justify-content:center;
           font-size:${open ? 22 : 17}px;background:${open ? "#7C3AED" : "#fff"};border:3px solid ${open ? "#fff" : "#7C3AED"};
           box-shadow:0 2px 6px rgba(0,0,0,.4);${open ? "animation:ev-pulse 1.4s infinite" : "opacity:.85"}">${KIND_ICON[kind] ?? "🎪"}</div>`,
    iconSize: [s, s], iconAnchor: [s / 2, s / 2],
  });
}

// Ambulanza in movimento: lampeggia se in viaggio, ferma sul posto durante l'intervento
// Per ogni mezzo, solo il servizio più recente, finché il percorso (rientro compreso) non è finito
function onTheRoad<T extends { vehicle_id: string; assigned_at: string; route_ends_at: string }>(list: T[], now: number) {
  const latest = new Map<string, T>();
  for (const a of list) {
    const cur = latest.get(a.vehicle_id);
    if (!cur || a.assigned_at > cur.assigned_at) latest.set(a.vehicle_id, a);
  }
  return Array.from(latest.values()).filter((a) => now < new Date(a.route_ends_at).getTime() + 10_000);
}

// Lampeggianti accesi solo nei codici giallo e rosso, mentre viaggia (non al rientro in sede)
function sirens(code: string, pos: { moving: boolean; text: string }) {
  return (code === "giallo" || code === "rosso") && pos.moving && pos.text !== "Rientro in sede";
}

// Ambulanza di un altro giocatore: più piccola, con lo stemma della sua associazione
function otherAmbulanceIcon(onScene: boolean, img: string | null, facingRight: boolean, type: BasePin["org_type"], logo: string | null) {
  const pic = img
    ? `<img src="${img.replace(/\.png$/, "-map.png")}" style="width:48px;height:auto;display:block;transform:scaleX(${facingRight ? -1 : 1});opacity:.92" alt=""/>`
    : `<div style="font-size:22px">🚑</div>`;
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));${onScene ? "" : "animation:amb-blink .6s steps(1) infinite"}">
             ${pic}
             <div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);width:18px;height:18px;border-radius:50%;
                         background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 2px rgba(0,0,0,.5)">${emblemSvg(type, 14, logo)}</div>
           </div>`,
    iconSize: [48, 26], iconAnchor: [24, 13],
  });
}

// Ambulanza vista di profilo (immagine del modello), girata verso dove sta andando
function ambulanceIcon(onScene: boolean, img: string | null, facingRight: boolean) {
  if (!img) {
    return L.divIcon({
      className: "",
      html: `<div style="font-size:26px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));
             ${onScene ? "" : "animation:amb-blink .6s steps(1) infinite"}">🚑</div>`,
      iconSize: [30, 30], iconAnchor: [15, 15],
    });
  }
  const small = img.replace(/\.png$/, "-map.png");
  return L.divIcon({
    className: "",
    html: `<img src="${small}" style="width:60px;height:auto;display:block;transform:scaleX(${facingRight ? -1 : 1});
           filter:drop-shadow(0 1px 2px rgba(0,0,0,.6));${onScene ? "" : "animation:amb-blink .6s steps(1) infinite"}" alt=""/>`,
    iconSize: [60, 30], iconAnchor: [30, 15],
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
function baseIcon(type: BasePin["org_type"], mine: boolean, logo?: string | null) {
  const svg = emblemSvg(type, mine ? (logo ? 38 : 30) : (logo ? 30 : 22), logo);
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
  const [notes, setNotes] = useState<{ id: string; text: string }[]>([]);
  const [moneyPops, setMoneyPops] = useState<{ key: number; amount: number; label: string }[]>([]);
  const [shownFunds, setShownFunds] = useState<number | null>(null);
  const [fundsFlash, setFundsFlash] = useState(false);
  const [hiddenNotes, setHiddenNotes] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MissionPin | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [others, setOthers] = useState<OtherAmbulance[]>([]);
  const [fleetKey, setFleetKey] = useState(0);
  const [, setRoadsLoaded] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [upcoming, setUpcoming] = useState<UpcomingEvent[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);

  useEffect(() => {
    supabase.from("hospitals_map").select("*").then(({ data, error }) => { if (!error) setHospitals((data as Hospital[]) ?? []); });
  }, []);

  async function refreshOrg() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from("organizations")
      .select("id,name,type,funds,reputation,logo_url").eq("owner_id", session.user.id).maybeSingle();
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
          const amount = a.reward_funds ?? 0, key = Date.now() + Math.random();
          setMoneyPops((p) => [...p, { key, amount, label: `${a.call_sign} · ${a.title.split(" — ")[0]}` }]);
          setTimeout(() => setMoneyPops((p) => p.filter((x) => x.key !== key)), 3200);
          refreshOrg();
        }
      }
      prev = new Map(list.map((a) => [a.id, a.status]));
      setAssignments(list);
      setFleetKey((k) => k + 1);
      // ambulanze degli altri giocatori
      const { data: o } = await supabase.from("live_ambulances").select("*");
      setOthers((o as OtherAmbulance[]) ?? []);
    }
    loadAssignments();
    const t1 = setInterval(loadAssignments, 20_000);
    const t2 = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  // I soldi in alto salgono contando, con un lampo verde quando entrano
  useEffect(() => {
    if (!org) return;
    const target = org.funds;
    setShownFunds((from) => {
      if (from === null || from === target) return target;
      if (target > from) {
        const start = performance.now(), dur = 1400, base = from;
        setFundsFlash(true);
        setTimeout(() => setFundsFlash(false), 1800);
        const step = (t: number) => {
          const k = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - k, 3);
          setShownFunds(Math.round(base + (target - base) * e));
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        return from;
      }
      return target;
    });
  }, [org?.funds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Richieste e proposte per me (inviti in alleanza, offerte di acquisto): controllo ogni 20 secondi
  useEffect(() => {
    if (!org) return;
    const myId = org.id;
    async function loadNotes() {
      const [inv, off] = await Promise.all([
        supabase.from("alliance_invites").select("id,alliance_id,alliances(name)").eq("org_id", myId),
        supabase.from("acquisition_offers").select("id,price,buyer:organizations!acquisition_offers_buyer_org_fkey(name)")
          .eq("seller_org", myId).eq("status", "in_attesa"),
      ]);
      const list: { id: string; text: string }[] = [];
      for (const i of (inv.data as unknown as { id: string; alliances: { name: string } | null }[]) ?? [])
        list.push({ id: i.id, text: `🤝 Sei invitato nell'alleanza «${i.alliances?.name ?? "?"}»` });
      for (const o of (off.data as unknown as { id: string; price: number; buyer: { name: string } | null }[]) ?? [])
        list.push({ id: o.id, text: `💼 ${o.buyer?.name ?? "Un'associazione"} vuole comprarti per ${o.price.toLocaleString("it-IT")} €` });
      setNotes(list);
    }
    loadNotes();
    const t = setInterval(loadNotes, 20_000);
    return () => clearInterval(t);
  }, [org]);

  // Scarica le strade vere dei tratti in movimento dei servizi in corso
  useEffect(() => {
    for (const a of [...assignments, ...others]) {
      if (a.status === "conclusa" || !a.route?.length) continue;
      for (let i = 0; i < a.route.length - 1; i++) {
        const p = a.route[i], q = a.route[i + 1];
        if (p.lat === q.lat && p.lng === q.lng) continue;
        fetchLeg(p, q).then(() => setRoadsLoaded((n) => n + 1));
      }
    }
  }, [assignments, others]);

  // Sessione: se sei loggato ma senza associazione vai all'onboarding
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoggedIn(false); return; }
      setLoggedIn(true);
      const { data } = await supabase.from("organizations")
        .select("id,name,type,funds,reputation,logo_url").eq("owner_id", session.user.id).maybeSingle();
      if (!data) { router.replace("/onboarding"); return; }
      // associazione venduta: deve scegliere una nuova sede
      const { count } = await supabase.from("bases").select("id", { count: "exact", head: true }).eq("org_id", data.id);
      if (count === 0) { router.replace("/nuova-sede"); return; }
      setOrg(data as Organization);
      const { data: prof } = await supabase.from("profiles").select("is_admin").eq("id", session.user.id).maybeSingle();
      setIsAdmin(!!prof?.is_admin);
    })();
  }, [router]);

  useEffect(() => {
    async function load() {
      const in24h = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const [m, b, ev] = await Promise.all([
        supabase.from("missions_map").select("*"),
        supabase.from("bases_map").select("*"),
        supabase.from("events_map").select("id,title,kind,starts_at,show_at,time_confirmed,venue,slots,reward_funds,lat,lng")
          .gt("starts_at", new Date().toISOString()).lt("starts_at", in24h).order("starts_at"),
      ]);
      if (!ev.error) setUpcoming((ev.data as UpcomingEvent[]) ?? []);
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
      {/* Barra in alto: associazione e soldi */}
      <div className="fs-top">
        {org ? (
          <button className="fs-pill" onClick={() => router.push("/associazione")} title="Modifica associazione">
            <FactionEmblem type={org.type} size={34} logo={org.logo_url} />
            <span className="fs-pill-text">
              <span className="fs-name">{org.name}</span>
              <span className={`fs-money${fundsFlash ? " fs-money-flash" : ""}`}>💶 {(shownFunds ?? org.funds).toLocaleString("it-IT")} € <span className="fs-rep">⭐ {org.reputation}</span></span>
            </span>
          </button>
        ) : loggedIn === false ? (
          <button className="fs-pill" onClick={() => router.push("/login")} style={{ fontWeight: 700 }}>Accedi / Registrati</button>
        ) : null}
      </div>

      {/* Le mie ambulanze con il conto alla rovescia */}
      {org && <FleetPanel jobs={assignments} now={now} refreshKey={fleetKey}
                          onChanged={(msg) => {
                            showToast(msg);
                            supabase.from("my_assignments").select("*").then(({ data }) => setAssignments((data as Assignment[]) ?? []));
                          }} />}

      {/* Richieste e proposte: ben visibili sulla mappa */}
      {notes.filter((n) => !hiddenNotes.includes(n.id)).length > 0 && (
        <div className="fs-notes">
          {notes.filter((n) => !hiddenNotes.includes(n.id)).map((n) => (
            <div key={n.id} className="fs-note">
              <span style={{ fontSize: 22 }}>📬</span>
              <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14 }}>{n.text}</div>
              <button onClick={() => router.push("/alleanza")}
                      style={{ border: "none", background: "#fff", color: "#B45309", fontWeight: 800, borderRadius: 8,
                               padding: "7px 12px", cursor: "pointer", whiteSpace: "nowrap" }}>Rispondi</button>
              <button onClick={() => setHiddenNotes((h) => [...h, n.id])} aria-label="Nascondi"
                      style={{ border: "none", background: "transparent", color: "#fff", fontSize: 18, cursor: "pointer", padding: 2 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Soldi che entrano: monete che volano e cifra grande */}
      {moneyPops.map((p, i) => (
        <div key={p.key} className="fs-pop" style={{ top: `${18 + i * 9}%` }}>
          <div className="fs-pop-coins">
            {Array.from({ length: 9 }).map((_, j) => (
              <span key={j} style={{ ["--dx" as string]: `${(j - 4) * 26}px`, ["--d" as string]: `${j * 60}ms` }}>{j % 3 === 0 ? "💶" : "🪙"}</span>
            ))}
          </div>
          <div className="fs-pop-amount">+{p.amount.toLocaleString("it-IT")} €</div>
          <div className="fs-pop-label">✅ {p.label}</div>
        </div>
      ))}

      {/* Chat tra giocatori */}
      {org && <ChatPanel orgId={org.id} />}

      {/* Menu: in alto a destra sul computer, in basso sul telefono */}
      {org && (
        <nav className="fs-nav">
          <button className="fs-btn" style={{ background: "#F97316" }} onClick={() => router.push("/garage")}><span>🚑</span>Garage</button>
          <button className="fs-btn" style={{ background: "#1E3A8A" }} onClick={() => router.push("/squadra")}><span>👥</span>Squadra</button>
          <button className="fs-btn" style={{ background: "#15803D", position: "relative" }} onClick={() => router.push("/alleanza")}>
            <span>🤝</span>Alleanza
            {notes.length > 0 && <b className="fs-badge">{notes.length}</b>}
          </button>
          <button className="fs-btn" style={{ background: "#111" }} onClick={() => router.push("/negozio")}><span>🛒</span>Presidi</button>
          <button className="fs-btn" style={{ background: "#B45309" }} onClick={() => router.push("/classifica")}><span>🏆</span>Classifica</button>
          {isAdmin && <button className="fs-btn" style={{ background: "#7C3AED" }} onClick={() => router.push("/admin")}><span>🛠️</span>Admin</button>}
          <button className="fs-btn fs-exit" onClick={logout}><span>🚪</span>Esci</button>
        </nav>
      )}

      {error && (
        <div style={{ position: "absolute", top: 64, left: 12, right: 12, zIndex: 1000, background: "#fff3f3",
                      color: "#900", border: "1px solid #e99", padding: "10px 14px", borderRadius: 8 }}>{error}</div>
      )}

      <MapContainer center={[43.60, 10.42]} zoom={11} className="fs-map" style={{ width: "100%" }}>
        <TileLayer attribution="&copy; OpenStreetMap contributors"
                   url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {hospitals.map((h) => (
          <Marker key={h.id} position={[h.lat, h.lng]} icon={hospitalIcon}>
            <Popup>
              <strong>🏥 {h.name}</strong><br />
              {h.capabilities.map((c) => ({ ps: "Pronto soccorso", cardio: "Emodinamica", trauma_maggiore: "Trauma center",
                pediatria: "Pediatria", dialisi: "Dialisi" } as Record<string, string>)[c] ?? c).join(" · ")}
            </Popup>
          </Marker>
        ))}

        {bases.map((b) => (
          <Marker key={b.id} position={[b.lat, b.lng]} icon={baseIcon(b.org_type, b.org_id === org?.id, b.logo_url)}>
            <Popup>
              <strong>{b.name}</strong><br />
              {b.org_name} · livello {b.level}{b.is_headquarters ? " · sede centrale" : ""}
              {b.org_id === org?.id && (
                <><br /><button onClick={() => router.push("/sedi")}
                        style={{ marginTop: 6, border: "none", background: "#111", color: "#fff", borderRadius: 8,
                                 padding: "6px 10px", cursor: "pointer", fontWeight: 700 }}>🏠 Compra una nuova sede</button></>
              )}
            </Popup>
          </Marker>
        ))}

        {upcoming.filter((e) => !missions.some((m) => m.event_id === e.id)).map((e) => {
          const show = new Date(e.show_at ?? e.starts_at);
          const opensAt = new Date(new Date(e.starts_at).getTime() - 2 * 3600 * 1000);
          return (
            <Marker key={`ev-${e.id}`} position={[e.lat, e.lng]} icon={eventIcon(e.kind, false)}>
              <Popup>
                <strong>{KIND_ICON[e.kind]} {e.title}</strong><br />
                {e.venue} · inizio {show.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                {!e.time_confirmed && " (orario indicativo)"}<br />
                {e.slots} {e.slots > 1 ? "ambulanze" : "ambulanza"} · {e.reward_funds.toLocaleString("it-IT")} € ciascuna<br />
                <em>Prenotazioni dalle {opensAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</em>
              </Popup>
            </Marker>
          );
        })}

        {missions.filter((m) => m.category === "grande_evento").map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]}
                  icon={eventIcon(upcoming.find((e) => e.id === m.event_id)?.kind ?? "altro", m.status === "aperta")}>
            <Popup>
              <strong>🏟️ {m.title}</strong><br />
              {m.venue} · {m.description}<br />
              Ambulanze: {m.slots_taken}/{m.slots_total} · {m.reward_funds.toLocaleString("it-IT")} € ciascuna<br />
              Prenotabile fino alle {new Date(m.expires_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
              {org && m.status === "aperta" && m.slots_taken < m.slots_total && (
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => setSelected(m)}
                          style={{ width: "100%", border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer",
                                   background: "#7C3AED", color: "#fff", fontWeight: 700 }}>🏟️ Prenota la postazione</button>
                </div>
              )}
            </Popup>
          </Marker>
        ))}

        {missions.filter((m) => m.category !== "grande_evento").map((m) => (
          <CircleMarker key={m.id} center={[m.lat, m.lng]} radius={10}
                        pathOptions={{ color: CODE_COLOR[m.code], fillOpacity: 0.8 }}>
            <Popup>
              <strong>{m.title}</strong><br />
              {m.description && <>{m.description}<br /></>}
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

        {onTheRoad(others, now).map((a) => {
          const route: RoutePoint[] = a.route?.length ? a.route : [
            { lat: a.base_lat, lng: a.base_lng, t: a.assigned_at, label: "Sede" },
            { lat: a.lat, lng: a.lng, t: a.arrives_at, label: "Sul posto" },
            { lat: a.lat, lng: a.lng, t: a.completes_at, label: "Sul posto" },
          ];
          const pos = alongRoute(route, now);
          const ahead = alongRoute(route, now + 4000);
          return (
            <Marker key={`o-${a.id}`} position={[pos.lat, pos.lng]} zIndexOffset={-100}
                    icon={otherAmbulanceIcon(!sirens(a.code, pos), a.vehicle_image, ahead.lng > pos.lng, a.org_type, a.logo_url)}>
              <Popup>
                <strong>{a.org_name}</strong> · {a.call_sign}<br />
                {a.title}<br />
                {pos.text}
              </Popup>
            </Marker>
          );
        })}

        {onTheRoad(assignments, now).map((a) => {
          const route: RoutePoint[] = a.route?.length ? a.route : [
            { lat: a.base_lat, lng: a.base_lng, t: a.assigned_at, label: "Sede" },
            { lat: a.lat, lng: a.lng, t: a.arrives_at, label: "Sul posto" },
            { lat: a.lat, lng: a.lng, t: a.completes_at, label: "Sul posto" },
          ];
          const pos = alongRoute(route, now);
          const ahead = alongRoute(route, now + 4000);
          const facingRight = ahead.lng > pos.lng;
          const path = remainingPath(route, pos.leg, pos.f);
          const left = Math.max(0, Math.round((pos.until - now) / 60000));
          const back = Math.max(0, Math.round((new Date(a.completes_at).getTime() - now) / 60000));
          return (
            <Fragment key={a.id}>
            {path.map((seg, i) => (
              <Polyline key={`${a.id}-p${i}`} positions={seg}
                        pathOptions={i === 0 && pos.moving
                          ? { color: "#2563EB", weight: 5, opacity: 0.85 }
                          : { color: "#2563EB", weight: 4, opacity: 0.45, dashArray: "8 8" }} />
            ))}
            <Marker position={[pos.lat, pos.lng]} icon={ambulanceIcon(!sirens(a.code, pos), a.vehicle_image, facingRight)}>
              <Popup>
                <strong>{a.call_sign}</strong> · {a.title}<br />
                {pos.text} · {left} min<br />
                {a.hospital && <>Ospedale: {a.hospital}<br /></>}
                {back > 0 ? <>Libero tra {back} min</> : <strong style={{ color: "#15803D" }}>✅ Disponibile: puoi già mandarlo su un altro servizio</strong>}
              </Popup>
            </Marker>
            </Fragment>
          );
        })}
      </MapContainer>

      <style>{`
        .fs-map { height: 100vh; height: 100dvh; }
        .fs-top { position: absolute; top: 10px; left: 56px; z-index: 1000; max-width: calc(100% - 66px); }
        .fs-pill { display: flex; align-items: center; gap: 10px; background: #fff; border: none; border-radius: 14px;
          padding: 6px 12px 6px 8px; box-shadow: 0 2px 8px rgba(0,0,0,.25); cursor: pointer; text-align: left;
          max-width: 100%; font-family: inherit; }
        .fs-pill-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
        .fs-name { font-weight: 800; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #111; }
        .fs-money { font-size: 15px; font-weight: 700; color: #15803D; white-space: nowrap; transition: transform .2s; display: inline-block; }
        .fs-money-flash { animation: money-flash 1.8s ease-out; }
        @keyframes money-flash { 0% { transform: scale(1); text-shadow: none }
          15% { transform: scale(1.25); text-shadow: 0 0 12px #22C55E; color: #16A34A }
          60% { transform: scale(1.1); text-shadow: 0 0 8px #22C55E } 100% { transform: scale(1); text-shadow: none } }
        .fs-pop { position: absolute; z-index: 1300; left: 50%; transform: translateX(-50%); pointer-events: none; text-align: center;
          animation: pop-rise 3.2s ease-out forwards; }
        .fs-pop-amount { font-size: 46px; font-weight: 900; color: #16A34A; -webkit-text-stroke: 2px #fff;
          text-shadow: 0 4px 14px rgba(0,0,0,.35); letter-spacing: -1px; }
        .fs-pop-label { display: inline-block; margin-top: 2px; background: rgba(17,17,17,.85); color: #fff; font-weight: 700;
          font-size: 13px; padding: 4px 10px; border-radius: 999px; }
        .fs-pop-coins { position: relative; height: 34px; }
        .fs-pop-coins span { position: absolute; left: 50%; top: 10px; font-size: 26px; opacity: 0;
          animation: coin-burst 1.6s ease-out var(--d) forwards; }
        @keyframes coin-burst { 0% { transform: translate(-50%, 30px) scale(.4); opacity: 0 }
          25% { opacity: 1 } 70% { transform: translate(calc(-50% + var(--dx)), -40px) scale(1.1) rotate(25deg); opacity: 1 }
          100% { transform: translate(calc(-50% + var(--dx)), -10px) scale(.9) rotate(40deg); opacity: 0 } }
        @keyframes pop-rise { 0% { transform: translate(-50%, 30px) scale(.6); opacity: 0 }
          12% { transform: translate(-50%, 0) scale(1.15); opacity: 1 } 22% { transform: translate(-50%, 0) scale(1) }
          80% { transform: translate(-50%, -20px); opacity: 1 } 100% { transform: translate(-50%, -60px); opacity: 0 } }
        .fs-rep { color: #B45309; font-weight: 600; margin-left: 6px; }
        .fs-nav { position: absolute; top: 10px; right: 10px; z-index: 1000; display: flex; gap: 6px; }
        .fs-btn { border: none; color: #fff; border-radius: 10px; padding: 8px 12px; cursor: pointer; font-size: 13px;
          font-weight: 700; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(0,0,0,.2); font-family: inherit; }
        .fs-exit { background: #fff !important; color: #333; }
        .fs-toast { bottom: 24px; }
        .fs-chat-btn { position: absolute; z-index: 1000; left: 10px; bottom: 24px; width: 52px; height: 52px; border-radius: 50%;
          border: none; background: #111; color: #fff; font-size: 24px; cursor: pointer; box-shadow: 0 3px 12px rgba(0,0,0,.35); }
        .fs-chat-dot { position: absolute; top: 2px; right: 2px; width: 14px; height: 14px; border-radius: 50%; background: #DC2626;
          border: 2px solid #fff; animation: note-pulse 1.4s infinite; }
        .fs-chat { position: absolute; z-index: 1060; left: 10px; bottom: 86px; width: min(360px, calc(100% - 20px)); height: min(460px, 65vh);
          background: #fff; border-radius: 14px; box-shadow: 0 8px 28px rgba(0,0,0,.35); display: flex; flex-direction: column; overflow: hidden; }
        .fs-badge { position: absolute; top: -6px; right: -6px; min-width: 20px; height: 20px; border-radius: 10px; background: #DC2626;
          color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; padding: 0 5px;
          border: 2px solid #fff; animation: note-pulse 1.4s infinite; }
        .fs-notes { position: absolute; z-index: 1050; bottom: 80px; left: 50%; transform: translateX(-50%); width: min(560px, calc(100% - 20px));
          display: grid; gap: 8px; }
        .fs-note { display: flex; align-items: center; gap: 10px; background: linear-gradient(135deg,#F59E0B,#B45309); color: #fff;
          border-radius: 14px; padding: 10px 12px; box-shadow: 0 6px 20px rgba(0,0,0,.35); animation: note-in .4s ease-out, note-glow 2s infinite; }
        @keyframes note-in { from { transform: translateY(-12px); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes note-glow { 0%,100% { box-shadow: 0 6px 20px rgba(0,0,0,.35) } 50% { box-shadow: 0 6px 26px rgba(245,158,11,.9) } }
        @keyframes note-pulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.18) } }
        .fs-fleet { position: absolute; top: 66px; left: 56px; z-index: 1000; width: min(330px, calc(100% - 66px)); }
        .fs-fleet-btn { background: #fff; border: none; border-radius: 12px; padding: 7px 12px; font-size: 13px; font-weight: 600;
          box-shadow: 0 2px 8px rgba(0,0,0,.25); cursor: pointer; font-family: inherit; color: #111; }
        .fs-fleet-list { margin-top: 6px; background: #fff; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,.25);
          max-height: 50vh; overflow-y: auto; }
        @media (max-width: 760px) {
          .fs-nav { top: auto; bottom: 0; left: 0; right: 0; gap: 0; background: #fff; box-shadow: 0 -2px 10px rgba(0,0,0,.2);
            padding: 4px 4px calc(4px + env(safe-area-inset-bottom)); justify-content: space-around; }
          .fs-btn { flex: 1; flex-direction: column; gap: 2px; font-size: 11px; padding: 6px 2px; border-radius: 10px;
            margin: 0 2px; box-shadow: none; min-width: 0; }
          .fs-btn span { font-size: 20px; line-height: 1; }
          .fs-exit { background: #f1f1f1 !important; }
          .fs-toast { bottom: calc(76px + env(safe-area-inset-bottom)); }
          .fs-notes { bottom: auto; top: 110px; }
          .fs-chat-btn { bottom: calc(80px + env(safe-area-inset-bottom)); width: 48px; height: 48px; font-size: 22px; }
          .fs-chat { left: 8px; right: 8px; width: auto; bottom: calc(136px + env(safe-area-inset-bottom)); height: 55vh; }
          .fs-badge { top: 0; right: 4px; }
          .leaflet-bottom { bottom: calc(64px + env(safe-area-inset-bottom)); }
          .fs-pill { padding: 5px 10px 5px 6px; }
        }
        @keyframes amb-blink { 0% { filter: drop-shadow(0 0 6px #3b82f6) } 50% { filter: drop-shadow(0 0 6px #ef4444) } }
        @keyframes ev-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(124,58,237,.6) } 50% { box-shadow: 0 0 0 10px rgba(124,58,237,0) } }`}</style>

      {selected && (
        <MissionPanel mission={selected} onClose={() => setSelected(null)}
                      onClaimed={(text) => { setSelected(null); showToast(text); setTimeout(() => {
                        supabase.from("my_assignments").select("*").then(({ data }) => setAssignments((data as Assignment[]) ?? []));
                      }, 300); }} />
      )}

      {toast && (
        <div className="fs-toast" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", zIndex: 1200,
                      background: "#111", color: "#fff", padding: "12px 18px", borderRadius: 12, fontWeight: 600,
                      boxShadow: "0 6px 24px rgba(0,0,0,.35)", maxWidth: "90vw", textAlign: "center" }}>{toast}</div>
      )}
    </div>
  );
}
