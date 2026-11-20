"use client";
// Editor livrea: disegni sulla fiancata del mezzo (strisce, cerchi, linee, pennello, testo, scacchi, foto),
// scegli a quali sedi va, salvi: il gioco crea l'immagine e tutti vedono i tuoi mezzi con la nuova livrea.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPE } from "react";
import { useRouter } from "next/navigation";
import { supabase, friendlyError } from "@/lib/supabase";
import { gameConfirm } from "@/lib/confirm";
import { loadVehicleLiveries } from "@/lib/liveries";

type Kind = "rect" | "ellipse" | "line" | "path" | "text" | "image" | "checker";
type Item = {
  id: string; t: Kind; x: number; y: number; w: number; h: number; r: number;
  fill: string; stroke: string; sw: number; op: number;
  text?: string; bold?: boolean; src?: string; pts?: [number, number][]; c2?: string;
};
type Design = { v: 1; w: number; h: number; items: Item[] };
type Model = { id: string; name: string; image_url: string | null; boat: boolean };
type Livery = { id: string; model_id: string; name: string; design: Design; image_url: string | null; base_ids: string[] | null; updated_at: string };
type Base = { id: string; name: string; is_headquarters: boolean };

const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 1100, margin: "0 auto", padding: 12 };
const box: CSSProperties = { background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", marginBottom: 12 };
const btn: CSSProperties = { padding: "8px 12px", borderRadius: 10, border: "none", background: "#13294B", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 };
const tool: CSSProperties = { ...btn, background: "#fff", color: "#13294B", border: "1px solid #CBD5E1", padding: "7px 10px" };
const lbl: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 3 };
const uid = () => Math.random().toString(36).slice(2, 10);
const ERR: Record<string, string> = {
  LIVERY_TOO_MANY_PHOTOS: "Al massimo 5 foto per livrea.", LIVERY_TOO_BIG: "La livrea è troppo pesante: togli qualche forma o foto.",
  TOO_MANY_LIVERIES: "Hai già 40 livree: cancellane qualcuna.", NOT_YOUR_BASE: "Puoi scegliere solo le tue sedi.",
};
const errText = (m: string) => Object.entries(ERR).find(([k]) => m.includes(k))?.[1] ?? friendlyError(m);

// ---------- livree pronte da cui partire (posizioni in proporzione al mezzo) ----------
const R = (W: number, H: number, x: number, y: number, w: number, h: number, fill: string, extra: Partial<Item> = {}): Item =>
  ({ id: uid(), t: "rect", x: x * W, y: y * H, w: w * W, h: h * H, r: 0, fill, stroke: "#000", sw: 0, op: 1, ...extra });
const CK = (W: number, H: number, y: number, h: number, a: string, b: string): Item =>
  ({ id: uid(), t: "checker", x: 0, y: y * H, w: W, h: h * H, r: 0, fill: a, c2: b, stroke: "#000", sw: 0, op: 1 });
const PRESETS: { name: string; make: (W: number, H: number) => Item[] }[] = [
  { name: "🟧 Classica arancio (118)", make: (W, H) => [R(W, H, 0, 0.52, 1, 0.075, "#F97316"), CK(W, H, 0.72, 0.05, "#F97316", "#FACC15"), CK(W, H, 0.16, 0.035, "#F97316", "#FACC15")] },
  { name: "🟦 Blu e gialla", make: (W, H) => [R(W, H, 0, 0.52, 1, 0.075, "#1E3A8A"), CK(W, H, 0.72, 0.05, "#1E3A8A", "#FACC15"), CK(W, H, 0.16, 0.035, "#FACC15", "#1E3A8A")] },
  { name: "🟥 Rossa e bianca", make: (W, H) => [R(W, H, 0, 0.52, 1, 0.075, "#DC2626"), CK(W, H, 0.72, 0.05, "#DC2626", "#FFFFFF"), R(W, H, 0, 0.17, 1, 0.025, "#DC2626")] },
  { name: "🟩 Verde e gialla", make: (W, H) => [R(W, H, 0, 0.52, 1, 0.075, "#16A34A"), CK(W, H, 0.72, 0.05, "#16A34A", "#FACC15"), CK(W, H, 0.16, 0.035, "#16A34A", "#FACC15")] },
  { name: "🏁 Scacchi grandi (Battenburg)", make: (W, H) => [CK(W, H, 0.5, 0.2, "#FACC15", "#16A34A"), R(W, H, 0, 0.16, 1, 0.03, "#16A34A")] },
  { name: "⚡ Sportiva a righe oblique", make: (W, H) => [R(W, H, 0, 0.58, 1, 0.06, "#1D4ED8"),
      R(W, H, 0.55, 0.3, 0.06, 0.55, "#F97316", { r: 25 }), R(W, H, 0.63, 0.3, 0.03, 0.55, "#FACC15", { r: 25 }), R(W, H, 0.68, 0.3, 0.015, 0.55, "#1D4ED8", { r: 25 })] },
  { name: "➖ Elegante a doppia linea", make: (W, H) => [R(W, H, 0, 0.56, 1, 0.02, "#13294B"), R(W, H, 0, 0.6, 1, 0.008, "#F59E0B")] },
  { name: "🚨 Fascia larga con scritta", make: (W, H) => [R(W, H, 0, 0.5, 1, 0.13, "#F97316"),
      { id: uid(), t: "text", x: W * 0.3, y: H * 0.515, w: W * 0.4, h: H * 0.1, r: 0, fill: "#FFFFFF", stroke: "#000", sw: 0, op: 1, text: "AMBULANZA", bold: true }] },
];

// ---------- immagine "bianca" del mezzo: tolgo i colori della livrea ufficiale, tengo ombre, vetri e ruote ----------
async function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
function blankOf(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
  const W = c.width, H = c.height;
  const d = g.getImageData(0, 0, W, H); const p = d.data;
  // bianco della carrozzeria (mediana dei pixel chiari e grigi), per ridipingere le strisce dello stesso bianco
  const hist = new Array(256).fill(0); let nb = 0;
  for (let i = 0; i < p.length; i += 4) {
    const mx = Math.max(p[i], p[i + 1], p[i + 2]), mn = Math.min(p[i], p[i + 1], p[i + 2]);
    if (p[i + 3] > 200 && mx > 190 && (mx - mn) / mx < 0.08) { hist[mx]++; nb++; }
  }
  let w0 = 240, acc = 0;
  for (let v = 0; v < 256 && nb; v++) { acc += hist[v]; if (acc >= nb / 2) { w0 = v; break; } }
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const r = p[i], gg = p[i + 1], b = p[i + 2];
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dl = mx - mn, s = mx ? dl / mx : 0;
    if (!((s >= 0.15 && mx >= 95) || (s >= 0.45 && mx >= 45))) continue;
    let h = 0;
    if (mx === r) h = ((gg - b) / dl) % 6; else if (mx === gg) h = (b - r) / dl + 2; else h = (r - gg) / dl + 4;
    h = (h * 60 + 360) % 360;
    const px = (i / 4) % W, py = Math.floor(i / 4 / W);
    if (py < 0.2 * H && h >= 190 && h <= 260) continue;                          // lampeggianti blu sul tetto
    if ((h < 12 || h > 345) && s > 0.5 && px > 0.93 * W) continue;              // fanali posteriori rossi
    p[i] = w0; p[i + 1] = w0; p[i + 2] = w0;                                    // ogni colore della livrea → bianco
  }
  g.putImageData(d, 0, 0);
  return c;
}

// ---------- dove si può dipingere: solo la carrozzeria (niente vetri, cerchioni, fanali, gomme, pavimento) ----------
function paintMaskOf(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
  const W = c.width, H = c.height, N = W * H;
  const p = g.getImageData(0, 0, W, H).data;
  const mx = new Uint8Array(N), al = new Uint8Array(N), sat = new Float32Array(N), hue = new Float32Array(N);
  const hist = new Array(256).fill(0); let nb = 0;
  for (let k = 0, i = 0; k < N; k++, i += 4) {
    const r = p[i], gg = p[i + 1], b = p[i + 2], M = Math.max(r, gg, b), m = Math.min(r, gg, b), d = M - m;
    mx[k] = M; al[k] = p[i + 3]; sat[k] = M ? d / M : 0;
    let h = 0; if (d) { if (M === r) h = ((gg - b) / d) % 6; else if (M === gg) h = (b - r) / d + 2; else h = (r - gg) / d + 4; h = (h * 60 + 360) % 360; }
    hue[k] = h;
    if (al[k] > 200 && M > 190 && sat[k] < 0.08) { hist[M]++; nb++; }
  }
  let w0 = 240, acc = 0; for (let v = 0; v < 256 && nb; v++) { acc += hist[v]; if (acc >= nb / 2) { w0 = v; break; } }
  const cand = new Uint8Array(N), dark = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    const x = k % W, y = (k / W) | 0, h = hue[k], s = sat[k], M = mx[k];
    const blueLight = y < 0.2 * H && h >= 190 && h <= 260, tail = (h < 12 || h > 345) && s > 0.5 && x > 0.93 * W;
    const liv = al[k] > 0 && !blueLight && !tail && ((s >= 0.15 && M >= 95) || (s >= 0.45 && M >= 45));
    cand[k] = al[k] > 200 && (liv || (s < 0.15 && M >= 0.62 * w0)) ? 1 : 0;
    dark[k] = M < 80 && al[k] > 100 ? 1 : 0;
  }
  // componenti connesse (4 vicini) di una maschera dentro un rettangolo di righe
  const label = (mask: Uint8Array, y0: number) => {
    const lab = new Int32Array(N); const comps: { n: number; x0: number; x1: number; y0: number; y1: number; edge: boolean }[] = [{ n: 0, x0: 0, x1: 0, y0: 0, y1: 0, edge: false }];
    const st: number[] = [];
    for (let k = y0 * W; k < N; k++) {
      if (!mask[k] || lab[k]) continue;
      const id = comps.length; const cp = { n: 0, x0: W, x1: 0, y0: H, y1: 0, edge: false }; comps.push(cp);
      lab[k] = id; st.push(k);
      while (st.length) {
        const q = st.pop()!; const x = q % W, y = (q / W) | 0;
        cp.n++; if (x < cp.x0) cp.x0 = x; if (x > cp.x1) cp.x1 = x; if (y < cp.y0) cp.y0 = y; if (y > cp.y1) cp.y1 = y;
        if (x === 0 || x === W - 1 || y === y0 || y === H - 1) cp.edge = true;
        const nb4 = [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, y > y0 ? q - W : -1, y < H - 1 ? q + W : -1];
        for (const t of nb4) if (t >= 0 && mask[t] && !lab[t]) { lab[t] = id; st.push(t); }
      }
    }
    return { lab, comps };
  };
  // cerchioni: zone chiare chiuse dentro le gomme, tonde, nella metà bassa
  const y0 = Math.floor(0.45 * H);
  const notDark = new Uint8Array(N); for (let k = y0 * W; k < N; k++) notDark[k] = dark[k] ? 0 : 1;
  const w = label(notDark, y0);
  const wheelIds = new Set<number>();
  w.comps.forEach((cp, id) => { if (!id || cp.edge) return; const hh = cp.y1 - cp.y0 + 1, ww = cp.x1 - cp.x0 + 1; if (ww / hh >= 0.6 && ww / hh <= 1.7 && hh >= 0.08 * H) wheelIds.add(id); });
  if (wheelIds.size) for (let k = y0 * W; k < N; k++) if (wheelIds.has(w.lab[k])) {
    const x = k % W, y = (k / W) | 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < W && yy >= 0 && yy < H) cand[yy * W + xx] = 0; }
  }
  // sfondo rimasto sotto la carrozzeria: dal fondo, saltata l'ombra a terra, si toglie il chiaro fino al primo scuro
  for (let x = 0; x < W; x++) {
    let phase = 0;
    for (let y = H - 1; y >= Math.floor(H * 0.78); y--) {
      const k = y * W + x; if (al[k] < 10) continue;
      if (!phase) { if (cand[k]) { phase = 1; cand[k] = 0; } else if (y < H * 0.92) break; }
      else if (cand[k]) cand[k] = 0; else break;
    }
  }
  // solo le zone grandi (via fanali, riflessi, maniglie)
  const b = label(cand, 0);
  const out = g.createImageData(W, H);
  for (let k = 0; k < N; k++) if (cand[k] && b.comps[b.lab[k]].n >= 0.004 * N) out.data[k * 4 + 3] = 255;
  g.putImageData(out, 0, 0);
  return c;
}

// ---------- disegno delle forme ----------
const imgCache = new Map<string, HTMLImageElement>();
function drawItems(g: CanvasRenderingContext2D, items: Item[]) {
  for (const it of items) {
    g.save();
    g.globalAlpha = it.op;
    const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
    if (it.t === "line") {
      g.strokeStyle = it.stroke; g.lineWidth = Math.max(1, it.sw); g.lineCap = "round";
      g.beginPath(); g.moveTo(it.x, it.y); g.lineTo(it.x + it.w, it.y + it.h); g.stroke();
    } else if (it.t === "path") {
      const pts = it.pts ?? [];
      if (pts.length > 1) {
        g.strokeStyle = it.stroke; g.lineWidth = Math.max(1, it.sw); g.lineCap = "round"; g.lineJoin = "round";
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts.slice(1)) g.lineTo(x, y); g.stroke();
      }
    } else {
      g.translate(cx, cy); g.rotate((it.r * Math.PI) / 180);
      const w = Math.abs(it.w), h = Math.abs(it.h);
      if (it.t === "rect") {
        if (it.fill !== "none") { g.fillStyle = it.fill; g.fillRect(-w / 2, -h / 2, w, h); }
        if (it.sw > 0) { g.strokeStyle = it.stroke; g.lineWidth = it.sw; g.strokeRect(-w / 2, -h / 2, w, h); }
      } else if (it.t === "ellipse") {
        g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
        if (it.fill !== "none") { g.fillStyle = it.fill; g.fill(); }
        if (it.sw > 0) { g.strokeStyle = it.stroke; g.lineWidth = it.sw; g.stroke(); }
      } else if (it.t === "checker") {
        const cell = h / 2, n = Math.max(1, Math.round(w / cell));
        const cw = w / n;
        for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
          g.fillStyle = (i + j) % 2 ? (it.c2 ?? "#1D4ED8") : it.fill;
          g.fillRect(-w / 2 + i * cw, -h / 2 + j * cell, cw + 0.5, cell + 0.5);
        }
      } else if (it.t === "text") {
        g.fillStyle = it.fill; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = `${it.bold ? "900 " : "600 "}${Math.max(6, h * 0.82)}px Arial, sans-serif`;
        const tw = g.measureText(it.text ?? "").width || 1;
        g.save(); g.scale(w / tw, 1); g.fillText(it.text ?? "", 0, 0); g.restore();
        if (it.sw > 0) { g.strokeStyle = it.stroke; g.lineWidth = it.sw; g.save(); g.scale(w / tw, 1); g.strokeText(it.text ?? "", 0, 0); g.restore(); }
      } else if (it.t === "image" && it.src) {
        const im = imgCache.get(it.src);
        if (im?.complete) g.drawImage(im, -w / 2, -h / 2, w, h);
      }
    }
    g.restore();
  }
}
/** livrea finale: le forme stanno solo sulla sagoma, e vetri/ruote/ombre restano visibili sopra (moltiplica) */
function compose(blank: HTMLCanvasElement, items: Item[], paint?: HTMLCanvasElement | null): HTMLCanvasElement {
  const W = blank.width, H = blank.height;
  const d = document.createElement("canvas"); d.width = W; d.height = H;
  const dg = d.getContext("2d")!; drawItems(dg, items);
  dg.globalCompositeOperation = "destination-in"; dg.drawImage(paint ?? blank, 0, 0);
  const o = document.createElement("canvas"); o.width = W; o.height = H;
  const og = o.getContext("2d")!;
  og.drawImage(blank, 0, 0);
  og.globalCompositeOperation = "multiply"; og.drawImage(d, 0, 0);
  og.globalCompositeOperation = "destination-in"; og.drawImage(blank, 0, 0);
  return o;
}
const bbox = (it: Item) => {
  if (it.t === "path" && it.pts?.length) {
    const xs = it.pts.map((p) => p[0]), ys = it.pts.map((p) => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  return { x: Math.min(it.x, it.x + it.w), y: Math.min(it.y, it.y + it.h), w: Math.abs(it.w), h: Math.abs(it.h) };
};

export default function LiveryEditor() {
  const router = useRouter();
  const [org, setOrg] = useState<{ id: string; name: string } | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [bases, setBases] = useState<Base[]>([]);
  const [lvs, setLvs] = useState<Livery[]>([]);
  const [modelId, setModelId] = useState<string>("");
  const [cur, setCur] = useState<Livery | null>(null);          // livrea aperta (null = nuova)
  const [name, setName] = useState("La mia livrea");
  const [allBases, setAllBases] = useState(true);
  const [pick, setPick] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<"select" | "brush" | "pick">("select");
  const [brush, setBrush] = useState({ color: "#1D4ED8", size: 10 });
  const [blank, setBlank] = useState<HTMLCanvasElement | null>(null);
  const [paint, setPaint] = useState<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tick, setTick] = useState(0);
  const undo = useRef<Item[][]>([]); const redo = useRef<Item[][]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ kind: "move" | "size" | "brush"; id: string; sx: number; sy: number; orig: Item } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const W = blank?.width ?? 900, H = blank?.height ?? 400;
  const model = models.find((m) => m.id === modelId) ?? null;

  // ---------- caricamento ----------
  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); return; }
    const { data: o } = await supabase.from("organizations").select("id,name").eq("owner_id", session.user.id).maybeSingle();
    if (!o) { router.replace("/onboarding"); return; }
    setOrg(o as { id: string; name: string });
    const [ms, vs, bs, ls] = await Promise.all([
      supabase.from("vehicle_models").select("id,name,image_url,boat").eq("is_active", true).order("name"),
      supabase.from("vehicles").select("model_id").eq("org_id", o.id),
      supabase.from("bases").select("id,name,is_headquarters").eq("org_id", o.id).order("built_at"),
      supabase.rpc("my_liveries"),
    ]);
    const mm = ((ms.data as Model[]) ?? []).filter((m) => m.image_url && !m.image_url.includes("h-pegaso"));
    const cnt: Record<string, number> = {};
    for (const v of (vs.data as { model_id: string }[]) ?? []) cnt[v.model_id] = (cnt[v.model_id] ?? 0) + 1;
    mm.sort((a, b) => (cnt[b.id] ?? 0) - (cnt[a.id] ?? 0) || a.name.localeCompare(b.name));
    setModels(mm); setOwned(cnt);
    setBases((bs.data as Base[]) ?? []);
    setLvs((ls.data as Livery[]) ?? []);
    setModelId((m) => m || mm[0]?.id || "");
  }, [router]);
  useEffect(() => { load(); }, [load]);

  // immagine base del modello scelto
  useEffect(() => {
    if (!model?.image_url) return;
    let ok = true;
    loadImg(model.image_url).then((img) => { if (ok) { setPaint(paintMaskOf(img)); setBlank(blankOf(img)); } }).catch(() => setMsg({ ok: false, text: "Immagine del mezzo non trovata." }));
    return () => { ok = false; };
  }, [model?.image_url]);

  // foto delle forme: caricate una volta
  useEffect(() => {
    for (const it of items) if (it.t === "image" && it.src && !imgCache.has(it.src)) {
      const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => setTick((n) => n + 1); im.src = it.src; imgCache.set(it.src, im);
    }
  }, [items]);

  // anteprima
  useEffect(() => {
    const c = canvasRef.current; if (!c || !blank) return;
    c.width = W; c.height = H;
    const g = c.getContext("2d")!; g.clearRect(0, 0, W, H);
    g.drawImage(compose(blank, items, paint), 0, 0);
  }, [blank, paint, items, tick, W, H]);

  // colori già usati nella livrea (per il pennello e per le forme)
  const used = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) for (const c of [it.fill, it.stroke, it.c2]) if (c && c !== "none" && /^#[0-9a-f]{6}$/i.test(c)) set.add(c.toLowerCase());
    for (const c of ["#f97316", "#facc15", "#1d4ed8", "#1e3a8a", "#dc2626", "#16a34a", "#ffffff", "#111827"]) set.add(c);
    return Array.from(set).slice(0, 18);
  }, [items]);
  const myLvs = useMemo(() => lvs.filter((l) => l.model_id === modelId), [lvs, modelId]);

  // ---------- modifiche con annulla ----------
  const commit = useCallback((next: Item[]) => {
    undo.current.push(items); if (undo.current.length > 60) undo.current.shift();
    redo.current = []; setItems(next);
  }, [items]);
  const patch = (id: string, p: Partial<Item>) => commit(items.map((it) => (it.id === id ? { ...it, ...p } : it)));
  const selected = items.find((i) => i.id === sel) ?? null;

  function openLivery(l: Livery | null) {
    setCur(l); setSel(null); undo.current = []; redo.current = [];
    if (l) {
      setName(l.name); setAllBases(!l.base_ids); setPick(l.base_ids ?? []);
      const d = l.design;
      const sx = d?.w ? W / d.w : 1, sy = d?.h ? H / d.h : 1;
      setItems(scaleItems(d?.items ?? [], sx, sy));
    } else { setName("La mia livrea"); setAllBases(true); setPick([]); setItems([]); }
  }
  function scaleItems(list: Item[], sx: number, sy: number): Item[] {
    if (sx === 1 && sy === 1) return list.map((i) => ({ ...i }));
    return list.map((i) => ({ ...i, id: uid(), x: i.x * sx, y: i.y * sy, w: i.w * sx, h: i.h * sy, sw: i.sw * Math.min(sx, sy),
      pts: i.pts?.map(([x, y]) => [x * sx, y * sy] as [number, number]) }));
  }
  function copyFrom(id: string) {
    const l = lvs.find((x) => x.id === id); if (!l) return;
    const d = l.design; const sx = d?.w ? W / d.w : 1, sy = d?.h ? H / d.h : 1;
    commit(scaleItems(d?.items ?? [], sx, sy));
    setMsg({ ok: true, text: `Copiato «${l.name}». Sistemalo e premi Salva.` });
  }

  // ---------- nuove forme ----------
  function add(t: Kind) {
    const base: Item = { id: uid(), t, x: W * 0.3, y: H * 0.4, w: W * 0.25, h: H * 0.15, r: 0, fill: "#F97316", stroke: "#111827", sw: 0, op: 1 };
    const it: Item =
      t === "rect" ? { ...base, x: W * 0.05, y: H * 0.5, w: W * 0.9, h: H * 0.07 } :
      t === "ellipse" ? { ...base, x: W * 0.4, y: H * 0.3, w: H * 0.25, h: H * 0.25, fill: "#DC2626" } :
      t === "line" ? { ...base, x: W * 0.1, y: H * 0.35, w: W * 0.8, h: 0, sw: 8, stroke: "#1D4ED8" } :
      t === "checker" ? { ...base, x: W * 0.05, y: H * 0.62, w: W * 0.9, h: H * 0.06, fill: "#FACC15", c2: "#1D4ED8" } :
      t === "text" ? { ...base, x: W * 0.3, y: H * 0.42, w: W * 0.4, h: H * 0.09, fill: "#1D4ED8", text: "AMBULANZA", bold: true } : base;
    commit([...items, it]); setSel(it.id); setMode("select");
  }
  async function addPhoto(file: File) {
    if (!org) return;
    if (items.filter((i) => i.t === "image").length >= 5) { setMsg({ ok: false, text: ERR.LIVERY_TOO_MANY_PHOTOS }); return; }
    setBusy(true);
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("immagine non valida"))), "image/png"));
      const path = `${org.id}/livrea-foto-${Date.now()}.png`;
      const { error } = await supabase.storage.from("org-logos").upload(path, blob, { contentType: "image/png", upsert: true });
      if (error) throw error;
      const src = supabase.storage.from("org-logos").getPublicUrl(path).data.publicUrl;
      const h = H * 0.3, w = (h * c.width) / c.height;
      const it: Item = { id: uid(), t: "image", x: W * 0.4, y: H * 0.3, w, h, r: 0, fill: "none", stroke: "#000", sw: 0, op: 1, src };
      commit([...items, it]); setSel(it.id); setMode("select");
    } catch (e) { setMsg({ ok: false, text: "Foto non caricata: " + String((e as Error).message ?? e) }); }
    setBusy(false);
  }

  // ---------- mouse e dita ----------
  const toImg = (e: RPE) => {
    const r = svgRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H] as [number, number];
  };
  function down(e: RPE<SVGSVGElement>) {
    if (!blank) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const [x, y] = toImg(e);
    if (mode === "pick") {   // contagocce: prende il colore dal mezzo e lo dà al pennello (e alla forma scelta)
      const px = canvasRef.current?.getContext("2d")?.getImageData(Math.max(0, Math.min(W - 1, Math.round(x))), Math.max(0, Math.min(H - 1, Math.round(y))), 1, 1).data;
      if (px && px[3] > 0) {
        const hex = "#" + [px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
        setBrush((b) => ({ ...b, color: hex }));
        if (selected) patch(selected.id, ["line", "path"].includes(selected.t) ? { stroke: hex } : { fill: hex });
        setMsg({ ok: true, text: `💧 Colore preso: ${hex}. Ora il pennello usa questo colore.` });
        setMode(selected ? "select" : "brush");
      }
      return;
    }
    if (mode === "brush") {
      const it: Item = { id: uid(), t: "path", x, y, w: 0, h: 0, r: 0, fill: "none", stroke: brush.color, sw: brush.size, op: 1, pts: [[x, y]] };
      undo.current.push(items); redo.current = [];
      setItems([...items, it]); drag.current = { kind: "brush", id: it.id, sx: x, sy: y, orig: it }; return;
    }
    const handle = (e.target as Element).getAttribute?.("data-h");
    if (handle && selected) { drag.current = { kind: "size", id: selected.id, sx: x, sy: y, orig: { ...selected } }; undo.current.push(items); return; }
    const hit = [...items].reverse().find((it) => { const b = bbox(it); const pad = Math.max(8, it.sw); return x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad; });
    setSel(hit?.id ?? null);
    if (hit) { drag.current = { kind: "move", id: hit.id, sx: x, sy: y, orig: { ...hit, pts: hit.pts?.map((p) => [...p] as [number, number]) } }; undo.current.push(items); redo.current = []; }
  }
  function move(e: RPE<SVGSVGElement>) {
    const d = drag.current; if (!d) return;
    const [x, y] = toImg(e); const dx = x - d.sx, dy = y - d.sy;
    setItems((list) => list.map((it) => {
      if (it.id !== d.id) return it;
      if (d.kind === "brush") return { ...it, pts: [...(it.pts ?? []), [x, y] as [number, number]] };
      if (d.kind === "move") return { ...it, x: d.orig.x + dx, y: d.orig.y + dy, pts: d.orig.pts?.map(([px, py]) => [px + dx, py + dy] as [number, number]) };
      // ridimensiona dall'angolo in basso a destra
      if (it.t === "path") {
        const b = bbox(d.orig); const sx = Math.max(0.05, (b.w + dx) / (b.w || 1)), sy = Math.max(0.05, (b.h + dy) / (b.h || 1));
        return { ...it, pts: d.orig.pts?.map(([px, py]) => [b.x + (px - b.x) * sx, b.y + (py - b.y) * sy] as [number, number]) };
      }
      if (it.t === "line") return { ...it, w: d.orig.w + dx, h: d.orig.h + dy };
      const keep = it.t === "image" && !e.shiftKey ? d.orig.h / (d.orig.w || 1) : null;
      const nw = Math.max(6, d.orig.w + dx);
      return { ...it, w: nw, h: keep ? nw * keep : Math.max(4, d.orig.h + dy) };
    }));
  }
  function up() {
    const d = drag.current; drag.current = null;
    if (d?.kind === "brush") setItems((list) => list.map((it) => (it.id === d.id ? { ...it, ...bbox(it) } : it)));
  }
  function doUndo() { const p = undo.current.pop(); if (p) { redo.current.push(items); setItems(p); } }
  function doRedo() { const n = redo.current.pop(); if (n) { undo.current.push(items); setItems(n); } }
  function layer(dir: 1 | -1) {
    if (!selected) return; const i = items.findIndex((x) => x.id === selected.id); const j = i + dir;
    if (j < 0 || j >= items.length) return; const n = [...items]; [n[i], n[j]] = [n[j], n[i]]; commit(n);
  }

  // ---------- salva ----------
  async function save() {
    if (!org || !blank || !model) return;
    if (!allBases && !pick.length) { setMsg({ ok: false, text: "Scegli almeno una sede (o «Tutte le sedi»)." }); return; }
    setBusy(true); setMsg(null);
    try {
      const big = compose(blank, items, paint);
      const small = document.createElement("canvas"); small.width = 160; small.height = Math.round((H * 160) / W);
      const sg = small.getContext("2d")!; sg.imageSmoothingQuality = "high"; sg.drawImage(big, 0, 0, small.width, small.height);
      const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("immagine non creata"))), "image/png"));
      const stamp = `${org.id}/livrea-${model.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
      const [b1, b2] = await Promise.all([toBlob(big), toBlob(small)]);
      const up1 = await supabase.storage.from("org-logos").upload(`${stamp}.png`, b1, { contentType: "image/png", upsert: true });
      if (up1.error) throw up1.error;
      const up2 = await supabase.storage.from("org-logos").upload(`${stamp}-map.png`, b2, { contentType: "image/png", upsert: true });
      if (up2.error) throw up2.error;
      const url = supabase.storage.from("org-logos").getPublicUrl(`${stamp}.png`).data.publicUrl;
      const design: Design = { v: 1, w: W, h: H, items };
      const { data, error } = await supabase.rpc("livery_save", { p_id: cur?.id ?? null, p_model: model.id, p_name: name, p_design: design, p_image: url,
        p_base_ids: allBases ? null : pick });
      if (error) throw error;
      if (cur?.image_url) removeFiles(cur.image_url);
      setMsg({ ok: true, text: `✅ Livrea salvata: ${owned[model.id] ? "i tuoi " + model.name + " " + (allBases ? "di tutte le sedi" : "delle sedi scelte") + " ora la usano." : "la vedrai quando avrai questo modello."}` });
      await load(); loadVehicleLiveries(true);
      setCur((c) => ({ ...(c ?? { id: String(data), model_id: model.id, updated_at: "" }), id: String(data), name, design, image_url: url, base_ids: allBases ? null : pick } as Livery));
    } catch (e) { setMsg({ ok: false, text: errText(String((e as Error).message ?? e)) }); }
    setBusy(false);
  }
  function removeFiles(url: string) {
    const k = url.split("/org-logos/")[1]; if (!k) return;
    supabase.storage.from("org-logos").remove([k, k.replace(/\.png$/, "-map.png")]).then(() => {}, () => {});
  }
  async function del() {
    if (!cur) { openLivery(null); return; }
    if (!(await gameConfirm(`Rimettere la livrea ufficiale?\nLa livrea «${cur.name}» viene cancellata e i mezzi tornano con la livrea ufficiale.`))) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("livery_delete", { p_id: cur.id });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: errText(error.message) }); return; }
    if (data) removeFiles(String(data));
    openLivery(null); await load(); loadVehicleLiveries(true);
    setMsg({ ok: true, text: "Livrea ufficiale rimessa." });
  }

  const sb = selected ? bbox(selected) : null;
  const ink = Math.max(2, W / 300);

  return (
    <main style={shell}>
      <div style={wrap}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <a href="/" style={{ color: "#64748B", textDecoration: "none", fontSize: 14 }}>← Mappa</a>
          <h1 style={{ margin: 0, fontSize: 22, color: "#13294B" }}>🎨 Editor livrea</h1>
        </div>
        <div style={{ ...box, background: "#FFF7ED", color: "#9A3412", fontSize: 13, padding: 10 }}>
          💻 Consigliato dal PC (più spazio e mouse). Dal telefono funziona col dito: tocca una forma per sceglierla, trascinala, e usa il pallino blu per ingrandirla.
        </div>

        {/* modello e livrea */}
        <div style={box}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}>
            <div style={{ minWidth: 220, flex: 1 }}>
              <span style={lbl}>Modello</span>
              <select value={modelId} onChange={(e) => { setModelId(e.target.value); openLivery(null); }} style={{ width: "100%", padding: 8, borderRadius: 8 }}>
                {models.map((m) => <option key={m.id} value={m.id}>{m.name}{owned[m.id] ? ` · ne hai ${owned[m.id]}` : ""}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 220, flex: 1 }}>
              <span style={lbl}>Livrea</span>
              <select value={cur?.id ?? ""} onChange={(e) => openLivery(myLvs.find((l) => l.id === e.target.value) ?? null)} style={{ width: "100%", padding: 8, borderRadius: 8 }}>
                <option value="">➕ Nuova livrea</option>
                {myLvs.map((l) => <option key={l.id} value={l.id}>{l.name} {l.base_ids ? `(${l.base_ids.length} sedi)` : "(tutte le sedi)"}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 220, flex: 1 }}>
              <span style={lbl}>✨ Parti da una livrea pronta</span>
              <select value="" onChange={(e) => { const pr = PRESETS[+e.target.value]; if (pr) { commit(pr.make(W, H)); setSel(null); setMsg({ ok: true, text: `Livrea «${pr.name.replace(/^\S+\s/, "")}» pronta: cambiala come vuoi e premi Salva.` }); } }}
                      style={{ width: "100%", padding: 8, borderRadius: 8 }}>
                <option value="">Scegli una base…</option>
                {PRESETS.map((pr, i) => <option key={pr.name} value={i}>{pr.name}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 220, flex: 1 }}>
              <span style={lbl}>📋 Copia un mio lavoro</span>
              <select value="" onChange={(e) => e.target.value && copyFrom(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 8 }}>
                <option value="">Scegli una livrea da copiare…</option>
                {lvs.map((l) => <option key={l.id} value={l.id}>{l.name} — {models.find((m) => m.id === l.model_id)?.name ?? "?"}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* strumenti */}
        <div style={{ ...box, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", position: "sticky", top: 0, zIndex: 5 }}>
          <button style={{ ...tool, background: mode === "select" ? "#13294B" : "#fff", color: mode === "select" ? "#fff" : "#13294B" }} onClick={() => setMode("select")}>👆 Sposta</button>
          <button style={tool} onClick={() => add("rect")}>▬ Striscia</button>
          <button style={tool} onClick={() => add("ellipse")}>● Cerchio</button>
          <button style={tool} onClick={() => add("line")}>╱ Linea</button>
          <button style={tool} onClick={() => add("checker")}>▦ Scacchi</button>
          <button style={tool} onClick={() => add("text")}>🔤 Testo</button>
          <button style={tool} disabled={busy} onClick={() => fileRef.current?.click()}>🖼️ Foto / logo</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) addPhoto(f); }} />
          <button style={{ ...tool, background: mode === "brush" ? "#13294B" : "#fff", color: mode === "brush" ? "#fff" : "#13294B" }} onClick={() => { setMode("brush"); setSel(null); }}>🖌️ Pennello</button>
          <button style={{ ...tool, background: mode === "pick" ? "#13294B" : "#fff", color: mode === "pick" ? "#fff" : "#13294B" }} onClick={() => setMode(mode === "pick" ? "brush" : "pick")} title="Prendi un colore dal mezzo">💧 Contagocce</button>
          {(mode === "brush" || mode === "pick") && <>
            <input type="color" value={brush.color} onChange={(e) => setBrush({ ...brush, color: e.target.value })} title="Colore pennello" style={{ width: 40, height: 34, border: "none", background: "none" }} />
            <span style={{ fontSize: 12, color: "#475569" }}>Spessore</span>
            <input type="range" min={2} max={60} value={brush.size} onChange={(e) => setBrush({ ...brush, size: +e.target.value })} title="Spessore" />
            <span style={{ display: "inline-block", width: Math.min(30, brush.size), height: Math.min(30, brush.size), borderRadius: "50%", background: brush.color, border: "1px solid #CBD5E1" }} />
          </>}
          {(mode === "brush" || mode === "pick") && <div style={{ width: "100%", display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>I tuoi colori:</span>
            {used.map((c) => <button key={c} title={c} onClick={() => { setBrush((b) => ({ ...b, color: c })); setMode("brush"); }}
              style={{ width: 26, height: 26, borderRadius: 7, background: c, border: brush.color.toLowerCase() === c ? "3px solid #13294B" : "1px solid #CBD5E1", cursor: "pointer", padding: 0 }} />)}
          </div>}
          <span style={{ flex: 1 }} />
          <button style={tool} onClick={doUndo} title="Annulla">↶</button>
          <button style={tool} onClick={doRedo} title="Ripeti">↷</button>
        </div>

        {/* tela */}
        <div style={{ ...box, padding: 8, background: "repeating-conic-gradient(#eef2f7 0% 25%, #fff 0% 50%) 50% / 24px 24px" }}>
          <div style={{ position: "relative", width: "100%", aspectRatio: `${W} / ${H}` }}>
            <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: mode === "brush" ? "crosshair" : mode === "pick" ? "copy" : "default" }}
                 onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
              <rect x={0} y={0} width={W} height={H} fill="transparent" />
              {mode === "select" && items.map((it) => { const b = bbox(it); return <rect key={it.id} x={b.x} y={b.y} width={Math.max(1, b.w)} height={Math.max(1, b.h)} fill="none" stroke="rgba(19,41,75,.18)" strokeDasharray="6 6" strokeWidth={1} pointerEvents="none" />; })}
              {sb && mode === "select" && <>
                <rect x={sb.x} y={sb.y} width={Math.max(1, sb.w)} height={Math.max(1, sb.h)} fill="none" stroke="#2563EB" strokeWidth={ink} strokeDasharray={`${ink * 4} ${ink * 3}`} pointerEvents="none" />
                <circle data-h="1" cx={selected!.t === "line" ? selected!.x + selected!.w : sb.x + sb.w} cy={selected!.t === "line" ? selected!.y + selected!.h : sb.y + sb.h}
                        r={Math.max(12, W / 60)} fill="#2563EB" stroke="#fff" strokeWidth={ink} style={{ cursor: "nwse-resize" }} />
              </>}
            </svg>
          </div>
          {!items.length && <div style={{ textAlign: "center", color: "#64748B", fontSize: 13, marginTop: 6 }}>Il mezzo è bianco: aggiungi strisce, scacchi, testo o il tuo logo coi pulsanti qui sopra.</div>}
        </div>

        {/* forma scelta */}
        {selected && mode === "select" && (
          <div style={{ ...box, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
            <strong style={{ width: "100%", color: "#13294B" }}>Forma scelta: {({ rect: "striscia", ellipse: "cerchio", line: "linea", path: "pennello", text: "testo", image: "foto", checker: "scacchi" } as Record<Kind, string>)[selected.t]}</strong>
            {selected.t === "text" && <div style={{ flex: "1 1 220px" }}><span style={lbl}>Testo</span>
              <input value={selected.text ?? ""} onChange={(e) => patch(selected.id, { text: e.target.value.slice(0, 40) })} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #CBD5E1", boxSizing: "border-box" }} />
              <label style={{ fontSize: 13 }}><input type="checkbox" checked={!!selected.bold} onChange={(e) => patch(selected.id, { bold: e.target.checked })} /> Grassetto</label></div>}
            {["rect", "ellipse", "text", "checker"].includes(selected.t) && <div><span style={lbl}>Colore</span>
              <input type="color" value={selected.fill === "none" ? "#ffffff" : selected.fill} onChange={(e) => patch(selected.id, { fill: e.target.value })} /></div>}
            {selected.t === "checker" && <div><span style={lbl}>Secondo colore</span>
              <input type="color" value={selected.c2 ?? "#1D4ED8"} onChange={(e) => patch(selected.id, { c2: e.target.value })} /></div>}
            {["rect", "ellipse"].includes(selected.t) && <div><span style={lbl}>Riempita</span>
              <input type="checkbox" checked={selected.fill !== "none"} onChange={(e) => patch(selected.id, { fill: e.target.checked ? "#F97316" : "none", sw: e.target.checked ? selected.sw : Math.max(selected.sw, 6) })} /></div>}
            {selected.t !== "image" && selected.t !== "checker" && <div><span style={lbl}>{["line", "path"].includes(selected.t) ? "Colore linea" : "Bordo"}</span>
              <input type="color" value={selected.stroke} onChange={(e) => patch(selected.id, { stroke: e.target.value })} /></div>}
            {selected.t !== "image" && selected.t !== "checker" && <div style={{ flex: "1 1 140px" }}><span style={lbl}>Spessore {Math.round(selected.sw)}</span>
              <input type="range" min={0} max={60} value={selected.sw} onChange={(e) => setItems(items.map((i) => (i.id === selected.id ? { ...i, sw: +e.target.value } : i)))} style={{ width: "100%" }} /></div>}
            {!["line", "path"].includes(selected.t) && <div style={{ flex: "1 1 140px" }}><span style={lbl}>Rotazione {Math.round(selected.r)}°</span>
              <input type="range" min={-180} max={180} value={selected.r} onChange={(e) => setItems(items.map((i) => (i.id === selected.id ? { ...i, r: +e.target.value } : i)))} style={{ width: "100%" }} /></div>}
            <div style={{ flex: "1 1 140px" }}><span style={lbl}>Trasparenza {Math.round((1 - selected.op) * 100)}%</span>
              <input type="range" min={10} max={100} value={Math.round(selected.op * 100)} onChange={(e) => setItems(items.map((i) => (i.id === selected.id ? { ...i, op: +e.target.value / 100 } : i)))} style={{ width: "100%" }} /></div>
            <div style={{ width: "100%", display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>I tuoi colori:</span>
              {used.map((c) => <button key={c} title={c} onClick={() => patch(selected.id, ["line", "path"].includes(selected.t) ? { stroke: c } : { fill: c })}
                style={{ width: 26, height: 26, borderRadius: 7, background: c, border: "1px solid #CBD5E1", cursor: "pointer", padding: 0 }} />)}
              <button style={{ ...tool, padding: "4px 8px" }} onClick={() => setMode("pick")}>💧 Prendi dal mezzo</button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button style={tool} onClick={() => layer(1)}>⬆️ Sopra</button>
              <button style={tool} onClick={() => layer(-1)}>⬇️ Sotto</button>
              <button style={tool} onClick={() => { const c = { ...selected, id: uid(), x: selected.x + 20, y: selected.y + 20, pts: selected.pts?.map(([x, y]) => [x + 20, y + 20] as [number, number]) }; commit([...items, c]); setSel(c.id); }}>⧉ Duplica</button>
              <button style={{ ...tool, color: "#B91C1C" }} onClick={() => { commit(items.filter((i) => i.id !== selected.id)); setSel(null); }}>🗑️ Elimina</button>
            </div>
          </div>
        )}

        {/* sedi e salvataggio */}
        <div style={box}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
            <div style={{ flex: "1 1 240px" }}><span style={lbl}>Nome della livrea</span>
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #CBD5E1", boxSizing: "border-box" }} /></div>
          </div>
          <div style={{ marginTop: 10 }}>
            <span style={lbl}>A quali sedi va questa livrea</span>
            <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontWeight: 700, marginRight: 12 }}>
              <input type="checkbox" checked={allBases} onChange={(e) => setAllBases(e.target.checked)} /> 🌍 Tutte le sedi
            </label>
            {!allBases && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {bases.map((b) => { const on = pick.includes(b.id); return (
                <button key={b.id} onClick={() => setPick(on ? pick.filter((x) => x !== b.id) : [...pick, b.id])}
                        style={{ ...tool, padding: "5px 9px", fontSize: 13, background: on ? "#DCFCE7" : "#fff", borderColor: on ? "#16A34A" : "#CBD5E1" }}>
                  {on ? "✅ " : ""}{b.is_headquarters ? "⭐ " : ""}{b.name}
                </button>); })}
              <button style={{ ...tool, padding: "5px 9px", fontSize: 13 }} onClick={() => setPick(bases.map((b) => b.id))}>Tutte</button>
              <button style={{ ...tool, padding: "5px 9px", fontSize: 13 }} onClick={() => setPick([])}>Nessuna</button>
            </div>}
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 6 }}>Se una sede ha una livrea sua, vale quella; le altre sedi usano la livrea per «tutte le sedi» (o quella ufficiale).</div>
          </div>
          {msg && <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: msg.ok ? "#DCFCE7" : "#FEE2E2", color: msg.ok ? "#166534" : "#991B1B", fontWeight: 600 }}>{msg.text}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button style={{ ...btn, background: "#16A34A", opacity: busy ? 0.5 : 1 }} disabled={busy || !blank} onClick={save}>{busy ? "Salvo…" : "💾 Salva e applica"}</button>
            <button style={{ ...btn, background: "#fff", color: "#B91C1C", border: "1px solid #FCA5A5" }} disabled={busy} onClick={del}>{cur ? "↩️ Rimetti la livrea ufficiale" : "🧹 Ricomincia"}</button>
          </div>
        </div>
      </div>
    </main>
  );
}
