// Percorsi su strada vera (OpenStreetMap: Valhalla con strade principali, OSRM di riserva) con cache in memoria e nel browser.
export type LatLng = [number, number];
export type Leg = { pts: LatLng[]; cum: number[] }; // punti e distanza cumulata (metri)

const mem = new Map<string, Leg | "loading" | number>(); // number = momento del fallimento (si riprova dopo un po')
const KEY = "fs-roads-v4";   // v4: strade principali (Valhalla) invece delle stradine
const RETRY_MS = 45_000;
const MAX_STORED = 150;

// L'archivio delle strade si legge UNA volta sola e si riscrive al massimo ogni 15 s
// (prima veniva riletto e riscritto per intero a ogni strada scaricata: diversi MB → la pagina si bloccava).
let store: Record<string, LatLng[]> | null = null;
function loadStore(): Record<string, LatLng[]> {
  if (store) return store;
  try { localStorage.removeItem("fs-roads-v2"); } catch {} // vecchio archivio, troppo grande
  try { store = JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { store = {}; }
  return store!;
}
// archivio di prima (OSRM): si usa ancora per i tratti già scaricati, così le ambulanze non vanno in linea retta
let oldStore: Record<string, LatLng[]> | null = null;
function loadOld(): Record<string, LatLng[]> {
  if (oldStore) return oldStore;
  try { oldStore = JSON.parse(localStorage.getItem("fs-roads-v3") ?? "{}"); } catch { oldStore = {}; }
  return oldStore!;
}
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveStore(k: string, pts: LatLng[]) {
  const s = loadStore();
  delete s[k]; s[k] = pts;
  const keys = Object.keys(s);
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX_STORED))) delete s[old]; // tieni gli ultimi
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const write = () => { try { localStorage.setItem(KEY, JSON.stringify(loadStore())); } catch { /* pieno o non disponibile */ } };
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
    if (ric) ric(write); else write();
  }, 15_000);
}

export function legKey(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return `${a.lat.toFixed(5)},${a.lng.toFixed(5)}>${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;
}

function meters(a: LatLng, b: LatLng) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function makeLeg(pts: LatLng[]): Leg {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + meters(pts[i - 1], pts[i]));
  return { pts, cum };
}

export function getLeg(k: string): Leg | null {
  const v = mem.get(k);
  return v && typeof v === "object" ? v : null;
}

// Due server OSRM gratuiti: se uno è lento o rifiuta, si usa l'altro
const SERVERS = [
  "https://router.project-osrm.org/route/v1/driving/",
  "https://routing.openstreetmap.de/routed-car/route/v1/driving/",
];
let srv = 0;

type Job = { k: string; a: { lat: number; lng: number }; b: { lat: number; lng: number }; prio: number; done: (() => void)[] };
const jobs = new Map<string, Job>();
let running = false;

// Polilinea codificata di Valhalla (precisione 6)
function decode6(str: string): LatLng[] {
  const out: LatLng[] = []; let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const k of [0, 1]) {
      let res = 0, sh = 0, c: number;
      do { c = str.charCodeAt(i++) - 63; res |= (c & 0x1f) << sh; sh += 5; } while (c >= 0x20);
      const d = res & 1 ? ~(res >> 1) : res >> 1;
      if (k === 0) lat += d; else lng += d;
    }
    out.push([lat / 1e6, lng / 1e6]);
  }
  return out;
}

// Valhalla (server gratuito di OpenStreetMap): come un'ambulanza vera evita sterrati, strade di servizio e vicoli,
// e li usa solo se non c'è altro modo. Prima si aggancia a strade almeno "residenziali", poi a qualsiasi strada.
let valhallaOff = 0;
async function valhalla(a: { lat: number; lng: number }, b: { lat: number; lng: number }, strict: boolean): Promise<LatLng[] | null> {
  const loc = (p: { lat: number; lng: number }) => ({ lat: p.lat, lon: p.lng, radius: 600,
    ...(strict ? { search_filter: { min_road_class: "residential" } } : {}) });
  const q = { locations: [loc(a), loc(b)], costing: "auto", directions_type: "none",
    costing_options: { auto: { use_tracks: 0, use_living_streets: 0, service_penalty: 300, service_factor: 5, use_highways: 1, use_ferry: 0 } } };
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 5000);
  try {
    const r = await fetch(`https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(q))}`, { signal: ctl.signal });
    if (r.status === 429 || r.status >= 500) { valhallaOff = Date.now(); return null; }
    if (!r.ok) return null;                                   // per esempio nessuna strada adatta: si riprova più largo
    const j = await r.json();
    const shape: string | undefined = j?.trip?.legs?.[0]?.shape;
    return shape ? decode6(shape) : null;
  } catch { valhallaOff = Date.now(); return null; }
  finally { clearTimeout(to); }
}

function thin(all: LatLng[]): LatLng[] {
  all = all.map(([la, ln]) => [Math.round(la * 1e5) / 1e5, Math.round(ln * 1e5) / 1e5] as LatLng);
  const out: LatLng[] = [all[0]];
  for (let i = 1; i < all.length - 1; i++) if (meters(out[out.length - 1], all[i]) >= 12) out.push(all[i]);
  if (all.length > 1) out.push(all[all.length - 1]);
  return out;
}

async function download(a: { lat: number; lng: number }, b: { lat: number; lng: number }): Promise<LatLng[] | null> {
  // prima le strade principali; se il server non risponde per un po' si usa OSRM
  if (Date.now() - valhallaOff > 120_000) {
    const v = await valhalla(a, b, true);
    if (v && v.length > 1) return thin(v);
  }
  for (let tries = 0; tries < SERVERS.length; tries++) {
    const base = SERVERS[srv];
    try {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(`${base}${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`, { signal: ctl.signal });
      clearTimeout(to);
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      const coords: [number, number][] = j?.routes?.[0]?.geometry?.coordinates ?? [];
      if (!coords.length) return null;
      const all: LatLng[] = coords.map(([lng, lat]) => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5]);
      const out: LatLng[] = [all[0]];
      for (let i = 1; i < all.length - 1; i++) if (meters(out[out.length - 1], all[i]) >= 12) out.push(all[i]);
      if (all.length > 1) out.push(all[all.length - 1]);
      return out;
    } catch {
      srv = (srv + 1) % SERVERS.length; // prova l'altro server
    }
  }
  return null;
}

// Scarica i tratti uno alla volta, prima quelli più urgenti (il tratto che il mezzo sta percorrendo adesso)
async function worker() {
  if (running) return;
  running = true;
  while (jobs.size) {
    const job = Array.from(jobs.values()).sort((x, y) => x.prio - y.prio)[0];
    jobs.delete(job.k);
    const pts = await download(job.a, job.b);
    if (pts) { mem.set(job.k, makeLeg(pts)); saveStore(job.k, pts); roadsArrived(); } else mem.set(job.k, Date.now());
    job.done.forEach((f) => f());
    await new Promise((res) => setTimeout(res, Date.now() - valhallaOff > 120_000 ? 700 : 300));   // il server gratuito chiede poche richieste al secondo
  }
  running = false;
}

// Chi disegna la mappa si iscrive qui: viene avvisato al massimo ogni 3 s che sono arrivate strade nuove
let onRoads: (() => void) | null = null;
let roadsTimer: ReturnType<typeof setTimeout> | null = null;
export function onRoadsLoaded(cb: (() => void) | null) { onRoads = cb; }
function roadsArrived() {
  if (roadsTimer) return;
  roadsTimer = setTimeout(() => { roadsTimer = null; onRoads?.(); }, 3000);
}

// prio: 0 = tratto in corso, 1 = prossimo, 2 = più avanti
export function fetchLeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }, prio = 1): Promise<void> {
  const k = legKey(a, b);
  const cur = mem.get(k);
  if (cur && typeof cur === "object") return Promise.resolve();
  if (typeof cur === "number" && Date.now() - cur < RETRY_MS) return Promise.resolve();
  // tratti cortissimi (dentro l'ospedale): linea dritta
  if (meters([a.lat, a.lng], [b.lat, b.lng]) < 250) { mem.set(k, makeLeg([[a.lat, a.lng], [b.lat, b.lng]])); return Promise.resolve(); }
  const stored = loadStore()[k] ?? loadOld()[k];
  if (stored) { mem.set(k, makeLeg(stored)); return Promise.resolve(); }
  return new Promise((res) => {
    const j = jobs.get(k);
    if (j) { j.prio = Math.min(j.prio, prio); j.done.push(res); }
    else { mem.set(k, "loading"); jobs.set(k, { k, a, b, prio, done: [res] }); }
    worker();
  });
}

// Punto a una certa frazione (0..1) della strada
export function pointAt(leg: Leg, f: number): LatLng {
  const total = leg.cum[leg.cum.length - 1];
  const d = Math.min(1, Math.max(0, f)) * total;
  let i = 1;
  while (i < leg.cum.length - 1 && leg.cum[i] < d) i++;
  const seg = leg.cum[i] - leg.cum[i - 1];
  const t = seg > 0 ? (d - leg.cum[i - 1]) / seg : 0;
  const a = leg.pts[i - 1], b = leg.pts[i] ?? a;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// Pezzo di strada da una frazione a un'altra (per disegnare il percorso che manca)
export function slice(leg: Leg, from: number, to = 1): LatLng[] {
  const total = leg.cum[leg.cum.length - 1];
  const d0 = from * total, d1 = to * total;
  const out: LatLng[] = [pointAt(leg, from)];
  for (let i = 0; i < leg.pts.length; i++) if (leg.cum[i] > d0 && leg.cum[i] < d1) out.push(leg.pts[i]);
  out.push(pointAt(leg, to));
  return out;
}
