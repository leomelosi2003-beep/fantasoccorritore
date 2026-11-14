"use client";
// Scena animata di una maxi emergenza in stile "radar / centrale operativa" 3D:
// griglia in prospettiva, scena stilizzata in bianco, mezzi con scie colorate e "velo" trasparente, HUD e scritte animate.
import { useEffect, useRef } from "react";
import { distKm, shuttleState, shuttleTravelS } from "../lib/maxiShuttle";

export type SceneVehicle = {
  id: string; call_sign: string; org_name: string; mine: boolean; status: string;
  assigned_at: string; arrives_at: string; completes_at?: string | null;
  base_lat: number | null; base_lng: number | null; automedica?: boolean; moto?: boolean; pma?: boolean; long?: boolean;
  maxi?: "camion" | "furgone" | null; modules?: string[];   // mezzi per le maxi emergenze e moduli caricati
  aib?: "daily" | "ranger" | "scorpio" | "pickup" | "autobotte" | null; route?: { lat: number; lng: number; t: string; label?: string }[] | null;   // incendi: mezzo AIB e spola per l'acqua
};
export type SceneData = {
  id: string; title: string; description?: string | null; lat: number; lng: number;
  created_at: string; ends_at?: string | null; status?: string; vehicles: SceneVehicle[];
  hospital?: { name: string; lat: number; lng: number } | null;
  shuttle?: { scene: number; hosp: number; travel: number };   // solo per la scena di prova
  venue?: string | null; fire?: { severity: number; intensity: number; base_radius?: number } | null;   // incendi boschivi
};

type V3 = [number, number, number];
const ORANGE = "#FF5A36", BLUE = "#6CB4FF", WHITE = "#F1F5F9";

export function scenarioOf(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("treno")) return "deragliamento";
  if (t.includes("palazzina")) return "crollo";
  if (t.includes("fabbrica")) return "fabbrica";
  if (t.includes("tamponamento")) return "tamponamento";
  if (t.includes("commerciale")) return "centro-commerciale";
  if (t.includes("concerto")) return "concerto";
  if (t.includes("gas")) return "gas";
  if (t.includes("alluvione")) return "alluvione";
  if (t.includes("autobus")) return "autobus";
  if (t.includes("terremoto")) return "terremoto";
  return "generico";
}

// numeri pseudo-casuali ripetibili (la scena è sempre uguale per la stessa maxi)
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}
function hash(str: string) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

type Box = { c: V3; s: V3; yaw: number; roll?: number; fill?: string; edge?: string };
type Fx = { kind: "fire" | "smoke" | "dust" | "steam" | "water"; at: V3; r: number };

// Modelli stilizzati per ogni scenario
function buildScene(kind: string, seed: number) {
  const r = rng(seed);
  const boxes: Box[] = []; const fx: Fx[] = []; const lines: [V3, V3][] = [];
  let water = false, fog = false; const crowd: V3[] = [];
  const house = (x: number, z: number, w: number, h: number, d: number, yaw = 0, roll = 0) => boxes.push({ c: [x, h / 2, z], s: [w, h, d], yaw, roll });
  const rubble = (x: number, z: number, n: number, spread: number) => {
    for (let i = 0; i < n; i++) { const s = 1 + r() * 3; boxes.push({ c: [x + (r() - 0.5) * spread, s / 2 + r() * 2, z + (r() - 0.5) * spread], s: [s, s * 0.6, s], yaw: r() * 3, roll: (r() - 0.5) }); }
  };
  switch (kind) {
    case "deragliamento":
      lines.push([[-90, 0, -4], [90, 0, -4]], [[-90, 0, 4], [90, 0, 4]]);
      for (let i = 0; i < 6; i++) boxes.push({ c: [-45 + i * 17, 2.2, (i > 1 && i < 5) ? (r() - 0.5) * 18 : 0], s: [15, 4, 3.6], yaw: (i > 1 && i < 5) ? (r() - 0.5) * 0.9 : 0, roll: i === 3 ? 1.4 : i === 2 ? 0.5 : 0 });
      fx.push({ kind: "smoke", at: [8, 4, 2], r: 6 }, { kind: "dust", at: [-10, 1, 6], r: 10 });
      break;
    case "crollo":
      house(-26, -6, 14, 28, 14); house(26, -6, 14, 22, 14); rubble(0, -4, 40, 18);
      fx.push({ kind: "dust", at: [0, 3, -4], r: 14 }); break;
    case "fabbrica":
      house(0, -10, 44, 10, 24); boxes.push({ c: [18, 14, -16], s: [3, 28, 3], yaw: 0 });
      boxes.push({ c: [-30, 4, 8], s: [6, 8, 6], yaw: 0 }, { c: [-22, 4, 8], s: [6, 8, 6], yaw: 0 }); rubble(5, 6, 20, 14);
      fx.push({ kind: "fire", at: [-4, 10, -10], r: 7 }, { kind: "smoke", at: [-4, 14, -10], r: 12 }, { kind: "fire", at: [10, 10, -4], r: 4 }); break;
    case "tamponamento":
      lines.push([[-100, 0, -8], [100, 0, -8]], [[-100, 0, 8], [100, 0, 8]], [[-100, 0, 0], [100, 0, 0]]);
      for (let i = 0; i < 24; i++) boxes.push({ c: [-60 + i * 5 + (r() - 0.5) * 3, 0.8, (r() - 0.5) * 12], s: r() < 0.2 ? [10, 3, 2.6] : [4.2, 1.5, 1.9], yaw: (r() - 0.5) * 1.6 });
      fog = true; fx.push({ kind: "smoke", at: [4, 2, 0], r: 5 }); break;
    case "centro-commerciale":
      house(0, -16, 54, 10, 30); fx.push({ kind: "fire", at: [6, 11, -14], r: 8 }, { kind: "smoke", at: [6, 16, -14], r: 16 });
      for (let i = 0; i < 70; i++) crowd.push([(r() - 0.5) * 60, 0, 6 + r() * 16]); break;
    case "concerto":
      for (const x of [-18, 18]) lines.push([[x, 0, -10], [x, 16, -10]], [[x, 0, -22], [x, 16, -22]]);
      lines.push([[-18, 16, -10], [4, 4, -12]], [[-18, 16, -22], [18, 16, -22]], [[18, 16, -10], [18, 16, -22]]);
      boxes.push({ c: [0, 1.2, -16], s: [40, 2.4, 14], yaw: 0 }); rubble(-4, -6, 12, 10);
      for (let i = 0; i < 140; i++) crowd.push([(r() - 0.5) * 70, 0, 2 + r() * 26]); break;
    case "gas":
      house(-22, -8, 12, 16, 12); house(0, -10, 14, 20, 12, 0, 0); house(22, -8, 12, 14, 12); rubble(0, 0, 18, 12);
      fx.push({ kind: "fire", at: [0, 8, -4], r: 6 }, { kind: "smoke", at: [0, 14, -8], r: 12 }); break;
    case "alluvione":
      water = true; house(-24, -10, 12, 9, 10); house(4, -14, 14, 11, 12); house(28, -6, 10, 8, 10);
      for (let i = 0; i < 8; i++) boxes.push({ c: [(r() - 0.5) * 60, 0.6, (r() - 0.5) * 30], s: [4.2, 1.5, 1.9], yaw: r() * 3, roll: (r() - 0.5) * 0.6 }); break;
    case "autobus":
      lines.push([[-90, 0, 0], [90, 0, 0]], [[0, 0, -90], [0, 0, 90]]);
      boxes.push({ c: [-6, 1.8, 1], s: [12, 3.6, 3], yaw: 0.15 }, { c: [6.5, 1.8, -1], s: [12, 3.6, 3], yaw: -0.25, roll: 0.15 });
      fx.push({ kind: "smoke", at: [0, 3, 0], r: 6 }); break;
    case "terremoto":
      for (let i = 0; i < 7; i++) house(-40 + i * 13, -14 + (i % 2) * 6, 10, 10 + r() * 10, 10, 0, (r() - 0.5) * 0.35);
      rubble(-6, 2, 28, 30); fx.push({ kind: "dust", at: [0, 2, -4], r: 18 }); break;
    case "incendio1":                                                         // sterpaglie e campi incolti
      for (let i = 0; i < 9; i++) boxes.push({ c: [-40 + r() * 80, 0.7, -50 + r() * 40], s: [1.6, 1.4, 1.6], yaw: r() * 3, fill: "rgba(202,138,4,.25)", edge: "rgba(250,204,21,.6)" });  // rotoballe
      lines.push([[-70, 1, -6], [70, 1, -6]], [[-70, 0.4, -6.2], [70, 0.4, -6.2]]);                     // recinzione
      house(52, -46, 10, 6, 8, 0.3); break;                                                             // capanno
    case "incendio2":                                                         // bosco
      for (let i = 0; i < 12; i++) boxes.push({ c: [-50 + r() * 100, 0.6, -70 + r() * 60], s: [1.5 + r() * 2, 1 + r(), 1.5 + r() * 2], yaw: r() * 3, fill: "rgba(120,113,108,.25)", edge: "rgba(168,162,158,.6)" }); // massi
      { const tr: V3[] = [[-90, 0.05, -2], [-20, 0.05, -40], [40, 0.05, -60], [90, 0.05, -90]]; for (let i = 0; i < 3; i++) lines.push([tr[i], tr[i + 1]]); }   // sentiero forestale
      break;
    case "incendio3":                                                         // interfaccia: il fuoco minaccia le case
      for (let i = 0; i < 6; i++) house(-45 + i * 18, -78 + (i % 2) * 5, 10, 6 + r() * 4, 9, (r() - 0.5) * 0.2);
      lines.push([[-90, 12, -64], [90, 12, -64]]);
      for (let i = -3; i <= 3; i++) lines.push([[i * 30, 0, -64], [i * 30, 12, -64]]);                 // linea elettrica
      break;
    default:
      rubble(0, 0, 30, 20); fx.push({ kind: "smoke", at: [0, 5, 0], r: 10 });
  }
  return { boxes, fx, lines, water, fog, crowd };
}
const FIRE_C: V3 = [0, 0, -28];                                               // centro dell'incendio
// incendio: dove si trova il mezzo AIB nella sua spola fuoco ↔ sede per l'acqua (dalla rotta vera)
type FirePh = { state: "scene" | "in" | "out" | "away"; f: number; text: string; left: number };
function firePhase(route: SceneVehicle["route"], now: number, lat: number, lng: number, EX = 15): FirePh {
  const scene: FirePh = { state: "scene", f: 0, text: "", left: 0 };
  if (!route || route.length < 2) return scene;
  const near = (q: { lat: number; lng: number }) => distKm(q.lat, q.lng, lat, lng) < 0.4;
  const ts = route.map((q) => Date.parse(q.t));
  const last = route.length - 1;
  if (now >= ts[last]) return near(route[last]) ? scene : { state: "away", f: 0, text: "RIENTRATO", left: 0 };
  let i = 0; while (i < last - 1 && !(ts[i] <= now && now < ts[i + 1])) i++;
  const na = near(route[i]), nb = near(route[i + 1]);
  let j = i + 1; while (j < last && !near(route[j])) j++;
  const back = Math.max(0, (ts[j] - now) / 1000);
  if (na && nb) return scene;
  if (!na && nb) { const left = (ts[i + 1] - now) / 1000; return left < EX ? { state: "in", f: 1 - left / EX, text: "", left } : { state: "away", f: 0, text: "💧 TORNA CON L'ACQUA", left: back }; }
  if (na && !nb) { const since = (now - ts[i]) / 1000; return since < EX ? { state: "out", f: since / EX, text: "", left: back } : { state: "away", f: 0, text: "➜ RIFORNIMENTO", left: back }; }
  return { state: "away", f: 0, text: "💧 CARICA ACQUA IN SEDE", left: back };
}
export const FIRE_TITLES = ["", "Incendio di sterpaglie", "Incendio boschivo", "Incendio d'interfaccia: il fuoco minaccia le case"];

// posti auto nell'area mezzi e area PMA
const slot = (i: number): V3 => [-78 + (i % 6) * 12, 0, 40 + Math.floor(i / 6) * 13];
const PMA: [number, number, number, number] = [48, 58, 86, 88];
const pmaSlot = (i: number): V3 => [62 + (i % 2) * 14, 0, 64 + Math.floor(i / 2) * 9];
const maxiSlot = (i: number): V3 => [16 + (i % 3) * 13, 0, 46 + Math.floor(i / 3) * 12];   // area logistica, a sud della strada
const sceneSpot = (i: number): V3 => [-33 + (i % 6) * 12, 0, 27 + Math.floor(i / 6) * 9];
type Cam = { yaw: number; el: number; dist: number; auto: boolean };
// percorso su strada: polilinea con corsia di destra, posizione e direzione a una certa distanza
function makePath(raw: V3[], lane = 1.9) {
  const pts: V3[] = raw.filter((q, i) => i === 0 || Math.hypot(q[0] - raw[i - 1][0], q[2] - raw[i - 1][2]) > 0.01);
  const nrm = (i: number): [number, number] => { const a = pts[i], b = pts[i + 1]; const l = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1; return [-(b[2] - a[2]) / l, (b[0] - a[0]) / l]; };
  const off: V3[] = pts.map((q, i) => {
    if (i === pts.length - 1 || pts.length < 2) return q;            // l'ultimo punto (parcheggio) senza corsia
    const n1 = nrm(Math.min(i, pts.length - 2)), n0 = i > 0 ? nrm(i - 1) : n1;
    let nx = n0[0] + n1[0], nz = n0[1] + n1[1]; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    return [q[0] + nx * lane, 0, q[2] + nz * lane];
  });
  const cum = [0]; for (let i = 1; i < off.length; i++) cum.push(cum[i - 1] + Math.hypot(off[i][0] - off[i - 1][0], off[i][2] - off[i - 1][2]));
  const len = cum[cum.length - 1] || 1;
  const at = (dRaw: number): { p: V3; h: number } => {
    const dd = Math.max(0, Math.min(len, dRaw)); let i = 1; while (i < cum.length - 1 && cum[i] < dd) i++;
    const a = off[i - 1] ?? off[0], b = off[i] ?? off[0]; const sl = (cum[i] - cum[i - 1]) || 1; const u = (dd - cum[i - 1]) / sl;
    return { p: [a[0] + (b[0] - a[0]) * u, 0, a[2] + (b[2] - a[2]) * u], h: Math.atan2(b[2] - a[2], b[0] - a[0]) };
  };
  return { len, at };
}
const ROAD_Z = 34, ROAD_X = 95, PMA_Z = 72;
const ENTRIES: { pts: V3[]; dir: [number, number] }[] = [
  { pts: [[-165, 0, ROAD_Z]], dir: [-1, 0] }, { pts: [[165, 0, ROAD_Z]], dir: [1, 0] },
  { pts: [[ROAD_X, 0, -165], [ROAD_X, 0, ROAD_Z]], dir: [0.5, -1] }, { pts: [[ROAD_X, 0, 165], [ROAD_X, 0, ROAD_Z]], dir: [0.5, 1] },
  { pts: [[-60, 0, -165], [-60, 0, ROAD_Z]], dir: [-0.4, -1] },
];
export const VIEWS: { name: string; cam: Cam }[] = [
  { name: "Panoramica", cam: { yaw: 0.6, el: 0.5, dist: 150, auto: true } },
  { name: "Dall'alto", cam: { yaw: 0, el: 1.4, dist: 210, auto: false } },
  { name: "Ravvicinata", cam: { yaw: 0.9, el: 0.32, dist: 70, auto: false } },
  { name: "Area PMA", cam: { yaw: -0.7, el: 0.5, dist: 120, auto: false } },
];

export default function MaxiScene({ data, serverOffset = 0, view = 0, viewKey = 0 }: { data: SceneData; serverOffset?: number; view?: number; viewKey?: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef(data); dataRef.current = data;
  const camRef = useRef<Cam & { tYaw: number; tEl: number; tDist: number; tgtX: number; tgtZ: number }>({ ...VIEWS[0].cam, tYaw: 0.6, tEl: 0.5, tDist: 150, tgtX: 0, tgtZ: 18 });
  // cambio inquadratura dai pulsanti
  useEffect(() => {
    const v = VIEWS[view] ?? VIEWS[0]; const c = camRef.current;
    c.tYaw = v.cam.yaw; c.tEl = v.cam.el; c.tDist = v.cam.dist; c.auto = v.cam.auto;
    const fireV = dataRef.current.venue === "AIB";
    c.tgtX = view === 3 && !fireV ? 66 : 0; c.tgtZ = fireV ? -12 : view === 3 ? 72 : 18;
  }, [view, viewKey]);

  useEffect(() => {
    const canvas = cv.current!; const ctx = canvas.getContext("2d")!;
    let raf = 0, last = 0;
    const seed = hash(data.id);
    const FIRE = data.venue === "AIB";
    const sev = Math.max(1, Math.min(3, Math.round(data.fire?.severity ?? 2)));
    const kind = FIRE ? "incendio" + sev : scenarioOf(data.title);
    let fireR = 12 + sev * 5 + (data.fire?.intensity ?? 50) * 0.18;               // raggio del fronte (si muove piano verso quello vero)
    const scene = buildScene(kind, seed);
    const particles: { p: V3; v: V3; life: number; max: number; kind: Fx["kind"] }[] = [];
    const captions: { text: string; hi: string; at: number }[] = [{ text: FIRE ? FIRE_TITLES[sev] : data.title, hi: "", at: performance.now() }];
    const seen = new Map<string, string>();
    const injured = 24 + (seed % 46);

    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize(); window.addEventListener("resize", resize);
    // trascina = ruota/inclina, rotellina o due dita = zoom
    const pts = new Map<number, { x: number; y: number }>(); let pinch = 0;
    const cam = camRef.current;
    const clamp = () => { cam.tEl = Math.max(0.15, Math.min(1.45, cam.tEl)); cam.tDist = Math.max(45, Math.min(330, cam.tDist)); };
    const down = (e: PointerEvent) => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); cam.auto = false; };
    const move = (e: PointerEvent) => {
      const p0 = pts.get(e.pointerId); if (!p0) return;
      if (pts.size === 1) { cam.tYaw -= (e.clientX - p0.x) * 0.006; cam.tEl += (e.clientY - p0.y) * 0.004; }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]; const dd = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) cam.tDist *= pinch / dd; pinch = dd;
      }
      clamp();
    };
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
    const wheel = (e: WheelEvent) => { e.preventDefault(); cam.auto = false; cam.tDist *= e.deltaY > 0 ? 1.12 : 0.89; clamp(); };
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.style.touchAction = "none";

    function frame(t: number) {
      raf = requestAnimationFrame(frame);
      if (t - last < 33) return; last = t;
      const W = canvas.clientWidth, H = canvas.clientHeight; const d = dataRef.current;
      const now = Date.now() + serverOffset;

      // camera che gira piano attorno alla scena
      if (cam.auto) cam.tYaw += 0.0012;
      cam.yaw += (cam.tYaw - cam.yaw) * 0.15; cam.el += (cam.tEl - cam.el) * 0.15; cam.dist += (cam.tDist - cam.dist) * 0.15;
      const yaw = cam.yaw, el = cam.el, dist = cam.dist;
      const tgt: V3 = [cam.tgtX, 4, cam.tgtZ];
      const camP: V3 = [tgt[0] + Math.sin(yaw) * Math.cos(el) * dist, Math.sin(el) * dist, tgt[2] + Math.cos(yaw) * Math.cos(el) * dist];
      const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
      const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const fw = norm(sub(tgt, camP)); const rt = norm(cross(fw, [0, 1, 0])); const up = cross(rt, fw);
      const f = Math.min(W, H) * 1.25;
      const P = (p: V3): [number, number, number] | null => {
        const q = sub(p, camP); const z = dot(q, fw); if (z < 2) return null;
        return [W / 2 + (f * dot(q, rt)) / z, H * 0.56 - (f * dot(q, up)) / z, z];
      };
      const poly = (pts: V3[], stroke?: string, fill?: string, lw = 1) => {
        const pp = pts.map(P); if (pp.some((x) => !x)) return;
        ctx.beginPath(); pp.forEach((x, i) => (i ? ctx.lineTo(x![0], x![1]) : ctx.moveTo(x![0], x![1]))); ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
      };

      // sfondo
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#050B18"); g.addColorStop(1, "#0B1A33");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // griglia
      ctx.lineWidth = 1;
      for (let i = -160; i <= 160; i += 10) {
        const a = P([i, 0, -160]), b = P([i, 0, 160]), c = P([-160, 0, i]), e = P([160, 0, i]);
        const al = 0.07 + (i % 50 === 0 ? 0.07 : 0);
        ctx.strokeStyle = `rgba(120,160,220,${al})`;
        if (a && b) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
        if (c && e) { ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(e[0], e[1]); ctx.stroke(); }
      }
      // cerchi di distanza che pulsano
      for (const [rad, i] of [[35, 0], [70, 1], [110, 2]] as const) {
        const pts: V3[] = []; for (let k = 0; k <= 64; k++) pts.push([Math.cos(k / 64 * Math.PI * 2) * rad, 0.05, Math.sin(k / 64 * Math.PI * 2) * rad]);
        const pulse = 0.18 + 0.12 * Math.sin(t / 700 - i);
        ctx.setLineDash(i === 2 ? [6, 6] : []); poly(pts, `rgba(255,90,54,${pulse})`, undefined, 1.2); ctx.setLineDash([]);
      }

      // ===== ambiente: campi, strade, case lontane, alberi =====
      for (const [x1, z1, x2, z2, c] of [[-160, -160, -60, -60, "rgba(34,197,94,.06)"], [100, -160, 160, -40, "rgba(132,204,22,.05)"],
                                        [-160, 50, -70, 160, "rgba(34,197,94,.05)"], [100, 45, 160, 160, "rgba(234,179,8,.04)"]] as [number, number, number, number, string][])
        poly([[x1, 0.02, z1], [x2, 0.02, z1], [x2, 0.02, z2], [x1, 0.02, z2]], undefined, c);
      const road = (x1: number, z1: number, x2: number, z2: number, w: number) => {
        const dx = x2 - x1, dz = z2 - z1, l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * w / 2, nz = (dx / l) * w / 2;
        poly([[x1 + nx, 0.04, z1 + nz], [x2 + nx, 0.04, z2 + nz], [x2 - nx, 0.04, z2 - nz], [x1 - nx, 0.04, z1 - nz]], "rgba(148,163,184,.35)", "rgba(51,65,85,.55)");
        const a = P([x1, 0.06, z1]), b = P([x2, 0.06, z2]);
        if (a && b) { ctx.setLineDash([8, 10]); ctx.strokeStyle = "rgba(241,245,249,.45)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]); }
      };
      road(-160, 34, 160, 34, 9); road(95, -160, 95, 160, 9); road(-60, -160, -60, 34, 7); road(0, 34, 0, 60, 6); road(95, 72, 55, 72, 6);
      // acqua (alluvione)
      if (scene.water) {
        const sh = 0.16 + 0.05 * Math.sin(t / 500);
        poly([[-80, 0.4, -50], [80, 0.4, -50], [80, 0.4, 30], [-80, 0.4, 30]], `rgba(108,180,255,.5)`, `rgba(40,120,220,${sh})`);
        for (let k = 0; k < 10; k++) { const z = -45 + k * 8, o = ((t / 60 + k * 13) % 160) - 80; const a = P([o, 0.5, z]), b = P([o + 10, 0.5, z]); if (a && b) { ctx.strokeStyle = "rgba(170,215,255,.35)"; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }
      }
      // linee della scena (binari, strade, tralicci)
      ctx.strokeStyle = "rgba(241,245,249,.55)"; ctx.lineWidth = 1.2;
      for (const [a3, b3] of scene.lines) { const a = P(a3), b = P(b3); if (a && b) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }

      // area PMA (non negli incendi)
      const [x1, z1, x2, z2] = FIRE ? [0, 0, 0, 0] : PMA;
      if (!FIRE) {
      ctx.setLineDash([5, 4]);
      poly([[x1, 0.1, z1], [x2, 0.1, z1], [x2, 0.1, z2], [x1, 0.1, z2]], "rgba(52,211,153,.8)", "rgba(52,211,153,.07)", 1.4);
      ctx.setLineDash([]);
      const pm = P([(x1 + x2) / 2, 0.2, (z1 + z2) / 2]);
      if (pm) { ctx.fillStyle = "rgba(52,211,153,.9)"; ctx.font = "700 11px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.fillText(d.vehicles.some((v) => v.pma) ? "AREA PMA" : "AREA PMA · NESSUN PMA", pm[0], pm[1]); }
      const st = P([-48, 0.2, 33]); if (st) { ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.font = "700 10px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.fillText("AREA MEZZI", st[0], st[1]); }
      }
      // incendio: area bruciata e fronte del fuoco
      const fireTarget = 12 + sev * 5 + (d.fire?.intensity ?? 50) * 0.18;
      fireR += (fireTarget - fireR) * 0.02;
      const frontN = 48; const front: { p: V3; a: number; on: boolean }[] = [];
      if (FIRE) {
        const rr = (a: number) => fireR * (1 + 0.13 * Math.sin(a * 3 + seed) + 0.07 * Math.sin(a * 7 + t / 3000));
        const burnt: V3[] = []; for (let k = 0; k < frontN; k++) { const a = (k / frontN) * Math.PI * 2; const q: V3 = [FIRE_C[0] + Math.cos(a) * rr(a), 0.08, FIRE_C[2] + Math.sin(a) * rr(a) * 0.8]; burnt.push(q); front.push({ p: [q[0], 0.5, q[2]], a, on: (d.fire?.intensity ?? 50) > 0 }); }
        poly(burnt, "rgba(251,146,60,.5)", "rgba(28,25,23,.55)", 1.5);
        const glow = P([FIRE_C[0], 0, FIRE_C[2]]);
        if (glow && (d.fire?.intensity ?? 50) > 0) { const gr = ctx.createRadialGradient(glow[0], glow[1], 0, glow[0], glow[1], (f / glow[2]) * fireR * 1.3); gr.addColorStop(0, "rgba(234,88,12,.0)"); gr.addColorStop(0.7, "rgba(234,88,12,.10)"); gr.addColorStop(1, "rgba(234,88,12,0)"); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(glow[0], glow[1], (f / glow[2]) * fireR * 1.3, 0, Math.PI * 2); ctx.fill(); }
      }

      // scatole (scena + mezzi), ordinate per distanza
      type Draw = { z: number; fn: () => void };
      const draws: Draw[] = [];
      const addBox = (b: Box) => {
        const [cx, cy, cz] = b.c, [w, h, dd] = b.s; const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
        const cr = Math.cos(b.roll ?? 0), sr = Math.sin(b.roll ?? 0);
        const v = (x: number, y: number, z: number): V3 => {
          const y2 = y * cr - z * sr, z2 = y * sr + z * cr; // inclinazione
          return [cx + x * cs - z2 * sn, cy + y2, cz + x * sn + z2 * cs];
        };
        const pts = [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]].map(([a, bb, c]) => v(a * w / 2, bb * h / 2, c * dd / 2));
        const pc = P(b.c); if (!pc) return;
        draws.push({ z: pc[2], fn: () => {
          const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]];
          for (const fc of faces) poly(fc.map((i) => pts[i]), b.edge ?? "rgba(241,245,249,.85)", b.fill ?? "rgba(226,232,240,.10)", 1);
        } });
      };
      scene.boxes.forEach(addBox);
      const er = rng(seed + 3);
      for (let k = 0; k < 9; k++) { const a = er() * Math.PI * 2, r = 120 + er() * 30; const hh = 4 + er() * 6;
        addBox({ c: [Math.cos(a) * r, hh / 2, Math.sin(a) * r], s: [7 + er() * 6, hh, 7 + er() * 6], yaw: er(), fill: "rgba(148,163,184,.10)", edge: "rgba(148,163,184,.45)" }); }
      const trees: V3[] = [];
      const nTrees = FIRE ? (sev === 1 ? 45 : 170) : 70;
      for (let k = 0; k < 420 && trees.length < nTrees; k++) {
        const x = (er() - 0.5) * 300, z = (er() - 0.5) * 300;
        if (!FIRE && Math.abs(x) < 70 && z > -45 && z < 60) continue;          // zona dell'intervento
        if (FIRE && z > 12 && z < 60 && Math.abs(x) < 110) continue;          // fascia dei mezzi AIB e della strada
        if (FIRE && sev === 3 && z < -70 && z > -88 && Math.abs(x) < 60) continue;  // case
        if (Math.abs(z - 34) < 8 || Math.abs(x - 95) < 8 || (Math.abs(x + 60) < 7 && z < 34)) continue;  // strade
        if (x > 40 && x < 100 && z > 50 && z < 95) continue;                    // PMA
        trees.push([x, er() * 6.28, z]);
      }
      const burningTops: V3[] = [];
      for (const tr of trees) {
        const b0 = P([tr[0], 0, tr[2]]), m = P([tr[0], 2.2, tr[2]]), top = P([tr[0], 7.5, tr[2]]); if (!b0 || !m || !top) continue;
        const fd = FIRE ? Math.hypot(tr[0] - FIRE_C[0], (tr[2] - FIRE_C[2]) / 0.8) : 999;
        const burnt = fd < fireR - 5, burning = !burnt && fd < fireR + 3 && (d.fire?.intensity ?? 50) > 0;
        if (burning) burningTops.push([tr[0], 6, tr[2]]);
        if (burnt) { draws.push({ z: b0[2], fn: () => { const w = (f / b0[2]) * 2.4; ctx.strokeStyle = "rgba(41,37,36,.95)"; ctx.lineWidth = Math.max(1, w * 0.18); ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(top[0], top[1] + (m[1] - top[1]) * 0.35); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(m[0], m[1] - (m[1] - top[1]) * 0.3); ctx.lineTo(m[0] + w * 0.5, m[1] - (m[1] - top[1]) * 0.55); ctx.stroke(); } }); continue; }
        draws.push({ z: b0[2], fn: () => {
          const w = (f / b0[2]) * 2.4, sway = Math.sin(t / 1400 + tr[1]) * w * 0.06;
          ctx.strokeStyle = "rgba(120,90,60,.8)"; ctx.lineWidth = Math.max(1, w * 0.15); ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(m[0], m[1]); ctx.stroke();
          for (const [k, sc] of [[0, 1], [1, 0.7]] as [number, number][]) {
            const yb = m[1] - (m[1] - top[1]) * k * 0.35, yt = top[1] + (m[1] - top[1]) * (k ? 0 : 0.25);
            ctx.beginPath(); ctx.moveTo(m[0] - w * sc, yb); ctx.lineTo(m[0] + w * sc, yb); ctx.lineTo(top[0] + sway, yt); ctx.closePath();
            ctx.fillStyle = burning ? (k ? "rgba(249,115,22,.75)" : "rgba(194,65,12,.75)") : k ? "rgba(34,197,94,.55)" : "rgba(21,128,61,.55)"; ctx.fill(); ctx.strokeStyle = burning ? "rgba(253,186,116,.8)" : "rgba(134,239,172,.6)"; ctx.lineWidth = 1; ctx.stroke();
          }
        } });
      }


      // ===== feriti: a terra intorno alla scena e DENTRO la scena (nei vagoni, sotto le macerie...) =====
      const pr = rng(seed + 7);
      const lerp3c = (x: V3, y: V3, u: number): V3 => [x[0] + (y[0] - x[0]) * u, x[1] + (y[1] - x[1]) * u, x[2] + (y[2] - x[2]) * u];
      const inside = scene.boxes.filter((bx) => bx.s[0] * bx.s[2] > 20);
      type Pose = "walk" | "kneel" | "stand" | "lie" | "sit" | "wave" | "carry" | "cut" | "film" | "spray" | "limp";
      const patients = Array.from({ length: FIRE ? 0 : 10 + (seed % 8) }, (_, k) => {
        const tri = k % 5 === 0 ? "#EF4444" : k % 3 === 0 ? "#FACC15" : "#22C55E";
        const trapped = k % 4 === 0 && inside.length > 0;
        let p3: V3;
        if (trapped) { const bx = inside[k % inside.length]; p3 = [bx.c[0] + (pr() - 0.5) * bx.s[0] * 0.5, Math.max(0, bx.c[1] - bx.s[1] / 2 + 0.3), bx.c[2] + (pr() - 0.5) * 1]; }
        else p3 = [(pr() - 0.5) * 44, 0, 2 + pr() * 16];
        const pose: Pose = trapped ? (tri === "#22C55E" ? "wave" : "lie") : tri === "#EF4444" ? "lie" : tri === "#FACC15" ? (k % 2 ? "sit" : "lie") : (k % 2 ? "limp" : "wave");
        const bx0 = trapped ? inside[k % inside.length] : null;
        const handoff: V3 = bx0 ? [bx0.c[0] + (pr() - 0.5) * 4, 0, bx0.c[2] + bx0.s[2] / 2 + 4 + pr() * 2] : p3;
        return { p: p3, home: p3, handoff, tri, pose, trapped, freed: !trapped, hidden: false, busy: false, ph: pr() * 6 };
      });
      // i feriti verdi camminano zoppicando vicino al loro punto
      for (const pt of patients) if (pt.pose === "limp") {
        const w = t / 4000 + pt.ph; pt.p = [pt.home[0] + Math.cos(w) * 2.5, 0, pt.home[2] + Math.sin(w * 1.3) * 2];
      }
      const people: { p: V3; pose: Pose; col: string }[] = [];
      const stretchers: { a: V3; b: V3; loaded: boolean; color?: string }[] = [];
      const props: { c: V3; s: V3; fill: string; edge: string; yaw?: number }[] = [];
      const flashes: V3[] = [];
      let transported = 0, extricated = 0; const awayList: string[] = []; const comingList: { s: string; ms: number }[] = [];
      const firemen: { p: V3; pose: Pose }[] = [];
      const sparks: V3[] = []; const sprays: { from: V3; to: V3 }[] = [];
      // ===== Vigili del Fuoco: mezzi fissi vicino alla scena, estricazione dei feriti intrappolati =====
      const vvf: { p: V3; h: number; ladder: boolean }[] = FIRE ? [] : [
        { p: [-40, 0, -16], h: 0.3, ladder: false }, { p: [40, 0, -18], h: Math.PI - 0.3, ladder: true }, { p: [-8, 0, -34], h: 0, ladder: false }];
      for (const pt of patients) if (pt.trapped) {
        const cyc = ((now / 1000 + pt.ph * 6) % 36) / 36;
        const g: V3 = [pt.home[0], 0, pt.home[2]];
        const truck = vvf.reduce((b, v) => (Math.hypot(v.p[0] - g[0], v.p[2] - g[2]) < Math.hypot(b.p[0] - g[0], b.p[2] - g[2]) ? v : b), vvf[0]).p;
        const s1: V3 = [g[0] - 1.2, 0, g[2] + 1.6], s2: V3 = [g[0] + 1.3, 0, g[2] + 1.4];
        const panelHome: V3 = [pt.home[0], pt.home[1] + 1.4, pt.home[2]];
        const panelOff: V3 = [g[0] + 4, 0.15, g[2] + 3];
        const blocks = () => { for (const [dx, dz] of [[-1.6, -1], [1.6, -1], [-1.6, 1], [1.6, 1]]) props.push({ c: [g[0] + dx, 0.3, g[2] + dz], s: [0.6, 0.6, 0.6], fill: "rgba(250,204,21,.9)", edge: "#FACC15" }); };
        const medic: V3 = [g[0] + 0.2, 0, g[2] + 2.2];
        if (cyc < 0.08) {            // arrivano dal camion con l'attrezzatura
          const u = cyc / 0.08; firemen.push({ p: lerp3c(truck, s1, u), pose: "carry" }, { p: lerp3c(truck, s2, Math.max(0, u - 0.15) / 0.85), pose: "walk" }); pt.freed = false;
          props.push({ c: panelHome, s: [2.6, 0.15, 1.8], fill: "rgba(203,213,225,.5)", edge: "#CBD5E1" });
        } else if (cyc < 0.16) {     // messa in sicurezza: cunei di stabilizzazione
          firemen.push({ p: s1, pose: "kneel" }, { p: [g[0] + (cyc - 0.08) * 40 - 1.6, 0, g[2] - 1.8], pose: "walk" });
          props.push({ c: panelHome, s: [2.6, 0.15, 1.8], fill: "rgba(203,213,225,.5)", edge: "#CBD5E1" }); if (cyc > 0.12) blocks(); pt.freed = false;
        } else if (cyc < 0.42) {     // taglio con divaricatore/cesoie: scintille, la lamiera vibra
          firemen.push({ p: s1, pose: "cut" }, { p: s2, pose: "cut" });
          const jit = Math.sin(t / 40) * 0.06;
          props.push({ c: [panelHome[0] + jit, panelHome[1], panelHome[2]], s: [2.6, 0.15, 1.8], fill: "rgba(203,213,225,.5)", edge: "#CBD5E1" }); blocks();
          if (Math.floor(t / 110) % 2 === 0) sparks.push([pt.home[0], pt.home[1] + 1, pt.home[2]]);
          pt.freed = false;
        } else if (cyc < 0.5) {      // tolgono la lamiera e la appoggiano a terra
          const u = (cyc - 0.42) / 0.08; const pc = lerp3c(panelHome, panelOff, u); pc[1] += Math.sin(u * Math.PI) * 2.5;
          props.push({ c: pc, s: [2.6, 0.15, 1.8], fill: "rgba(203,213,225,.5)", edge: "#CBD5E1", yaw: u * 1.2 }); blocks();
          firemen.push({ p: lerp3c(s1, [panelOff[0] - 1.2, 0, panelOff[2]], u), pose: "carry" }, { p: lerp3c(s2, [panelOff[0] + 1.2, 0, panelOff[2]], u), pose: "carry" });
          pt.freed = false;
        } else if (cyc < 0.6) {      // collare e tavola spinale: lavorano insieme VVF e sanitari
          props.push({ c: panelOff, s: [2.6, 0.15, 1.8], fill: "rgba(203,213,225,.5)", edge: "#CBD5E1", yaw: 1.2 }); blocks();
          firemen.push({ p: s1, pose: "kneel" }, { p: s2, pose: "stand" });
          people.push({ p: medic, pose: "kneel", col: "#FDE68A" });
          stretchers.push({ a: [g[0] - 1.4, 0, g[2] - 0.6], b: [g[0] + 1.4, 0, g[2] - 0.6], loaded: false, color: "#FB923C" });
          pt.freed = false;
        } else if (cyc < 0.7) {      // portano fuori il ferito sulla tavola, in quattro
          const u = (cyc - 0.6) / 0.1; pt.p = lerp3c(pt.home, pt.handoff, u); pt.pose = "lie"; pt.hidden = true;
          const c: V3 = [pt.p[0], 0, pt.p[2]];
          firemen.push({ p: [c[0] - 1.5, 0, c[2] - 0.7], pose: "carry" }, { p: [c[0] + 1.5, 0, c[2] - 0.7], pose: "carry" });
          people.push({ p: [c[0] - 1.5, 0, c[2] + 0.7], pose: "carry", col: "#FDE68A" }, { p: [c[0] + 1.5, 0, c[2] + 0.7], pose: "carry", col: "#FDE68A" });
          stretchers.push({ a: [c[0] - 1.4, 0, c[2]], b: [c[0] + 1.4, 0, c[2]], loaded: true, color: "#FB923C" });
          pt.freed = false;
        } else {                     // affidato alle ambulanze, i pompieri tornano al camion
          pt.p = pt.handoff; pt.pose = "lie"; pt.freed = true; extricated++;
          props.push({ c: panelOff, s: [2.6, 0.15, 1.8], fill: "rgba(203,213,225,.5)", edge: "#CBD5E1", yaw: 1.2 });
          const u = Math.min(1, (cyc - 0.7) / 0.12);
          firemen.push({ p: u < 1 ? lerp3c(pt.handoff, truck, u) : [truck[0] + 2, 0, truck[2] + 2], pose: u < 1 ? "walk" : "stand" },
                       { p: [pt.handoff[0] + 2.5, 0, pt.handoff[2] - 1], pose: "stand" });
        }
      }
      // coordinatore del triage: gira tra i feriti e mette il cartellino
      { const free = patients.filter((q) => !q.trapped); if (free.length) {
        const k = Math.floor(now / 6000) % free.length, u = (now % 6000) / 6000;
        const from = free[k].p, to = free[(k + 1) % free.length].p;
        if (u < 0.35) { people.push({ p: [from[0] + 1.2, 0, from[2] + 1], pose: "kneel", col: "#FDBA74" }); free[k].busy = true; }
        else people.push({ p: lerp3c([from[0] + 1.2, 0, from[2] + 1], [to[0] + 1.2, 0, to[2] + 1], (u - 0.35) / 0.65), pose: "walk", col: "#FDBA74" });
      } }
      // con fuoco: un vigile con la lancia spegne le fiamme
      for (const e of scene.fx) if (e.kind === "fire") {
        const from: V3 = [e.at[0] + 14, 0, e.at[2] + 14];
        firemen.push({ p: from, pose: "spray" }); sprays.push({ from: [from[0], 1.6, from[2]], to: e.at });
      }

      // ===== mezzi =====
      const vs = d.vehicles;
      const cLat = Math.cos((d.lat * Math.PI) / 180);
      let onSite = 0, coming = 0, pmaOn = 0, amb = 0, pmaIdx = 0, away = 0, mxIdx = 0, fireOn = 0; const hoses: [V3, V3][] = []; const modsOn = new Set<string>();
      const hasPma = vs.some((v) => v.pma && Date.parse(v.arrives_at) <= now && v.status !== "conclusa");
      const CENTER: V3 = [0, 0, 8];
      const hosp = d.hospital;
      const travelS = d.shuttle?.travel ?? shuttleTravelS(hosp ? distKm(d.lat, d.lng, hosp.lat, hosp.lng) : 8);
      const EXIT_S = Math.min(18, travelS);             // secondi in cui si vede uscire (o rientrare) dalla scena
      const hospName = hosp ? hosp.name.replace(/^Ospedale (di |del |della )?/i, "").toUpperCase() : "OSPEDALE";
      const lerp3 = (x: V3, y: V3, u: number): V3 => [x[0] + (y[0] - x[0]) * u, x[1] + (y[1] - x[1]) * u, x[2] + (y[2] - x[2]) * u];
      const dirTo = (x: V3, y: V3) => Math.atan2(y[2] - x[2], y[0] - x[0]);   // angolo di marcia (asse lungo del mezzo = x locale)
      vs.forEach((veh) => {
        const a0 = Date.parse(veh.assigned_at), a1 = Date.parse(veh.arrives_at);
        if (veh.status === "conclusa" || veh.status === "rientro") return;
        const p = Math.max(0, Math.min(1, (now - a0) / Math.max(1, a1 - a0)));
        if (p >= 1) onSite++; else coming++;
        if (veh.pma && p >= 1) pmaOn++;
        const prev = seen.get(veh.id);
        const state = p >= 1 ? "posto" : "viaggio";
        if (prev !== state) {
          if (prev === undefined && state === "viaggio") captions.push({ text: `${veh.call_sign} in arrivo`, hi: veh.call_sign, at: t });
          if (prev !== undefined && state === "posto") captions.push(veh.pma ? { text: "PMA operativo", hi: "PMA", at: t } : { text: `${veh.call_sign} sul posto`, hi: veh.call_sign, at: t });
          seen.set(veh.id, state);
        }
        let ang = (hash(veh.id) % 628) / 100;
        if (veh.base_lat != null && veh.base_lng != null) ang = Math.atan2((veh.base_lng - d.lng) * cLat, veh.base_lat - d.lat);
        const start: V3 = [Math.sin(ang) * 150, 0, -Math.cos(ang) * 150];
        const isMaxiV = !!veh.maxi && !veh.pma;
        const myIdx = veh.pma ? pmaIdx++ : isMaxiV ? mxIdx++ : amb++;
        const end: V3 = FIRE ? [0, 0, 0] : veh.pma ? pmaSlot(myIdx % 6) : isMaxiV ? maxiSlot(myIdx % 9) : myIdx < 20 ? sceneSpot(myIdx) : slot(myIdx - 20);
        // entra dalla strada più vicina alla direzione della sua sede
        const sd: [number, number] = [Math.sin(ang), -Math.cos(ang)];
        const entry = ENTRIES.reduce((b, e) => { const l = Math.hypot(...e.dir); const v = (e.dir[0] * sd[0] + e.dir[1] * sd[1]) / l; return v > b.v ? { e, v } : b; }, { e: ENTRIES[0], v: -9 }).e;
        // incendio: i mezzi AIB si dispongono in cerchio attorno al fronte (dal sud, poi a destra e sinistra)
        const nF = Math.max(1, vs.length), stepA = Math.min(0.55, (Math.PI * 2) / nF);
        const aT = Math.PI / 2 + (myIdx % 2 ? 1 : -1) * Math.ceil(myIdx / 2) * stepA;
        const Rr = fireR + 9;
        const ringPt = (a: number): V3 => [FIRE_C[0] + Math.cos(a) * Rr, 0, FIRE_C[2] + Math.sin(a) * Rr * 0.8];
        const fireRaw: V3[] = [];
        if (FIRE) {
          const s0 = ringPt(Math.PI / 2); fireRaw.push(...entry.pts, [s0[0], 0, ROAD_Z], s0);
          const nSteps = Math.ceil(Math.abs(aT - Math.PI / 2) / 0.15);
          for (let k = 1; k <= nSteps; k++) fireRaw.push(ringPt(Math.PI / 2 + ((aT - Math.PI / 2) * k) / nSteps));
        }
        const fEnd = FIRE ? fireRaw[fireRaw.length - 1] : end;
        if (FIRE) { end[0] = fEnd[0]; end[2] = fEnd[2]; }
        const approach = makePath(FIRE ? fireRaw : veh.pma
          ? [...entry.pts, [ROAD_X, 0, ROAD_Z], [ROAD_X, 0, PMA_Z], [end[0], 0, PMA_Z], end]
          : [...entry.pts, [end[0], 0, ROAD_Z], end]);
        // nella scena il mezzo entra solo negli ultimi secondi prima dell'arrivo vero, a velocità normale:
        // prima è nell'elenco "in arrivo", così arriva sul posto nello stesso momento della mappa principale
        const ENTRY = 18000;
        if (now < a1 - ENTRY) { comingList.push({ s: `${veh.call_sign}${veh.pma ? " (PMA)" : ""}`, ms: a1 - now }); return; }
        const pe = Math.max(0, Math.min(1, (now - (a1 - ENTRY)) / ENTRY));
        const ease = pe < 1 ? 1 - (1 - pe) ** 1.6 : 1;
        const park = approach.at(approach.len).h;                               // resta parcheggiato come è arrivato
        const ap = approach.at(ease * approach.len);
        let pos = ap.p; let heading = p < 1 ? ap.h : park; let label = veh.pma ? "PMA" : "SUL POSTO"; let moving = p < 1; let doorsOpen = false;
        const fwd = (h: number): V3 => [Math.cos(h), 0, Math.sin(h)];
        const rear = (q: V3, h: number, dd = 3.4): V3 => [q[0] - fwd(h)[0] * dd, 0, q[2] - fwd(h)[2] * dd];
        const crewCol = veh.mine ? "#FFB199" : "#BFE0FF";

        if (p >= 1) for (const md of veh.modules ?? []) modsOn.add(md);
        if (FIRE && p >= 1) {
          // AIB: spegne col naspo, poi va a ricaricare l'acqua in sede e torna (rotta vera del mezzo)
          const ph = firePhase(veh.route, now, d.lat, d.lng);
          if (ph.state === "away") { away++; awayList.push(`${veh.call_sign} ${ph.text}${ph.left ? ` · ${Math.max(1, Math.round(ph.left / 60))}'` : ""}`); return; }
          if (ph.state === "in") { const q = approach.at(ph.f * approach.len); pos = q.p; heading = q.h; moving = true; label = "💧 ARRIVA CON L'ACQUA"; }
          else if (ph.state === "out") { const op = makePath([...fireRaw].reverse()); const q = op.at(ph.f * op.len); pos = q.p; heading = q.h; moving = true; label = "➜ RIFORNIMENTO ACQUA"; }
          else {
            fireOn++;
            const ang = aT;
            const rr0 = rear(end, park, 2.2);
            for (let r = 0; r < 2; r++) {
              let a = ang + (r ? 0.16 : -0.16) + Math.sin(now / 2500 + r + myIdx) * 0.06; a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
              const k = Math.round((a / (Math.PI * 2)) * frontN) % frontN; const fp = front[k]?.p ?? FIRE_C;
              const dl = Math.hypot(end[0] - fp[0], end[2] - fp[2]) || 1; const nz: V3 = [fp[0] + ((end[0] - fp[0]) / dl) * 7, 0, fp[2] + ((end[2] - fp[2]) / dl) * 7];
              const inS = (now - a1) / 1000;
              const walk = Math.min(1, ((inS + r * 2) % 9999) / 8);
              const at = walk < 1 ? lerp3(rr0, nz, walk) : nz;
              people.push({ p: at, pose: walk < 1 ? "carry" : "spray", col: crewCol });
              hoses.push([rr0, at]);
              if (walk >= 1) { sprays.push({ from: [at[0], 1.6, at[2]], to: [fp[0], 0.6, fp[2]] }); for (let q = -2; q <= 2; q++) { const fq = front[(k + q + frontN) % frontN]; if (fq) fq.on = false; } }
            }
            label = "💦 SPEGNIMENTO";
          }
        }
        if (p >= 1 && isMaxiV) {
          // mezzi maxi: ogni modulo caricato ha la sua attività
          const mods = veh.modules ?? []; const r0 = rear(end, park, 4.5); const ph = (hash(veh.id) % 100) / 10;
          label = mods.length ? mods.map((md) => ({ unita_logistica: "LOGISTICA", unita_cinofila: "CINOFILA", unita_droni: "DRONI", pma_tenda: "PMA" } as Record<string, string>)[md] ?? "").filter(Boolean).join(" · ") : "SUL POSTO";
          doorsOpen = true;
          if (!mods.length) people.push({ p: [r0[0], 0, r0[2] + 1], pose: "stand", col: crewCol });
          if (mods.includes("unita_logistica")) {
            const g: V3 = [end[0] + 2, 0, end[2] + 8];
            addBox({ c: [g[0], 1.6, g[2]], s: [6, 3.2, 5], yaw: 0, fill: "rgba(241,245,249,.25)", edge: "rgba(241,245,249,.9)" });       // gazebo
            addBox({ c: [g[0], 3.3, g[2]], s: [6.4, 0.25, 5.4], yaw: 0, fill: "rgba(249,115,22,.85)", edge: "#F97316" });
            props.push({ c: [end[0] - 6, 0.6, end[2] + 6], s: [1.8, 1.2, 1.1], fill: "rgba(249,115,22,.9)", edge: "#F97316" });           // generatore
            props.push({ c: [end[0] - 6, 4, end[2] + 2], s: [0.15, 8, 0.15], fill: "rgba(203,213,225,.9)", edge: "#CBD5E1" });           // torre faro
            props.push({ c: [end[0] - 6, 8.2, end[2] + 2], s: [1.6, 0.5, 0.5], fill: "rgba(254,249,195,.98)", edge: "#FEF9C3" });
            const lt = P([end[0] - 6, 8.2, end[2] + 2]);
            if (lt) draws.push({ z: lt[2] - 3, fn: () => { const gr = ctx.createRadialGradient(lt[0], lt[1], 0, lt[0], lt[1], 40); gr.addColorStop(0, "rgba(254,249,195,.55)"); gr.addColorStop(1, "rgba(254,249,195,0)"); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(lt[0], lt[1], 40, 0, Math.PI * 2); ctx.fill(); } });
            const u = ((now / 1000 + ph) % 16) / 16; const a = r0, b: V3 = [g[0], 0, g[2] - 3];
            people.push({ p: u < 0.5 ? lerp3(a, b, u * 2) : lerp3(b, a, (u - 0.5) * 2), pose: u < 0.5 ? "carry" : "walk", col: crewCol });
            people.push({ p: [g[0] - 1.5, 0, g[2]], pose: "stand", col: crewCol }, { p: [g[0] + 1.5, 0, g[2] + 0.5], pose: "sit", col: "#E2E8F0" });
          }
          if (mods.includes("unita_cinofila")) {
            for (let k = 0; k < 2; k++) {
              const tt2 = now / 1000 / 7 + k * 2.1 + ph; const rad = 9 + 6 * Math.sin(tt2 * 0.7 + k);
              const dp: V3 = [CENTER[0] + Math.cos(tt2) * rad, 0, CENTER[2] - 6 + Math.sin(tt2 * 1.3) * rad * 0.6];
              const dh = Math.atan2(Math.cos(tt2 * 1.3) * 1.3 * rad * 0.6, -Math.sin(tt2) * rad);
              const sniff = Math.abs(Math.sin(now / 160 + k)) * 0.12;
              props.push({ c: [dp[0], 0.65, dp[2]], s: [1.3, 0.45, 0.45], fill: "rgba(161,98,7,.95)", edge: "#A16207", yaw: dh });                  // cane
              props.push({ c: [dp[0] + Math.cos(dh) * 0.8, 0.75 - sniff, dp[2] + Math.sin(dh) * 0.8], s: [0.45, 0.35, 0.35], fill: "rgba(120,53,15,.95)", edge: "#78350F", yaw: dh });
              for (const lx of [0.45, -0.45]) props.push({ c: [dp[0] + Math.cos(dh) * lx, 0.22, dp[2] + Math.sin(dh) * lx], s: [0.12, 0.44, 0.5], fill: "rgba(120,53,15,.95)", edge: "#78350F", yaw: dh });
              people.push({ p: [dp[0] - Math.cos(dh) * 2.6, 0, dp[2] - Math.sin(dh) * 2.6], pose: "walk", col: "#FDBA74" });
              if (((now / 1000 + k * 9 + ph) % 22) < 3) {                       // il cane segnala un disperso
                flashes.push([dp[0], 0.8, dp[2]]); const q = P([dp[0], 3, dp[2]]);
                if (q) draws.push({ z: q[2] - 2, fn: () => { ctx.font = "800 11px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#FDE68A"; ctx.fillText("🐕 SEGNALAZIONE", q[0], q[1] - 8); } });
              }
            }
          }
          if (mods.includes("unita_droni")) {
            people.push({ p: [r0[0] + 1.5, 0, r0[2] + 2], pose: "film", col: crewCol });
            for (let k = 0; k < 2; k++) {
              const a = now / 1000 / 6 + k * Math.PI + ph; const dp: V3 = [CENTER[0] + Math.cos(a) * (18 + k * 8), 20 + k * 4 + Math.sin(now / 700 + k) * 0.6, CENTER[2] + Math.sin(a) * (14 + k * 6)];
              props.push({ c: dp, s: [0.8, 0.25, 0.8], fill: "rgba(30,41,59,.95)", edge: "#94A3B8" });
              props.push({ c: dp, s: [2.6, 0.08, 0.18], fill: "rgba(148,163,184,.9)", edge: "#94A3B8", yaw: Math.PI / 4 }, { c: dp, s: [2.6, 0.08, 0.18], fill: "rgba(148,163,184,.9)", edge: "#94A3B8", yaw: -Math.PI / 4 });
              props.push({ c: [dp[0], dp[1] - 0.2, dp[2]], s: [0.2, 0.15, 0.2], fill: Math.floor(now / 300) % 2 ? "rgba(239,68,68,.95)" : "rgba(34,197,94,.95)", edge: "#fff" });
              const top = P(dp), gnd = P([dp[0], 0, dp[2]]);
              if (top && gnd) draws.push({ z: gnd[2] - 0.2, fn: () => {      // cono della termocamera
                const gr = ctx.createLinearGradient(top[0], top[1], gnd[0], gnd[1]); gr.addColorStop(0, "rgba(250,204,21,.35)"); gr.addColorStop(1, "rgba(250,204,21,0)");
                ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(gnd[0] - 22, gnd[1]); ctx.lineTo(gnd[0] + 22, gnd[1]); ctx.closePath(); ctx.fill(); } });
            }
          }
        }
        if (p >= 1 && !veh.pma && !isMaxiV && !FIRE) {
          const off = hash(veh.id) % 40;
          const sinceArr = Math.max(0, (now - a1) / 1000);
          if (veh.moto || veh.automedica) {
            // primo soccorso: vanno dal ferito più grave e lo assistono
            const avail2 = patients.filter((q) => q.freed); const pt = (avail2.length ? avail2 : patients)[(hash(veh.id) >>> 2) % (avail2.length || patients.length)]; pt.busy = true;
            const cyc = ((now / 1000 + off) % 30) / 30; const r0 = rear(end, park, 1.5);
            for (let r = 0; r < (veh.moto ? 1 : 2); r++) {
              const tgt: V3 = [pt.p[0] + (r ? 1 : -1), 0, pt.p[2] + 0.6];
              const x = cyc < 0.15 ? lerp3(r0, tgt, cyc / 0.15) : cyc < 0.85 ? tgt : lerp3(tgt, r0, (cyc - 0.85) / 0.15);
              people.push({ p: x, pose: cyc < 0.15 || cyc >= 0.85 ? "walk" : "kneel", col: crewCol });
            }
            label = "PRIMO SOCCORSO";
          } else {
            // ciclo del recupero: barella → ferito → cure → barella in ambulanza → PMA (42 s) oppure spola con l'ospedale
            const CYC = 42; const tt = now / 1000 + off;
            const sh = hasPma ? null : shuttleState(a1, travelS, now, d.shuttle ?? {});
            const n = sh ? sh.n : Math.floor(tt / CYC);
            let u = sh ? 0 : (tt % CYC) / CYC;
            if (sh) {
              transported += sh.delivered;
              if (sh.phase === "scena") u = sh.f * 0.5;
              else if (sh.phase === "andata") u = sh.inS < EXIT_S ? 0.5 + (sh.inS / EXIT_S) * 0.15 : -1;
              else if (sh.phase === "ritorno") u = sh.leftS < EXIT_S ? 0.75 + (1 - sh.leftS / EXIT_S) * 0.17 : -1;
              else u = -1;
              if (u < 0) {                                  // fuori dalla scena: in viaggio o in pronto soccorso
                away++;
                const mins = Math.max(1, Math.round((sh.phase === "andata" ? sh.leftS + sh.hosp + sh.travel : sh.phase === "ospedale" ? sh.leftS + sh.travel : sh.leftS) / 60));
                awayList.push(`${veh.call_sign} ${sh.phase === "andata" ? "➜ " + hospName : sh.phase === "ospedale" ? "IN PS " + hospName : "RIENTRA"} · ${mins}'`);
                return;
              }
            } else transported += Math.max(0, Math.floor((sinceArr + (off % CYC)) / CYC));
            const avail = patients.filter((q) => q.freed); const pt = (avail.length ? avail : patients)[(hash(veh.id) + n * 5) % (avail.length || patients.length)];
            const dest: V3 = hasPma ? [56 + (myIdx % 4) * 3, 0, 80] : entry.pts[0];
            const trip = makePath(hasPma ? [end, [end[0], 0, ROAD_Z], [ROAD_X, 0, ROAD_Z], [ROAD_X, 0, PMA_Z], [dest[0], 0, PMA_Z], dest]
                                         : [end, [end[0], 0, ROAD_Z], ...[...entry.pts].reverse()]);
            const back = makePath(hasPma ? [dest, [dest[0], 0, PMA_Z], [ROAD_X, 0, PMA_Z], [ROAD_X, 0, ROAD_Z], [end[0], 0, ROAD_Z], end]
                                         : [...entry.pts, [end[0], 0, ROAD_Z], end]);
            const rr = rear(end, park);
            const ptGround: V3 = [pt.p[0], 0, pt.p[2]];
            const pair = (c: V3, h: number, loaded: boolean, pose: Pose) => {   // due soccorritori ai capi della barella
              const f = fwd(h); const a: V3 = [c[0] + f[0] * 1.3, 0, c[2] + f[2] * 1.3], b: V3 = [c[0] - f[0] * 1.3, 0, c[2] - f[2] * 1.3];
              people.push({ p: a, pose, col: crewCol }, { p: b, pose, col: crewCol });
              stretchers.push({ a: [a[0] - f[0] * 0.5, 0, a[2] - f[2] * 0.5], b: [b[0] + f[0] * 0.5, 0, b[2] + f[2] * 0.5], loaded });
            };
            const hWalk = dirTo(rr, ptGround);
            if (u < 0.12) { doorsOpen = u < 0.04; pair(lerp3(rr, ptGround, u / 0.12), hWalk, false, "carry"); label = "RECUPERO FERITO"; }
            else if (u < 0.3) {
              pt.busy = true; label = "STABILIZZAZIONE";
              people.push({ p: [ptGround[0] - 1.1, 0, ptGround[2] + 0.8], pose: "kneel", col: crewCol }, { p: [ptGround[0] + 1.2, 0, ptGround[2] + 0.8], pose: "kneel", col: crewCol });
              stretchers.push({ a: [ptGround[0] - 1.3, 0, ptGround[2] - 1.2], b: [ptGround[0] + 1.3, 0, ptGround[2] - 1.2], loaded: false });
              props.push({ c: [ptGround[0] - 2, 1.3, ptGround[2] - 0.2], s: [0.08, 2.6, 0.08], fill: "rgba(203,213,225,.9)", edge: "#CBD5E1" });   // asta flebo
              props.push({ c: [ptGround[0] - 2, 2.5, ptGround[2] - 0.2], s: [0.4, 0.5, 0.2], fill: "rgba(125,211,252,.9)", edge: "#7DD3FC" });
              props.push({ c: [ptGround[0] + 2.1, 0.3, ptGround[2] + 0.3], s: [0.9, 0.6, 0.5], fill: "rgba(250,204,21,.95)", edge: "#FACC15" });  // DAE / zaino
              if (pt.tri === "#EF4444" && (now % 4000) < 160) flashes.push([ptGround[0] + 1, 0.6, ptGround[2]]);
            }
            else if (u < 0.45) { doorsOpen = true; pt.hidden = true; pair(lerp3(ptGround, rr, (u - 0.3) / 0.15), hWalk + Math.PI, true, "carry"); label = "BARELLA IN ARRIVO"; }
            else if (u < 0.5) { doorsOpen = true; pt.hidden = true; people.push({ p: [rr[0] + 1, 0, rr[2]], pose: "stand", col: crewCol }); label = "CARICO IN AMBULANZA"; }
            else if (u < 0.65) { pt.hidden = true; const q = trip.at(((u - 0.5) / 0.15) * trip.len); pos = q.p; heading = q.h; moving = true; label = hasPma ? "➜ PMA CON FERITO" : "➜ " + hospName; }
            else if (u < 0.75) {
              pt.hidden = true; pos = dest; heading = trip.at(trip.len).h;
              if (hasPma) { doorsOpen = true; const r2 = rear(dest, heading); pair(lerp3(r2, [64, 0, 76], (u - 0.65) / 0.1), dirTo(r2, [64, 0, 76]), true, "carry"); label = "CONSEGNA AL PMA"; }
              else label = "IN OSPEDALE";
            }
            else if (u < 0.92) { const q = back.at(((u - 0.75) / 0.17) * back.len); pos = q.p; heading = q.h; moving = true; label = "RIENTRO SUL POSTO"; }
          }
        }
        const col = veh.mine ? ORANGE : BLUE;
        // scia corta che svanisce: solo l'ultimo tratto dietro al mezzo, sparisce 6 s dopo l'arrivo
        const fade = p < 1 ? 1 : Math.max(0, 1 - (now - a1) / 6000);
        if (fade > 0) {
          const dNow = ease * approach.len, from = Math.max(0, dNow - 45); const steps = 10; const trail: V3[] = [];
          for (let k = 0; k <= steps; k++) trail.push(approach.at(from + ((dNow - from) * k) / steps).p);
          const TH = 4;
          for (let k = 0; k < steps; k++) {
            const a = trail[k], b = trail[k + 1]; const al = (0.12 * fade * (k + 1)) / steps;
            poly([[a[0], 0.2, a[2]], [b[0], 0.2, b[2]], [b[0], TH, b[2]], [a[0], TH, a[2]]], undefined, veh.mine ? `rgba(255,90,54,${al})` : `rgba(108,180,255,${al})`);
          }
          const tp = trail.map((x) => P([x[0], TH, x[2]]));
          if (tp.every(Boolean)) {
            const gr = ctx.createLinearGradient(tp[0]![0], tp[0]![1], tp[steps]![0], tp[steps]![1]);
            gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, col);
            ctx.globalAlpha = fade; ctx.strokeStyle = gr; ctx.lineWidth = 2.2; ctx.beginPath();
            tp.forEach((x, k) => (k ? ctx.lineTo(x![0], x![1]) : ctx.moveTo(x![0], x![1]))); ctx.stroke(); ctx.globalAlpha = 1;
          }
        }
        // ===== modellino: asse lungo = x locale, muso verso +x =====
        const blinkOn = Math.floor(t / 250) % 2 === 0;
        const bounce = moving ? Math.abs(Math.sin(t / 90 + (hash(veh.id) % 7))) * 0.12 : 0;
        const part = (dx: number, dy: number, dz: number, w: number, h: number, dd: number, fill: string, edge = col) => {
          const cs = Math.cos(heading), sn = Math.sin(heading);
          addBox({ c: [pos[0] + dx * cs - dz * sn, dy + (dy > 0.6 ? bounce : 0), pos[2] + dx * sn + dz * cs], s: [w, h, dd], yaw: heading, fill, edge });
        };
        const bar = blinkOn ? "rgba(239,68,68,.95)" : "rgba(59,130,246,.95)";
        const bar2 = blinkOn ? "rgba(59,130,246,.95)" : "rgba(239,68,68,.95)";
        const dark = "rgba(15,23,42,.9)", glass = "rgba(56,189,248,.35)";
        const wheels = (xs: number[], half: number, r = 0.45) => { for (const x of xs) for (const z of [-half, half]) part(x, r, z, r * 2, r * 2, 0.35, dark, dark); };
        const W1 = "rgba(241,245,249,.95)", OR = "rgba(249,115,22,.95)", YE = "rgba(250,204,21,.95)";
        const chk = (x0: number, len: number, y: number, z: number) => { for (let k = 0; k < Math.floor(len / 0.5); k++) part(x0 - len / 2 + 0.25 + k * 0.5, y, z, 0.48, 0.22, 0.04, k % 2 ? YE : OR, k % 2 ? "#FACC15" : "#F97316"); };
        if (veh.aib === "daily" || veh.aib === "autobotte") {               // come il D-Daily AIB: doppia cabina alta + modulo antincendio
          part(1.55, 1.75, 0, 3.0, 2.3, 2.2, W1);                                                  // doppia cabina
          part(3.25, 1.2, 0, 0.5, 1.1, 2.1, W1);                                                   // muso
          part(2.9, 2.25, 0, 0.06, 1.0, 1.9, glass, glass);
          for (const z of [1.12, -1.12]) { part(1.3, 2.25, z, 2.2, 0.75, 0.04, glass, glass); part(1.6, 1.45, z, 3.0, 0.22, 0.04, OR, "#F97316"); chk(1.6, 3, 0.95, z); }
          part(-1.75, 1.75, 0, 3.4, 2.1, 2.3, W1);                                                 // modulo
          for (const z of [1.17, -1.17]) {
            part(-1.75, 2.65, z, 3.3, 0.22, 0.04, OR, "#F97316"); chk(-1.75, 3.2, 0.85, z);
            part(-2.6, 1.7, z, 0.7, 0.9, 0.05, "rgba(220,38,38,.95)", "#EF4444"); part(-2.6, 1.7, z + Math.sign(z) * 0.02, 0.35, 0.45, 0.04, YE, "#FACC15");   // naspi rossi/gialli
            part(-1.4, 1.6, z, 0.9, 0.9, 0.05, "rgba(148,163,184,.9)", "#94A3B8");                      // serbatoio e pompa
          }
          part(-1.75, 2.95, 0, 3.4, 0.08, 1.4, "rgba(203,213,225,.9)", "#CBD5E1");                 // scala sul tetto
          part(1.9, 3.0, 0, 0.45, 0.2, 1.4, bar, bar);
          wheels([2.4, -2.4], 1.15, 0.6);
        } else if (veh.aib === "ranger" || veh.aib === "scorpio" || veh.aib === "pickup") {   // pickup doppia cabina (Ranger / Scorpio) con modulo e naspo nel cassone
          const sc = veh.aib === "scorpio" ? 0.92 : 1;
          part(0.5 * sc, 1.3, 0, 2.4 * sc, 1.25, 1.95, W1);                                        // doppia cabina
          part(2.25 * sc, 0.95, 0, 1.4 * sc, 0.65, 1.9, W1);                                       // cofano
          part(1.55 * sc, 1.55, 0, 0.06, 0.6, 1.7, glass, glass);
          for (const z of [0.99, -0.99]) { part(0.5 * sc, 1.65, z, 2.0 * sc, 0.5, 0.04, glass, glass); part(0.6 * sc, 1.1, z, 4.2 * sc, 0.22, 0.04, OR, "#F97316"); chk(0.2 * sc, 3.4 * sc, 0.6, z); }
          part(-1.7 * sc, 0.95, 0, 2.2 * sc, 0.65, 1.95, W1);                                      // cassone
          part(-1.4 * sc, 1.65, 0, 1.0, 0.8, 1.2, "rgba(148,163,184,.92)", "#94A3B8");             // serbatoio + motopompa
          part(-2.35 * sc, 1.85, 0, 0.35, veh.aib === "scorpio" ? 1.25 : 1.0, 1.1, "rgba(220,38,38,.95)", "#EF4444");   // naspo
          if (veh.aib === "scorpio") part(-0.75 * sc, 1.9, 0, 0.12, 0.9, 1.8, "rgba(203,213,225,.9)", "#CBD5E1");        // roll bar
          part(2.95 * sc, 0.75, 0, 0.25, 0.5, 1.7, "rgba(15,23,42,.9)", "#334155");                 // bull bar
          part(0.6 * sc, 2.0, 0, 0.4, 0.18, 1.3, bar, bar);
          wheels([1.85 * sc, -1.75 * sc], 1.0, 0.5);
        } else if (veh.maxi === "camion") {                                         // camion maxi: cabina + cassone, fasce arancio/gialle
          part(4.6, 1.9, 0, 2.2, 2.9, 2.6, "rgba(241,245,249,.94)");
          part(5.72, 2.3, 0, 0.06, 1.1, 2.2, glass, glass);
          part(-1.4, 2.6, 0, 9.2, 3.9, 2.8, "rgba(241,245,249,.92)");
          for (const z of [1.42, -1.42]) { part(-1.4, 2.4, z, 9, 0.35, 0.04, "rgba(249,115,22,.95)", "#F97316"); part(-1.4, 1.5, z, 9, 0.3, 0.04, "rgba(250,204,21,.95)", "#FACC15"); }
          part(4.6, 3.45, 0, 0.5, 0.22, 1.8, bar, bar); part(-5.9, 4.65, 0.9, 0.3, 0.2, 0.3, bar2, bar2);
          if (doorsOpen) part(-6.3, 0.6, 0, 1.4, 0.12, 2.6, "rgba(148,163,184,.9)", "#94A3B8");   // sponda idraulica giù
          wheels([4.4, -3.4, -4.9], 1.3, 0.6);
        } else if (veh.maxi === "furgone") {                                 // furgone comando giallo con torre faro
          part(-0.4, 1.9, 0, 6.2, 2.9, 2.4, "rgba(250,204,21,.92)", "#FACC15");
          part(3.15, 1.35, 0, 1.5, 1.8, 2.3, "rgba(250,204,21,.92)", "#FACC15");
          part(3.92, 1.7, 0, 0.06, 0.8, 2.0, glass, glass);
          for (const z of [1.22, -1.22]) part(-0.4, 1.5, z, 6, 0.3, 0.04, "rgba(30,58,138,.95)", "#1E3A8A");
          part(-1.2, 3.55, 0, 3.8, 0.12, 0.5, "rgba(203,213,225,.9)", "#CBD5E1");                  // traliccio torre faro
          part(0.8, 3.6, 0, 1.2, 0.35, 0.9, "rgba(241,245,249,.9)");                               // condizionatore
          part(3, 3.45, 0, 0.45, 0.22, 2.0, bar, bar); part(-3.3, 3.45, 0, 0.3, 0.22, 1.6, bar2, bar2);
          wheels([2.8, -2.4], 1.15, 0.5);
        } else if (veh.pma) {
          part(3.8, 1.5, 0, 2, 2.6, 2.5, "rgba(241,245,249,.92)");
          part(4.75, 2, 0, 0.1, 1, 2.1, glass, glass);
          part(-1.6, 2.1, 0, 7.4, 3.4, 2.7, "rgba(52,211,153,.8)", "#34D399");
          part(-1.6, 3.85, 0, 2.2, 0.1, 0.6, "rgba(239,68,68,.95)", "#EF4444"); part(-1.6, 3.85, 0, 0.6, 0.1, 2.2, "rgba(239,68,68,.95)", "#EF4444");
          wheels([3.6, -0.5, -3.8], 1.3, 0.55);
        } else if (veh.moto) {
          part(0, 0.75, 0, 2.2, 0.6, 0.45, "rgba(241,245,249,.9)");
          part(0.75, 1.3, 0, 0.5, 0.55, 0.5, glass, glass);
          part(-0.85, 1.25, 0, 0.7, 0.55, 0.9, "rgba(241,245,249,.9)");     // bauletto
          part(-0.85, 1.6, 0, 0.25, 0.18, 0.5, bar, bar);
          wheels([0.9, -0.9], 0, 0.4);
          if (moving || p < 1) part(-0.1, 1.7, 0, 0.6, 1.1, 0.5, "rgba(255,90,54,.9)");
        } else if (veh.automedica) {
          part(0, 0.7, 0, 4.2, 0.9, 1.9, "rgba(241,245,249,.92)");
          part(-0.3, 1.45, 0, 2.3, 0.7, 1.7, glass);
          part(1.6, 1.0, 0, 0.9, 0.15, 1.8, "rgba(241,245,249,.92)");     // cofano
          part(-0.3, 1.9, 0, 0.5, 0.22, 1.5, bar, bar);
          part(0, 0.75, 0.97, 3.6, 0.25, 0.04, "rgba(250,204,21,.95)", "#FACC15"); // fascia gialla
          wheels([1.3, -1.3], 0.95, 0.4);
        } else {
          const L = veh.long ? 5.8 : 4.4;
          const bx = -L / 2 + 0.4;
          part(bx, 1.7, 0, L, 2.8, 2.4, "rgba(241,245,249,.94)");           // vano sanitario
          part(1.55, 1.15, 0, 1.6, 1.9, 2.3, "rgba(241,245,249,.94)");      // cabina
          part(2.36, 1.55, 0, 0.06, 0.8, 2.0, glass, glass);                // parabrezza
          part(1.4, 1.6, 1.16, 0.9, 0.6, 0.04, glass, glass); part(1.4, 1.6, -1.16, 0.9, 0.6, 0.04, glass, glass);
          part(bx, 1.35, 1.22, L - 0.3, 0.32, 0.04, veh.mine ? "rgba(255,90,54,.95)" : "rgba(108,180,255,.95)"); // fascia
          part(bx, 1.35, -1.22, L - 0.3, 0.32, 0.04, veh.mine ? "rgba(255,90,54,.95)" : "rgba(108,180,255,.95)");
          part(bx, 2.1, 1.22, 0.9, 0.9, 0.04, "rgba(239,68,68,.9)", "#EF4444");   // croce sul fianco
          if (doorsOpen) {                                                     // porte posteriori aperte
            part(bx - L / 2 - 0.6, 1.7, 1.2, 1.2, 2.2, 0.06, "rgba(241,245,249,.9)"); part(bx - L / 2 - 0.6, 1.7, -1.2, 1.2, 2.2, 0.06, "rgba(241,245,249,.9)");
          } else part(bx - L / 2 + 0.02, 1.7, 0, 0.04, 2.2, 0.05, dark, dark);
          part(1.8, 2.25, 0, 0.45, 0.22, 2.0, bar, bar);                     // barra luci anteriore
          part(bx - L / 2 + 0.3, 3.2, 0.8, 0.3, 0.2, 0.3, bar2, bar2); part(bx - L / 2 + 0.3, 3.2, -0.8, 0.3, 0.2, 0.3, bar, bar);
          wheels([1.4, bx - L / 2 + 1.1], 1.15);
        }
        if (veh.pma && p >= 1) {
          addBox({ c: [pos[0] + 2, 2, pos[2] + 8], s: [11, 4, 8], yaw: 0, fill: "rgba(52,211,153,.22)", edge: "rgba(52,211,153,.95)" });
          addBox({ c: [pos[0] + 2, 4.1, pos[2] + 8], s: [3, 0.1, 0.8], yaw: 0, fill: "rgba(239,68,68,.95)", edge: "#EF4444" });
          addBox({ c: [pos[0] + 2, 4.1, pos[2] + 8], s: [0.8, 0.1, 3], yaw: 0, fill: "rgba(239,68,68,.95)", edge: "#EF4444" });
        }
        const lp = P([pos[0], veh.aib ? 3.6 : veh.maxi ? 5.4 : veh.pma ? 5 : veh.moto ? 2.6 : 3.8, pos[2]]);
        const showLab = p < 1 || moving || veh.mine || veh.pma || !!veh.maxi || cam.dist < 110;
        if (lp && showLab) draws.push({ z: lp[2] - 1, fn: () => {
          ctx.font = "700 10px ui-monospace,monospace"; ctx.textAlign = "center";
          const eta = Math.max(0, Math.round((a1 - now) / 1000));
          const lab = p < 1 ? `${Math.floor(eta / 60)}:${String(eta % 60).padStart(2, "0")}` : label;
          ctx.fillStyle = WHITE; ctx.fillText(veh.call_sign.toUpperCase(), lp[0], lp[1] - 16);
          ctx.fillStyle = veh.pma ? "#34D399" : col; ctx.fillText(lab, lp[0], lp[1] - 5);
        } });
      });

      // incendio: tubi del naspo a terra ed elicottero con la benna (gravità 3)
      for (const [a3, b3] of hoses) { const a = P([a3[0], 0.15, a3[2]]), b = P([b3[0], 0.15, b3[2]]); if (a && b) draws.push({ z: Math.max(a[2], b[2]), fn: () => { ctx.strokeStyle = "rgba(239,68,68,.9)"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2 + 4, (a[1] + b[1]) / 2 + 3, b[0], b[1]); ctx.stroke(); } }); }
      if (FIRE && sev === 3 && (d.fire?.intensity ?? 50) > 0) {
        const cyc = (now % 40000) / 40000; const k0 = Math.floor(now / 40000) * 7 % frontN; const tgtP = front[k0]?.p ?? FIRE_C;
        const orbit: V3 = [FIRE_C[0] + Math.cos(now / 9000) * 80, 32, FIRE_C[2] + Math.sin(now / 9000) * 60];
        const hp: V3 = cyc < 0.3 ? lerp3(orbit, [tgtP[0], 26, tgtP[2]], cyc / 0.3) : cyc < 0.45 ? [tgtP[0], 26, tgtP[2]] : lerp3([tgtP[0], 26, tgtP[2]], orbit, (cyc - 0.45) / 0.55);
        addBox({ c: hp, s: [4, 1.6, 1.6], yaw: now / 9000, fill: "rgba(239,68,68,.9)", edge: "#F87171" });
        addBox({ c: [hp[0], hp[1] + 1.1, hp[2]], s: [9, 0.08, 0.3], yaw: now / 60, fill: "rgba(203,213,225,.8)", edge: "#CBD5E1" });
        addBox({ c: [hp[0], hp[1] - 6, hp[2]], s: [0.9, 0.9, 0.9], yaw: 0, fill: "rgba(249,115,22,.9)", edge: "#F97316" });   // benna
        if (cyc >= 0.3 && cyc < 0.45) { for (let q = -3; q <= 3; q++) { const fq = front[(k0 + q + frontN) % frontN]; if (fq) fq.on = false; }
          for (let q = 0; q < 6; q++) particles.push({ p: [hp[0] + (Math.random() - 0.5) * 3, hp[1] - 6, hp[2] + (Math.random() - 0.5) * 3], v: [0, -0.9, 0], life: 0, max: 26, kind: "water" }); }
        const lab = P([hp[0], hp[1] + 3, hp[2]]); if (lab) draws.push({ z: lab[2] - 1, fn: () => { ctx.font = "700 10px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#F87171"; ctx.fillText("ELICOTTERO AIB", lab[0], lab[1]); } });
      }
      // ===== figure: soccorritori, feriti, barelle =====
      const figure = (p3: V3, pose: Pose, col: string, phase: number) => {
        const base = p3[1]; const low = pose === "kneel" || pose === "sit" || pose === "cut";
        const foot = P(p3), head = P([p3[0], base + (low ? 1.8 : 2.8), p3[2]]); if (!foot || !head) return;
        draws.push({ z: foot[2] - 0.5, fn: () => {
          const h = Math.max(3, (foot[1] - head[1]) * (low ? 2.8 / 1.8 : 1)); const fx = foot[0], fy = foot[1];
          ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(1, h / 10); ctx.lineCap = "round";
          const seg = (pts: [number, number][]) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
          const limb = (x0: number, y0: number, a1: number, a2: number, l: number) => {   // arto in due pezzi (angoli dalla verticale)
            const x1 = x0 + Math.sin(a1) * l, y1 = y0 + Math.cos(a1) * l; seg([[x0, y0], [x1, y1], [x1 + Math.sin(a2) * l, y1 + Math.cos(a2) * l]]);
          };
          if (pose === "lie") {
            const e = P([p3[0] + 2.4, base + 0.2, p3[2]]); if (!e) return;
            const lift = Math.max(0, Math.sin(phase * 1.3)) ** 6;      // ogni tanto alza un braccio
            seg([[fx, fy], [e[0], e[1]]]);
            const mx = fx + (e[0] - fx) * 0.65, my = fy + (e[1] - fy) * 0.65;
            seg([[mx, my], [mx + h * 0.05, my - h * 0.3 * lift - h * 0.02]]);
            ctx.beginPath(); ctx.arc(e[0], e[1] - Math.sin(phase * 2) * h * 0.02, Math.max(1.5, h / 9), 0, Math.PI * 2); ctx.fill(); return;
          }
          const w = phase * (pose === "limp" ? 5 : 8);
          const walking = pose === "walk" || pose === "carry" || pose === "limp";
          const bob = walking ? Math.abs(Math.sin(w)) * h * (pose === "limp" ? 0.09 : 0.04) : pose === "stand" || pose === "film" ? Math.sin(phase * 1.5) * h * 0.01 : 0;
          const hipY = fy - h * (low ? 0.28 : 0.47) - bob, hipX = fx;
          const sway = pose === "stand" || pose === "film" ? Math.sin(phase * 0.9) * h * 0.02 : 0;
          const lean = pose === "kneel" || pose === "cut" ? h * 0.1 : pose === "carry" ? -h * 0.03 : 0;
          const shX = hipX + lean + sway, shY = hipY - h * 0.32;
          const cpr = pose === "kneel" ? Math.max(0, Math.sin(phase * 9)) * h * 0.05 : 0;
          // gambe
          const L = h * 0.24;
          if (walking) { const sw = Math.sin(w) * (pose === "limp" ? 0.25 : 0.5); limb(hipX, hipY, sw, sw - Math.max(0, -Math.sin(w)) * 0.6, L); limb(hipX, hipY, -sw, -sw - Math.max(0, Math.sin(w)) * 0.6, L); }
          else if (low && pose !== "sit") { limb(hipX, hipY, 1.2, 0, L); limb(hipX, hipY, -0.3, 1.6, L * 0.9); }           // in ginocchio
          else if (pose === "sit") { const r = Math.sin(phase * 1.2) * 0.1; limb(hipX, hipY, 1.4 + r, 0.2, L); limb(hipX, hipY, 1.1 + r, 0, L); }
          else { limb(hipX, hipY, 0.08, 0.02, L); limb(hipX, hipY, -0.08, -0.02, L); }
          // busto e testa
          seg([[hipX, hipY], [shX, shY + cpr]]);
          ctx.beginPath(); ctx.arc(shX + lean * 0.2, shY - h * 0.1 + cpr, h * 0.11, 0, Math.PI * 2); ctx.fill();
          // braccia
          const A = h * 0.17, sy = shY + cpr;
          if (pose === "carry") { limb(shX, sy, 0.9, 1.3, A); limb(shX, sy, 0.8, 1.2, A); }
          else if (walking) { const sw = Math.sin(w + Math.PI) * 0.45; limb(shX, sy, sw, sw + 0.3, A); limb(shX, sy, -sw, -sw + 0.3, A); }
          else if (pose === "kneel") { limb(shX, sy, 0.6, 0.2, A); limb(shX, sy, 0.5, 0.1, A); }                   // massaggio cardiaco
          else if (pose === "cut") { const c = Math.sin(phase * 14) * 0.35; limb(shX, sy, 1.1 + c, 1.5 + c, A); limb(shX, sy, 0.9 - c, 1.4 - c, A); }
          else if (pose === "spray") { limb(shX, sy, 1.4, 1.5, A); limb(shX, sy, 1.2, 1.5, A); }
          else if (pose === "wave") { const c = Math.sin(phase * 7) * 0.5; limb(shX, sy, Math.PI - 0.4 + c, Math.PI - 0.1 + c, A); limb(shX, sy, -0.2, -0.1, A); }
          else if (pose === "film") {
            limb(shX, sy, Math.PI - 0.9, Math.PI - 0.6, A); limb(shX, sy, -0.15, -0.1, A);
            if (Math.floor(phase * 2) % 3 === 0) { ctx.fillStyle = "#FEF9C3"; ctx.fillRect(shX + A * 1.2, sy - A * 1.5, 2, 2); }
          }
          else if (pose === "sit") { limb(shX, sy, 0.7, 1.2, A); limb(shX, sy, 0.5, 1.0, A); }
          else { const radio = Math.max(0, Math.sin(phase * 0.5)) ** 8; limb(shX, sy, 0.15 + radio * 2.5, 0.1 + radio * 3.3, A); limb(shX, sy, -0.15, -0.05, A); }
        } });
      };
      for (const pr2 of props) addBox({ c: pr2.c, s: pr2.s, yaw: pr2.yaw ?? 0, fill: pr2.fill, edge: pr2.edge });
      for (const fl of flashes) { const q = P(fl); if (q) draws.push({ z: q[2] - 1, fn: () => { ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.beginPath(); ctx.arc(q[0], q[1], 9, 0, Math.PI * 2); ctx.fill(); } }); }
      for (const st of stretchers) {
        const a = P([st.a[0], 1.0, st.a[2]]), b = P([st.b[0], 1.0, st.b[2]]); if (!a || !b) continue;
        draws.push({ z: (a[2] + b[2]) / 2 - 0.6, fn: () => {
          ctx.strokeStyle = st.color ?? "rgba(241,245,249,.95)"; ctx.lineWidth = Math.max(2, (f / a[2]) * 0.5);
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
          if (st.loaded) {
            ctx.strokeStyle = "#F87171"; ctx.lineWidth = Math.max(1.5, (f / a[2]) * 0.35);
            ctx.beginPath(); ctx.moveTo(a[0] + (b[0] - a[0]) * 0.15, a[1] - 2); ctx.lineTo(b[0] - (b[0] - a[0]) * 0.1, b[1] - 2); ctx.stroke();
            ctx.fillStyle = "#F1F5F9"; ctx.beginPath(); ctx.arc(a[0] + (b[0] - a[0]) * 0.12, a[1] - 3, Math.max(1.5, (f / a[2]) * 0.3), 0, Math.PI * 2); ctx.fill();
          }
        } });
      }
      for (const pt of patients) {
        if (pt.hidden) continue;
        figure(pt.p, pt.pose, "rgba(241,245,249,.92)", t / 1000 + pt.ph);
        const tp = P([pt.p[0] + 0.4, pt.p[1] + (pt.pose === "lie" ? 1.2 : 3.4), pt.p[2]]);
        if (tp) draws.push({ z: tp[2] - 0.4, fn: () => {
          const pulse = pt.tri === "#EF4444" && !pt.busy ? 1 + 0.4 * Math.abs(Math.sin(t / 300)) : 1;
          ctx.fillStyle = pt.tri; ctx.beginPath(); ctx.arc(tp[0], tp[1], (pt.busy ? 3 : 2.3) * pulse, 0, Math.PI * 2); ctx.fill();
        } });
      }
      people.forEach((pp, k) => figure(pp.p, pp.pose, pp.col, t / 1000 + k * 0.7));
      // mezzi VVF
      for (const v of vvf) {
        const cs = Math.cos(v.h), sn = Math.sin(v.h);
        const part = (dx: number, dy: number, dz: number, w: number, h: number, dd: number, fill: string, edge = "#F87171") =>
          addBox({ c: [v.p[0] + dx * cs - dz * sn, dy, v.p[2] + dx * sn + dz * cs], s: [w, h, dd], yaw: v.h, fill, edge });
        const bl = Math.floor(t / 220) % 2 === 0 ? "rgba(59,130,246,.95)" : "rgba(147,197,253,.6)";
        part(2.8, 1.5, 0, 2.2, 2.6, 2.5, "rgba(220,38,38,.9)");                 // cabina
        part(3.95, 1.9, 0, 0.06, 0.9, 2.1, "rgba(56,189,248,.35)", "rgba(56,189,248,.6)");
        part(-1.6, 1.6, 0, 6.6, 2.8, 2.5, "rgba(220,38,38,.85)");              // cassone
        part(-1.6, 1.0, 1.27, 6.4, 0.3, 0.04, "rgba(250,250,250,.9)", "#FFF"); part(-1.6, 1.0, -1.27, 6.4, 0.3, 0.04, "rgba(250,250,250,.9)", "#FFF");
        part(2.8, 2.95, 0, 0.5, 0.25, 2.1, bl, bl);
        if (v.ladder) part(-1, 3.3, 0, 8.5, 0.35, 0.9, "rgba(203,213,225,.85)", "#CBD5E1"); // autoscala
        for (const x of [2.8, -3.6]) for (const z of [-1.3, 1.3]) part(x, 0.5, z, 1, 1, 0.35, "rgba(15,23,42,.9)", "rgba(15,23,42,.9)");
        const lp = P([v.p[0], 4.2, v.p[2]]);
        if (lp && cam.dist < 160) draws.push({ z: lp[2] - 1, fn: () => { ctx.font = "700 10px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#F87171"; ctx.fillText("VVF", lp[0], lp[1]); } });
      }
      firemen.forEach((fm, k) => figure(fm.p, fm.pose, "#F87171", t / 1000 + k * 0.9 + 3));
      // cordone: nastro della polizia, auto della polizia, curiosi che filmano
      if (!FIRE) { const tape: V3[] = []; for (let k = 0; k <= 40; k++) { const a = Math.PI * 1.05 + (k / 40) * Math.PI * 0.9; tape.push([Math.cos(a) * 58, 1, Math.sin(a) * 50]); }
        const tp = tape.map(P); if (tp.every(Boolean)) { ctx.setLineDash([6, 4]); ctx.strokeStyle = "rgba(250,204,21,.85)"; ctx.lineWidth = 1.4; ctx.beginPath(); tp.forEach((q, k) => (k ? ctx.lineTo(q![0], q![1] + Math.sin(t / 400 + k) * 0.6) : ctx.moveTo(q![0], q![1]))); ctx.stroke(); ctx.setLineDash([]); }
        const bys = rng(seed + 99);
        for (let k = 0; k < 12; k++) { const a = Math.PI * 1.1 + bys() * Math.PI * 0.8; const r = 62 + bys() * 6;
          const wob = Math.sin(t / 2500 + k) * 0.8; figure([Math.cos(a) * r + wob, 0, Math.sin(a) * (r - 8)], k % 3 === 0 ? "film" : k % 4 === 1 ? "walk" : "stand", "rgba(148,163,184,.9)", t / 1000 + k); }
        const pc: V3 = [-60, 0, -10]; const bl = Math.floor(t / 200) % 2 === 0;
        const pp = (dx: number, dy: number, dz: number, w: number, h: number, dd: number, fill: string, edge = "#93C5FD") => addBox({ c: [pc[0] + dx, dy, pc[2] + dz], s: [w, h, dd], yaw: 0.4, fill, edge });
        pp(0, 0.7, 0, 4.2, 1, 1.9, "rgba(30,58,138,.9)"); pp(-0.3, 1.5, 0, 2.2, 0.7, 1.7, "rgba(241,245,249,.8)"); pp(-0.3, 1.95, 0, 0.5, 0.2, 1.4, bl ? "rgba(59,130,246,.95)" : "rgba(147,197,253,.5)");
        figure([pc[0] + 3, 0, pc[2] + 3], "stand", "#93C5FD", t / 1000 + 7); }
      for (const fm of firemen) { const hp = P([fm.p[0], fm.pose === "kneel" ? 1.95 : 3.05, fm.p[2]]); if (hp) draws.push({ z: hp[2] - 0.7, fn: () => { ctx.fillStyle = "#FACC15"; ctx.fillRect(hp[0] - 2, hp[1] - 1, 4, 2); } }); }
      for (const sp of sparks) { const q = P(sp); if (q) draws.push({ z: q[2] - 0.8, fn: () => {
        ctx.strokeStyle = "#FDE047"; ctx.lineWidth = 1.2; ctx.beginPath();
        for (let k = 0; k < 7; k++) { const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 7; ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + Math.cos(a) * r, q[1] + Math.sin(a) * r - 2); }
        ctx.stroke(); } }); }
      for (const sp of sprays) {
        for (let k = 0; k < 14; k++) {
          const u = ((t / 900 + k / 14) % 1); const x = lerp3c(sp.from, sp.to, u); x[1] += Math.sin(u * Math.PI) * 6;
          const q = P(x); if (q) draws.push({ z: q[2] - 0.5, fn: () => { ctx.fillStyle = "rgba(125,211,252,.85)"; ctx.beginPath(); ctx.arc(q[0], q[1], 1.8, 0, Math.PI * 2); ctx.fill(); } });
        }
      }
      draws.sort((a, b) => b.z - a.z).forEach((x) => x.fn());

      // folla
      ctx.fillStyle = "rgba(241,245,249,.7)";
      for (const c of scene.crowd) { const q = P([c[0] + Math.sin(t / 900 + c[0]) * 0.4, 0.5, c[2]]); if (q) ctx.fillRect(q[0], q[1], 1.6, 1.6); }

      // fuoco, fumo, polvere
      if (FIRE && (d.fire?.intensity ?? 50) > 0) {
        const intens = (d.fire?.intensity ?? 50) / 100;
        for (const fr of front) if (particles.length < 520 && Math.random() < (fr.on ? 0.35 + intens * 0.4 : 0.12))
          particles.push(fr.on ? { p: [fr.p[0] + (Math.random() - 0.5) * 3, 0.5, fr.p[2] + (Math.random() - 0.5) * 3], v: [(Math.random() - 0.5) * 0.12, 0.3 + Math.random() * 0.2, (Math.random() - 0.5) * 0.12], life: 0, max: 14 + Math.random() * 8, kind: "fire" }
                               : { p: [fr.p[0], 0.5, fr.p[2]], v: [(Math.random() - 0.5) * 0.1, 0.2, (Math.random() - 0.5) * 0.1], life: 0, max: 40, kind: "steam" });
        for (const bt of burningTops) if (particles.length < 520 && Math.random() < 0.3) particles.push({ p: [bt[0] + (Math.random() - 0.5) * 2, bt[1], bt[2]], v: [0, 0.3, 0], life: 0, max: 16, kind: "fire" });
        if (particles.length < 540) for (let q = 0; q < 2; q++) particles.push({ p: [FIRE_C[0] + (Math.random() - 0.5) * fireR, 4, FIRE_C[2] + (Math.random() - 0.5) * fireR * 0.8], v: [0.05 + Math.random() * 0.08, 0.25, (Math.random() - 0.5) * 0.08], life: 0, max: 110, kind: "smoke" });
      }
      for (const e of scene.fx) if (particles.length < 260 && Math.random() < (e.kind === "fire" ? 0.9 : 0.5)) {
        particles.push({ p: [e.at[0] + (Math.random() - 0.5) * e.r, e.at[1], e.at[2] + (Math.random() - 0.5) * e.r],
          v: [(Math.random() - 0.5) * 0.15, e.kind === "fire" ? 0.35 : e.kind === "smoke" ? 0.22 : 0.08, (Math.random() - 0.5) * 0.15],
          life: 0, max: e.kind === "fire" ? 18 : 70, kind: e.kind });
      }
      for (let k = particles.length - 1; k >= 0; k--) {
        const q = particles[k]; q.life++; q.p = [q.p[0] + q.v[0] + 0.03, q.p[1] + q.v[1], q.p[2] + q.v[2]];
        if (q.life > q.max) { particles.splice(k, 1); continue; }
        const s = P(q.p); if (!s) continue; const u = q.life / q.max; const rad = (f / s[2]) * (q.kind === "fire" ? 1.8 : 3 + u * 6);
        ctx.fillStyle = q.kind === "fire" ? `rgba(255,${120 + Math.floor(u * 100)},40,${0.7 * (1 - u)})`
          : q.kind === "smoke" ? `rgba(60,70,85,${0.35 * (1 - u)})` : q.kind === "steam" ? `rgba(226,232,240,${0.3 * (1 - u)})`
          : q.kind === "water" ? `rgba(125,211,252,${0.8 * (1 - u)})` : `rgba(200,190,170,${0.18 * (1 - u)})`;
        ctx.beginPath(); ctx.arc(s[0], s[1], rad, 0, Math.PI * 2); ctx.fill();
      }
      if (scene.fog) { ctx.fillStyle = `rgba(180,195,215,${0.08 + 0.03 * Math.sin(t / 1500)})`; ctx.fillRect(0, H * 0.35, W, H * 0.4); }

      // HUD in alto a sinistra
      const dt = new Date(now);
      ctx.textAlign = "left"; ctx.font = "700 11px ui-monospace,monospace";
      const head = FIRE ? "INCENDIO BOSCHIVO · " : "MAXI EMERGENZA · ";
      ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.fillText(head, 14, 24);
      const tag = dt.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
      const w1 = ctx.measureText(head).width;
      ctx.fillStyle = "#E2E8F0"; ctx.fillRect(14 + w1, 13, ctx.measureText(tag).width + 6, 14);
      ctx.fillStyle = "#0B1A33"; ctx.fillText(tag, 17 + w1, 24);
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.fillText(dt.toLocaleTimeString("it-IT") + " · " + d.lat.toFixed(4) + "N " + d.lng.toFixed(4) + "E", 14, 40);
      ctx.fillStyle = WHITE; ctx.font = "800 12px ui-monospace,monospace";
      if (FIRE) {
        const inten = Math.round(d.fire?.intensity ?? 0), need = sev + 1;
        ctx.fillText(`MEZZI AIB ${onSite + coming} · SPENGONO ${fireOn} · IN ARRIVO ${coming} · A RIFORNIRSI ${away} · NE SERVONO ${need}`, 14, 58);
        const stato = inten === 0 ? "✅ DOMATO" : inten >= 70 ? "FUORI CONTROLLO" : fireOn >= need ? "IN SPEGNIMENTO" : "IN ESPANSIONE";
        ctx.fillStyle = inten === 0 ? "#22C55E" : inten >= 70 ? "#EF4444" : fireOn >= need ? "#FACC15" : "#F97316";
        ctx.fillText(`GRAVITÀ ${sev}/3 · INTENSITÀ ${inten}% · ${stato}`, 14, 75);
      } else {
      ctx.fillText(`MEZZI ${onSite + coming} · SUL POSTO ${onSite} · IN ARRIVO ${coming} · PMA ${pmaOn ? "ATTIVO" : "NO"}${hasPma ? "" : ` · VERSO/IN OSPEDALE ${away}`} · VVF ${vvf.length} · ESTRICATI ${extricated}/${patients.filter((q) => q.trapped).length}`, 14, 58);
      const remaining = Math.max(0, injured - transported); const red = Math.round(remaining * 0.15), yel = Math.round(remaining * 0.35), grn = remaining - red - yel;
      const left = Math.max(0, injured - transported);
      ctx.fillText(`FERITI ${left} · TRASPORTATI ${Math.min(injured, transported)} ·`, 14, 75);
      const wf = ctx.measureText(`FERITI ${left} · TRASPORTATI ${Math.min(injured, transported)} · `).width;
      ctx.fillStyle = "#EF4444"; ctx.fillText(`● ${red}`, 14 + wf, 75);
      ctx.fillStyle = "#FACC15"; ctx.fillText(`● ${yel}`, 14 + wf + 38, 75);
      ctx.fillStyle = "#22C55E"; ctx.fillText(`● ${grn}`, 14 + wf + 76, 75);
      }
      if (d.ends_at) {
        const rem = Math.max(0, Math.round((Date.parse(d.ends_at) - now) / 1000));
        ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.font = "700 11px ui-monospace,monospace";
        ctx.fillText(`FINE INTERVENTO TRA ${Math.floor(rem / 3600)}h ${String(Math.floor((rem % 3600) / 60)).padStart(2, "0")}m`, 14, 92);
      }
      if (modsOn.size) {
        const nm: Record<string, string> = { pma_tenda: "⛺ PMA", unita_logistica: "⚡ LOGISTICA", unita_cinofila: "🐕 CINOFILA", unita_droni: "🛸 DRONI" };
        ctx.fillStyle = "#FDE68A"; ctx.font = "700 11px ui-monospace,monospace";
        ctx.fillText("MODULI: " + [...modsOn].map((x) => nm[x] ?? x).join(" · "), 14, 109);
      }
      // mezzi fuori dalla scena (spola con l'ospedale, senza PMA)
      // elenchi a sinistra sotto i dati: mezzi in arrivo (con i minuti) e mezzi fuori scena
      let ly = 132; ctx.textAlign = "left"; ctx.font = "700 11px ui-monospace,monospace";
      if (comingList.length) {
        ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.fillText("🚨 IN ARRIVO SUL POSTO", 14, ly); ly += 15;
        comingList.sort((a, b) => a.ms - b.ms).slice(0, 8).forEach((x) => {
          const sec = Math.round(x.ms / 1000); ctx.fillStyle = "rgba(226,232,240,.9)";
          ctx.fillText(`${x.s} · ${sec >= 60 ? `${Math.floor(sec / 60)}' ${String(sec % 60).padStart(2, "0")}"` : `${sec}"`}`, 14, ly); ly += 15; });
        if (comingList.length > 8) { ctx.fillText(`+${comingList.length - 8}`, 14, ly); ly += 15; }
        ly += 6;
      }
      if (!hasPma && awayList.length) {
        ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.fillText(FIRE ? "💧 FUORI SCENA · SPOLA PER L'ACQUA" : `🏥 FUORI SCENA · ${hosp?.name ?? "OSPEDALE"}`, 14, ly); ly += 15;
        awayList.slice(0, 8).forEach((x) => { ctx.fillStyle = "rgba(226,232,240,.9)"; ctx.fillText(x, 14, ly); ly += 15; });
        if (awayList.length > 8) ctx.fillText(`+${awayList.length - 8}`, 14, ly);
      }

      // scritta grande animata (ultimo evento)
      while (captions.length > 1 && t - captions[0].at > 4500) captions.shift();
      const cap = captions[captions.length - 1];
      const age = t - cap.at;
      if (age < 4500) {
        const a = Math.min(1, age / 300) * Math.min(1, (4500 - age) / 500);
        ctx.globalAlpha = a; ctx.textAlign = "center";
        ctx.font = `900 ${Math.round(Math.min(W / 18, 30))}px system-ui,sans-serif`;
        const y = H * 0.82 - (1 - Math.min(1, age / 300)) * 10;
        if (cap.hi && cap.text.startsWith(cap.hi)) {
          const rest = cap.text.slice(cap.hi.length);
          const w2 = ctx.measureText(cap.hi).width, w3 = ctx.measureText(rest).width; const x0 = W / 2 - (w2 + w3) / 2;
          ctx.textAlign = "left"; ctx.fillStyle = ORANGE; ctx.fillText(cap.hi, x0, y); ctx.fillStyle = WHITE; ctx.fillText(rest, x0 + w2, y);
        } else { ctx.fillStyle = WHITE; ctx.fillText(cap.text, W / 2, y); }
        ctx.globalAlpha = 1;
      }
    }
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf); window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up); canvas.removeEventListener("wheel", wheel);
    };
  }, [data.id, data.title, serverOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={cv} style={{ width: "100%", height: "100%", display: "block", background: "#050B18" }} />;
}
