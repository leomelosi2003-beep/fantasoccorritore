"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Polyline, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase, livery, type MissionPin, type BasePin, type Organization } from "@/lib/supabase";
import FactionEmblem, { emblemSvg } from "@/components/FactionEmblem";
import MissionPanel from "@/components/MissionPanel";
import FleetPanel from "@/components/FleetPanel";
import ChatPanel from "@/components/ChatPanel";
import AcquisitionModal from "@/components/AcquisitionModal";
import ThemeToggle from "@/components/ThemeToggle";
import Tutorial, { TUTORIAL_KEY } from "@/components/Tutorial";
import { fetchLeg, getLeg, legKey, pointAt, slice, type LatLng } from "@/components/roads";

type RoutePoint = { lat: number; lng: number; t: string; label: string };
type Hospital = { id: string; name: string; capabilities: string[]; lat: number; lng: number };

// Orologio del server: se l'orologio del telefono è avanti o indietro, i mezzi veloci (barca, elisoccorso)
// sembrerebbero già arrivati o fermi. Tutte le animazioni usano l'ora del server.
let clockOffset = 0;
const serverNow = () => Date.now() + clockOffset;
async function syncClock() {
  try {
    const t0 = Date.now();
    const { data } = await supabase.rpc("server_now");
    const t1 = Date.now();
    if (data) clockOffset = new Date(data as string).getTime() - (t0 + t1) / 2;
  } catch { /* rete assente: resta l'ora del telefono */ }
}

// Posizione dell'ambulanza lungo il percorso (sede → posto → ospedale → sede) e cosa sta facendo
function alongRoute(route: RoutePoint[], now: number) {
  const pts = route.map((p) => ({ ...p, ms: new Date(p.t).getTime() }));
  if (now <= pts[0].ms) return { lat: pts[0].lat, lng: pts[0].lng, moving: false, text: "In partenza", until: pts[0].ms, leg: 0, f: 0 };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (now <= b.ms) {
      const f = (now - a.ms) / Math.max(1, b.ms - a.ms);
      const still = a.lat === b.lat && a.lng === b.lng;
      // i punti "Rotta" della barca sono solo curve della rotta: il testo guarda la tappa vera
      const la = a.label === "Rotta" ? ([...pts.slice(0, i + 1)].reverse().find((x) => x.label !== "Rotta")?.label ?? a.label) : a.label;
      const lb = b.label === "Rotta" ? (pts.slice(i + 1).find((x) => x.label !== "Rotta")?.label ?? b.label) : b.label;
      const text = still
        ? (la === "Elisoccorso sul posto" ? "🚁 Elisoccorso: soccorso sul posto" : la.startsWith("Eliporto") ? `🚁 Consegna il paziente · ${la.replace("Eliporto: ", "")}`
          : la === "In mare" ? "Soccorso in mare" : la.startsWith("Approdo") ? "In porto: consegna il paziente all'ambulanza"
          : la.startsWith("Al porto") ? "Al porto: aspetta la barca e carica il paziente" : la === "Sul posto" ? "Soccorso in corso" : la === "A casa del paziente" ? "Accompagna il paziente in casa" : `In ospedale · ${la}`)
        : la === lb ? (i > 0 && pts[i - 1].lat === a.lat && pts[i - 1].lng === a.lng ? "Esce dall'ospedale" : "Entra al Pronto Soccorso")
        : lb === "Elisoccorso sul posto" ? "🚁 In volo verso il posto" : lb.startsWith("Eliporto") ? `🚁 In volo verso ${lb.replace("Eliporto: ", "")}`
        : lb.startsWith("Elibase") ? `🚁 Rientro alla base ${lb.replace("Elibase: ", "")}`
        : lb === "Ormeggio" ? "Rientro all'ormeggio"
        : lb.startsWith("Al porto") ? `In viaggio verso il porto (${lb.replace("Al porto: ", "")})` : lb === "In mare" ? "In navigazione verso il posto"
        : lb.startsWith("Approdo") ? `Porta il paziente in porto (${lb.replace("Approdo: ", "")})`
        : lb === "Sede" ? "Rientro in sede" : lb === "Sul posto" ? "In viaggio verso il posto"
        : la === "Sede" ? `In viaggio verso ${lb}`
        : lb === "A casa del paziente" ? "Riporta il paziente a casa" : `Trasporto verso ${lb}`;
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

const isHeli = (a: { vehicle_image?: string | null }) => !!a.vehicle_image?.includes("h-pegaso");
const isBoat = (a: { vehicle_image?: string | null }) => /\/b-(marlin|sprint)/.test(a.vehicle_image ?? "");
type HeliRow = { id: string; status: string; route: RoutePoint[] | null; arrives_at: string; route_ends_at: string; lat: number; lng: number;
  title: string; hospital: string | null; vehicle_image: string | null; org_name: string; org_type: string | null; call_sign: string; mine: boolean };
const boatIcons = new Map<string, L.DivIcon>();
function boatMoveIcon(img: string, facingRight: boolean, w: number, moving: boolean, badge = "⛵ IN MARE") {
  const k = `${img}|${facingRight}|${w}|${moving}|${badge}`;
  let ic = boatIcons.get(k);
  if (!ic) {
    const small = img.replace(/\.png$/, "-map.png");
    ic = L.divIcon({
      className: "",
      html: `<div style="position:relative;width:${w}px">
               ${moving ? `<div style="position:absolute;bottom:-4px;${facingRight ? "left" : "right"}:-14px;width:30px;height:8px;border-radius:50%;
                               background:radial-gradient(ellipse at center,rgba(255,255,255,.95),rgba(186,230,253,.4) 60%,transparent 70%);animation:boat-wake .8s ease-in-out infinite"></div>` : ""}
               <img src="${small}" style="width:${w}px;height:auto;display:block;transform:scaleX(${facingRight ? -1 : 1});filter:drop-shadow(0 2px 2px rgba(0,0,0,.5))" alt=""/>
               <div style="position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:#0369A1;color:#fff;font:700 10px system-ui;
                           padding:1px 5px;border-radius:999px;white-space:nowrap">${badge}</div>
             </div>`,
      iconSize: [w, Math.round(w * 0.4)], iconAnchor: [w / 2, Math.round(w * 0.2)],
    });
    boatIcons.set(k, ic);
  }
  return ic;
}

const shortEuro = (n: number) => n >= 1e6 ? `${(n / 1e6).toLocaleString("it-IT", { maximumFractionDigits: 1 })} mln` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)} €`;

// tratti della barca: niente strade
const isSea = (p: RoutePoint) => p.label === "Ormeggio" || p.label === "In mare" || p.label === "Rotta" || p.label.startsWith("Approdo")
  || p.label.startsWith("Eli"); // anche l'elisoccorso vola in linea retta
const heliIcon = L.divIcon({
  className: "",
  html: `<div style="width:24px;height:24px;border-radius:999px;background:#FFF7ED;border:2px solid #EA580C;display:flex;
         align-items:center;justify-content:center;font-size:13px;box-shadow:0 1px 3px rgba(0,0,0,.35)">🚁</div>`,
  iconSize: [24, 24], iconAnchor: [12, 12],
});

// Clic sulla mappa per scegliere il punto di ormeggio della barca
function MooringPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}
type Boat = { id: string; call_sign: string; status: string; moor_lat: number | null; moor_lng: number | null; vehicle_image: string | null };
type Port = { id: number; name: string; lat: number; lng: number };
const portIcon = L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;border-radius:6px;background:#E0F2FE;border:2px solid #0369A1;display:flex;
         align-items:center;justify-content:center;font-size:13px;box-shadow:0 1px 3px rgba(0,0,0,.35)">⚓</div>`,
  iconSize: [22, 22], iconAnchor: [11, 11],
});
function boatIcon(img: string | null) {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative"><img src="${(img ?? "/vehicles/b-marlin.png").replace(/\.png$/, "-map.png")}" style="width:54px;height:auto;display:block" alt=""/>
           <span style="position:absolute;right:-4px;top:-6px;background:#0369A1;color:#fff;border-radius:999px;font-size:10px;padding:0 4px">⚓</span></div>`,
    iconSize: [54, 34], iconAnchor: [27, 30],
  });
}

// Strada ancora da fare: resto del tratto attuale + tratti successivi
function remainingPath(route: RoutePoint[], leg: number, f: number): LatLng[][] {
  const out: LatLng[][] = [];
  for (let i = leg; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1];
    if (a.lat === b.lat && a.lng === b.lng) continue;
    const from = i === leg ? f : 0;
    if (isSea(a) || isSea(b)) { out.push([[a.lat + (b.lat - a.lat) * from, a.lng + (b.lng - a.lng) * from], [b.lat, b.lng]]); continue; }
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

type BaseCar = { call_sign: string; image_url: string | null; state: "sede" | "servizio" | "rientro" | "officina"; electric: boolean | null };
const CAR_STATE: Record<BaseCar["state"], [string, string]> = {
  sede: ["✅ in sede", "#15803D"], servizio: ["🚨 in servizio", "#DC2626"], rientro: ["↩️ in rientro", "#B45309"], officina: ["🔧 officina", "#6B7280"],
};

type Responder = { org_name: string; org_type: BasePin["org_type"]; logo_url: string | null; call_sign: string;
  status: string; arrives_at: string; mine: boolean; pos: number; slots: number; lost: boolean; automedica?: boolean; companion?: boolean };

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

// Icona speciale della maxi-emergenza: grande, rossa, pulsante.
function maxiIcon() {
  const s = 54;
  return L.divIcon({
    className: "",
    html: `<div class="fs-maxi-pin" style="width:${s}px;height:${s}px;border-radius:50%;display:flex;align-items:center;justify-content:center;
           font-size:27px;background:radial-gradient(circle at 50% 32%,#FCA5A5,#DC2626 70%);border:3px solid #fff;">🆘</div>`,
    iconSize: [s, s], iconAnchor: [s / 2, s / 2],
  });
}

// Ambulanza in movimento: lampeggia se in viaggio, ferma sul posto durante l'intervento
// Ambulanza ferma sul posto del servizio: non la disegniamo (coprirebbe il puntino), la contiamo nel badge
function nearM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dy = (aLat - bLat) * 111_000, dx = (aLng - bLng) * 111_000 * Math.cos(aLat * Math.PI / 180);
  return Math.sqrt(dx * dx + dy * dy);
}
function routeOf(a: { route: RoutePoint[] | null; base_lat: number; base_lng: number; lat: number; lng: number;
  assigned_at: string; arrives_at: string; completes_at: string }): RoutePoint[] {
  return a.route?.length ? a.route : [
    { lat: a.base_lat, lng: a.base_lng, t: a.assigned_at, label: "Sede" },
    { lat: a.lat, lng: a.lng, t: a.arrives_at, label: "Sul posto" },
    { lat: a.lat, lng: a.lng, t: a.completes_at, label: "Sul posto" },
  ];
}
function onScene(a: Parameters<typeof routeOf>[0], now: number) {
  const pos = alongRoute(routeOf(a), now);
  return !pos.moving && nearM(pos.lat, pos.lng, a.lat, a.lng) < 40;
}
type SceneOrg = { type: BasePin["org_type"]; logo: string | null; n: number };
function sceneBadge(orgs: SceneOrg[]) {
  const chips = orgs.map((o) =>
    `<span style="display:inline-flex;align-items:center;gap:3px;background:#fff;color:#111;border-radius:999px;padding:1px 6px 1px 2px;
       box-shadow:0 1px 3px rgba(0,0,0,.4);font:800 12px system-ui">
       <span style="display:inline-flex;width:16px;height:16px;border-radius:50%;overflow:hidden;align-items:center;justify-content:center">${emblemSvg(o.type, 16, o.logo)}</span>🚑${o.n}</span>`).join("");
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;gap:3px;white-space:nowrap;pointer-events:none">${chips}</div>`,
    iconSize: [60 * orgs.length, 20], iconAnchor: [-6, 26],
  });
}

// Per ogni mezzo, solo il servizio più recente, finché il percorso (rientro compreso) non è finito
function onTheRoad<T extends { vehicle_id: string; assigned_at: string; route_ends_at: string }>(list: T[], now: number) {
  const latest = new Map<string, T>();
  for (const a of list) {
    const key = a.vehicle_id ?? String((a as { id?: string }).id ?? ""); // l'elisoccorso non ha un mezzo nel garage
    const cur = latest.get(key);
    if (!cur || a.assigned_at > cur.assigned_at) latest.set(key, a);
  }
  return Array.from(latest.values()).filter((a) => now < new Date(a.route_ends_at).getTime() + 10_000);
}

// Lampeggianti accesi solo nei codici giallo e rosso, mentre viaggia (non al rientro in sede)
function sirens(code: string, pos: { moving: boolean; text: string }) {
  return (code === "giallo" || code === "rosso") && pos.moving && pos.text !== "Rientro in sede";
}

// Ambulanza che si muove in modo fluido: la posizione viene ricalcolata a ogni fotogramma
// direttamente su Leaflet (senza ridisegnare la pagina), l'icona cambia solo quando cambia verso o lampeggianti.
function MovingMarker({ route, code, makeIcon, zIndexOffset, children }: {
  route: RoutePoint[]; code: string; zIndexOffset?: number; children?: ReactNode;
  makeIcon: (onScene: boolean, facingRight: boolean) => L.DivIcon;
}) {
  const ref = useRef<L.Marker | null>(null);
  const routeRef = useRef(route); routeRef.current = route;
  const makeRef = useRef(makeIcon); makeRef.current = makeIcon;
  const [start] = useState(() => {
    const t = serverNow(); const p = alongRoute(route, t); const ah = alongRoute(route, t + 4000);
    return { pos: [p.lat, p.lng] as [number, number], key: `${!sirens(code, p)}|${ah.lng > p.lng}`,
             icon: makeIcon(!sirens(code, p), ah.lng > p.lng) };
  });
  const keyRef = useRef(start.key);
  useEffect(() => {
    let raf = 0, last = 0;
    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      if (ts - last < 33) return; // ~30 fotogrammi al secondo bastano e risparmiano batteria
      last = ts;
      const m = ref.current; if (!m) return;
      const t = serverNow();
      const p = alongRoute(routeRef.current, t);
      m.setLatLng([p.lat, p.lng]);
      const ah = alongRoute(routeRef.current, t + 4000);
      const facing = Math.abs(ah.lng - p.lng) < 1e-7 ? keyRef.current.endsWith("true") : ah.lng > p.lng;
      const key = `${!sirens(code, p)}|${facing}`;
      if (key !== keyRef.current) { keyRef.current = key; m.setIcon(makeRef.current(!sirens(code, p), facing)); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [code]);
  return <Marker ref={ref} position={start.pos} icon={start.icon} zIndexOffset={zIndexOffset}>{children}</Marker>;
}

// Ambulanza di un altro giocatore: più piccola, con lo stemma della sua associazione
// Lampeggianti accesi: solo le luci sul tetto si illuminano (non tutto il mezzo)
function lightsHtml(w: number) {
  const d = Math.max(4, Math.round(w / 10));
  const dot = (x: number, phase: "a" | "b") =>
    `<span style="position:absolute;top:${Math.round(-d / 3)}px;left:${Math.round(w * x - d / 2)}px;width:${d}px;height:${Math.round(d * 0.7)}px;
      border-radius:${d}px;animation:amb-light-${phase} .5s steps(1) infinite;pointer-events:none"></span>`;
  return dot(0.31, "a") + dot(0.47, "b") + dot(0.52, "a") + dot(0.92, "b");
}

function otherAmbulanceIcon(onScene: boolean, img: string | null, facingRight: boolean, type: BasePin["org_type"], logo: string | null) {
  if (img && img.includes("h-pegaso")) {
    return L.divIcon({ className: "", html: heliIconHtml(img, facingRight, 78), iconSize: [78, 30], iconAnchor: [39, 15] });
  }
  const pic = img
    ? `<div style="position:relative;transform:scaleX(${facingRight ? -1 : 1})">
         <img src="${img.replace(/\.png$/, "-map.png")}" style="width:48px;height:auto;display:block;opacity:.92" alt=""/>
         ${onScene ? "" : lightsHtml(48)}</div>`
    : `<div style="font-size:22px">🚑</div>`;
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">
             ${pic}
             <div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);width:18px;height:18px;border-radius:50%;
                         background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 2px rgba(0,0,0,.5)">${emblemSvg(type, 14, logo)}</div>
           </div>`,
    iconSize: [48, 26], iconAnchor: [24, 13],
  });
}

// Elisoccorso in volo: più grande, con il rotore che gira e l'ombra a terra
function heliIconHtml(img: string, facingRight: boolean, w: number) {
  const small = img.replace(/-(mis|cri)\.png$/, ".png").replace(/\.png$/, "-map.png");
  return `<div style="position:relative;width:${w}px;animation:heli-bob 1.6s ease-in-out infinite">
            <div style="position:absolute;left:12%;right:12%;bottom:-10px;height:7px;border-radius:50%;background:rgba(0,0,0,.28);filter:blur(2px)"></div>
            <div style="transform:scaleX(${facingRight ? -1 : 1});position:relative">
              <img src="${small}" style="width:${w}px;height:auto;display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.55))" alt=""/>
              <div style="position:absolute;top:${Math.round(w * 0.02)}px;left:${Math.round(w * 0.06)}px;width:${Math.round(w * 0.62)}px;height:3px;
                          border-radius:3px;background:rgba(40,40,40,.55);animation:heli-rotor .18s linear infinite;transform-origin:50% 50%"></div>
            </div>
            <div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);background:#EA580C;color:#fff;font:700 10px system-ui;
                        padding:1px 5px;border-radius:999px;white-space:nowrap">🚁 ELISOCCORSO</div>
          </div>`;
}

const heliIcons = new Map<string, L.DivIcon>();
function heliMarkerIcon(facingRight: boolean, w: number) {
  const k = `${facingRight}|${w}`;
  let ic = heliIcons.get(k);
  if (!ic) { ic = L.divIcon({ className: "", html: heliIconHtml("/vehicles/h-pegaso.png", facingRight, w), iconSize: [w, Math.round(w * 0.37)], iconAnchor: [w / 2, Math.round(w * 0.18)] }); heliIcons.set(k, ic); }
  return ic;
}

// Ambulanza vista di profilo (immagine del modello), girata verso dove sta andando
function ambulanceIcon(onScene: boolean, img: string | null, facingRight: boolean) {
  if (img && img.includes("h-pegaso")) {
    return L.divIcon({ className: "", html: heliIconHtml(img, facingRight, 92), iconSize: [92, 34], iconAnchor: [46, 17] });
  }
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
    html: `<div style="position:relative;width:60px;transform:scaleX(${facingRight ? -1 : 1})">
             <img src="${small}" style="width:60px;height:auto;display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))" alt=""/>
             ${onScene ? "" : lightsHtml(60)}
           </div>`,
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

// "5 min fa", "2 ore fa", "3 giorni fa"
function lastSeen(t: string) {
  const m = Math.max(1, Math.round((Date.now() - new Date(t).getTime()) / 60000));
  if (m < 60) return `${m} min fa`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "ora" : "ore"} fa`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? "giorno" : "giorni"} fa`;
}

// Icona della sede: lo stemma della fazione su un cerchio bianco
function baseIcon(type: BasePin["org_type"], mine: boolean, logo?: string | null, online = false) {
  const svg = emblemSvg(type, mine ? (logo ? 38 : 30) : (logo ? 30 : 22), logo);
  const s = mine ? 44 : 34;
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:${s}px;height:${s}px;border-radius:50%;background:#fff;display:flex;
           align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.4);
           border:${mine ? "3px solid #111" : "1px solid #999"}">${svg}${online
           ? `<span title="Online" style="position:absolute;top:-2px;right:-2px;width:12px;height:12px;border-radius:50%;
              background:#22C55E;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)"></span>` : ""}</div>`,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const reloadRef = useRef<() => void>(() => {});
  // ambulanze di una sede: caricate quando apro il popup della sede
  const [baseCars, setBaseCars] = useState<Record<string, BaseCar[] | null>>({});
  async function loadBaseCars(id: string) {
    setBaseCars((r) => ({ ...r, [id]: r[id] ?? null }));
    const { data } = await supabase.rpc("base_vehicles", { p_base: id });
    setBaseCars((r) => ({ ...r, [id]: (data as BaseCar[]) ?? [] }));
  }
  // chi sta andando su un servizio: caricato solo quando apro il popup del servizio
  const [responders, setResponders] = useState<Record<string, Responder[] | null>>({});
  const [openMission, setOpenMission] = useState<string | null>(null);
  async function loadResponders(id: string) {
    setResponders((r) => ({ ...r, [id]: r[id] ?? null }));
    const { data } = await supabase.rpc("mission_race2", { p_mission: id });
    setResponders((r) => ({ ...r, [id]: (data as Responder[]) ?? [] }));
  }
  // classifica d'arrivo in tempo reale finché il popup del servizio è aperto
  useEffect(() => {
    if (!openMission) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") loadResponders(openMission); }, 8000);
    return () => clearInterval(t);
  }, [openMission]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [others, setOthers] = useState<OtherAmbulance[]>([]);
  const [fleetKey, setFleetKey] = useState(0);
  // carburante: cisterna dell'associazione (1.000 L per sede) e mezzi in riserva
  const [fuel, setFuel] = useState<{ stock: number; cap: number; tanks: number; tanksMax: number; empty: number } | null>(null);
  const fuelAt = useRef(0);
  // elettricità: compare appena hai almeno un'ambulanza elettrica
  const [noVehicles, setNoVehicles] = useState(false);
  const [elec, setElec] = useState<{ n: number; pct: number; charging: number; empty: number } | null>(null);
  const [, setRoadsLoaded] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(serverNow());
  const fastRef = useRef(false);
  // andamento nel riquadro del profilo: entrate/uscite dell'ultima ora e servizi rubati
  const [stats, setStats] = useState<{ net_1h: number; in_1h: number; out_1h: number; stolen_24h: number; lost_24h: number; services_1h: number } | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  // Tutorial al primo accesso (una volta per dispositivo); riapribile dal menu.
  useEffect(() => {
    if (!org?.id) return;
    try { if (localStorage.getItem(TUTORIAL_KEY) !== "1") setShowTutorial(true); } catch {}
  }, [org?.id]);
  const closeTutorial = () => { setShowTutorial(false); try { localStorage.setItem(TUTORIAL_KEY, "1"); } catch {} };
  useEffect(() => {
    if (!org?.id) return;
    const load = () => supabase.rpc("my_quick_stats").then(({ data }) => {
      const r = ((data as { net_1h: number; in_1h: number; out_1h: number; stolen_24h: number; lost_24h: number; services_1h: number }[]) ?? [])[0];
      if (r) setStats({ ...r, net_1h: Number(r.net_1h), in_1h: Number(r.in_1h), out_1h: Number(r.out_1h) });
    });
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000);
    return () => clearInterval(t);
  }, [org?.id]);
  // "Localizza": centra la mappa sul mezzo e lo evidenzia per qualche secondo
  const mapRef = useRef<L.Map | null>(null);
  const [located, setLocated] = useState<{ vehicle: string; until: number } | null>(null);
  function locate(vehicleId: string) {
    const a = assignments.filter((x) => x.vehicle_id === vehicleId).sort((x, y) => (x.assigned_at < y.assigned_at ? 1 : -1))[0];
    if (!a) { showToast("Questo mezzo non è in servizio."); return; }
    const pos = alongRoute(routeOf(a), serverNow());
    mapRef.current?.flyTo([pos.lat, pos.lng], Math.max(mapRef.current.getZoom(), 14), { duration: 1.2 });
    setLocated({ vehicle: vehicleId, until: serverNow() + 8000 });
    showToast(`📍 ${a.call_sign}: ${pos.text}`);
  }
  const [upcoming, setUpcoming] = useState<UpcomingEvent[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);
  const [heliBases, setHeliBases] = useState<Port[]>([]);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [mooring, setMooring] = useState<Boat | null>(null);
  useEffect(() => {
    supabase.rpc("ports_map").then(({ data }) => setPorts((data as Port[]) ?? []));
    supabase.rpc("heli_bases_map").then(({ data }) => setHeliBases((data as Port[]) ?? []));
  }, []);
  useEffect(() => {
    if (!org?.id) return;
    const load = () => supabase.from("my_fleet").select("id,call_sign,status,moor_lat,moor_lng,vehicle_image").eq("boat", true)
      .then(({ data }) => setBoats((data as Boat[]) ?? []));
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000);
    return () => clearInterval(t);
  }, [org?.id]);
  async function moorAt(lat: number, lng: number) {
    if (!mooring) return;
    const b = mooring; setMooring(null);
    const { error } = await supabase.rpc("set_boat_mooring", { p_vehicle: b.id, p_lat: lat, p_lng: lng });
    if (error) { setToast(error.message.includes("TOO_FAR_FROM_PORT") ? "⚓ Troppo lontano dalla costa: ormeggia entro 30 km da un porto."
                          : error.message.includes("VEHICLE_BUSY") ? "⚓ La barca è in servizio: spostala quando è libera." : error.message); return; }
    setBoats((all) => all.map((x) => (x.id === b.id ? { ...x, moor_lat: lat, moor_lng: lng } : x)));
    setToast(`⚓ ${b.call_sign} ormeggiata qui.`);
  }

  useEffect(() => {
    supabase.from("hospitals_map").select("*").then(({ data, error }) => { if (!error) setHospitals((data as Hospital[]) ?? []); });
  }, []);

  useEffect(() => {
    if (!org?.id || Date.now() - fuelAt.current < 60_000) return;
    fuelAt.current = Date.now();
    Promise.all([
      supabase.from("organizations").select("fuel_stock").eq("id", org.id).maybeSingle(),
      supabase.from("bases").select("id", { count: "exact", head: true }).eq("org_id", org.id),
      supabase.from("my_fleet").select("fuel_liters,tank_liters,mine,electric,battery_pct").eq("mine", true),
    ]).then(([o, b, f]) => {
      const all = (f.data as { fuel_liters: number; tank_liters: number; electric: boolean | null; battery_pct: number }[]) ?? [];
      setNoVehicles(!f.error && all.length === 0);
      const list = all.filter((v) => !v.electric);
      const ev = all.filter((v) => v.electric);
      setElec(ev.length ? {
        n: ev.length,
        pct: ev.reduce((t, v) => t + Number(v.battery_pct ?? 0), 0) / ev.length,
        charging: ev.filter((v) => Number(v.battery_pct ?? 0) < 100).length,
        empty: ev.filter((v) => Number(v.battery_pct ?? 0) < 15).length,
      } : null);
      setFuel({
        stock: Number(o.data?.fuel_stock ?? 0), cap: 1000 * Math.max(1, b.count ?? 1),
        tanks: list.reduce((t, v) => t + Number(v.fuel_liters ?? 0), 0),
        tanksMax: list.reduce((t, v) => t + Number(v.tank_liters ?? 80), 0),
        empty: list.filter((v) => Number(v.fuel_liters ?? 0) < 5).length,
      });
    });
  }, [org?.id, fleetKey]);

  // appena un'ambulanza arriva sul posto la corsa si chiude: ricarico subito per vedere chi l'ha persa
  useEffect(() => {
    const t0 = Date.now();
    const next = [...assignments, ...others]
      .filter((a) => a.status === "in_viaggio")
      .map((a) => new Date(a.arrives_at).getTime())
      .filter((t) => t > t0)
      .sort((a, b) => a - b)[0];
    if (!next) return;
    const id = setTimeout(() => reloadRef.current(), Math.min(next - t0 + 6000, 2_147_000_000));
    return () => clearTimeout(id);
  }, [assignments, others]);

  async function refreshOrg() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from("organizations")
      .select("id,name,type,funds,reputation,logo_url,auto_enabled").eq("owner_id", session.user.id).maybeSingle();
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
        if (prev.get(a.id) && prev.get(a.id) !== "annullata" && prev.get(a.id) !== "conclusa" && a.status === "annullata"
            && !a.route?.some((p) => p.label === "Viaggio annullato")) {
          showToast(`⚔️ ${a.call_sign}: servizio perso, un'altra ambulanza è arrivata prima. Rientra in sede.`);
        }
        if (prev.get(a.id) && prev.get(a.id) !== "conclusa" && a.status === "conclusa") {
          const amount = a.reward_funds ?? 0, key = Date.now() + Math.random();
          setMoneyPops((p) => [...p, { key, amount, label: `${a.call_sign} · ${a.title.split(" — ")[0]}` }]);
          setTimeout(() => setMoneyPops((p) => p.filter((x) => x.key !== key)), 3200);
          refreshOrg();
        }
      }
      prev = new Map(list.map((a) => [a.id, a.status]));
      fastRef.current = list.some((a) => (isBoat(a) || isHeli(a)) && serverNow() < new Date(a.route_ends_at).getTime());
      setAssignments(list);
      setFleetKey((k) => k + 1);
      // ambulanze degli altri giocatori
      const { data: o } = await supabase.from("live_ambulances").select("*");
      setOthers((o as OtherAmbulance[]) ?? []);
    }
    loadAssignments();
    reloadRef.current = loadAssignments;
    const t1 = setInterval(() => { if (document.visibilityState === "visible") loadAssignments(); }, 25_000);
    syncClock().then(() => setNow(serverNow()));
    const t2 = setInterval(() => setNow(serverNow()), 1000);
    const t3 = setInterval(syncClock, 300_000);
    // con barche o elisoccorso in giro si aggiorna più spesso, per vederli partire subito
    const t4 = setInterval(() => { if (fastRef.current && document.visibilityState === "visible") loadAssignments(); }, 8_000);
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); clearInterval(t4); };
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
    const t = setInterval(() => { if (document.visibilityState === "visible") loadNotes(); }, 60_000);
    return () => clearInterval(t);
  }, [org]);

  // Scarica le strade vere dei tratti in movimento dei servizi in corso
  useEffect(() => {
    const tNow = serverNow();
    for (const a of [...assignments, ...others]) {
      if (a.status === "conclusa" || !a.route?.length) continue;
      let ahead = 0;
      for (let i = 0; i < a.route.length - 1; i++) {
        const p = a.route[i], q = a.route[i + 1];
        if (new Date(q.t).getTime() < tNow) continue; // tratto già percorso: non serve
        if (p.lat === q.lat && p.lng === q.lng) continue;
        if (isSea(p) || isSea(q)) continue; // la barca va in linea dritta sul mare
        fetchLeg(p, q, Math.min(2, ahead++)).then(() => setRoadsLoaded((n) => n + 1));
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
        .select("id,name,type,funds,reputation,logo_url,auto_enabled").eq("owner_id", session.user.id).maybeSingle();
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
    // servizi ogni 15 s; sedi ogni minuto; eventi ogni 5 minuti (cambiano di rado)
    let n = 0;
    async function load() {
      const in24h = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const withBases = n % 4 === 0, withEvents = n % 20 === 0;
      n++;
      const [m, b, ev] = await Promise.all([
        supabase.from("missions_map").select("*"),
        withBases ? supabase.from("bases_map").select("*") : Promise.resolve(null),
        withEvents ? supabase.from("events_map").select("id,title,kind,starts_at,show_at,time_confirmed,venue,slots,reward_funds,lat,lng")
          .gt("starts_at", new Date().toISOString()).lt("starts_at", in24h).order("starts_at") : Promise.resolve(null),
      ]);
      if (ev && !ev.error) setUpcoming((ev.data as UpcomingEvent[]) ?? []);
      if (m.error) { setError(`Il server è lento, riprovo tra poco…`); return; }
      setError(null);
      setMissions((m.data as MissionPin[]) ?? []);
      if (b && !b.error) setBases((b.data as BasePin[]) ?? []);
    }
    load();
    // aggiornamento ogni 12 secondi (niente tempo reale: pesava troppo sul server)
    const poll = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15_000);
    return () => clearInterval(poll);
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  // chi è fermo sul posto di ogni servizio: logo dell'associazione e numero di ambulanze
  const sceneCount = new Map<string, { lat: number; lng: number; orgs: Map<string, SceneOrg> }>();
  const addScene = (lat: number, lng: number, orgId: string, type: BasePin["org_type"], logo: string | null) => {
    const k = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const cur = sceneCount.get(k) ?? { lat, lng, orgs: new Map<string, SceneOrg>() };
    const o = cur.orgs.get(orgId) ?? { type, logo, n: 0 };
    o.n += 1; cur.orgs.set(orgId, o); sceneCount.set(k, cur);
  };
  // l'elisoccorso resta sempre visibile (anche quando è sul posto), non entra nel conteggio dei mezzi sul posto
  if (org) for (const a of onTheRoad(assignments, now)) if (onScene(a, now) && !isHeli(a)) addScene(a.lat, a.lng, org.id, org.type, org.logo_url ?? null);
  for (const a of onTheRoad(others, now)) if (onScene(a, now) && !isHeli(a)) addScene(a.lat, a.lng, a.org_id, a.org_type, a.logo_url);

  return (
    <div style={{ position: "relative", fontFamily: "system-ui, sans-serif" }}>
      {/* Barra in alto: associazione e soldi */}
      <div className="fs-top">
        {org ? (
          <div style={{ position: "relative", minWidth: 0 }}>
          <button className="fs-pill" onClick={() => setStatsOpen((o) => !o)} title="Andamento dell'associazione">
            <FactionEmblem type={org.type} size={34} logo={org.logo_url} />
            <span className="fs-pill-text">
              <span className="fs-name">{org.name}</span>
              {org.auto_enabled && <span className="fs-auto">🤖 AUTO</span>}
              <span className={`fs-money${fundsFlash ? " fs-money-flash" : ""}`}>💶 {(shownFunds ?? org.funds).toLocaleString("it-IT")} € <span className="fs-rep">⭐ {org.reputation}</span></span>
              {stats && (
                <span className="fs-chips">
                  <span title="Entrate meno uscite nell'ultima ora" style={{ color: stats.net_1h >= 0 ? "#15803D" : "#DC2626" }}>
                    {stats.net_1h >= 0 ? "📈" : "📉"} {stats.net_1h >= 0 ? "+" : "−"}{shortEuro(Math.abs(stats.net_1h))}/h
                  </span>
                  <span title="Servizi rubati nelle ultime 24 ore">🥷 {stats.stolen_24h}</span>
                  <span title="Servizi persi nelle ultime 24 ore" style={{ color: "#B45309" }}>😤 {stats.lost_24h}</span>
                </span>
              )}
            </span>
          </button>
          {statsOpen && stats && (
            <div className="fs-stats-pop" onClick={(e) => e.stopPropagation()}>
              <div className="fs-stats-head">📊 Andamento</div>
              <div className="fs-stats-body">
              <div className="fs-stat-row"><span>💚 Entrate ultima ora</span><strong style={{ color: "#15803D" }}>+{Number(stats.in_1h).toLocaleString("it-IT")} €</strong></div>
              <div className="fs-stat-row"><span>❤️ Uscite ultima ora</span><strong style={{ color: "#DC2626" }}>−{Number(stats.out_1h).toLocaleString("it-IT")} €</strong></div>
              <div className="fs-stat-row" style={{ borderTop: "1px solid #eee", paddingTop: 4 }}>
                <span>{stats.net_1h >= 0 ? "📈 Sei in positivo" : "📉 Sei in negativo"}</span>
                <strong style={{ color: stats.net_1h >= 0 ? "#15803D" : "#DC2626" }}>{stats.net_1h >= 0 ? "+" : "−"}{Math.abs(Number(stats.net_1h)).toLocaleString("it-IT")} €</strong>
              </div>
              <div className="fs-stat-row"><span>🚑 Servizi conclusi (1 ora)</span><strong>{stats.services_1h}</strong></div>
              <div className="fs-stat-row"><span>🥷 Servizi rubati (24 ore)</span><strong style={{ color: "#15803D" }}>{stats.stolen_24h}</strong></div>
              <div className="fs-stat-row"><span>😤 Servizi persi (24 ore)</span><strong style={{ color: "#B45309" }}>{stats.lost_24h}</strong></div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <button className="fs-stat-btn" onClick={() => router.push("/finanze")}>📊 Entrate e uscite</button>
                <button className="fs-stat-btn" onClick={() => router.push("/classifica")}>🏆 Classifica</button>
                <button className="fs-stat-btn" onClick={() => router.push("/associazione")}>🎨 Associazione</button>
              </div>
              </div>
            </div>
          )}
          </div>
        ) : loggedIn === false ? (
          <button className="fs-pill" onClick={() => router.push("/login")} style={{ fontWeight: 700 }}>Accedi / Registrati</button>
        ) : null}
        {org && fuel && (
          <button className="fs-fleet-btn fs-fuel-btn" onClick={() => router.push("/garage")}
                  title={`Gasolio nella cisterna per rifornire i mezzi: ${Math.round(fuel.stock)} L su ${fuel.cap} L. Tocca per andare al benzinaio.`}>
            {(() => {
              const pct = Math.max(0, Math.min(100, (fuel.stock / fuel.cap) * 100));
              const col = pct <= 0 ? "#9CA3AF" : pct < 20 ? "#DC2626" : pct < 50 ? "#EAB308" : "#16A34A";
              return (
                <>
                  <span className="fs-fuel-head">
                    <span>⛽ <span className="fs-fuel-word">Gasolio </span><strong style={{ color: pct < 20 ? "#DC2626" : "inherit" }}>{Math.round(fuel.stock).toLocaleString("it-IT")} L</strong></span>
                    <span style={{ color: "#888", fontWeight: 500 }}>/ {fuel.cap.toLocaleString("it-IT")}</span>
                  </span>
                  <span className="fs-fuel-bar"><span style={{ width: `${pct}%`, background: col }} /></span>
                  {fuel.empty > 0 && (
                    <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 700 }}>
                      {fuel.empty} {fuel.empty === 1 ? "mezzo" : "mezzi"} a secco
                    </span>
                  )}
                </>
              );
            })()}
          </button>
        )}
        {org && elec && (
          <button className="fs-fleet-btn fs-fuel-btn" onClick={() => setFleetKey((k) => k + 1)}
                  title={`Batteria media delle tue ${elec.n} ambulanze elettriche. Si ricaricano in 1 minuto quando sono ferme in sede.`}>
            {(() => {
              const pct = Math.max(0, Math.min(100, elec.pct));
              const col = pct < 20 ? "#DC2626" : pct < 50 ? "#EAB308" : "#16A34A";
              return (
                <>
                  <span className="fs-fuel-head">
                    <span>⚡ <span className="fs-fuel-word">Elettricità </span><strong style={{ color: pct < 20 ? "#DC2626" : "inherit" }}>{Math.round(pct)}%</strong></span>
                    <span style={{ color: "#888", fontWeight: 500 }}>{elec.n} {elec.n === 1 ? "mezzo" : "mezzi"}</span>
                  </span>
                  <span className="fs-fuel-bar"><span style={{ width: `${pct}%`, background: col }} /></span>
                  {elec.charging > 0 && (
                    <span style={{ fontSize: 11, color: "#15803D", fontWeight: 700 }}>🔌 {elec.charging} in ricarica</span>
                  )}
                </>
              );
            })()}
          </button>
        )}
      </div>

      {/* Le mie ambulanze con il conto alla rovescia */}
      {org && <FleetPanel jobs={assignments} now={now} refreshKey={fleetKey} orgType={org.type} onLocate={locate}
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

      {/* Nessuna ambulanza: guida al primo acquisto */}
      {org && noVehicles && (
        <div className="fs-first">
          <div style={{ fontSize: 30 }}>🚑</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800 }}>Non hai ancora un&apos;ambulanza</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>Comprane una nel Garage: ti guido passo passo. Poi tocca un servizio sulla mappa.</div>
          </div>
          <button onClick={() => router.push("/garage")}
                  style={{ border: "none", background: "#fff", color: "#C2410C", fontWeight: 800, borderRadius: 10, padding: "10px 14px", cursor: "pointer", whiteSpace: "nowrap" }}>
            Compra ora →
          </button>
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

      {/* Modalità scura */}
      <ThemeToggle className="fs-theme-btn" />

      {/* Chat tra giocatori */}
      {org && <ChatPanel orgId={org.id} />}

      {/* Menu hamburger: si apre da sinistra verso destra */}
      {org && (
        <>
          <button className="fs-burger" onClick={() => setMenuOpen(true)} aria-label="Apri il menu">
            <span /><span /><span />
            {notes.length > 0 && <b className="fs-badge">{notes.length}</b>}
          </button>
          <div className={`fs-drawer-bg${menuOpen ? " open" : ""}`} onClick={() => setMenuOpen(false)} />
          <nav className={`fs-drawer${menuOpen ? " open" : ""}`} aria-hidden={!menuOpen}>
            <div className="fs-drawer-head">
              <FactionEmblem type={org.type} size={38} logo={org.logo_url} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="fs-drawer-name">{org.name}</div>
                <div className="fs-drawer-sub">💶 {(shownFunds ?? org.funds).toLocaleString("it-IT")} € · ⭐ {org.reputation}</div>
              </div>
              <button className="fs-drawer-x" onClick={() => setMenuOpen(false)} aria-label="Chiudi">✕</button>
            </div>
            {([
              ["🚑", "Garage", "#F97316", "/garage"],
              ["👥", "Squadra", "#1E3A8A", "/squadra"],
              ["🤝", "Alleanza", "#15803D", "/alleanza"],
              ["🤖", org.auto_enabled ? "Modalità automatica · ON" : "Modalità automatica", "#0F766E", "/automatico"],
              ["🔁", "Trasferimenti", "#0E7490", "/trasferimenti"],
              ["🛒", "Presidi", "#374151", "/negozio"],
              ["🏷️", "Usato e aste", "#B45309", "/usate"],
              ["🏠", "Sedi", "#9333EA", "/sedi"],
              ["📊", "Entrate e uscite", "#166534", "/finanze"],
              ["🏢", "Fatturato sedi", "#1E3A8A", "/fatturato"],
              ["🏆", "Classifica", "#B45309", "/classifica"],
              ["🎨", "Associazione", "#DB2777", "/associazione"],
              ["📖", "Tutorial", "#2563EB", "__tutorial__"],
              ...(isAdmin ? [["🛠️", "Admin", "#7C3AED", "/admin"]] : []),
            ] as [string, string, string, string][]).map(([icon, label, color, href]) => (
              <button key={href} className="fs-drawer-item" onClick={() => {
                  setMenuOpen(false);
                  if (href === "__tutorial__") setShowTutorial(true); else router.push(href);
                }}>
                <span className="fs-drawer-ico" style={{ background: color }}>{icon}</span>
                <span style={{ flex: 1 }}>{label}</span>
                {href === "/alleanza" && notes.length > 0 && <b className="fs-drawer-badge">{notes.length}</b>}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button className="fs-drawer-item fs-drawer-exit" onClick={logout}>
              <span className="fs-drawer-ico" style={{ background: "#e5e5e0" }}>🚪</span>Esci
            </button>
          </nav>
        </>
      )}

      {showTutorial && <Tutorial onClose={closeTutorial} />}

      {error && (
        <div style={{ position: "absolute", top: 64, left: 12, right: 12, zIndex: 1000, background: "#fff3f3",
                      color: "#900", border: "1px solid #e99", padding: "10px 14px", borderRadius: 8 }}>{error}</div>
      )}

      {mooring && (
        <div style={{ position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "#0369A1",
                      color: "#fff", padding: "10px 14px", borderRadius: 10, fontWeight: 700, boxShadow: "0 2px 10px rgba(0,0,0,.3)",
                      display: "flex", gap: 10, alignItems: "center", maxWidth: "92vw" }}>
          ⚓ Tocca il mare dove ormeggiare {mooring.call_sign}
          <button onClick={() => setMooring(null)} style={{ border: "none", borderRadius: 8, padding: "4px 8px", cursor: "pointer" }}>Annulla</button>
        </div>
      )}
      <MapContainer ref={mapRef} center={[43.60, 10.42]} zoom={11} className="fs-map" style={{ width: "100%" }}>
        <TileLayer attribution="&copy; OpenStreetMap contributors"
                   url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {mooring && <MooringPicker onPick={moorAt} />}
        {located && now < located.until && (() => {
          const a = assignments.filter((x) => x.vehicle_id === located.vehicle).sort((x, y) => (x.assigned_at < y.assigned_at ? 1 : -1))[0];
          if (!a) return null;
          const p = alongRoute(routeOf(a), now);
          return <CircleMarker center={[p.lat, p.lng]} radius={26 + ((now / 1000) % 2) * 6}
                               pathOptions={{ color: "#2563EB", weight: 4, fillColor: "#60A5FA", fillOpacity: 0.15 }} />;
        })()}
        {heliBases.map((p) => (
          <Marker key={`heli-${p.id}`} position={[p.lat, p.lng]} icon={heliIcon}>
            <Popup><strong>🚁 {p.name}</strong><br />Base dell&apos;elisoccorso: da qui decolla e qui torna dopo il servizio.</Popup>
          </Marker>
        ))}
        {ports.map((p) => (
          <Marker key={`port-${p.id}`} position={[p.lat, p.lng]} icon={portIcon}>
            <Popup><strong>⚓ {p.name}</strong><br />Qui la barca porta il paziente e aspetta l&apos;ambulanza.</Popup>
          </Marker>
        ))}
        {boats.filter((b) => b.moor_lat != null && b.moor_lng != null && b.status !== "manutenzione" && b.status !== "fuori_servizio"
            // la barca ferma all'ormeggio si vede sempre, tranne quando è in giro (allora la mostra il livello delle barche in movimento)
            && !assignments.some((x) => x.vehicle_id === b.id && now < new Date(x.route_ends_at).getTime())).map((b) => (
          <Marker key={`boat-${b.id}`} position={[b.moor_lat!, b.moor_lng!]} icon={boatIcon(livery(b.vehicle_image, org?.type))}>
            <Popup>
              <strong>⛵ {b.call_sign}</strong><br />Ormeggiata, pronta per i servizi in mare (entro 40 km).
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setMooring(b)}
                        style={{ width: "100%", border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer",
                                 background: "#0369A1", color: "#fff", fontWeight: 700 }}>⚓ Sposta ormeggio</button>
              </div>
            </Popup>
          </Marker>
        ))}
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
          <Marker key={b.id} position={[b.lat, b.lng]} icon={baseIcon(b.org_type, b.org_id === org?.id, b.logo_url, b.is_headquarters && !!b.online)}
                  eventHandlers={{ popupopen: () => loadBaseCars(b.id) }}>
            <Popup>
              <div style={{ minWidth: 210 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <FactionEmblem type={b.org_type} size={34} logo={b.logo_url} />
                  <div style={{ lineHeight: 1.2 }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{b.org_name}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>⭐ {b.reputation ?? 0} reputazione</div>
                    <div style={{ fontSize: 12, color: b.online ? "#15803D" : "#888", fontWeight: 700 }}>
                      {b.online ? "🟢 Online" : b.last_seen_at ? `⚪ Visto ${lastSeen(b.last_seen_at)}` : "⚪ Offline"}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  🏠 <strong>{b.name}</strong>{b.is_headquarters && <span style={{ color: "#B45309", fontWeight: 700 }}> · sede principale</span>}
                  {b.org_id === org?.id && (
                    <button title="Cambia nome" onClick={async () => {
                        const name = window.prompt("Nuovo nome della sede (2-40 caratteri):", b.name);
                        if (name === null || name.trim() === b.name) return;
                        const { error } = await supabase.rpc("rename_base", { p_base: b.id, p_name: name });
                        if (error) { showToast(error.message.includes("BAD_NAME") ? "Il nome deve avere tra 2 e 40 caratteri." : "Non riesco a cambiare il nome."); return; }
                        showToast(`🏠 Sede rinominata: ${name.trim()}`);
                        supabase.from("bases_map").select("*").then(({ data }) => { if (data) setBases(data as BasePin[]); });
                      }}
                      style={{ marginLeft: 6, border: "none", background: "#f1f1f1", borderRadius: 6, padding: "1px 6px",
                               cursor: "pointer", fontSize: 12 }}>✏️</button>
                  )}<br />
                  {!b.is_headquarters && b.hq_name && <>🏛️ Sede principale: <strong>{b.hq_name}</strong><br /></>}
                  🤝 Alleanza: <strong>{b.alliance ?? "nessuna"}</strong><br />
                  🚑 Ambulanze qui: <strong>{b.vehicles_here ?? 0}</strong>{b.vehicle_capacity ? ` / ${b.vehicle_capacity} posti` : ""}<br />
                  📍 In tutto: <strong>{b.org_bases ?? 1}</strong> {b.org_bases === 1 ? "sede" : "sedi"} · <strong>{b.org_vehicles ?? 0}</strong> ambulanze · livello {b.level}
                </div>
                <div style={{ marginTop: 6, background: "#f6f6f4", borderRadius: 8, padding: "6px 8px", fontSize: 12, maxHeight: 180, overflowY: "auto" }}>
                  {(() => {
                    const cars = baseCars[b.id];
                    if (!cars) return <span style={{ color: "#888" }}>Caricamento ambulanze…</span>;
                    if (cars.length === 0) return <span style={{ color: "#888" }}>Nessuna ambulanza in questa sede</span>;
                    const home = cars.filter((c) => c.state === "sede").length;
                    return (
                      <>
                        <div style={{ fontWeight: 800, marginBottom: 3 }}>🚑 In sede ora: {home} su {cars.length}</div>
                        {cars.map((c, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                            {c.image_url
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={(livery(c.image_url, b.org_type) ?? "").replace(/\.png$/, "-map.png")} alt="" style={{ width: 34, height: "auto" }} />
                              : <span>🚑</span>}
                            <strong style={{ flex: 1 }}>{c.call_sign}{c.electric && " ⚡"}</strong>
                            <span style={{ color: CAR_STATE[c.state][1], fontWeight: 700, whiteSpace: "nowrap" }}>{CAR_STATE[c.state][0]}</span>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
                {b.org_id === org?.id && (
                  <button onClick={() => router.push("/sedi")}
                          style={{ marginTop: 8, width: "100%", border: "none", background: "#111", color: "#fff", borderRadius: 8,
                                   padding: "7px 10px", cursor: "pointer", fontWeight: 700 }}>🏠 Compra una nuova sede</button>
                )}
              </div>
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

        {missions.filter((m) => m.category === "grande_evento").map((m) => {
          const isMaxi = !m.event_id;
          return (
          <Marker key={m.id} position={[m.lat, m.lng]}
                  icon={isMaxi ? maxiIcon() : eventIcon(upcoming.find((e) => e.id === m.event_id)?.kind ?? "altro", m.status === "aperta")}>
            <Popup className="fs-mis-popup">
              <div className="fs-mis-bar" style={{ background: isMaxi ? "#DC2626" : "#7C3AED" }}>
                <span className="fs-mis-title">{m.title}</span>
                <span className="fs-mis-code">{isMaxi ? "MAXI" : "evento"}</span>
              </div>
              <div className="fs-mis-body">
                {isMaxi ? (
                  <>
                    {m.description && <div style={{ marginBottom: 6 }}>{m.description}</div>}
                    <div className="fs-mis-meta">
                      <span>🚑 {m.slots_taken} sul posto</span>
                      <span>💶 {m.reward_funds.toLocaleString("it-IT")} €/mezzo</span>
                      <span>⏱️ {new Date(m.expires_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 700, color: "#B91C1C" }}>Più ambulanze mandi, più guadagni (fino a 3× a mezzo).</div>
                    {org && m.status === "aperta" && (
                      <button onClick={() => setSelected(m)}
                              style={{ marginTop: 9, width: "100%", border: "none", borderRadius: 10, padding: "9px 10px", cursor: "pointer",
                                       background: "#DC2626", color: "#fff", fontWeight: 800 }}>🆘 Manda un&apos;ambulanza</button>
                    )}
                  </>
                ) : (
                  <>
                    {m.description && <div style={{ marginBottom: 6 }}>{m.venue} · {m.description}</div>}
                    <div className="fs-mis-meta">
                      <span>🚑 {m.slots_taken}/{m.slots_total}</span>
                      <span>💶 {m.reward_funds.toLocaleString("it-IT")} €</span>
                      <span>⏱️ {new Date(m.expires_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    {org && m.status === "aperta" && m.slots_taken < m.slots_total && (
                      <button onClick={() => setSelected(m)}
                              style={{ marginTop: 9, width: "100%", border: "none", borderRadius: 10, padding: "9px 10px", cursor: "pointer",
                                       background: "#7C3AED", color: "#fff", fontWeight: 800 }}>🏟️ Prenota la postazione</button>
                    )}
                  </>
                )}
              </div>
            </Popup>
          </Marker>
          );
        })}

        {missions.filter((m) => m.category !== "grande_evento").map((m) => (
          <CircleMarker key={m.id} center={[m.lat, m.lng]} radius={m.contestable ? 12 : 10}
                        pathOptions={m.contestable
                          ? { color: "#111", weight: 3, dashArray: "4 4", fillColor: CODE_COLOR[m.code], fillOpacity: 0.85 }
                          : m.category === "mare" ? { color: "#0369A1", weight: 4, fillColor: CODE_COLOR[m.code], fillOpacity: 0.85 }
                          : { color: CODE_COLOR[m.code], fillOpacity: 0.8 }}
                        eventHandlers={{ popupopen: () => { setOpenMission(m.id); loadResponders(m.id); },
                                         popupclose: () => setOpenMission((o) => (o === m.id ? null : o)) }}>
            <Popup className="fs-mis-popup">
              <div className="fs-mis-bar" style={{ background: CODE_COLOR[m.code] }}>
                <span className="fs-mis-title">{m.title}</span>
                <span className="fs-mis-code">{m.code === "nessuno" ? "ordinario" : m.code}</span>
              </div>
              <div className="fs-mis-body">
              {m.category === "mare" && <div style={{ fontSize: 12, color: "#0369A1", fontWeight: 700 }}>🌊 Servizio in mare: ci va solo la barca, poi un&apos;ambulanza prende il paziente al porto.</div>}
              {m.slots_taken > 0 && (
                <div style={{ margin: "6px 0", background: "#f6f6f4", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}>
                  <div style={{ fontWeight: 800, marginBottom: 2 }}>🏁 Ordine di arrivo</div>
                  {responders[m.id] === undefined || responders[m.id] === null ? <span style={{ color: "#888" }}>Caricamento…</span>
                    : responders[m.id]!.length === 0 ? <span style={{ color: "#888" }}>Nessuno in viaggio</span>
                    : (() => {
                        const list = responders[m.id]!;
                        const alive = list.filter((r) => !r.lost && !r.companion);
                        const lastAlive = alive.length > 1 ? alive[alive.length - 1] : null;
                        let rank = 0;
                        return list.map((r, i) => {
                          const ms = new Date(r.arrives_at).getTime() - now;
                          const here = r.status === "sul_posto" || ms <= 0;
                          const eta = ms < 60000 ? `${Math.max(1, Math.round(ms / 1000))} s` : `${Math.round(ms / 60000)} min`;
                          if (!r.lost && !r.companion) rank++;
                          const out = r.lost || (!r.companion && rank > r.slots);
                          const medal = r.lost ? "❌" : r.companion ? "🤝" : rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}°`;
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3,
                                                  opacity: r.lost ? 0.6 : 1, background: out ? "#FEE2E2" : undefined,
                                                  borderRadius: 6, padding: out ? "2px 4px" : undefined }}>
                              <span style={{ width: 22, textAlign: "center", fontWeight: 800 }}>{medal}</span>
                              <FactionEmblem type={r.org_type} size={18} logo={r.logo_url} />
                              <span style={{ flex: 1 }}>
                                <strong style={{ color: r.mine ? "#15803D" : undefined, textDecoration: r.lost ? "line-through" : undefined }}>
                                  {r.mine ? "Tu" : r.org_name}</strong> · {r.automedica && "🩺 "}{r.call_sign}
                                {r.companion && <span style={{ color: "#2563EB", fontWeight: 700 }}> · cambio automedica</span>}
                                {rank === 1 && !r.lost && !r.companion && <span style={{ color: "#15803D", fontWeight: 700 }}> · primo</span>}
                                {r === lastAlive && <span style={{ color: "#B91C1C", fontWeight: 700 }}> · ultimo</span>}
                              </span>
                              <span style={{ whiteSpace: "nowrap", fontWeight: 700, color: out ? "#B91C1C" : undefined }}>
                                {r.lost ? "ha perso, torna in sede" : out ? (here ? "senza posto" : `tra ${eta} · fuori`)
                                  : here ? "📍 sul posto" : `arriva tra ${eta}`}
                              </span>
                            </div>
                          );
                        });
                      })()}
                </div>
              )}
              {m.description && <div style={{ marginBottom: 6 }}>{m.description}</div>}
              <div className="fs-mis-meta">
                <span>🚑 {m.slots_taken}/{m.slots_total}</span>
                <span>💶 {m.reward_funds.toLocaleString("it-IT")} €</span>
                <span>⏱️ {new Date(m.expires_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              {m.requires?.length > 0 && <div className="fs-mis-req">🧰 {m.requires.map((r) => REQ[r] ?? r).join(", ")}</div>}
              {m.won_by_automedica && (
                <div style={{ marginTop: 8, background: "#FEE2E2", color: "#7F1D1D", borderRadius: 8, padding: "6px 8px", fontSize: 12, fontWeight: 700 }}>
                  🩺🏆 Vinto a tavolino da {m.won_by_automedica}: la sua automedica è arrivata per prima.
                </div>
              )}
              {org && m.status === "aperta" && m.slots_taken < m.slots_total && (!m.won_by_automedica || m.won_by_automedica === org.name) && (
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => setSelected(m)}
                          style={{ width: "100%", border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer",
                                   background: CODE_COLOR[m.code], color: "#fff", fontWeight: 700 }}>🚨 Prendi servizio</button>
                </div>
              )}
              {org && (m.category === "emergenza_118" || m.category === "mare") && !m.won_by_automedica
                && !(m.first_arrival && new Date(m.first_arrival).getTime() <= now) && (
                <div style={{ marginTop: 6 }}>
                  <button onClick={() => setSelected(m)}
                          style={{ width: "100%", border: "2px solid #EA580C", borderRadius: 8, padding: "6px 10px", cursor: "pointer",
                                   background: "#FFF7ED", color: "#9A3412", fontWeight: 800 }}>🚁 Elisoccorso (vinci a tavolino)</button>
                </div>
              )}
              {org && m.my_automedica_waiting && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>🩺 La tua automedica aspetta un&apos;ambulanza.</div>
                  <button onClick={() => setSelected(m)}
                          style={{ width: "100%", border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer",
                                   background: "#2563EB", color: "#fff", fontWeight: 800 }}>🚑 Manda l&apos;ambulanza</button>
                </div>
              )}
              {org && m.contestable && !(m.my_vehicles ?? 0) && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>⚔️ Già preso, ma nessuno è ancora arrivato: chi arriva primo vince!</div>
                  <button onClick={() => setSelected(m)}
                          style={{ width: "100%", border: "2px dashed #111", borderRadius: 8, padding: "8px 10px", cursor: "pointer",
                                   background: "#F97316", color: "#fff", fontWeight: 800 }}>⚔️ Contendi il servizio</button>
                </div>
              )}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {Array.from(sceneCount.entries()).map(([k, c]) => (
          <Marker key={`scene-${k}`} position={[c.lat, c.lng]} icon={sceneBadge(Array.from(c.orgs.values()))} interactive={false} zIndexOffset={500} />
        ))}

        {onTheRoad(others, now).filter((a) => !onScene(a, now) && !isHeli(a) && !isBoat(a)).map((a) => {
          const route: RoutePoint[] = a.route?.length ? a.route : [
            { lat: a.base_lat, lng: a.base_lng, t: a.assigned_at, label: "Sede" },
            { lat: a.lat, lng: a.lng, t: a.arrives_at, label: "Sul posto" },
            { lat: a.lat, lng: a.lng, t: a.completes_at, label: "Sul posto" },
          ];
          const pos = alongRoute(route, now);
          return (
            <MovingMarker key={`o-${a.id}`} route={route} code={a.code} zIndexOffset={-100}
                          makeIcon={(sc, fr) => otherAmbulanceIcon(sc, livery(a.vehicle_image, a.org_type), fr, a.org_type, a.logo_url)}>
              <Popup className="fs-amb-popup">
                <div className="fs-amb">
                  <div className="fs-amb-bar" style={{ background: CODE_COLOR[a.code] }}>
                    <FactionEmblem type={a.org_type} size={24} logo={a.logo_url} />
                    <div style={{ lineHeight: 1.15, minWidth: 0 }}>
                      <div className="fs-amb-org">{a.org_name}</div>
                      <div className="fs-amb-callsmall">🚑 {a.call_sign}</div>
                    </div>
                    <span className="fs-amb-code">{a.code === "nessuno" ? "ord." : a.code}</span>
                  </div>
                  <div className="fs-amb-body">
                    <div className="fs-amb-title">{a.title.split(" — ")[0]}</div>
                    <div className="fs-amb-row">📍 <span><b>{pos.text}</b>{now < new Date(a.arrives_at).getTime() && <> · sul posto tra {Math.max(1, Math.round((new Date(a.arrives_at).getTime() - now) / 60000))} min</>}</span></div>
                  </div>
                </div>
              </Popup>
            </MovingMarker>
          );
        })}

        {/* Elisoccorso: livello dedicato, posizione ricalcolata ogni secondo, sempre visibile dal decollo al rientro */}
        {([...assignments.map((x) => ({ id: x.id, status: x.status, route: x.route, arrives_at: x.arrives_at, route_ends_at: x.route_ends_at,
                lat: x.lat, lng: x.lng, title: x.title, hospital: x.hospital, vehicle_image: x.vehicle_image, org_name: "", org_type: org?.type ?? null,
                call_sign: x.call_sign, mine: true })),
           ...others.map((x) => ({ id: x.id, status: x.status, route: x.route, arrives_at: x.arrives_at, route_ends_at: x.route_ends_at,
                lat: (x as unknown as { lat: number }).lat, lng: (x as unknown as { lng: number }).lng, title: x.title, hospital: x.hospital,
                vehicle_image: x.vehicle_image, org_name: x.org_name, org_type: x.org_type, call_sign: x.call_sign, mine: false }))] as HeliRow[])
          .filter((a) => (isHeli(a) || isBoat(a)) && a.route?.length && (isBoat(a) || a.status !== "annullata") && now < new Date(a.route_ends_at).getTime())
          .map((a) => {
            if (isBoat(a)) {
              // barca: livello dedicato come l'elisoccorso, con la rotta in mare ancora da fare
              const r = a.route as RoutePoint[];
              const pos = alongRoute(r, now);
              const ahead = alongRoute(r, now + 3000);
              const path = remainingPath(r, pos.leg, pos.f);
              const img = livery(a.vehicle_image, a.org_type) ?? "/vehicles/b-marlin.png";
              return (
                <Fragment key={`boat-${a.id}`}>
                  {a.mine && path.map((seg, i) => (
                    <Polyline key={`boat-${a.id}-${i}`} positions={seg}
                              pathOptions={{ color: "#0369A1", weight: i === 0 ? 4 : 3, opacity: i === 0 ? 0.85 : 0.45, dashArray: i === 0 ? undefined : "8 8" }} />
                  ))}
                  <Marker position={[pos.lat, pos.lng]} icon={boatMoveIcon(img, ahead.lng > pos.lng, a.mine ? 72 : 58, pos.moving,
                          pos.moving ? (pos.text.startsWith("Rientro") ? "⛵ RIENTRA ALL'ORMEGGIO" : "⛵ IN NAVIGAZIONE")
                          : pos.text.startsWith("In porto") ? "⚓ IN PORTO · ASPETTA L'AMBULANZA" : pos.text.startsWith("Soccorso") ? "🛟 SOCCORSO IN MARE" : "⛵ IN MARE")} zIndexOffset={2500}>
                    <Popup>
                      <strong>⛵ {a.call_sign}</strong>{a.mine ? "" : ` · ${a.org_name}`}<br />
                      {a.title}<br />{pos.text}
                    </Popup>
                  </Marker>
                </Fragment>
              );
            }
            const r = a.route as RoutePoint[];
            const pos = alongRoute(r, now);
            const ahead = alongRoute(r, now + 3000);
            const toScene = now < new Date(a.arrives_at).getTime();
            const secs = Math.max(0, Math.round((new Date(a.arrives_at).getTime() - now) / 1000));
            return (
              <Fragment key={`heli-${a.id}`}>
                {toScene && <Polyline positions={[[pos.lat, pos.lng], [a.lat, a.lng]]} pathOptions={{ color: "#EA580C", weight: 3, dashArray: "6 6", opacity: 0.9 }} />}
                {toScene && <CircleMarker center={[a.lat, a.lng]} radius={16} pathOptions={{ color: "#EA580C", weight: 3, fillOpacity: 0.1 }} />}
                <Marker position={[pos.lat, pos.lng]} icon={heliMarkerIcon(ahead.lng > pos.lng, a.mine ? 96 : 80)} zIndexOffset={3000}>
                  <Popup>
                    <strong>🚁 Elisoccorso{a.mine ? "" : ` · ${a.org_name}`}</strong><br />
                    {a.title}<br />
                    {pos.text}{toScene ? ` · arriva tra ${secs} s` : ""}
                    {a.hospital && <><br />Ospedale: {a.hospital}</>}
                  </Popup>
                </Marker>
              </Fragment>
            );
          })}

        {onTheRoad(assignments, now).filter((a) => !isHeli(a) && !isBoat(a)).map((a) => {
          const route: RoutePoint[] = a.route?.length ? a.route : [
            { lat: a.base_lat, lng: a.base_lng, t: a.assigned_at, label: "Sede" },
            { lat: a.lat, lng: a.lng, t: a.arrives_at, label: "Sul posto" },
            { lat: a.lat, lng: a.lng, t: a.completes_at, label: "Sul posto" },
          ];
          const pos = alongRoute(route, now);
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
            {!onScene(a, now) && <MovingMarker key={`m-${a.id}`} route={route} code={a.code}
                          makeIcon={(sc, fr) => ambulanceIcon(sc, livery(a.vehicle_image, org?.type), fr)}>
              <Popup className="fs-amb-popup">
                <div className="fs-amb">
                  <div className="fs-amb-bar" style={{ background: CODE_COLOR[a.code] }}>
                    <span style={{ fontSize: 17 }}>🚑</span>
                    <span className="fs-amb-sign">{a.call_sign}</span>
                    <span className="fs-amb-code">{a.code === "nessuno" ? "ordinario" : a.code}</span>
                  </div>
                  <div className="fs-amb-body">
                    <div className="fs-amb-title">{a.title.split(" — ")[0]}</div>
                    <div className="fs-amb-row">📍 <span><b>{pos.text}</b> · {left} min</span></div>
                    {a.hospital && <div className="fs-amb-row">🏥 <span>{a.hospital}</span></div>}
                    {back > 0
                      ? <div className="fs-amb-row">🕐 Libero tra <b>{back} min</b></div>
                      : <div className="fs-amb-free">✅ Disponibile: puoi già rimandarlo</div>}
                    {a.status === "in_viaggio" && now < new Date(a.arrives_at).getTime() && (
                      <button className="fs-amb-cancel" onClick={async () => {
                          if (!window.confirm("Annullare il viaggio? L'ambulanza torna libera subito, senza premio.")) return;
                          const { error } = await supabase.rpc("cancel_assignment", { p_assignment: a.id });
                          if (error) { showToast("Non si può più annullare: è già sul posto."); return; }
                          showToast("↩️ Viaggio annullato: scegli un altro servizio sulla mappa.");
                          supabase.from("my_assignments").select("*").then(({ data }) => setAssignments((data as Assignment[]) ?? []));
                        }}>↩️ Annulla viaggio</button>
                    )}
                  </div>
                </div>
              </Popup>
            </MovingMarker>}
            </Fragment>
          );
        })}
      </MapContainer>

      <style>{`
        .fs-map { height: 100vh; height: 100dvh; }
        .fs-top { position: absolute; top: 10px; left: 62px; z-index: 1000; max-width: calc(100% - 72px); }
        .fs-pill { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,.92); backdrop-filter: blur(10px);
          border: 1px solid rgba(0,0,0,.05); border-radius: 14px; padding: 6px 12px 6px 8px;
          box-shadow: 0 4px 16px rgba(0,0,0,.18); cursor: pointer; text-align: left; max-width: 100%; font-family: inherit;
          transition: box-shadow .18s, transform .18s; }
        .fs-pill:hover { box-shadow: 0 6px 22px rgba(0,0,0,.24); transform: translateY(-1px); }
        .fs-pill-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
        .fs-chips { display: flex; gap: 8px; font-size: 11px; font-weight: 800; margin-top: 2px; white-space: nowrap; }
        .fs-stats-pop { position: absolute; top: calc(100% + 8px); left: 0; z-index: 1300; background: #fff; color: #111; border-radius: 16px;
          box-shadow: 0 16px 40px rgba(0,0,0,.32); border: 1px solid rgba(0,0,0,.05); padding: 0; overflow: hidden; width: min(300px, 86vw); font-size: 13px; text-align: left; }
        .fs-stats-head { background: linear-gradient(135deg,#16A34A,#15803D); color: #fff; font-weight: 800; font-size: 14px; padding: 11px 14px; }
        .fs-stats-body { padding: 12px 14px; }
        .fs-stat-row { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; }
        .fs-stat-btn { border: none; background: #f1f5f9; border-radius: 9px; padding: 7px 9px; font-weight: 700; font-size: 12px; cursor: pointer; }
        .fs-stat-btn:hover { background: #e2e8f0; }
        .fs-name { font-weight: 800; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #111; max-width: 190px; }
        .fs-money { font-size: 16px; font-weight: 800; color: #15803D; white-space: nowrap; transition: transform .2s; display: inline-flex; align-items: center; gap: 2px; }
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
        .fs-rep { color: #92400E; font-weight: 800; margin-left: 6px; background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 999px; padding: 1px 8px; font-size: 12.5px; }
        .fs-top { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; }
        .fs-top > .fs-pill { min-width: 0; }
        .fs-fuel-btn { white-space: nowrap; flex-shrink: 0; display: flex; flex-direction: column; justify-content: center; gap: 5px; min-width: 150px; text-align: left; }
        .fs-fuel-head { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
        .fs-fuel-head strong { font-variant-numeric: tabular-nums; }
        .fs-fuel-bar { display: block; height: 9px; background: #e5e7eb; border-radius: 999px; overflow: hidden; }
        .fs-fuel-bar > span { display: block; height: 100%; border-radius: 999px; transition: width .4s, background .4s; }
        @media (max-width: 760px) { .fs-fuel-word { display: none; } }
        .fs-first { position: absolute; z-index: 1050; left: 50%; transform: translateX(-50%); bottom: calc(24px + env(safe-area-inset-bottom));
          width: min(520px, calc(100% - 20px)); display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px;
          background: linear-gradient(135deg,#F97316,#C2410C); color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.35); animation: note-glow 2s infinite; }
        @media (max-width: 760px) { .fs-first { bottom: calc(80px + env(safe-area-inset-bottom)); } }
        .fs-auto { font-size: 10px; font-weight: 800; color: #fff; background: #0F766E; border-radius: 6px; padding: 1px 6px; width: fit-content; }
        .fs-burger { position: absolute; top: 10px; left: 10px; z-index: 1000; width: 44px; height: 44px; border-radius: 13px; border: none;
          background: linear-gradient(135deg,#F97316,#C2410C); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
          box-shadow: 0 4px 14px rgba(194,65,12,.45); transition: transform .18s, box-shadow .18s; }
        .fs-burger:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(194,65,12,.55); }
        .fs-burger span { display: block; width: 20px; height: 2.5px; border-radius: 2px; background: #fff; }
        .fs-map .leaflet-top.leaflet-left { top: 50px; }
        .fs-maxi-pin { box-shadow: 0 0 0 4px rgba(220,38,38,.4), 0 3px 10px rgba(0,0,0,.5); animation: maxi-pulse 1.3s infinite; }
        @keyframes maxi-pulse { 0%,100% { box-shadow: 0 0 0 4px rgba(220,38,38,.45), 0 3px 10px rgba(0,0,0,.5) }
          50% { box-shadow: 0 0 0 13px rgba(220,38,38,0), 0 3px 10px rgba(0,0,0,.5) } }
        .fs-mis-popup .leaflet-popup-content-wrapper { border-radius: 14px; box-shadow: 0 12px 34px rgba(0,0,0,.28); padding: 0; overflow: hidden; }
        .fs-mis-popup .leaflet-popup-content { margin: 0; width: 258px !important; }
        .fs-mis-popup .leaflet-popup-tip { box-shadow: 0 12px 34px rgba(0,0,0,.28); }
        .fs-mis-popup a.leaflet-popup-close-button { top: 6px; right: 7px; color: rgba(255,255,255,.95); width: 20px; height: 20px; font-size: 18px; }
        .fs-mis-bar { display: flex; align-items: center; gap: 8px; padding: 9px 30px 9px 12px; color: #fff; }
        .fs-mis-title { font-weight: 800; font-size: 13.5px; line-height: 1.22; flex: 1; }
        .fs-mis-code { flex-shrink: 0; font-size: 10px; font-weight: 900; color: #111; background: rgba(255,255,255,.92);
          padding: 2px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: .3px; }
        .fs-mis-body { padding: 10px 12px 11px; font-size: 13px; color: #374151; line-height: 1.4; }
        .fs-mis-meta { display: flex; flex-wrap: wrap; gap: 7px; margin: 7px 0 2px; }
        .fs-mis-meta span { background: #f3f4f6; border-radius: 8px; padding: 3px 8px; font-size: 12.5px; font-weight: 800; color: #111827; }
        .fs-mis-req { font-size: 12px; color: #6b7280; margin-top: 4px; }
        .fs-amb-popup .leaflet-popup-content-wrapper { border-radius: 14px; box-shadow: 0 12px 34px rgba(0,0,0,.30); padding: 0; overflow: hidden; }
        .fs-amb-popup .leaflet-popup-content { margin: 0; width: 232px !important; }
        .fs-amb-popup .leaflet-popup-tip { box-shadow: 0 12px 34px rgba(0,0,0,.30); }
        .fs-amb-popup a.leaflet-popup-close-button { top: 6px; right: 6px; color: rgba(255,255,255,.9); }
        .fs-amb { font-family: inherit; }
        .fs-amb-bar { height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 12px; color: #fff; }
        .fs-amb-bar .fs-amb-sign { font-weight: 800; font-size: 14px; color: #fff; letter-spacing: .2px; }
        .fs-amb-bar .fs-amb-org { font-weight: 800; font-size: 13px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fs-amb-bar .fs-amb-callsmall { font-size: 10px; color: rgba(255,255,255,.85); font-weight: 700; }
        .fs-amb-code { margin-left: auto; font-size: 10px; font-weight: 900; color: #111; background: rgba(255,255,255,.92);
          padding: 2px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: .4px; flex-shrink: 0; }
        .fs-amb-body { padding: 10px 12px 11px; }
        .fs-amb-title { font-size: 13px; color: #111827; font-weight: 700; line-height: 1.25; margin-bottom: 7px; }
        .fs-amb-row { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #4b5563; padding: 2px 0; }
        .fs-amb-row b { color: #111827; font-weight: 700; }
        .fs-amb-free { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #15803D; font-weight: 800;
          background: #ecfdf3; border: 1px solid #bbf7d0; border-radius: 9px; padding: 6px 8px; margin-top: 4px; }
        .fs-amb-cancel { margin-top: 9px; width: 100%; border: none; background: #374151; color: #fff; border-radius: 10px;
          padding: 8px 10px; cursor: pointer; font-weight: 800; font-size: 12px; transition: background .15s; }
        .fs-amb-cancel:hover { background: #1f2937; }
        .fs-drawer-bg { position: fixed; inset: 0; z-index: 1300; background: rgba(0,0,0,.4); opacity: 0; pointer-events: none; transition: opacity .25s; }
        .fs-drawer-bg.open { opacity: 1; pointer-events: auto; }
        .fs-drawer { position: fixed; top: 0; left: 0; bottom: 0; z-index: 1310; width: min(290px, 84vw); background: #fff;
          box-shadow: 6px 0 28px rgba(0,0,0,.35); transform: translateX(-105%); transition: transform .28s cubic-bezier(.2,.8,.2,1);
          display: flex; flex-direction: column; padding: 12px 10px calc(12px + env(safe-area-inset-bottom)); overflow-y: auto; }
        .fs-drawer.open { transform: translateX(0); }
        .fs-drawer-head { display: flex; align-items: center; gap: 10px; margin: -12px -10px 10px; padding: 16px 12px;
          background: linear-gradient(135deg,#F97316,#C2410C); border-radius: 0 0 18px 18px; box-shadow: 0 4px 14px rgba(194,65,12,.3); }
        .fs-drawer-name { font-weight: 800; font-size: 15px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fs-drawer-sub { font-size: 12px; color: rgba(255,255,255,.92); font-weight: 700; }
        .fs-drawer-x { border: none; background: rgba(255,255,255,.22); color: #fff; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 15px; }
        .fs-drawer-x:hover { background: rgba(255,255,255,.35); }
        .fs-drawer-item { display: flex; align-items: center; gap: 12px; width: 100%; border: none; background: transparent; color: #111;
          font: inherit; font-size: 15px; font-weight: 700; padding: 9px 8px; border-radius: 12px; cursor: pointer; text-align: left;
          transition: background .15s, transform .12s; }
        .fs-drawer-item:hover { background: #f3f4f6; transform: translateX(2px); }
        .fs-drawer-item:active { transform: translateX(2px) scale(.99); }
        .fs-drawer-ico { width: 38px; height: 38px; border-radius: 11px; display: flex; align-items: center; justify-content: center;
          font-size: 19px; flex-shrink: 0; color: #fff; box-shadow: 0 2px 6px rgba(0,0,0,.18); }
        .fs-drawer-badge { background: #DC2626; color: #fff; font-size: 12px; min-width: 22px; height: 22px; border-radius: 11px;
          display: flex; align-items: center; justify-content: center; padding: 0 6px; animation: note-pulse 1.4s infinite; }
        .fs-drawer-exit { color: #555; }
        .fs-toast { bottom: 24px; }
        .fs-theme-btn { position: absolute; z-index: 1000; top: 62px; right: 10px; width: 42px; height: 42px; border-radius: 50%;
          border: 1px solid rgba(0,0,0,.05); background: rgba(255,255,255,.92); backdrop-filter: blur(10px); font-size: 20px; cursor: pointer;
          box-shadow: 0 4px 16px rgba(0,0,0,.18); transition: transform .18s, box-shadow .18s; }
        .fs-theme-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(0,0,0,.24); }
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
        .fs-fleet { position: absolute; top: 96px; left: 62px; z-index: 1000; width: min(330px, calc(100% - 72px)); }
        .fs-fleet-btn { background: rgba(255,255,255,.92); backdrop-filter: blur(10px); border: 1px solid rgba(0,0,0,.05); border-radius: 14px;
          padding: 7px 12px; font-size: 13px; font-weight: 600; box-shadow: 0 4px 16px rgba(0,0,0,.18); cursor: pointer; font-family: inherit; color: #111;
          transition: transform .18s, box-shadow .18s; }
        .fs-fleet-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(0,0,0,.24); }
        .fs-fleet-toggle { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 7px 12px !important; }
        .fs-flt-ic { width: 32px; height: 32px; border-radius: 10px; background: linear-gradient(135deg,#F97316,#C2410C); color: #fff;
          display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; box-shadow: 0 2px 6px rgba(194,65,12,.4); }
        .fs-flt-main { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; flex: 1; }
        .fs-flt-title { font-weight: 800; font-size: 13px; color: #111; letter-spacing: .2px; }
        .fs-flt-sub { font-size: 11.5px; color: #6b7280; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fs-flt-sub strong { color: #15803D; }
        .fs-flt-chev { color: #9ca3af; font-size: 12px; flex-shrink: 0; }
        .fs-fleet-list { margin-top: 6px; background: #fff; border-radius: 14px; box-shadow: 0 12px 34px rgba(0,0,0,.28);
          border: 1px solid rgba(0,0,0,.05); max-height: 50vh; overflow-y: auto; overflow-x: hidden; }
        @media (max-width: 760px) {
          .fs-toast { bottom: calc(24px + env(safe-area-inset-bottom)); }
          .fs-notes { bottom: auto; top: 160px; }
          .fs-theme-btn { top: 10px; }
          /* telefono: nome e soldi su tutta la riga, gasolio ed elettricità sotto */
          .fs-top { left: 62px; right: 60px; max-width: none; flex-wrap: wrap; gap: 6px; }
          .fs-top > .fs-pill { flex: 1 1 100%; width: 100%; }
          .fs-name { font-size: 13px; }
          .fs-money { font-size: 14px; }
          .fs-fuel-btn { flex: 1 1 0; min-width: 0; padding: 6px 10px !important; font-size: 11.5px !important; gap: 4px; }
          .fs-fuel-bar { height: 8px; }
          .fs-rep { font-size: 12px; padding: 1px 7px; }
          .fs-fleet { top: 156px; left: 10px; width: calc(100% - 20px); }
          .fs-map .leaflet-control-zoom { display: none; }
          .fs-chat-btn { bottom: calc(20px + env(safe-area-inset-bottom)); width: 48px; height: 48px; font-size: 22px; }
          .fs-chat { left: 8px; right: 8px; width: auto; bottom: calc(76px + env(safe-area-inset-bottom)); height: 55vh; }
          .leaflet-bottom { bottom: env(safe-area-inset-bottom); }
          .fs-pill { padding: 5px 10px 5px 6px; }
        }
        @keyframes amb-blink { 0% { filter: drop-shadow(0 0 6px #3b82f6) } 50% { filter: drop-shadow(0 0 6px #ef4444) } }
        @keyframes boat-wake { 0%,100% { opacity: .9; transform: scaleX(1) } 50% { opacity: .5; transform: scaleX(1.3) } }
        @keyframes heli-rotor { 0% { transform: scaleX(1) } 50% { transform: scaleX(.15) } 100% { transform: scaleX(1) } }
        @keyframes heli-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        @keyframes amb-light-a { 0% { background: #60a5fa; box-shadow: 0 0 5px 2px rgba(59,130,246,.9) } 50% { background: transparent; box-shadow: none } }
        @keyframes amb-light-b { 0% { background: transparent; box-shadow: none } 50% { background: #60a5fa; box-shadow: 0 0 5px 2px rgba(59,130,246,.9) } }
        @keyframes ev-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(124,58,237,.6) } 50% { box-shadow: 0 0 0 10px rgba(124,58,237,0) } }`}</style>

      {selected && (
        <MissionPanel mission={selected} onClose={() => setSelected(null)}
                      onClaimed={(text) => { setSelected(null); showToast(text); setTimeout(() => {
                        supabase.from("my_assignments").select("*").then(({ data }) => setAssignments((data as Assignment[]) ?? []));
                      }, 300); }} />
      )}

      {org && <AcquisitionModal onDone={(t) => setToast(t)} />}
      {toast && (
        <div className="fs-toast" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", zIndex: 1200,
                      background: "#111", color: "#fff", padding: "12px 18px", borderRadius: 12, fontWeight: 600,
                      boxShadow: "0 6px 24px rgba(0,0,0,.35)", maxWidth: "90vw", textAlign: "center" }}>{toast}</div>
      )}
    </div>
  );
}
