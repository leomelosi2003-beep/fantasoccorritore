"use client";
// Scena animata di una maxi emergenza in stile "radar / centrale operativa" 3D:
// griglia in prospettiva, scena stilizzata in bianco, mezzi con scie colorate e "velo" trasparente, HUD e scritte animate.
import { useEffect, useRef } from "react";

export type SceneVehicle = {
  id: string; call_sign: string; org_name: string; mine: boolean; status: string;
  assigned_at: string; arrives_at: string; completes_at?: string | null;
  base_lat: number | null; base_lng: number | null; automedica?: boolean; moto?: boolean; pma?: boolean; long?: boolean;
};
export type SceneData = {
  id: string; title: string; description?: string | null; lat: number; lng: number;
  created_at: string; ends_at?: string | null; status?: string; vehicles: SceneVehicle[];
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
type Fx = { kind: "fire" | "smoke" | "dust"; at: V3; r: number };

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
    default:
      rubble(0, 0, 30, 20); fx.push({ kind: "smoke", at: [0, 5, 0], r: 10 });
  }
  return { boxes, fx, lines, water, fog, crowd };
}

// posti auto nell'area mezzi e area PMA
const slot = (i: number): V3 => [-78 + (i % 6) * 12, 0, 40 + Math.floor(i / 6) * 13];
const PMA: [number, number, number, number] = [28, 34, 62, 62];
const pmaSlot = (i: number): V3 => [40 + (i % 2) * 14, 0, 40 + Math.floor(i / 2) * 9];
const sceneSpot = (i: number): V3 => [-14 + (i % 5) * 7, 0, 10 + Math.floor(i / 5) * 5];
type Cam = { yaw: number; el: number; dist: number; auto: boolean };
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
    c.tgtX = view === 3 ? 45 : 0; c.tgtZ = view === 3 ? 48 : 18;
  }, [view, viewKey]);

  useEffect(() => {
    const canvas = cv.current!; const ctx = canvas.getContext("2d")!;
    let raf = 0, last = 0;
    const seed = hash(data.id);
    const kind = scenarioOf(data.title);
    const scene = buildScene(kind, seed);
    const particles: { p: V3; v: V3; life: number; max: number; kind: Fx["kind"] }[] = [];
    const captions: { text: string; hi: string; at: number }[] = [{ text: data.title, hi: "", at: performance.now() }];
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

      // acqua (alluvione)
      if (scene.water) {
        const sh = 0.16 + 0.05 * Math.sin(t / 500);
        poly([[-80, 0.4, -50], [80, 0.4, -50], [80, 0.4, 30], [-80, 0.4, 30]], `rgba(108,180,255,.5)`, `rgba(40,120,220,${sh})`);
        for (let k = 0; k < 10; k++) { const z = -45 + k * 8, o = ((t / 60 + k * 13) % 160) - 80; const a = P([o, 0.5, z]), b = P([o + 10, 0.5, z]); if (a && b) { ctx.strokeStyle = "rgba(170,215,255,.35)"; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }
      }
      // linee della scena (binari, strade, tralicci)
      ctx.strokeStyle = "rgba(241,245,249,.55)"; ctx.lineWidth = 1.2;
      for (const [a3, b3] of scene.lines) { const a = P(a3), b = P(b3); if (a && b) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }

      // area PMA
      const [x1, z1, x2, z2] = PMA;
      ctx.setLineDash([5, 4]);
      poly([[x1, 0.1, z1], [x2, 0.1, z1], [x2, 0.1, z2], [x1, 0.1, z2]], "rgba(52,211,153,.8)", "rgba(52,211,153,.07)", 1.4);
      ctx.setLineDash([]);
      const pm = P([(x1 + x2) / 2, 0.2, (z1 + z2) / 2]);
      if (pm) { ctx.fillStyle = "rgba(52,211,153,.9)"; ctx.font = "700 11px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.fillText(d.vehicles.some((v) => v.pma) ? "AREA PMA" : "AREA PMA · NESSUN PMA", pm[0], pm[1]); }
      const st = P([-48, 0.2, 33]); if (st) { ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.font = "700 10px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.fillText("AREA MEZZI", st[0], st[1]); }

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

      // feriti a terra (posizioni fisse per questa maxi) e soccorritori
      const pr = rng(seed + 7);
      const patients = Array.from({ length: Math.min(14, 6 + (seed % 9)) }, (_, k) => ({
        p: [(pr() - 0.5) * 34, 0, 4 + pr() * 16] as V3, tri: k % 7 === 0 ? "#EF4444" : k % 3 === 0 ? "#FACC15" : "#22C55E", busy: false }));
      const people: { p: V3; pose: "walk" | "kneel" | "stand"; col: string }[] = [];

      // mezzi
      const vs = d.vehicles;
      const cLat = Math.cos((d.lat * Math.PI) / 180);
      let onSite = 0, coming = 0, pmaOn = 0, amb = 0, pmaIdx = 0;
      const hasPma = vs.some((v) => v.pma && Date.parse(v.arrives_at) <= now && v.status !== "conclusa");
      vs.forEach((veh, i) => {
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
        const myIdx = veh.pma ? pmaIdx++ : amb++;
        // i PMA vanno nell'area PMA; le ambulanze vanno sul luogo e, se c'è un PMA, fanno la spola coi feriti
        const end = veh.pma ? pmaSlot(myIdx % 6) : hasPma ? sceneSpot(myIdx % 20) : slot(myIdx % 30);
        const ctrl: V3 = [(start[0] + end[0]) / 2 + Math.cos(ang) * 30, 0, (start[2] + end[2]) / 2 + Math.sin(ang) * 30];
        const at = (u: number): V3 => [
          (1 - u) ** 2 * start[0] + 2 * (1 - u) * u * ctrl[0] + u * u * end[0], 0,
          (1 - u) ** 2 * start[2] + 2 * (1 - u) * u * ctrl[2] + u * u * end[2]];
        const ease = 1 - (1 - p) ** 2;
        let pos = at(ease); let heading = 0; let carrying = false;
        if (p < 1) { const nxt = at(Math.min(1, ease + 0.01)); heading = Math.atan2(nxt[0] - pos[0], nxt[2] - pos[2]) + Math.PI / 2; }
        else if (!veh.pma && hasPma) {
          // navetta: carica sul posto → PMA → torna (ciclo di 24 s, sfasato per mezzo)
          const cyc = ((now / 1000 + (hash(veh.id) % 24)) % 24) / 24;
          const pm: V3 = [31 + (myIdx % 4) * 2.5, 0, 58];
          const lerp = (u: number): V3 => [end[0] + (pm[0] - end[0]) * u, 0, end[2] + (pm[2] - end[2]) * u];
          if (cyc < 0.3) pos = end;
          else if (cyc < 0.5) { const u = (cyc - 0.3) / 0.2; pos = lerp(u); heading = Math.atan2(pm[0] - end[0], pm[2] - end[2]) + Math.PI / 2; carrying = true; }
          else if (cyc < 0.7) { pos = pm; carrying = true; }
          else { const u = (cyc - 0.7) / 0.3; pos = lerp(1 - u); heading = Math.atan2(end[0] - pm[0], end[2] - pm[2]) + Math.PI / 2; }
        }
        const col = veh.mine ? ORANGE : BLUE;
        // scia corta che svanisce: solo l'ultimo tratto dietro al mezzo, sparisce 6 s dopo l'arrivo
        const fade = p < 1 ? 1 : Math.max(0, 1 - (now - a1) / 6000);
        if (fade > 0) {
          const from = Math.max(0, ease - 0.22); const steps = 10; const trail: V3[] = [];
          for (let k = 0; k <= steps; k++) trail.push(at(from + ((ease - from) * k) / steps));
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
        // il mezzo: modellino diverso per tipo
        const small = veh.moto ? 0.5 : veh.automedica ? 0.75 : veh.pma ? 1.6 : 1;
        const blinkOn = Math.floor(t / 250) % 2 === 0;
        const part = (dx: number, dy: number, dz: number, w: number, h: number, dd: number, fill: string, edge = col) => {
          const cs = Math.cos(heading), sn = Math.sin(heading);
          addBox({ c: [pos[0] + dx * cs - dz * sn, dy, pos[2] + dx * sn + dz * cs], s: [w, h, dd], yaw: heading, fill, edge });
        };
        const bar = blinkOn ? "rgba(239,68,68,.95)" : "rgba(59,130,246,.95)";
        if (veh.pma) {
          part(3.6, 1.5, 0, 2, 2.8, 2.5, "rgba(241,245,249,.9)");          // cabina
          part(-1.6, 1.9, 0, 7.2, 3.4, 2.6, "rgba(52,211,153,.8)", "#34D399"); // cassone PMA
        } else if (veh.moto) {
          part(0, 0.6, 0, 2.2, 0.7, 0.5, "rgba(241,245,249,.9)");
          part(-0.1, 1.5, 0, 0.6, 1.1, 0.5, "rgba(255,90,54,.9)");              // motociclista
          part(-0.9, 1.1, 0, 0.3, 0.2, 0.6, bar, bar);
        } else if (veh.automedica) {
          part(0, 0.6, 0, 4.2, 1.1, 1.9, "rgba(241,245,249,.92)");           // scocca
          part(-0.3, 1.5, 0, 2.2, 0.8, 1.7, "rgba(148,163,184,.55)");        // abitacolo
          part(-0.3, 2.05, 0, 0.5, 0.25, 1.5, bar, bar);                     // lampeggiante
        } else {
          const L = veh.long ? 5.8 : 4.4;                                    // passo lungo più lungo
          part(-L / 2 + 0.6, 1.55, 0, L, 2.9, 2.4, "rgba(241,245,249,.92)"); // vano sanitario
          part(1.7, 1.1, 0, 1.6, 2.0, 2.3, "rgba(226,232,240,.85)");         // cabina
          part(-L / 2 + 0.6, 1.25, 1.25, L - 0.4, 0.35, 0.05, veh.mine ? "rgba(255,90,54,.9)" : "rgba(108,180,255,.9)"); // fascia laterale
          part(0.9, 3.1, 0, 0.5, 0.25, 2.0, bar, bar);                       // barra luci
        }
        if (veh.pma && p >= 1) {
          // tenda del PMA montata accanto al camion, con croce
          addBox({ c: [pos[0], 2, pos[2] + 7], s: [10, 4, 7], yaw: 0, fill: "rgba(52,211,153,.25)", edge: "rgba(52,211,153,.95)" });
          addBox({ c: [pos[0], 4.1, pos[2] + 7], s: [3, 0.1, 0.8], yaw: 0, fill: "rgba(239,68,68,.95)", edge: "#EF4444" });
          addBox({ c: [pos[0], 4.1, pos[2] + 7], s: [0.8, 0.1, 3], yaw: 0, fill: "rgba(239,68,68,.95)", edge: "#EF4444" });
        }
        // soccorritori al lavoro: dal mezzo al ferito, si inginocchiano, poi tornano (solo mezzi fermi sul posto)
        if (p >= 1 && !veh.pma && !carrying && patients.length) {
          const pt = patients[(hash(veh.id) >>> 3) % patients.length];
          const cyc = ((now / 1000 + (hash(veh.id) % 18)) % 18) / 18;
          for (let r = 0; r < (veh.moto ? 1 : 2); r++) {
            const side = r ? 1.2 : -1.2;
            const a: V3 = [pos[0] + side, 0, pos[2] + 1.5], bb: V3 = [pt.p[0] + side * 0.9, 0, pt.p[2] + 0.4];
            let x: V3 = a, pose: "walk" | "kneel" | "stand" = "stand";
            if (cyc < 0.2) { const u = cyc / 0.2; x = [a[0] + (bb[0] - a[0]) * u, 0, a[2] + (bb[2] - a[2]) * u]; pose = "walk"; }
            else if (cyc < 0.75) { x = bb; pose = "kneel"; pt.busy = true; }
            else if (cyc < 0.95) { const u = (cyc - 0.75) / 0.2; x = [bb[0] + (a[0] - bb[0]) * u, 0, bb[2] + (a[2] - bb[2]) * u]; pose = "walk"; }
            people.push({ p: x, pose, col: veh.mine ? "#FFB199" : "#BFE0FF" });
          }
        }
        const lp = P([pos[0], veh.pma ? 5 : veh.moto ? 2.4 : 3.6, pos[2]]);
        if (lp) draws.push({ z: lp[2] - 1, fn: () => {
          const blink = Math.floor(t / 250) % 2 === 0;
          ctx.fillStyle = blink ? "#EF4444" : "#3B82F6"; ctx.beginPath(); ctx.arc(lp[0], lp[1], 2.4, 0, Math.PI * 2); ctx.fill();
          ctx.font = "700 10px ui-monospace,monospace"; ctx.textAlign = "center";
          const eta = Math.max(0, Math.round((a1 - now) / 1000));
          const lab = p < 1 ? `${Math.floor(eta / 60)}:${String(eta % 60).padStart(2, "0")}` : veh.pma ? "PMA" : carrying ? "➜ PMA CON FERITO" : "SUL POSTO";
          ctx.fillStyle = WHITE; ctx.fillText(veh.call_sign.toUpperCase(), lp[0], lp[1] - 16);
          ctx.fillStyle = veh.pma ? "#34D399" : col; ctx.fillText(lab, lp[0], lp[1] - 5);
        } });
      });
      // figure stilizzate (feriti sdraiati, soccorritori che camminano o si inginocchiano)
      const figure = (p3: V3, pose: "walk" | "kneel" | "stand" | "lie", col: string, phase: number) => {
        const foot = P(p3), head = P([p3[0], pose === "kneel" ? 1.7 : 2.8, p3[2]]); if (!foot || !head) return;
        draws.push({ z: foot[2] - 0.5, fn: () => {
          const h = Math.max(3, foot[1] - head[1]); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(1, h / 9);
          if (pose === "lie") {
            const e = P([p3[0] + 2.6, 0.2, p3[2]]); if (!e) return;
            ctx.beginPath(); ctx.moveTo(foot[0], foot[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
            ctx.beginPath(); ctx.arc(e[0], e[1], Math.max(1.5, h / 9), 0, Math.PI * 2); ctx.fill(); return;
          }
          const bob = pose === "kneel" ? Math.sin(phase * 9) * h * 0.06 : 0; // massaggio cardiaco
          const hy = head[1] + bob, hip = foot[1] - h * (pose === "kneel" ? 0.25 : 0.45);
          ctx.beginPath(); ctx.arc(head[0], hy, h * 0.13, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(head[0], hy + h * 0.12); ctx.lineTo(foot[0], hip);
          const sw = pose === "walk" ? Math.sin(phase * 10) * h * 0.18 : 0;
          if (pose === "kneel") { ctx.moveTo(foot[0], hip); ctx.lineTo(foot[0] + h * 0.25, foot[1]); ctx.moveTo(head[0], hy + h * 0.3); ctx.lineTo(head[0] + h * 0.3, hy + h * 0.55 + bob); }
          else { ctx.moveTo(foot[0], hip); ctx.lineTo(foot[0] + sw, foot[1]); ctx.moveTo(foot[0], hip); ctx.lineTo(foot[0] - sw, foot[1]);
                 ctx.moveTo(head[0], hy + h * 0.3); ctx.lineTo(head[0] - sw * 0.7, hy + h * 0.55); }
          ctx.stroke();
        } });
      };
      for (const pt of patients) {
        figure(pt.p, "lie", "rgba(241,245,249,.9)", 0);
        const tp = P([pt.p[0] + 0.8, 1.2, pt.p[2]]);
        if (tp) draws.push({ z: tp[2] - 0.4, fn: () => { ctx.fillStyle = pt.tri; ctx.beginPath(); ctx.arc(tp[0], tp[1], pt.busy ? 3 : 2.2, 0, Math.PI * 2); ctx.fill(); } });
      }
      people.forEach((pp, k) => figure(pp.p, pp.pose, pp.col, t / 1000 + k));

      draws.sort((a, b) => b.z - a.z).forEach((x) => x.fn());

      // folla
      ctx.fillStyle = "rgba(241,245,249,.7)";
      for (const c of scene.crowd) { const q = P([c[0] + Math.sin(t / 900 + c[0]) * 0.4, 0.5, c[2]]); if (q) ctx.fillRect(q[0], q[1], 1.6, 1.6); }

      // fuoco, fumo, polvere
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
          : q.kind === "smoke" ? `rgba(60,70,85,${0.35 * (1 - u)})` : `rgba(200,190,170,${0.18 * (1 - u)})`;
        ctx.beginPath(); ctx.arc(s[0], s[1], rad, 0, Math.PI * 2); ctx.fill();
      }
      if (scene.fog) { ctx.fillStyle = `rgba(180,195,215,${0.08 + 0.03 * Math.sin(t / 1500)})`; ctx.fillRect(0, H * 0.35, W, H * 0.4); }

      // HUD in alto a sinistra
      const dt = new Date(now);
      ctx.textAlign = "left"; ctx.font = "700 11px ui-monospace,monospace";
      ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.fillText("MAXI EMERGENZA · ", 14, 24);
      const tag = dt.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
      const w1 = ctx.measureText("MAXI EMERGENZA · ").width;
      ctx.fillStyle = "#E2E8F0"; ctx.fillRect(14 + w1, 13, ctx.measureText(tag).width + 6, 14);
      ctx.fillStyle = "#0B1A33"; ctx.fillText(tag, 17 + w1, 24);
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.fillText(dt.toLocaleTimeString("it-IT") + " · " + d.lat.toFixed(4) + "N " + d.lng.toFixed(4) + "E", 14, 40);
      ctx.fillStyle = WHITE; ctx.font = "800 12px ui-monospace,monospace";
      ctx.fillText(`MEZZI ${onSite + coming} · SUL POSTO ${onSite} · IN ARRIVO ${coming} · PMA ${pmaOn ? "ATTIVO" : "NO"}`, 14, 58);
      const red = Math.round(injured * 0.15), yel = Math.round(injured * 0.35), grn = injured - red - yel;
      ctx.fillText(`FERITI ${injured} ·`, 14, 75);
      const wf = ctx.measureText(`FERITI ${injured} · `).width;
      ctx.fillStyle = "#EF4444"; ctx.fillText(`● ${red}`, 14 + wf, 75);
      ctx.fillStyle = "#FACC15"; ctx.fillText(`● ${yel}`, 14 + wf + 38, 75);
      ctx.fillStyle = "#22C55E"; ctx.fillText(`● ${grn}`, 14 + wf + 76, 75);
      if (d.ends_at) {
        const rem = Math.max(0, Math.round((Date.parse(d.ends_at) - now) / 1000));
        ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.font = "700 11px ui-monospace,monospace";
        ctx.fillText(`FINE INTERVENTO TRA ${Math.floor(rem / 3600)}h ${String(Math.floor((rem % 3600) / 60)).padStart(2, "0")}m`, 14, 92);
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
