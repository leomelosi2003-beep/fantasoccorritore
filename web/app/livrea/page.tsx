"use client";
// Editor livrea: forme (strisce, cerchi, triangoli, stelle, chevron, onde, sagomature…), sfumature, testo, scacchi, foto, pennello.
// Si personalizzano solo i modelli che hai comprato; la livrea va a tutti i mezzi del modello, ad alcune sedi o ad alcuni mezzi.
// Se sei in un'alleanza il logo dell'alleanza è obbligatorio (si sposta e si ridimensiona, ma non si toglie).
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPE } from "react";
import { useRouter } from "next/navigation";
import { supabase, friendlyError } from "@/lib/supabase";
import { gameConfirm } from "@/lib/confirm";
import { loadVehicleLiveries } from "@/lib/liveries";
import { type Item, type Kind, type Design, uid, SHAPES, PATTERNS, PATTERN_KINDS, STICKERS, glassMaskOf, KIND_NAME, FILLABLE, PRESETS, loadImg, blankOf, paintMaskOf, imgCache, compose, bbox, drawItems } from "@/components/livery/engine";

type Model = { id: string; name: string; image_url: string | null };
type Livery = { id: string; model_id: string; name: string; design: Design; image_url: string | null; base_ids: string[] | null; vehicle_ids: string[] | null; updated_at: string };
type Base = { id: string; name: string; is_headquarters: boolean };
type Veh = { id: string; call_sign: string; model_id: string; base_id: string | null };
type Ally = { name: string; logo_url: string | null };
type Target = "all" | "bases" | "vehicles";

const shell: CSSProperties = { minHeight: "100vh", background: "#EEF2F6", fontFamily: "system-ui, -apple-system, sans-serif" };
const box: CSSProperties = { background: "#fff", borderRadius: 14, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,.06)", marginBottom: 10 };
const btn: CSSProperties = { padding: "8px 12px", borderRadius: 10, border: "none", background: "#13294B", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 };
const tool = (on = false): CSSProperties => ({ ...btn, background: on ? "#13294B" : "#fff", color: on ? "#fff" : "#13294B", border: "1px solid #CBD5E1", padding: "7px 10px", fontSize: 13.5 });
const lbl: CSSProperties = { fontSize: 11.5, fontWeight: 800, color: "#64748B", display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.3 };
const sel: CSSProperties = { width: "100%", padding: 8, borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 14, background: "#fff" };
const ERR: Record<string, string> = {
  LIVERY_TOO_MANY_PHOTOS: "Al massimo 5 foto per livrea.", LIVERY_TOO_BIG: "La livrea è troppo pesante: togli qualche forma o foto.",
  TOO_MANY_LIVERIES: "Hai già 40 livree: cancellane qualcuna.", NOT_YOUR_BASE: "Puoi scegliere solo le tue sedi.", NOT_YOUR_VEHICLE: "Puoi scegliere solo i tuoi mezzi di questo modello.",
  MODEL_NOT_OWNED: "Puoi personalizzare solo i modelli che hai comprato.", ALLY_LOGO_REQUIRED: "Sei in un'alleanza: il logo dell'alleanza deve restare sulla livrea.",
};
const errText = (m: string) => Object.entries(ERR).find(([k]) => m.includes(k))?.[1] ?? friendlyError(m);
const BASE_COLORS = ["#f97316", "#facc15", "#1d4ed8", "#1e3a8a", "#dc2626", "#16a34a", "#0ea5e9", "#9333ea", "#ffffff", "#111827"];

export default function LiveryEditor() {
  const router = useRouter();
  const [org, setOrg] = useState<{ id: string; name: string } | null>(null);
  const [ally, setAlly] = useState<Ally | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [vehs, setVehs] = useState<Veh[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [lvs, setLvs] = useState<Livery[]>([]);
  const [modelId, setModelId] = useState("");
  const [cur, setCur] = useState<Livery | null>(null);
  const [name, setName] = useState("La mia livrea");
  const [target, setTarget] = useState<Target>("all");
  const [pickB, setPickB] = useState<string[]>([]);
  const [pickV, setPickV] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [mode, setMode] = useState<"select" | "brush" | "pick" | "pan">("select");
  const [brush, setBrush] = useState({ color: "#1D4ED8", size: 10 });
  const [shapesOpen, setShapesOpen] = useState(false);
  const [stkOpen, setStkOpen] = useState(false);
  const [step, setStep] = useState(5);
  const [more, setMore] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [side, setSide] = useState<"props" | "layers">("props");
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });          // zoom e spostamento della vista
  const [vp, setVp] = useState({ w: 800, h: 360 });               // misure del riquadro
  const [full, setFull] = useState(false);
  const [bg, setBg] = useState<"chess" | "light" | "dark">("chess");
  const vpRef = useRef<HTMLDivElement | null>(null);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const panRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const pinchRef = useRef<{ d: number; cx: number; cy: number; z: number; x: number; y: number } | null>(null);
  const space = useRef(false);
  const [blank, setBlank] = useState<HTMLCanvasElement | null>(null);
  const [paint, setPaint] = useState<HTMLCanvasElement | null>(null);
  const [glass, setGlass] = useState<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tick, setTick] = useState(0);
  const [ghost, setGhost] = useState(true);                      // parti nascoste (vetri, ruote) in trasparenza
  const [draft, setDraft] = useState<{ items: Item[]; name: string; curId: string | null; t: number } | null>(null);
  const dirty = useRef(false);
  const [wide, setWide] = useState(true);
  const undo = useRef<Item[][]>([]); const redo = useRef<Item[][]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ kind: "move" | "size" | "rot" | "brush" | "p0" | "p1"; id: string; sx: number; sy: number; orig: Item; hx?: number; hy?: number } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const W = blank?.width ?? 900, H = blank?.height ?? 400;
  const model = models.find((m) => m.id === modelId) ?? null;
  const MARGIN = wide ? 90 : 56;                                 // spazio intorno al mezzo per maniglie e frecce
  const fit = Math.max(0.05, Math.min((vp.w - 2 * MARGIN) / W, (vp.h - 2 * MARGIN) / H));   // a zoom 1 il mezzo entra tutto, con margine
  const fitView = useCallback(() => setView({ z: 1, x: (vp.w - W * fit) / 2, y: (vp.h - H * fit) / 2 }), [vp.w, vp.h, W, H, fit]);
  useEffect(() => { fitView(); }, [fitView]);
  useEffect(() => {
    const f = () => {
      const w = vpRef.current?.clientWidth ?? 800;
      const h = full ? window.innerHeight - 130 : Math.max(380, Math.min(window.innerHeight * 0.8, (w * H) / W + 200));   // tavolo di lavoro grande
      setVp({ w, h });
    };
    f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f);
  }, [full, W, H, wide]);
  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => setView((v) => {
    const z = Math.min(10, Math.max(1, v.z * factor));
    const px = cx ?? vp.w / 2, py = cy ?? vp.h / 2;
    return { z, x: px - ((px - v.x) / v.z) * z, y: py - ((py - v.y) / v.z) * z };
  }), [vp.w, vp.h]);
  // rotellina = zoom sul punto del mouse (senza far scorrere la pagina)
  useEffect(() => {
    const el = vpRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);
  const selected = items.find((i) => i.id === selId) ?? null;
  const myVehs = useMemo(() => vehs.filter((v) => v.model_id === modelId), [vehs, modelId]);
  const myLvs = useMemo(() => lvs.filter((l) => l.model_id === modelId), [lvs, modelId]);
  const baseName = (id: string | null) => bases.find((b) => b.id === id)?.name ?? "—";

  useEffect(() => { const f = () => setWide(window.innerWidth >= 980); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);

  // ---------- caricamento ----------
  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); return; }
    const { data: o } = await supabase.from("organizations").select("id,name").eq("owner_id", session.user.id).maybeSingle();
    if (!o) { router.replace("/onboarding"); return; }
    setOrg(o as { id: string; name: string });
    const [ms, vs, bs, ls, am] = await Promise.all([
      supabase.from("vehicle_models").select("id,name,image_url").order("name"),
      supabase.from("vehicles").select("id,call_sign,model_id,base_id").eq("org_id", o.id).order("call_sign"),
      supabase.from("bases").select("id,name,is_headquarters").eq("org_id", o.id).order("built_at"),
      supabase.rpc("my_liveries"),
      supabase.from("alliance_members").select("alliances(name,logo_url)").eq("org_id", o.id).maybeSingle(),
    ]);
    const vv = (vs.data as Veh[]) ?? [];
    const owned = new Set(vv.map((v) => v.model_id));
    // solo i modelli che hai comprato
    const mm = ((ms.data as Model[]) ?? []).filter((m) => owned.has(m.id) && m.image_url && !m.image_url.includes("h-pegaso"));
    const cnt = (id: string) => vv.filter((v) => v.model_id === id).length;
    mm.sort((a, b) => cnt(b.id) - cnt(a.id) || a.name.localeCompare(b.name));
    setModels(mm); setVehs(vv);
    setBases((bs.data as Base[]) ?? []);
    setLvs((ls.data as Livery[]) ?? []);
    setAlly(((am.data as unknown as { alliances: Ally | null } | null)?.alliances) ?? null);
    setModelId((m) => (m && mm.some((x) => x.id === m) ? m : mm[0]?.id ?? ""));
  }, [router]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!model?.image_url) return;
    let ok = true;
    loadImg(model.image_url).then((img) => { if (ok) { setPaint(paintMaskOf(img)); setGlass(glassMaskOf(img)); setBlank(blankOf(img)); } }).catch(() => setMsg({ ok: false, text: "Immagine del mezzo non trovata." }));
    return () => { ok = false; };
  }, [model?.image_url]);

  useEffect(() => {
    for (const it of items) if (it.t === "image" && it.src && !imgCache.has(it.src)) {
      const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => setTick((n) => n + 1); im.src = it.src; imgCache.set(it.src, im);
    }
  }, [items]);

  useEffect(() => {
    const c = canvasRef.current; if (!c || !blank) return;
    c.width = W; c.height = H;
    const g = c.getContext("2d")!; g.clearRect(0, 0, W, H);
    g.drawImage(compose(blank, items, paint, glass), 0, 0);
    // parti che non si vedranno (fuori carrozzeria o fuori dai vetri): in trasparenza, così si capisce dov'è la forma
    if (ghost) for (const [list, mask] of [[items.filter((i) => !i.glass), paint ?? blank], [items.filter((i) => i.glass), glass ?? blank]] as const) {
      if (!list.length) continue;
      const t = document.createElement("canvas"); t.width = W; t.height = H;
      const tg = t.getContext("2d")!; drawItems(tg, list as Item[]);
      tg.globalCompositeOperation = "destination-out"; tg.drawImage(mask, 0, 0);
      g.save(); g.globalAlpha = 0.3; g.drawImage(t, 0, 0); g.restore();
    }
  }, [blank, paint, glass, items, tick, W, H, ghost]);

  // ---------- quanta parte di una forma finisce dove si vede ----------
  const maskData = useMemo(() => {
    const read = (c: HTMLCanvasElement | null) => c ? c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data : null;
    return { paint: read(paint), glass: read(glass) };
  }, [paint, glass]);
  const coverage = useCallback((x: number, y: number, w: number, h: number, onGlass: boolean) => {
    const d = onGlass ? maskData.glass : maskData.paint; if (!d) return 1;
    let ok = 0, n = 0;
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const px = Math.round(x + (w * (i + 0.5)) / 7), py = Math.round(y + (h * (j + 0.5)) / 7);
      n++; if (px >= 0 && py >= 0 && px < W && py < H && d[(py * W + px) * 4 + 3] > 0) ok++;
    }
    return ok / n;
  }, [maskData, W, H]);
  /** posto migliore vicino a (x,y) dove la forma si vede tutta */
  const bestSpot = useCallback((x: number, y: number, w: number, h: number, onGlass: boolean) => {
    if (coverage(x, y, w, h, onGlass) > 0.9) return { x, y };
    let best = { x, y, s: -1 };
    for (let i = 0; i <= 16; i++) for (let j = 0; j <= 12; j++) {
      const cx = ((W - w) * i) / 16, cy = ((H - h) * j) / 12;
      const s = coverage(cx, cy, w, h, onGlass) - (Math.hypot(cx - x, cy - y) / W) * 0.25;
      if (s > best.s) best = { x: cx, y: cy, s };
    }
    return { x: best.x, y: best.y };
  }, [coverage, W, H]);

  // ---------- logo dell'alleanza: obbligatorio ----------
  const allyItem = useCallback((): Item | null => {
    if (!ally) return null;
    const h = H * 0.2;
    if (ally.logo_url) return { id: uid(), t: "image", x: W * 0.6, y: H * 0.3, w: h, h, r: 0, fill: "none", stroke: "#000", sw: 0, op: 1, src: ally.logo_url, ally: true };
    return { id: uid(), t: "text", x: W * 0.55, y: H * 0.33, w: W * 0.25, h: H * 0.07, r: 0, fill: "#13294B", stroke: "#000", sw: 0, op: 1, text: ally.name.toUpperCase(), bold: true, ally: true };
  }, [ally, W, H]);
  const withAlly = useCallback((list: Item[]) => {
    if (!ally || list.some((i) => i.ally)) return list;
    const a = allyItem(); return a ? [...list, a] : list;
  }, [ally, allyItem]);

  // ---------- modifiche con annulla ----------
  const commit = useCallback((next: Item[]) => {
    undo.current.push(items); if (undo.current.length > 80) undo.current.shift();
    redo.current = []; setItems(withAlly(next)); dirty.current = true;
  }, [items, withAlly]);
  const patch = (id: string, p: Partial<Item>) => commit(items.map((it) => (it.id === id ? { ...it, ...p } : it)));
  const live = (id: string, p: Partial<Item>) => { dirty.current = true; setItems((l) => l.map((it) => (it.id === id ? { ...it, ...p } : it))); };   // durante gli slider

  function scaleItems(list: Item[], sx: number, sy: number): Item[] {
    return list.map((i) => ({ ...i, id: uid(), x: i.x * sx, y: i.y * sy, w: i.w * sx, h: i.h * sy, sw: i.sw * Math.min(sx, sy),
      pts: i.pts?.map(([x, y]) => [x * sx, y * sy] as [number, number]) }));
  }
  function openLivery(l: Livery | null) {
    setCur(l); setSelId(null); undo.current = []; redo.current = [];
    if (l) {
      setName(l.name);
      setTarget(l.vehicle_ids ? "vehicles" : l.base_ids ? "bases" : "all"); setPickB(l.base_ids ?? []); setPickV(l.vehicle_ids ?? []);
      const d = l.design; setItems(withAlly(scaleItems(d?.items ?? [], d?.w ? W / d.w : 1, d?.h ? H / d.h : 1)));
    } else { setName("La mia livrea"); setTarget("all"); setPickB([]); setPickV([]); setItems(withAlly([])); }
  }
  // all'apertura (e quando arriva l'alleanza) il logo c'è sempre
  useEffect(() => { setItems((l) => withAlly(l)); }, [withAlly]);

  // ---------- bozza automatica (se si chiude la pagina o cade la linea non si perde il lavoro) ----------
  const draftKey = `fs_liv_draft_${modelId}`;
  useEffect(() => {
    if (!modelId) return;
    try { const d = JSON.parse(localStorage.getItem(draftKey) ?? "null"); setDraft(d && d.items?.some((i: Item) => !i.ally) ? d : null); } catch { setDraft(null); }
    dirty.current = false;
  }, [modelId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!modelId || !dirty.current) return;
    const t = setTimeout(() => { try { localStorage.setItem(draftKey, JSON.stringify({ items, name, curId: cur?.id ?? null, t: Date.now() })); } catch { /* spazio pieno */ } }, 700);
    return () => clearTimeout(t);
  }, [items, name, modelId, cur?.id, draftKey]);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", f); return () => window.removeEventListener("beforeunload", f);
  }, []);
  function resumeDraft() {
    if (!draft) return;
    const c = lvs.find((l) => l.id === draft.curId) ?? null;
    setCur(c); setName(draft.name); setItems(withAlly(draft.items)); undo.current = []; redo.current = []; setSelId(null);
    setDraft(null); dirty.current = true;
    setMsg({ ok: true, text: "Bozza ripresa. Ricordati di premere Salva." });
  }
  function dropDraft() { try { localStorage.removeItem(draftKey); } catch { /* */ } setDraft(null); }

  function copyFrom(id: string) {
    const l = lvs.find((x) => x.id === id); if (!l) return;
    const d = l.design; commit(scaleItems((d?.items ?? []).filter((i) => !i.ally), d?.w ? W / d.w : 1, d?.h ? H / d.h : 1));
    setMsg({ ok: true, text: `Copiato «${l.name}». Sistemalo e premi Salva.` });
  }

  // ---------- nuove forme ----------
  function add(t: Kind, onGlass = false) {
    const base: Item = { id: uid(), t, x: W * 0.4, y: H * 0.35, w: H * 0.25, h: H * 0.25, r: 0, fill: "#F97316", stroke: "#111827", sw: 0, op: 1 };
    const it: Item =
      t === "rect" ? { ...base, x: W * 0.05, y: H * 0.5, w: W * 0.9, h: H * 0.07 } :
      t === "roundrect" ? { ...base, x: W * 0.3, y: H * 0.4, w: W * 0.3, h: H * 0.12, fill: "#1D4ED8" } :
      t === "ellipse" ? { ...base, fill: "#DC2626" } :
      t === "line" ? { ...base, x: W * 0.1, y: H * 0.35, w: W * 0.8, h: 0, sw: 8, stroke: "#1D4ED8" } :
      t === "checker" ? { ...base, x: W * 0.05, y: H * 0.62, w: W * 0.9, h: H * 0.06, fill: "#FACC15", c2: "#1D4ED8" } :
      PATTERN_KINDS.includes(t) ? { ...base, x: W * 0.05, y: H * 0.5, w: W * 0.9, h: H * 0.1, fill: "#F97316", c2: "#FFFFFF" } :
      t === "wave" ? { ...base, x: W * 0.05, y: H * 0.45, w: W * 0.9, h: H * 0.12, fill: "#0EA5E9" } :
      t === "swoosh" ? { ...base, x: W * 0.15, y: H * 0.3, w: W * 0.7, h: H * 0.35, fill: "#F97316", g2: "#FACC15", gdir: "h" } :
      t === "sol" ? { ...base, w: H * 0.22, h: H * 0.22, fill: "#1D4ED8", c2: "#FFFFFF", stroke: "#FFFFFF", sw: 3 } :
      t === "chevron" || t === "arrow" ? { ...base, w: H * 0.3, h: H * 0.22, fill: "#FACC15" } :
      t === "text" ? { ...base, x: W * 0.3, y: H * 0.42, w: W * 0.4, h: H * 0.09, fill: "#1D4ED8", text: "AMBULANZA", bold: true } : base;
    const fin0 = onGlass ? { ...it, glass: true, x: W * 0.3, y: H * 0.22, w: Math.min(it.w, H * 0.2), h: Math.min(it.h, H * 0.2), g2: undefined } : it;
    const sp = t === "line" ? { x: fin0.x, y: fin0.y } : bestSpot(fin0.x, fin0.y, Math.abs(fin0.w), Math.abs(fin0.h), onGlass);
    const fin = { ...fin0, x: sp.x, y: sp.y };
    commit([...items, fin]); setSelId(fin.id); setMode("select"); setShapesOpen(false); setSide("props");
  }
  function addSticker(k: string) {
    const st = STICKERS.find((x) => x.stk === k); if (!st) return;
    const h = H * 0.13;
    const sp = bestSpot(W * 0.3, H * 0.22, h * st.w, h * st.h, true);
    const it: Item = { id: uid(), t: "sticker", stk: st.stk, x: sp.x, y: sp.y, w: h * st.w, h: h * st.h, r: 0, fill: st.fill, c2: st.c2, stroke: "#000", sw: 0, op: st.stk === "glasstext" ? 0.85 : 1, text: st.text, glass: true };
    commit([...items, it]); setSelId(it.id); setMode("select"); setStkOpen(false); setSide("props");
  }
  async function addPhoto(file: File) {
    if (!org) return;
    if (items.filter((i) => i.t === "image" && !i.ally).length >= 5) { setMsg({ ok: false, text: ERR.LIVERY_TOO_MANY_PHOTOS }); return; }
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
      commit([...items, it]); setSelId(it.id); setMode("select");
    } catch (e) { setMsg({ ok: false, text: "Foto non caricata: " + String((e as Error).message ?? e) }); }
    setBusy(false);
  }
  const used = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) for (const c of [it.fill, it.stroke, it.c2, it.g2]) if (c && /^#[0-9a-f]{6}$/i.test(c)) set.add(c.toLowerCase());
    for (const c of BASE_COLORS) set.add(c);
    return Array.from(set).slice(0, 20);
  }, [items]);

  // ---------- mouse e dita ----------
  const toImg = (e: RPE) => {
    const r = svgRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H] as [number, number];
  };
  function down(e: RPE<SVGSVGElement>) {
    if (!blank || mode === "pan" || space.current || ptrs.current.size > 1) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const [x, y] = toImg(e);
    if (mode === "pick") {
      const px = canvasRef.current?.getContext("2d")?.getImageData(Math.max(0, Math.min(W - 1, Math.round(x))), Math.max(0, Math.min(H - 1, Math.round(y))), 1, 1).data;
      if (px && px[3] > 0) {
        const hex = "#" + [px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
        setBrush((b) => ({ ...b, color: hex }));
        if (selected) patch(selected.id, ["line", "path"].includes(selected.t) ? { stroke: hex } : { fill: hex });
        setMsg({ ok: true, text: `💧 Colore preso: ${hex}` });
        setMode(selected ? "select" : "brush");
      }
      return;
    }
    if (mode === "brush") {
      const it: Item = { id: uid(), t: "path", x, y, w: 0, h: 0, r: 0, fill: "none", stroke: brush.color, sw: brush.size, op: 1, pts: [[x, y]] };
      undo.current.push(items); redo.current = [];
      setItems([...items, it]); drag.current = { kind: "brush", id: it.id, sx: x, sy: y, orig: it }; return;
    }
    const tgt = (e.target as Element).closest?.("[data-h],[data-nudge]");
    const nudgeAttr = tgt?.getAttribute("data-nudge");
    if ((nudgeAttr || tgt?.getAttribute("data-h")) && selected?.locked) { setMsg({ ok: false, text: "🔒 Forma bloccata: sbloccala dai Livelli per spostarla." }); return; }
    if (nudgeAttr && selected) {           // freccette sul disegno
      const [nx, ny] = nudgeAttr.split(",").map(Number); const ddx = nx * step, ddy = ny * step;
      patch(selected.id, { x: selected.x + ddx, y: selected.y + ddy, pts: selected.pts?.map(([px, py]) => [px + ddx, py + ddy] as [number, number]) });
      return;
    }
    const handle = tgt?.getAttribute("data-h");
    if (handle && selected) {
      undo.current.push(items); redo.current = [];
      const orig = { ...selected, pts: selected.pts?.map((pp) => [...pp] as [number, number]) };
      if (handle === "rot") drag.current = { kind: "rot", id: selected.id, sx: x, sy: y, orig };
      else if (handle === "p0" || handle === "p1") drag.current = { kind: handle, id: selected.id, sx: x, sy: y, orig };
      else { const [hx, hy] = handle.split(",").map(Number); drag.current = { kind: "size", id: selected.id, sx: x, sy: y, orig, hx, hy }; }
      return;
    }
    const inside = (it: Item, pad: number) => {
      if (it.t === "path" || it.t === "line") { const b = bbox(it); return x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad; }
      const cx = it.x + it.w / 2, cy = it.y + it.h / 2, a = (-it.r * Math.PI) / 180;
      const lx = (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), ly = (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a);
      return Math.abs(lx) <= Math.abs(it.w) / 2 + pad && Math.abs(ly) <= Math.abs(it.h) / 2 + pad;
    };
    const pad0 = 6 / (fit * view.z);
    const hit = (selected && !selected.locked && inside(selected, pad0) ? selected : null) ?? [...items].reverse().find((it) => !it.locked && inside(it, Math.max(pad0, it.sw / 2)));
    setSelId(hit?.id ?? null); if (hit) setSide("props");
    if (hit) { drag.current = { kind: "move", id: hit.id, sx: x, sy: y, orig: { ...hit, pts: hit.pts?.map((p) => [...p] as [number, number]) } }; undo.current.push(items); redo.current = []; }
  }
  function move(e: RPE<SVGSVGElement>) {
    const d = drag.current; if (!d || pinchRef.current) return;
    const [x, y] = toImg(e); const dx = x - d.sx, dy = y - d.sy;
    setItems((list) => list.map((it) => {
      if (it.id !== d.id) return it;
      if (d.kind === "brush") return { ...it, pts: [...(it.pts ?? []), [x, y] as [number, number]] };
      if (d.kind === "move") return { ...it, x: d.orig.x + dx, y: d.orig.y + dy, pts: d.orig.pts?.map(([px, py]) => [px + dx, py + dy] as [number, number]) };
      const o = d.orig;
      if (d.kind === "p0") return { ...it, x: o.x + dx, y: o.y + dy, w: o.w - dx, h: o.h - dy };      // linea: punto iniziale
      if (d.kind === "p1") return { ...it, w: o.w + dx, h: o.h + dy };                                // linea: punto finale
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      if (d.kind === "rot") {                                                                          // rotazione (scatta ogni 15° vicino)
        let a = (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90; if (a > 180) a -= 360;
        const sn = Math.round(a / 15) * 15; if (Math.abs(a - sn) < 4 || e.shiftKey) a = sn;
        return { ...it, r: Math.round(a) };
      }
      const hx = d.hx ?? 1, hy = d.hy ?? 1;
      if (it.t === "path") {
        const b = bbox(o);
        const sx = hx ? Math.max(0.05, (b.w + hx * dx) / (b.w || 1)) : 1, sy = hy ? Math.max(0.05, (b.h + hy * dy) / (b.h || 1)) : 1;
        const ox = hx < 0 ? b.x + b.w : b.x, oy = hy < 0 ? b.y + b.h : b.y;
        return { ...it, pts: o.pts?.map(([px, py]) => [ox + (px - ox) * sx, oy + (py - oy) * sy] as [number, number]) };
      }
      // spostamento nel verso della forma (anche se è ruotata)
      const a = (o.r * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
      const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
      let nw = Math.max(6, o.w + hx * lx), nh = Math.max(4, o.h + hy * ly);
      const corner = hx !== 0 && hy !== 0;
      if (corner && !e.shiftKey && ["image", "sticker", "text", "ellipse", "star", "heart", "hex", "diamond", "tri"].includes(it.t)) {
        const k = Math.max(nw / (o.w || 1), nh / (o.h || 1)); nw = Math.max(6, o.w * k); nh = Math.max(4, o.h * k);   // angoli: proporzioni mantenute
      }
      if (!hx) nw = o.w; if (!hy) nh = o.h;
      const cxl = (hx * (nw - o.w)) / 2, cyl = (hy * (nh - o.h)) / 2;                                   // il lato opposto resta fermo
      const ncx = cx + cxl * ca - cyl * sa, ncy = cy + cxl * sa + cyl * ca;
      return { ...it, w: nw, h: nh, x: ncx - nw / 2, y: ncy - nh / 2 };
    }));
  }
  function up() {
    const d = drag.current; drag.current = null;
    if (d?.kind === "brush") setItems((list) => list.map((it) => (it.id === d.id ? { ...it, ...bbox(it) } : it)));
  }
  const doUndo = useCallback(() => { const p = undo.current.pop(); if (p) { redo.current.push(items); setItems(withAlly(p)); } }, [items, withAlly]);
  const doRedo = useCallback(() => { const n = redo.current.pop(); if (n) { undo.current.push(items); setItems(withAlly(n)); } }, [items, withAlly]);
  function mirror(it: Item, vert: boolean) {
    if (it.locked) { setMsg({ ok: false, text: "🔒 Forma bloccata: sbloccala dai Livelli." }); return; }
    if (it.t === "line") { patch(it.id, vert ? { y: it.y + it.h, h: -it.h } : { x: it.x + it.w, w: -it.w }); return; }
    if (it.t === "path") {
      const b = bbox(it), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      patch(it.id, { pts: it.pts?.map(([x, y]) => (vert ? [x, 2 * cy - y] : [2 * cx - x, y]) as [number, number]) }); return;
    }
    // la specchiatura avviene dopo la rotazione: per specchiare "come si vede" si inverte anche l'angolo
    patch(it.id, vert ? { flipV: !it.flipV, r: -it.r } : { flip: !it.flip, r: -it.r });
  }
  function layer(id: string, dir: 1 | -1) {
    const i = items.findIndex((x) => x.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return; const n = [...items]; [n[i], n[j]] = [n[j], n[i]]; commit(n);
  }
  const dup = useCallback((it: Item) => {
    if (it.ally) return;
    const c = { ...it, id: uid(), x: it.x + 20, y: it.y + 20, pts: it.pts?.map(([x, y]) => [x + 20, y + 20] as [number, number]) };
    commit([...items, c]); setSelId(c.id);
  }, [items, commit]);
  const remove = useCallback((it: Item) => {
    if (it.ally) { setMsg({ ok: false, text: "🤝 Il logo dell'alleanza è obbligatorio: puoi spostarlo e ridimensionarlo, ma non toglierlo." }); return; }
    commit(items.filter((i) => i.id !== it.id)); setSelId(null);
  }, [items, commit]);

  // scorciatoie da tastiera (PC)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement; if (tg && /input|textarea|select/i.test(tg.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === " ") { space.current = true; e.preventDefault(); return; }
      if (k === "+" || k === "=") { zoomAt(1.25); return; }
      if (k === "-") { zoomAt(0.8); return; }
      if (k === "0") { fitView(); return; }
      if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); doRedo(); return; }
      if (!selected) return;
      if ((e.ctrlKey || e.metaKey) && k === "d") { e.preventDefault(); dup(selected); return; }
      if (k === "delete" || k === "backspace") { e.preventDefault(); remove(selected); return; }
      const st = e.shiftKey ? 10 : 2;
      const mv: Record<string, [number, number]> = { arrowleft: [-st, 0], arrowright: [st, 0], arrowup: [0, -st], arrowdown: [0, st] };
      if (mv[k]) { e.preventDefault(); const [dx, dy] = mv[k]; patch(selected.id, { x: selected.x + dx, y: selected.y + dy, pts: selected.pts?.map(([x, y]) => [x + dx, y + dy] as [number, number]) }); }
      if (k === "escape") setSelId(null);
    };
    const onUp = (e: KeyboardEvent) => { if (e.key === " ") space.current = false; };
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onUp); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- salva ----------
  async function save() {
    if (!org || !blank || !model) return;
    if (target === "bases" && !pickB.length) { setMsg({ ok: false, text: "Scegli almeno una sede." }); return; }
    if (target === "vehicles" && !pickV.length) { setMsg({ ok: false, text: "Scegli almeno un mezzo." }); return; }
    const finalItems = withAlly(items);
    setBusy(true); setMsg(null);
    try {
      const big = compose(blank, finalItems, paint, glass);
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
      const design: Design = { v: 1, w: W, h: H, items: finalItems };
      const { data, error } = await supabase.rpc("livery_save2", { p_id: cur?.id ?? null, p_model: model.id, p_name: name, p_design: design, p_image: url,
        p_base_ids: target === "bases" ? pickB : null, p_vehicle_ids: target === "vehicles" ? pickV : null });
      if (error) throw error;
      if (cur?.image_url) removeFiles(cur.image_url);
      const who = target === "all" ? `tutti i tuoi ${model.name}` : target === "bases" ? `i ${model.name} delle sedi scelte` : `${pickV.length} ${pickV.length === 1 ? "mezzo scelto" : "mezzi scelti"}`;
      setMsg({ ok: true, text: `✅ Livrea salvata: ora la usano ${who}.` });
      dirty.current = false; try { localStorage.removeItem(draftKey); } catch { /* */ }
      await load(); loadVehicleLiveries(true);
      setCur({ id: String(data), model_id: model.id, name, design, image_url: url, base_ids: target === "bases" ? pickB : null, vehicle_ids: target === "vehicles" ? pickV : null, updated_at: "" });
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
  const ink = 1.6 / (fit * view.z);                // linee e maniglie sempre della stessa grandezza a schermo
  const handleR = 9 / (fit * view.z);
  const swatches = (onPick: (c: string) => void, current?: string) => (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
      {used.map((c) => <button key={c} title={c} onClick={() => onPick(c)}
        style={{ width: 24, height: 24, borderRadius: 6, background: c, border: current?.toLowerCase() === c ? "3px solid #13294B" : "1px solid #CBD5E1", cursor: "pointer", padding: 0 }} />)}
    </div>);
  const isFillable = !!selected && (FILLABLE.includes(selected.t) || selected.t === "text");

  // ---------- pannello proprietà ----------
  const props = selected ? (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <strong style={{ color: "#13294B", flex: 1 }}>{selected.ally ? "🤝 Logo alleanza" : KIND_NAME[selected.t]}</strong>
        <button style={tool()} onClick={() => setSelId(null)} title="Deseleziona">✕</button>
      </div>
      {selected.ally && <div style={{ fontSize: 12.5, background: "#ECFDF5", color: "#065F46", borderRadius: 8, padding: 8, marginBottom: 8 }}>Obbligatorio per chi è in alleanza: puoi spostarlo e ridimensionarlo, non toglierlo.</div>}
      {selected.t === "text" && !selected.ally && <div style={{ marginBottom: 8 }}><span style={lbl}>Testo</span>
        <input value={selected.text ?? ""} onChange={(e) => live(selected.id, { text: e.target.value.slice(0, 40) })} style={{ ...sel, boxSizing: "border-box" }} />
        <label style={{ fontSize: 13 }}><input type="checkbox" checked={!!selected.bold} onChange={(e) => patch(selected.id, { bold: e.target.checked })} /> Grassetto</label></div>}
      {selected.t === "sticker" && <div style={{ marginBottom: 8 }}>
        <span style={lbl}>Colori adesivo</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12 }}>Sfondo</span><input type="color" value={selected.fill} onChange={(e) => live(selected.id, { fill: e.target.value })} />
          <span style={{ fontSize: 12 }}>Simbolo</span><input type="color" value={selected.c2 ?? "#ffffff"} onChange={(e) => live(selected.id, { c2: e.target.value })} />
        </div>
        {selected.text !== undefined && <input value={selected.text ?? ""} onChange={(e) => live(selected.id, { text: e.target.value.slice(0, 30) })} placeholder="Scritta"
          style={{ ...sel, boxSizing: "border-box", marginTop: 6 }} />}
      </div>}
      {selected.t === "sol" && <div style={{ marginBottom: 8 }}>
        <span style={lbl}>Colori stella della vita</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>
          <span style={{ fontSize: 12 }}>Stella</span><input type="color" value={selected.fill} onChange={(e) => live(selected.id, { fill: e.target.value })} />
          <span style={{ fontSize: 12 }}>Bastone e serpente</span><input type="color" value={selected.c2 ?? "#ffffff"} onChange={(e) => live(selected.id, { c2: e.target.value })} />
          <span style={{ fontSize: 12 }}>Bordo</span><input type="color" value={selected.stroke} onChange={(e) => live(selected.id, { stroke: e.target.value, sw: selected.sw || 3 })} />
        </div>
        {swatches((c) => patch(selected.id, { fill: c }), selected.fill)}
        <span style={{ ...lbl, marginTop: 6 }}>Spessore bordo {selected.sw}</span>
        <input type="range" min={0} max={20} value={selected.sw} onChange={(e) => live(selected.id, { sw: +e.target.value })} style={{ width: "100%" }} />
      </div>}
      {(isFillable || PATTERN_KINDS.includes(selected.t)) && <div style={{ marginBottom: 8 }}>
        <span style={lbl}>{PATTERN_KINDS.includes(selected.t) ? "Colori del motivo" : "Colore"}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5 }}>
          <input type="color" value={selected.fill === "none" ? "#ffffff" : selected.fill} onChange={(e) => live(selected.id, { fill: e.target.value })} />
          {PATTERN_KINDS.includes(selected.t) && <input type="color" value={selected.c2 ?? "#1D4ED8"} onChange={(e) => live(selected.id, { c2: e.target.value })} />}
          {FILLABLE.includes(selected.t) && <label style={{ fontSize: 12.5 }}><input type="checkbox" checked={selected.fill !== "none"} onChange={(e) => patch(selected.id, { fill: e.target.checked ? "#F97316" : "none", sw: e.target.checked ? selected.sw : Math.max(selected.sw, 6) })} /> riempita</label>}
        </div>
        {swatches((c) => patch(selected.id, { fill: c }), selected.fill)}
      </div>}
      {selected.t !== "path" && selected.t !== "line" && <div style={{ marginBottom: 8 }}><span style={lbl}>Grandezza</span>
        <input type="range" min={10} max={Math.round(W * 1.2)} value={Math.round(Math.abs(selected.w))}
               onChange={(e) => { const nw = +e.target.value, k = selected.h / (selected.w || 1), cx = selected.x + selected.w / 2, cy = selected.y + selected.h / 2;
                 live(selected.id, { w: nw, h: nw * k, x: cx - nw / 2, y: cy - (nw * k) / 2 }); }} style={{ width: "100%" }} /></div>}
      {!["line", "path"].includes(selected.t) && <div style={{ marginBottom: 8 }}><span style={lbl}>Rotazione</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button style={{ ...tool(), padding: "3px 7px" }} title="Un grado a sinistra" onClick={() => patch(selected.id, { r: Math.round(selected.r) - 1 })}>−1°</button>
          <input type="range" min={-180} max={180} step={1} value={selected.r} onChange={(e) => live(selected.id, { r: +e.target.value })} style={{ flex: 1, minWidth: 0 }} />
          <button style={{ ...tool(), padding: "3px 7px" }} title="Un grado a destra" onClick={() => patch(selected.id, { r: Math.round(selected.r) + 1 })}>+1°</button>
          <input type="number" min={-180} max={180} step={1} value={Math.round(selected.r)} onChange={(e) => { let v = +e.target.value; if (!Number.isFinite(v)) return; v = ((v + 180) % 360 + 360) % 360 - 180; patch(selected.id, { r: v }); }}
                 style={{ width: 54, padding: "3px 4px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13 }} />°
          <button style={{ ...tool(), padding: "3px 7px" }} title="Dritta" onClick={() => patch(selected.id, { r: 0 })}>0°</button>
        </div></div>}
      <div style={{ marginBottom: 8 }}><span style={lbl}>Trasparenza {Math.round((1 - selected.op) * 100)}%</span>
        <input type="range" min={10} max={100} value={Math.round(selected.op * 100)} onChange={(e) => live(selected.id, { op: +e.target.value / 100 })} style={{ width: "100%" }} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 8 }}>
        {!selected.ally && <button style={tool()} onClick={() => dup(selected)}>⧉ Duplica</button>}
        {!selected.ally && <button style={{ ...tool(), color: "#B91C1C" }} onClick={() => remove(selected)}>🗑️ Elimina</button>}
        <button style={tool(!!selected.flip)} onClick={() => mirror(selected, false)}>↔️ Specchia</button>
        <button style={tool(!!selected.flipV)} onClick={() => mirror(selected, true)}>↕️ Capovolgi</button>
        <button style={tool()} onClick={() => layer(selected.id, 1)}>⬆️ Porta sopra</button>
        <button style={tool()} onClick={() => layer(selected.id, -1)}>⬇️ Porta sotto</button>
      </div>
      <button style={{ ...tool(more), width: "100%", marginBottom: 8 }} onClick={() => setMore(!more)}>{more ? "▾ Meno opzioni" : "▸ Altre opzioni (posizione esatta, gradiente, bordo, adesivo…)"}</button>
      {more && <div>
      {/* posizione precisa */}
      <div style={{ marginBottom: 10, background: "#F8FAFC", borderRadius: 10, padding: 8 }}>
        <span style={lbl}>Posizione e misure</span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 34px)", gridTemplateRows: "repeat(3, 30px)", gap: 3 }}>
            {[["", 0, 0], ["↑", 0, -1], ["", 0, 0], ["←", -1, 0], ["·", 0, 0], ["→", 1, 0], ["", 0, 0], ["↓", 0, 1], ["", 0, 0]].map(([ic, dx, dy], i) => ic && ic !== "·"
              ? <button key={i} style={{ ...tool(), padding: 0, fontSize: 16 }} onClick={() => { const ddx = (dx as number) * step, ddy = (dy as number) * step;
                  patch(selected.id, { x: selected.x + ddx, y: selected.y + ddy, pts: selected.pts?.map(([x, y]) => [x + ddx, y + ddy] as [number, number]) }); }}>{ic}</button>
              : <span key={i} style={{ display: "grid", placeItems: "center", fontSize: 10.5, color: "#64748B" }}>{ic === "·" ? `${step}px` : ""}</span>)}
          </div>
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {(["x", "y", "w", "h"] as const).map((k) => (
              <label key={k} style={{ fontSize: 11.5, color: "#475569", fontWeight: 700 }}>{({ x: "X", y: "Y", w: "Largh.", h: "Alt." } as const)[k]}
                <input type="number" value={Math.round(selected[k])} disabled={selected.t === "path"}
                       onChange={(e) => { const v = +e.target.value; if (!Number.isFinite(v)) return; live(selected.id, { [k]: (k === "w" || k === "h") && selected.t !== "line" ? Math.max(4, v) : v } as Partial<Item>); }}
                       style={{ width: "100%", boxSizing: "border-box", padding: "3px 5px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13 }} /></label>))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: "#475569" }}>Passo</span>
          {[1, 5, 20].map((n) => <button key={n} style={{ ...tool(step === n), padding: "2px 8px", fontSize: 12 }} onClick={() => setStep(n)}>{n}</button>)}
          <span style={{ flex: 1 }} />
          {selected.t !== "path" && <>
            <button style={{ ...tool(), padding: "2px 7px", fontSize: 12 }} title="Centra in orizzontale" onClick={() => patch(selected.id, { x: (W - selected.w) / 2 })}>↔ centro</button>
            <button style={{ ...tool(), padding: "2px 7px", fontSize: 12 }} title="Centra in verticale" onClick={() => patch(selected.id, { y: (H - selected.h) / 2 })}>↕ centro</button>
          </>}
        </div>
      </div>
      {isFillable && selected.fill !== "none" && (() => {
        const kind = selected.gfade ? "fade" : selected.g2 ? "grad" : "solid";
        return (
        <div style={{ marginBottom: 8, background: "#F8FAFC", borderRadius: 10, padding: 8 }}>
          <span style={lbl}>Riempimento</span>
          <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            <button style={{ ...tool(kind === "solid"), flex: 1, padding: "5px 4px", fontSize: 12.5 }} onClick={() => patch(selected.id, { g2: undefined, g3: undefined, gfade: false })}>Colore unico</button>
            <button style={{ ...tool(kind === "grad"), flex: 1, padding: "5px 4px", fontSize: 12.5 }} onClick={() => patch(selected.id, { g2: selected.g2 ?? "#FACC15", gfade: false, gdir: selected.gdir === "r" ? "r" : "h", gang: selected.gang ?? 0 })}>🌈 Gradiente</button>
            <button style={{ ...tool(kind === "fade"), flex: 1, padding: "5px 4px", fontSize: 12.5 }} onClick={() => patch(selected.id, { gfade: true, g2: undefined, g3: undefined, gang: selected.gang ?? 0 })}>Sfuma</button>
          </div>
          {kind !== "solid" && <>
            <div style={{ height: 22, borderRadius: 6, border: "1px solid #CBD5E1", marginBottom: 6,
              background: selected.gdir === "r" ? `radial-gradient(${selected.fill}, ${selected.g3 && kind === "grad" ? selected.g3 + "," : ""} ${kind === "fade" ? "transparent" : selected.g2})`
                : `linear-gradient(${90 + (selected.gang ?? 0)}deg, ${selected.fill}, ${selected.g3 && kind === "grad" ? selected.g3 + "," : ""} ${kind === "fade" ? "transparent" : selected.g2})` }} />
            {kind === "grad" && <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12 }}>Da</span><input type="color" value={selected.fill} onChange={(e) => live(selected.id, { fill: e.target.value })} />
              {selected.g3 ? <><span style={{ fontSize: 12 }}>poi</span><input type="color" value={selected.g3} onChange={(e) => live(selected.id, { g3: e.target.value })} />
                <button style={{ ...tool(), padding: "2px 6px", fontSize: 12 }} onClick={() => patch(selected.id, { g3: undefined })}>✕</button></>
                : <button style={{ ...tool(), padding: "2px 7px", fontSize: 12 }} onClick={() => patch(selected.id, { g3: "#FFFFFF" })}>+ colore in mezzo</button>}
              <span style={{ fontSize: 12 }}>a</span><input type="color" value={selected.g2 ?? "#ffffff"} onChange={(e) => live(selected.id, { g2: e.target.value })} />
              <button style={{ ...tool(), padding: "2px 7px", fontSize: 12 }} title="Inverti" onClick={() => patch(selected.id, { fill: selected.g2 ?? selected.fill, g2: selected.fill })}>⇄</button>
            </div>}
            <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
              {([["→", 0], ["↘", 45], ["↓", 90], ["↙", 135], ["←", 180], ["↑", 270]] as const).map(([ic, a]) => (
                <button key={a} style={{ ...tool(selected.gdir !== "r" && (selected.gang ?? 0) === a), padding: "3px 7px" }} onClick={() => patch(selected.id, { gdir: "h", gang: a })}>{ic}</button>))}
              <button style={{ ...tool(selected.gdir === "r"), padding: "3px 7px" }} onClick={() => patch(selected.id, { gdir: "r" })} title="Dal centro">◎</button>
            </div>
            {selected.gdir !== "r" && <><span style={{ ...lbl, marginTop: 6 }}>Angolo {Math.round(selected.gang ?? 0)}°</span>
              <input type="range" min={0} max={359} value={selected.gang ?? 0} onChange={(e) => live(selected.id, { gang: +e.target.value, gdir: "h" })} style={{ width: "100%" }} /></>}
          </>}
        </div>);
      })()}
      {selected.t !== "image" && selected.t !== "checker" && <div style={{ marginBottom: 8 }}>
        <span style={lbl}>{["line", "path"].includes(selected.t) ? "Colore linea" : "Bordo"} · spessore {Math.round(selected.sw)}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="color" value={selected.stroke} onChange={(e) => live(selected.id, { stroke: e.target.value })} />
          <input type="range" min={0} max={60} value={selected.sw} onChange={(e) => live(selected.id, { sw: +e.target.value })} style={{ flex: 1 }} />
        </div>
        {["line", "path"].includes(selected.t) && <div style={{ marginTop: 5 }}>{swatches((c) => patch(selected.id, { stroke: c }), selected.stroke)}</div>}
      </div>}
      {!selected.ally && <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, fontWeight: 700, marginBottom: 8, background: selected.glass ? "#E0F2FE" : "transparent", borderRadius: 8, padding: "4px 6px" }}>
        <input type="checkbox" checked={!!selected.glass} onChange={(e) => patch(selected.id, { glass: e.target.checked })} /> 🪟 Adesivo sui vetri (non va sulla carrozzeria)
      </label>}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>

          <button style={tool()} onClick={() => setMode("pick")}>💧 Prendi colore dal mezzo</button>
        </div>
      </div>}
    </div>
  ) : (
    <div style={{ color: "#64748B", fontSize: 13.5, lineHeight: 1.5 }}>
      <strong style={{ color: "#13294B" }}>Come si usa</strong><br />
      • Aggiungi una forma, un testo o una foto dalla barra.<br />
      • Tocca una forma per sceglierla e trascinala col dito o col mouse.<br />
      • Sul disegno: i <b>tondini negli angoli</b> la ingrandiscono, i <b>quadratini sui lati</b> la allargano o allungano, <b>↻</b> la ruota, le <b>frecce blu</b> la spostano di poco.<br />
      • Qui cambi colore, grandezza e rotazione.<br />
      {wide && <>• Tastiera: Canc elimina, frecce spostano, Ctrl+Z / Ctrl+Y, Ctrl+D duplica.<br /></>}
      • Si colora solo la carrozzeria: vetri, cerchioni e fanali restano com&apos;erano.
    </div>
  );
  const layers = (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {[...items].reverse().map((it) => (
        <div key={it.id} onClick={() => { setSelId(it.id); setSide("props"); setMode("select"); }}
             style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 8, cursor: "pointer", background: it.id === selId ? "#DBEAFE" : "#F8FAFC", border: it.id === selId ? "1px solid #2563EB" : "1px solid transparent" }}>
          <span style={{ width: 18, height: 18, borderRadius: 4, background: it.t === "image" ? "#E2E8F0" : (it.fill !== "none" ? it.fill : it.stroke), border: "1px solid #CBD5E1", flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.ally ? "🤝 Logo alleanza" : it.t === "text" ? `Testo «${it.text}»` : KIND_NAME[it.t]}</span>
          <button style={{ ...tool(!!it.locked), padding: "2px 6px" }} title={it.locked ? "Sblocca" : "Blocca (non si sposta e non si prende toccando)"}
                  onClick={(e) => { e.stopPropagation(); patch(it.id, { locked: !it.locked }); }}>{it.locked ? "🔒" : "🔓"}</button>
          <button style={{ ...tool(), padding: "2px 6px" }} onClick={(e) => { e.stopPropagation(); layer(it.id, 1); }}>↑</button>
          <button style={{ ...tool(), padding: "2px 6px" }} onClick={(e) => { e.stopPropagation(); layer(it.id, -1); }}>↓</button>
          {!it.ally && <button style={{ ...tool(), padding: "2px 6px", color: "#B91C1C" }} onClick={(e) => { e.stopPropagation(); remove(it); }}>✕</button>}
        </div>
      ))}
      {!items.length && <div style={{ color: "#64748B", fontSize: 13 }}>Ancora niente: aggiungi una forma.</div>}
    </div>
  );

  if (org && !models.length) return (
    <main style={shell}><div style={{ maxWidth: 700, margin: "0 auto", padding: 16 }}>
      <a href="/" style={{ color: "#64748B", textDecoration: "none" }}>← Mappa</a>
      <div style={{ ...box, marginTop: 10 }}>🎨 Compra un mezzo nel Garage: poi potrai disegnarne la livrea qui.</div>
    </div></main>);

  return (
    <main style={shell}>
      <div style={{ maxWidth: 1600, margin: "0 auto", padding: 10 }}>
        {/* intestazione */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <a href="/" style={{ color: "#64748B", textDecoration: "none", fontSize: 14 }}>← Mappa</a>
          <h1 style={{ margin: 0, fontSize: 21, color: "#13294B", flex: 1 }}>🖌️ Editor livrea</h1>
          {ally && <span style={{ background: "#ECFDF5", color: "#065F46", borderRadius: 999, padding: "4px 10px", fontSize: 12.5, fontWeight: 700 }}>🤝 {ally.name}: logo obbligatorio</span>}
          {!wide && <span style={{ fontSize: 12, color: "#9A3412" }}>💻 Meglio dal PC</span>}
        </div>

        {/* 1 - mezzo e partenza */}
        <div style={{ fontWeight: 800, color: "#13294B", margin: "4px 2px 6px" }}>1️⃣ Scegli il mezzo</div>
        <div style={{ ...box, display: "grid", gridTemplateColumns: wide ? "repeat(3, 1fr)" : "1fr", gap: 10 }}>
          <div><span style={lbl}>Mezzo (solo quelli comprati)</span>
            <select value={modelId} onChange={(e) => { setModelId(e.target.value); setCur(null); setItems(withAlly([])); setSelId(null); }} style={sel}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.name} · {vehs.filter((v) => v.model_id === m.id).length}</option>)}
            </select></div>
          <div><span style={lbl}>Livrea</span>
            <select value={cur?.id ?? ""} onChange={(e) => openLivery(myLvs.find((l) => l.id === e.target.value) ?? null)} style={sel}>
              <option value="">➕ Nuova livrea</option>
              {myLvs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select></div>
          <div><span style={lbl}>✨ Parti da…</span>
            <select value="" onChange={(e) => { const v = e.target.value; if (v.startsWith("p")) { const pr = PRESETS[+v.slice(1)]; if (pr) { commit(pr.make(W, H)); setSelId(null); setMsg({ ok: true, text: "Base pronta: cambiala come vuoi." }); } } else if (v) copyFrom(v.slice(1)); }} style={sel}>
              <option value="">una livrea pronta o un tuo lavoro…</option>
              <optgroup label="Livree pronte">{PRESETS.map((pr, i) => <option key={pr.name} value={"p" + i}>{pr.name}</option>)}</optgroup>
              {lvs.length > 0 && <optgroup label="I tuoi lavori">{lvs.map((l) => <option key={l.id} value={"c" + l.id}>{l.name} — {models.find((m) => m.id === l.model_id)?.name ?? "?"}</option>)}</optgroup>}
            </select></div>
        </div>

        <div style={{ fontWeight: 800, color: "#13294B", margin: "8px 2px 6px" }}>2️⃣ Disegna</div>
        {draft && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1E3A8A", borderRadius: 12, padding: "8px 12px", marginBottom: 8, fontSize: 13.5 }}>
          <span style={{ flex: 1, minWidth: 180 }}>📝 Hai una bozza non salvata di «{draft.name}» ({new Date(draft.t).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}).</span>
          <button style={{ ...tool(true), padding: "4px 10px" }} onClick={resumeDraft}>Riprendi</button>
          <button style={{ ...tool(), padding: "4px 10px" }} onClick={dropDraft}>Scarta</button>
        </div>}
        {/* barra strumenti */}
        <div style={{ ...box, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", position: "sticky", top: 0, zIndex: 6, padding: 8 }}>
          <button style={tool(mode === "select")} onClick={() => setMode("select")} title="Sposta e scegli">👆 Sposta</button>
          <div style={{ position: "relative" }}>
            <button style={tool(shapesOpen)} onClick={() => { setShapesOpen(!shapesOpen); setStkOpen(false); }}>🔷 Forme ▾</button>
            {shapesOpen && <div style={{ position: "fixed", left: "50%", top: 70, transform: "translateX(-50%)", width: "min(460px, 94vw)", background: "#fff", borderRadius: 14, boxShadow: "0 12px 36px rgba(15,23,42,.35)", padding: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))", gap: 6, zIndex: 100, maxHeight: "72vh", overflow: "auto", boxSizing: "border-box" }}><div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", position: "sticky", top: -10, background: "#fff", padding: "4px 0", zIndex: 1 }}><strong style={{ flex: 1, color: "#13294B" }}>🔷 Forme e motivi</strong><button style={{ ...tool(), padding: "3px 10px" }} onClick={() => setShapesOpen(false)}>✕ Chiudi</button></div>
              <div style={{ gridColumn: "1 / -1", fontSize: 11.5, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Forme</div>
              {SHAPES.map((s) => <button key={s.t} onClick={() => add(s.t)} style={{ ...tool(), display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 2px", fontSize: 11.5 }}>
                <span style={{ fontSize: 20, lineHeight: 1.1 }}>{s.icon}</span>{s.name}</button>)}
              <div style={{ gridColumn: "1 / -1", fontSize: 11.5, fontWeight: 800, color: "#64748B", textTransform: "uppercase", marginTop: 4 }}>Motivi</div>
              {PATTERNS.map((s) => <button key={s.t} onClick={() => add(s.t)} style={{ ...tool(), display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 2px", fontSize: 11.5 }}>
                <span style={{ fontSize: 20, lineHeight: 1.1 }}>{s.icon}</span>{s.name}</button>)}
            </div>}
          </div>
          <button style={tool()} onClick={() => add("text")}>🔤 Testo</button>
          <div style={{ position: "relative" }}>
            <button style={tool(stkOpen)} onClick={() => { setStkOpen(!stkOpen); setShapesOpen(false); }}>🏷️ Adesivi ▾</button>
            {stkOpen && <div style={{ position: "fixed", left: "50%", top: 70, transform: "translateX(-50%)", width: "min(460px, 94vw)", background: "#fff", borderRadius: 14, boxShadow: "0 12px 36px rgba(15,23,42,.35)", padding: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))", gap: 6, zIndex: 100, maxHeight: "72vh", overflow: "auto", boxSizing: "border-box" }}><div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", position: "sticky", top: -10, background: "#fff", padding: "4px 0", zIndex: 1 }}><strong style={{ flex: 1, color: "#13294B" }}>🏷️ Adesivi (solo sui vetri)</strong><button style={{ ...tool(), padding: "3px 10px" }} onClick={() => setStkOpen(false)}>✕ Chiudi</button></div>
              {STICKERS.map((s2) => <button key={s2.stk} onClick={() => addSticker(s2.stk)} style={{ ...tool(), display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 2px", fontSize: 11.5 }}>
                <span style={{ fontSize: 20, lineHeight: 1.1 }}>{s2.icon}</span>{s2.name}</button>)}
              <div style={{ gridColumn: "1 / -1", fontSize: 11.5, fontWeight: 800, color: "#475569", marginTop: 4 }}>Forme come adesivo</div>
              {SHAPES.filter((s2) => !["line", "checker"].includes(s2.t)).map((s2) => <button key={"g" + s2.t} onClick={() => { add(s2.t, true); setStkOpen(false); }} style={{ ...tool(), display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 2px", fontSize: 11 }}>
                <span style={{ fontSize: 17, lineHeight: 1.1 }}>{s2.icon}</span>{s2.name}</button>)}
              <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: "#64748B" }}>Gli adesivi stanno solo sui vetri.</div>
            </div>}
          </div>
          <button style={tool()} disabled={busy} onClick={() => fileRef.current?.click()}>🖼️ Foto</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) addPhoto(f); }} />
          <button style={tool(mode === "brush")} onClick={() => { setMode("brush"); setSelId(null); setShapesOpen(false); }}>🖌️ Pennello</button>
          <button style={tool(mode === "pick")} onClick={() => setMode(mode === "pick" ? "select" : "pick")} title="Prendi un colore dal mezzo">💧</button>
          <span style={{ width: 1, height: 26, background: "#E2E8F0" }} />
          <button style={tool()} onClick={doUndo} title="Annulla">↶</button>
          <button style={tool()} onClick={doRedo} title="Ripeti">↷</button>
          <span style={{ flex: 1 }} />
          <button style={tool(mode === "pan")} onClick={() => setMode(mode === "pan" ? "select" : "pan")} title="Sposta la vista (anche: tieni premuto Spazio, o due dita)">✋</button>
          <button style={tool()} onClick={() => zoomAt(0.8)} title="Riduci (−)">−</button>
          <span style={{ fontSize: 12.5, minWidth: 44, textAlign: "center", fontWeight: 700 }}>{Math.round(view.z * 100)}%</span>
          <button style={tool()} onClick={() => zoomAt(1.25)} title="Ingrandisci (+)">+</button>
          <button style={tool()} onClick={fitView} title="Adatta (0)">⤢</button>
          <button style={tool(full)} onClick={() => setFull(!full)} title="Schermo intero">{full ? "🗗" : "⛶"}</button>
          {(mode === "brush" || mode === "pick") && <div style={{ width: "100%", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid #EEF2F7", paddingTop: 6 }}>
            <input type="color" value={brush.color} onChange={(e) => setBrush({ ...brush, color: e.target.value })} />
            <span style={{ fontSize: 12, color: "#475569" }}>Spessore</span>
            <input type="range" min={2} max={60} value={brush.size} onChange={(e) => setBrush({ ...brush, size: +e.target.value })} />
            <span style={{ display: "inline-block", width: Math.min(30, brush.size), height: Math.min(30, brush.size), borderRadius: "50%", background: brush.color, border: "1px solid #CBD5E1" }} />
            {swatches((c) => { setBrush((b) => ({ ...b, color: c })); setMode("brush"); }, brush.color)}
          </div>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0, 1fr) 290px" : "1fr", gap: 10, alignItems: "start" }}>
          {/* tela: rotellina o due dita per lo zoom, ✋/Spazio/due dita per spostare la vista */}
          <div style={full ? { position: "fixed", inset: 0, zIndex: 60, background: "#0F172A", padding: 0 } : { ...box, padding: 0, overflow: "hidden" }}>
            {full && <div style={{ display: "flex", gap: 6, padding: 8, alignItems: "center", flexWrap: "wrap", background: "#13294B" }}>
              <button style={tool(mode === "select")} onClick={() => setMode("select")}>👆</button>
              <button style={tool(mode === "pan")} onClick={() => setMode(mode === "pan" ? "select" : "pan")}>✋</button>
              <button style={tool(mode === "brush")} onClick={() => { setMode("brush"); setSelId(null); }}>🖌️</button>
              <input type="color" value={brush.color} onChange={(e) => setBrush({ ...brush, color: e.target.value })} />
              <input type="range" min={1} max={60} value={brush.size} onChange={(e) => setBrush({ ...brush, size: +e.target.value })} style={{ width: 90 }} />
              <button style={tool()} onClick={doUndo}>↶</button><button style={tool()} onClick={doRedo}>↷</button>
              <span style={{ flex: 1 }} />
              <button style={tool()} onClick={() => zoomAt(0.8)}>−</button>
              <span style={{ color: "#fff", fontWeight: 800, minWidth: 48, textAlign: "center" }}>{Math.round(view.z * 100)}%</span>
              <button style={tool()} onClick={() => zoomAt(1.25)}>+</button>
              <button style={tool()} onClick={fitView}>⤢</button>
              <button style={{ ...tool(), background: "#16A34A", color: "#fff" }} onClick={() => setFull(false)}>✓ Fine</button>
            </div>}
            <div ref={vpRef} onClick={() => { setShapesOpen(false); setStkOpen(false); }}
                 style={{ position: "relative", width: "100%", height: vp.h, overflow: "hidden", touchAction: "none", cursor: mode === "pan" ? "grab" : undefined,
                   background: bg === "dark" ? "#1E293B" : bg === "light" ? "#F8FAFC" : "repeating-conic-gradient(#e8edf3 0% 25%, #fff 0% 50%) 50% / 22px 22px" }}
                 onPointerDownCapture={(e) => {
                   const r = vpRef.current!.getBoundingClientRect();
                   ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
                   if (ptrs.current.size === 2) {                       // due dita: zoom e spostamento
                     drag.current = null;
                     const [a, b] = Array.from(ptrs.current.values());
                     pinchRef.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top, z: view.z, x: view.x, y: view.y };
                     e.stopPropagation(); return;
                   }
                   if (mode === "pan" || space.current || e.button === 1) {
                     panRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
                     (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                     e.stopPropagation(); e.preventDefault();
                   }
                 }}
                 onPointerMove={(e) => {
                   if (ptrs.current.has(e.pointerId)) ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
                   const pc = pinchRef.current;
                   if (pc && ptrs.current.size >= 2) {
                     const r = vpRef.current!.getBoundingClientRect();
                     const [a, b] = Array.from(ptrs.current.values());
                     const z = Math.min(10, Math.max(1, pc.z * (Math.hypot(a.x - b.x, a.y - b.y) / pc.d)));
                     const cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
                     setView({ z, x: cx - ((pc.cx - pc.x) / pc.z) * z, y: cy - ((pc.cy - pc.y) / pc.z) * z });
                     return;
                   }
                   const p = panRef.current;
                   if (p) setView((v) => ({ ...v, x: p.vx + e.clientX - p.x, y: p.vy + e.clientY - p.y }));
                 }}
                 onPointerUp={(e) => { ptrs.current.delete(e.pointerId); if (ptrs.current.size < 2) pinchRef.current = null; panRef.current = null; }}
                 onPointerCancel={(e) => { ptrs.current.delete(e.pointerId); pinchRef.current = null; panRef.current = null; }}>
              <div style={{ position: "absolute", left: 0, top: 0, width: W * fit, height: H * fit, transformOrigin: "0 0", transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
                <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", imageRendering: view.z > 2.5 ? "pixelated" : "auto" }} />
                <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", cursor: mode === "brush" ? "crosshair" : mode === "pick" ? "copy" : mode === "pan" ? "grab" : "default" }}
                     onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
                  <rect x={0} y={0} width={W} height={H} fill="transparent" />
                  {sb && selected && mode === "select" && (() => {
                    const u = 1 / (fit * view.z), col = selected.ally ? "#059669" : "#2563EB";
                    const isLine = selected.t === "line", isPath = selected.t === "path";
                    const bx = isPath ? sb : { x: selected.x, y: selected.y, w: selected.w, h: selected.h };
                    const cx = bx.x + bx.w / 2, cy = bx.y + bx.h / 2, hw = Math.abs(bx.w) / 2, hh = Math.abs(bx.h) / 2;
                    const rot = isPath || isLine ? 0 : selected.r;
                    if (isLine) return <>
                      <line x1={selected.x} y1={selected.y} x2={selected.x + selected.w} y2={selected.y + selected.h} stroke={col} strokeWidth={ink} strokeDasharray={`${ink * 4} ${ink * 3}`} pointerEvents="none" />
                      {[["p0", selected.x, selected.y], ["p1", selected.x + selected.w, selected.y + selected.h]].map(([k, px, py]) =>
                        <circle key={k as string} data-h={k as string} cx={px as number} cy={py as number} r={handleR} fill="#fff" stroke={col} strokeWidth={2.4 * u} style={{ cursor: "move" }} />)}
                    </>;
                    return <g transform={`rotate(${rot} ${cx} ${cy})`}>
                      <rect x={cx - hw} y={cy - hh} width={Math.max(1, hw * 2)} height={Math.max(1, hh * 2)} fill="none" stroke={col} strokeWidth={ink * 1.2} pointerEvents="none" />
                      {!isPath && <>
                        <line x1={cx} y1={cy - hh} x2={cx} y2={cy - hh - 34 * u} stroke={col} strokeWidth={ink} pointerEvents="none" />
                        <g data-h="rot" style={{ cursor: "grab" }}>
                          <circle cx={cx} cy={cy - hh - 34 * u} r={11 * u} fill="#fff" stroke={col} strokeWidth={2.4 * u} />
                          <text x={cx} y={cy - hh - 34 * u} textAnchor="middle" dominantBaseline="central" fontSize={13 * u} fill={col} style={{ pointerEvents: "none", userSelect: "none" }}>↻</text>
                        </g>
                      </>}
                      {[[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]].map(([hx, hy]) => {
                        const corner = hx !== 0 && hy !== 0, hxp = cx + hx * hw, hyp = cy + hy * hh;
                        const cur = corner ? (hx === hy ? "nwse-resize" : "nesw-resize") : hx ? "ew-resize" : "ns-resize";
                        return corner
                          ? <circle key={`${hx}${hy}`} data-h={`${hx},${hy}`} cx={hxp} cy={hyp} r={handleR * 0.85} fill="#fff" stroke={col} strokeWidth={2.4 * u} style={{ cursor: cur }} />
                          : <rect key={`${hx}${hy}`} data-h={`${hx},${hy}`} x={hxp - (hx ? 5 : 11) * u} y={hyp - (hy ? 5 : 11) * u} width={(hx ? 10 : 22) * u} height={(hy ? 10 : 22) * u} rx={4 * u} fill="#fff" stroke={col} strokeWidth={2.2 * u} style={{ cursor: cur }} />;
                      })}
                    </g>;
                  })()}
                </svg>
              </div>
              {/* barra veloce sopra la forma scelta: si vede il disegno mentre si cambia */}
              {selected && mode === "select" && !drag.current && (() => {
                const b = bbox(selected), a = (selected.r * Math.PI) / 180, cx = selected.x + selected.w / 2, cy = selected.y + selected.h / 2;
                const ys = selected.t === "path" || selected.t === "line" ? [b.y, b.y + b.h]
                  : [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([kx, ky]) => cy + (kx * selected.w / 2) * Math.sin(a) + (ky * selected.h / 2) * Math.cos(a));
                const ys2 = selected.t === "path" || selected.t === "line" ? [b.y + b.h] : ys;
                const top = view.y + Math.min(...ys) * fit * view.z, bottom = view.y + Math.max(...ys2) * fit * view.z;
                const left = view.x + cx * fit * view.z;
                const above = top - 100 > 0;
                const fillKey: "fill" | "stroke" = ["line", "path"].includes(selected.t) ? "stroke" : "fill";
                return (
                  <div onPointerDown={(e) => e.stopPropagation()} style={{ position: "absolute", left: Math.max(150, Math.min(vp.w - 150, left)), top: above ? top - 94 : Math.min(vp.h - 52, bottom + 46), transform: "translateX(-50%)",
                    display: "flex", gap: 4, alignItems: "center", background: "#13294B", borderRadius: 12, padding: "5px 7px", boxShadow: "0 6px 18px rgba(0,0,0,.3)", zIndex: 8, whiteSpace: "nowrap" }}>
                    {selected.t !== "image" && <input type="color" title="Colore" value={(selected[fillKey] && selected[fillKey] !== "none" ? selected[fillKey] : "#ffffff") as string}
                      onChange={(e) => live(selected.id, { [fillKey]: e.target.value } as Partial<Item>)} style={{ width: 30, height: 28, border: "none", padding: 0, background: "none" }} />}
                    <span style={{ color: "#94A3B8", fontSize: 11 }}>passo</span>
                    {[1, 5, 20].map((n) => <button key={n} onClick={() => setStep(n)} style={{ ...tool(step === n), padding: "2px 7px", fontSize: 12, background: step === n ? "#F59E0B" : "#fff", color: "#13294B", border: "none" }}>{n}</button>)}
                    {!["line", "path"].includes(selected.t) && <button title="Raddrizza" onClick={() => patch(selected.id, { r: 0 })} style={{ ...tool(), padding: "3px 7px", border: "none" }}>⟲ 0°</button>}
                    {!selected.ally && <button title="Duplica" onClick={() => dup(selected)} style={{ ...tool(), padding: "3px 7px", border: "none" }}>⧉</button>}
                    <button title="Porta sopra" onClick={() => layer(selected.id, 1)} style={{ ...tool(), padding: "3px 7px", border: "none" }}>⬆</button>
                    {!selected.ally && <button title="Elimina" onClick={() => remove(selected)} style={{ ...tool(), padding: "3px 7px", border: "none", color: "#B91C1C" }}>🗑</button>}
                    <button title="Chiudi" onClick={() => setSelId(null)} style={{ ...tool(), padding: "3px 7px", border: "none" }}>✕</button>
                  </div>);
              })()}
              {/* livelli sul foglio di lavoro */}
              <button onClick={() => setLayersOpen(!layersOpen)} style={{ position: "absolute", left: 8, top: 8, zIndex: 9, ...tool(layersOpen), padding: "5px 10px", boxShadow: "0 2px 8px rgba(0,0,0,.15)" }}>🗂️ Livelli ({items.length})</button>
              {layersOpen && <div onPointerDown={(e) => e.stopPropagation()} style={{ position: "absolute", left: 8, top: 46, zIndex: 9, width: 250, maxHeight: vp.h - 60, overflow: "auto", background: "rgba(255,255,255,.97)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.2)", padding: 8 }}>
                <div style={{ fontSize: 11.5, color: "#64748B", marginBottom: 6 }}>In alto = sopra. Tocca per scegliere.</div>
                {layers}
              </div>}
              {/* sfondo e aiuto */}
              <div style={{ position: "absolute", right: 8, bottom: 8, display: "flex", gap: 4, background: "rgba(255,255,255,.9)", borderRadius: 8, padding: 3 }}>
                {([["chess", "▦"], ["light", "☀️"], ["dark", "🌙"]] as const).map(([k, ic]) => (
                  <button key={k} onClick={() => setBg(k)} title="Sfondo" style={{ ...tool(bg === k), padding: "2px 7px", fontSize: 12 }}>{ic}</button>))}
                <button onClick={() => setGhost(!ghost)} title="Mostra in trasparenza le parti che non si vedranno (vetri, ruote, fanali)" style={{ ...tool(ghost), padding: "2px 7px", fontSize: 12 }}>👻</button>
              </div>
              {selected && !["line", "path"].includes(selected.t) && (() => {
                const b = bbox(selected); const cv = coverage(b.x, b.y, b.w, b.h, !!selected.glass);
                if (cv > 0.5) return null;
                return <div style={{ position: "absolute", left: "50%", top: 8, transform: "translateX(-50%)", background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D", borderRadius: 10, padding: "5px 10px", fontSize: 12.5, fontWeight: 600, display: "flex", gap: 8, alignItems: "center", zIndex: 5, maxWidth: "92%" }}>
                  <span>⚠️ {cv < 0.05 ? "Non si vede" : "Si vede poco"}: {selected.glass ? "gli adesivi stanno solo sui vetri" : "qui ci sono vetri, ruote o fanali"}.</span>
                  <button style={{ ...tool(), padding: "2px 8px", fontSize: 12 }} onClick={() => { const sp = bestSpot(b.x, b.y, b.w, b.h, !!selected.glass); patch(selected.id, { x: selected.x + sp.x - b.x, y: selected.y + sp.y - b.y }); }}>📍 Spostala</button>
                </div>;
              })()}
              {view.z === 1 && <div style={{ position: "absolute", left: 8, bottom: 8, fontSize: 11.5, color: "#475569", background: "rgba(255,255,255,.85)", borderRadius: 6, padding: "2px 7px" }}>
                {wide ? "🖱️ Rotellina = zoom · Spazio + trascina = sposta" : "🤏 Due dita = zoom e sposta"}
              </div>}
            </div>
            {/* comandi sempre sotto il foglio di lavoro */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", padding: "8px 10px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC" }}>
              {(() => {
                const sl = selected; const dis = !sl || mode !== "select";
                const mv = (dx: number, dy: number) => sl && !sl.locked && patch(sl.id, { x: sl.x + dx * step, y: sl.y + dy * step, pts: sl.pts?.map(([x, y]) => [x + dx * step, y + dy * step] as [number, number]) });
                const sz = (k: number) => { if (!sl || sl.locked || sl.t === "path") return; const cx = sl.x + sl.w / 2, cy = sl.y + sl.h / 2, nw = Math.max(6, sl.w * k), nh = Math.max(4, sl.h * k); patch(sl.id, { w: nw, h: nh, x: cx - nw / 2, y: cy - nh / 2 }); };
                const rb = (ch: string, fn: () => void, title: string, big = false) => <button title={title} disabled={dis} onClick={fn}
                  style={{ ...tool(), padding: big ? "6px 12px" : "6px 9px", fontSize: big ? 17 : 14, opacity: dis ? 0.4 : 1, minWidth: 38 }}>{ch}</button>;
                return <>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#475569", minWidth: 70 }}>{sl ? (sl.ally ? "🤝 Logo" : KIND_NAME[sl.t]) : "Nessuna forma"}</span>
                  <div style={{ display: "flex", gap: 3 }}>{rb("←", () => mv(-1, 0), "Sinistra", true)}{rb("↑", () => mv(0, -1), "Su", true)}{rb("↓", () => mv(0, 1), "Giù", true)}{rb("→", () => mv(1, 0), "Destra", true)}</div>
                  <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                    <span style={{ fontSize: 11.5, color: "#64748B" }}>passo</span>
                    {[1, 5, 20].map((n) => <button key={n} onClick={() => setStep(n)} style={{ ...tool(step === n), padding: "4px 8px", fontSize: 12 }}>{n}</button>)}
                  </div>
                  <span style={{ width: 1, height: 26, background: "#E2E8F0" }} />
                  {rb("➖", () => sz(1 / 1.08), "Più piccola")}{rb("➕", () => sz(1.08), "Più grande")}
                  {rb("↺", () => sl && patch(sl.id, { r: Math.round(sl.r) - (step === 20 ? 15 : step) }), `Ruota a sinistra di ${step === 20 ? 15 : step}°`)}{rb("↻", () => sl && patch(sl.id, { r: Math.round(sl.r) + (step === 20 ? 15 : step) }), `Ruota a destra di ${step === 20 ? 15 : step}°`)}
                  {rb("↔", () => sl && mirror(sl, false), "Specchia sinistra-destra")}{rb("↕", () => sl && mirror(sl, true), "Capovolgi sopra-sotto")}
                  {rb("⬆", () => sl && layer(sl.id, 1), "Porta sopra")}{rb("⬇", () => sl && layer(sl.id, -1), "Porta sotto")}
                  {rb("⧉", () => sl && dup(sl), "Duplica")}{rb("🗑", () => sl && remove(sl), "Elimina")}
                  {!sl && <span style={{ fontSize: 12, color: "#64748B" }}>Tocca una forma sul mezzo per usare i comandi.</span>}
                </>;
              })()}
            </div>
          </div>

          {/* pannello laterale */}
          <div style={{ ...box, position: wide ? "sticky" : "static", top: 62 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <button style={{ ...tool(side === "props"), flex: 1 }} onClick={() => setSide("props")}>🎛️ Proprietà</button>
              <button style={{ ...tool(side === "layers"), flex: 1 }} onClick={() => setSide("layers")}>🗂️ Livelli ({items.length})</button>
            </div>
            {side === "props" ? props : layers}
          </div>
        </div>

        <div style={{ fontWeight: 800, color: "#13294B", margin: "8px 2px 6px" }}>3️⃣ Salva e scegli a chi va</div>
        {/* a chi va e salvataggio */}
        <div style={box}>
          <div style={{ display: "grid", gridTemplateColumns: wide ? "260px 1fr" : "1fr", gap: 12 }}>
            <div><span style={lbl}>Nome della livrea</span>
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} style={{ ...sel, boxSizing: "border-box" }} /></div>
            <div>
              <span style={lbl}>A chi va questa livrea</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button style={tool(target === "all")} onClick={() => setTarget("all")}>🌍 Tutti i {model?.name ?? "mezzi"} ({myVehs.length})</button>
                <button style={tool(target === "bases")} onClick={() => setTarget("bases")}>🏠 Solo alcune sedi</button>
                <button style={tool(target === "vehicles")} onClick={() => setTarget("vehicles")}>🚑 Solo alcuni mezzi</button>
              </div>
            </div>
          </div>
          {target === "bases" && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {bases.filter((b) => myVehs.some((v) => v.base_id === b.id)).map((b) => { const on = pickB.includes(b.id); return (
              <button key={b.id} onClick={() => setPickB(on ? pickB.filter((x) => x !== b.id) : [...pickB, b.id])}
                      style={{ ...tool(), padding: "5px 9px", fontSize: 13, background: on ? "#DCFCE7" : "#fff", borderColor: on ? "#16A34A" : "#CBD5E1" }}>
                {on ? "✅ " : ""}{b.is_headquarters ? "⭐ " : ""}{b.name} · {myVehs.filter((v) => v.base_id === b.id).length}
              </button>); })}
          </div>}
          {target === "vehicles" && <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <button style={{ ...tool(), padding: "4px 9px", fontSize: 12.5 }} onClick={() => setPickV(myVehs.map((v) => v.id))}>Tutti</button>
              <button style={{ ...tool(), padding: "4px 9px", fontSize: 12.5 }} onClick={() => setPickV([])}>Nessuno</button>
              <span style={{ fontSize: 12.5, color: "#64748B", alignSelf: "center" }}>{pickV.length} scelti</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 5, maxHeight: 220, overflow: "auto" }}>
              {myVehs.map((v) => { const on = pickV.includes(v.id); return (
                <button key={v.id} onClick={() => setPickV(on ? pickV.filter((x) => x !== v.id) : [...pickV, v.id])}
                        style={{ ...tool(), textAlign: "left", padding: "5px 8px", fontSize: 12.5, background: on ? "#DCFCE7" : "#fff", borderColor: on ? "#16A34A" : "#CBD5E1" }}>
                  {on ? "✅ " : "⬜ "}<b>{v.call_sign}</b> · {baseName(v.base_id)}
                </button>); })}
            </div>
          </div>}
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 6 }}>Se un mezzo ha più livree vale quella dei mezzi scelti, poi quella delle sedi, poi quella per tutti.</div>
          {msg && <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: msg.ok ? "#DCFCE7" : "#FEE2E2", color: msg.ok ? "#166534" : "#991B1B", fontWeight: 600 }}>{msg.text}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button style={{ ...btn, background: "#16A34A", opacity: busy ? 0.5 : 1, fontSize: 15 }} disabled={busy || !blank} onClick={save}>{busy ? "Salvo…" : "💾 Salva e applica"}</button>
            <button style={{ ...btn, background: "#fff", color: "#B91C1C", border: "1px solid #FCA5A5" }} disabled={busy} onClick={del}>{cur ? "↩️ Rimetti la livrea ufficiale" : "🧹 Ricomincia"}</button>
          </div>
        </div>
      </div>
    </main>
  );
}
