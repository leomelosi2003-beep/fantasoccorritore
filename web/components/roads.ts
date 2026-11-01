// Percorsi su strada vera (OpenStreetMap, servizio OSRM gratuito) con cache in memoria e nel browser.
export type LatLng = [number, number];
export type Leg = { pts: LatLng[]; cum: number[] }; // punti e distanza cumulata (metri)

const mem = new Map<string, Leg | "loading" | "fail">();
const KEY = "fs-roads-v1";

function loadStore(): Record<string, LatLng[]> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}
function saveStore(k: string, pts: LatLng[]) {
  try {
    const s = loadStore();
    s[k] = pts;
    const keys = Object.keys(s);
    for (const old of keys.slice(0, Math.max(0, keys.length - 150))) delete s[old]; // tieni gli ultimi 150
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* storage non disponibile */ }
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

// Scarica il tratto su strada (una richiesta alla volta per rispettare il servizio gratuito)
let queue: Promise<void> = Promise.resolve();
export function fetchLeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }): Promise<void> {
  const k = legKey(a, b);
  if (mem.has(k)) return Promise.resolve();
  const stored = loadStore()[k];
  if (stored) { mem.set(k, makeLeg(stored)); return Promise.resolve(); }
  mem.set(k, "loading");
  queue = queue.then(async () => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
      const r = await fetch(url);
      const j = await r.json();
      const coords: [number, number][] = j?.routes?.[0]?.geometry?.coordinates ?? [];
      if (!coords.length) throw new Error("no route");
      const pts: LatLng[] = coords.map(([lng, lat]) => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5]);
      mem.set(k, makeLeg(pts));
      saveStore(k, pts);
    } catch {
      mem.set(k, "fail");
    }
    await new Promise((res) => setTimeout(res, 400));
  });
  return queue;
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
