"use client";
// Editor livrea: forme (strisce, cerchi, triangoli, stelle, chevron, onde, sagomature…), sfumature, testo, scacchi, foto, pennello.
// Si personalizzano solo i modelli che hai comprato; la livrea va a tutti i mezzi del modello, ad alcune sedi o ad alcuni mezzi.
// Se sei in un'alleanza il logo dell'alleanza è obbligatorio (si sposta e si ridimensiona, ma non si toglie).
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPE } from "react";
import { useRouter } from "next/navigation";
import { supabase, friendlyError } from "@/lib/supabase";
import { gameConfirm } from "@/lib/confirm";
import { loadVehicleLiveries } from "@/lib/liveries";
import { type Item, type Kind, type Design, uid, SHAPES, STICKERS, glassMaskOf, KIND_NAME, FILLABLE, PRESETS, loadImg, blankOf, paintMaskOf, imgCache, compose, bbox } from "@/components/livery/engine";

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
  const [side, setSide] = useState<"props" | "layers" | "start">("props");
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedSnap, setSavedSnap] = useState("[]");
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [mapPrev, setMapPrev] = useState<string | null>(null);
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
  const [wide, setWide] = useState(true);
  const undo = useRef<Item[][]>([]); const redo = useRef<Item[][]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ kind: "move" | "size" | "brush"; id: string; sx: number; sy: number; orig: Item } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const W = blank?.width ?? 900, H = blank?.height ?? 400;
  const model = models.find((m) => m.id === modelId) ?? null;
  const fit = Math.min(vp.w / W, vp.h / H);                      // a zoom 1 il mezzo entra tutto
  const fitView = useCallback(() => setView({ z: 1, x: (vp.w - W * fit) / 2, y: (vp.h - H * fit) / 2 }), [vp.w, vp.h, W, H, fit]);
  useEffect(() => { fitView(); }, [fitView]);
  useEffect(() => {
    const f = () => {
      const w = vpRef.current?.clientWidth ?? 800;
      const h = full ? window.innerHeight - 70 : Math.min(window.innerHeight * 0.66, Math.max(240, (w * H) / W + 24));
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
  }, [blank, paint, glass, items, tick, W, H]);

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
    redo.current = []; setItems(withAlly(next));
  }, [items, withAlly]);
  const patch = (id: string, p: Partial<Item>) => commit(items.map((it) => (it.id === id ? { ...it, ...p } : it)));
  const live = (id: string, p: Partial<Item>) => setItems((l) => l.map((it) => (it.id === id ? { ...it, ...p } : it)));   // durante gli slider

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
      t === "wave" ? { ...base, x: W * 0.05, y: H * 0.45, w: W * 0.9, h: H * 0.12, fill: "#0EA5E9" } :
      t === "swoosh" ? { ...base, x: W * 0.15, y: H * 0.3, w: W * 0.7, h: H * 0.35, fill: "#F97316", g2: "#FACC15", gdir: "h" } :
      t === "chevron" || t === "arrow" ? { ...base, w: H * 0.3, h: H * 0.22, fill: "#FACC15" } :
      t === "text" ? { ...base, x: W * 0.3, y: H * 0.42, w: W * 0.4, h: H * 0.09, fill: "#1D4ED8", text: "AMBULANZA", bold: true } : base;
    const fin = onGlass ? { ...it, glass: true, x: W * 0.3, y: H * 0.22, w: Math.min(it.w, H * 0.2), h: Math.min(it.h, H * 0.2), g2: undefined } : it;
    commit([...items, fin]); setSelId(fin.id); setMode("select"); setShapesOpen(false); setSide("props");
  }
  function addSticker(k: string) {
    const st = STICKERS.find((x) => x.stk === k); if (!st) return;
    const h = H * 0.13;
    const it: Item = { id: uid(), t: "sticker", stk: st.stk, x: W * 0.3, y: H * 0.22, w: h * st.w, h: h * st.h, r: 0, fill: st.fill, c2: st.c2, stroke: "#000", sw: 0, op: st.stk === "glasstext" ? 0.85 : 1, text: st.text, glass: true };
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
    const handle = (e.target as Element).getAttribute?.("data-h");
    if (handle && selected) { drag.current = { kind: "size", id: selected.id, sx: x, sy: y, orig: { ...selected } }; undo.current.push(items); return; }
    const hit = [...items].reverse().find((it) => { const b = bbox(it); const pad = Math.max(8, it.sw); return x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad; });
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
      if (it.t === "path") {
        const b = bbox(d.orig); const sx = Math.max(0.05, (b.w + dx) / (b.w || 1)), sy = Math.max(0.05, (b.h + dy) / (b.h || 1));
        return { ...it, pts: d.orig.pts?.map(([px, py]) => [b.x + (px - b.x) * sx, b.y + (py - b.y) * sy] as [number, number]) };
      }
      if (it.t === "line") return { ...it, w: d.orig.w + dx, h: d.orig.h + dy };
      const keep = (it.t === "image" || e.shiftKey) ? d.orig.h / (d.orig.w || 1) : null;
      const nw = Math.max(6, d.orig.w + dx);
      return { ...it, w: nw, h: keep ? nw * keep : Math.max(4, d.orig.h + dy) };
    }));
  }
  function up() {
    const d = drag.current; drag.current = null;
    if (d?.kind === "brush") setItems((list) => list.map((it) => (it.id === d.id ? { ...it, ...bbox(it) } : it)));
  }
  const doUndo = useCallback(() => { const p = undo.current.pop(); if (p) { redo.current.push(items); setItems(withAlly(p)); } }, [items, withAlly]);
  const doRedo = useCallback(() => { const n = redo.current.pop(); if (n) { undo.current.push(items); setItems(withAlly(n)); } }, [items, withAlly]);
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
      if (!e.ctrlKey && !e.metaKey && k === "v") { setMode("select"); return; }
      if (!e.ctrlKey && !e.metaKey && k === "b") { setMode("brush"); setSelId(null); return; }
      if (!e.ctrlKey && !e.metaKey && k === "h") { setMode("pan"); return; }
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
      setSaveOpen(false); markSaved(finalItems);
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
      {selected.t === "sticker" && <div style={{ marginBottom: 8 }}>
        <span style={lbl}>Colori adesivo</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12 }}>Sfondo</span><input type="color" value={selected.fill} onChange={(e) => live(selected.id, { fill: e.target.value })} />
          <span style={{ fontSize: 12 }}>Simbolo</span><input type="color" value={selected.c2 ?? "#ffffff"} onChange={(e) => live(selected.id, { c2: e.target.value })} />
        </div>
        {selected.text !== undefined && <input value={selected.text ?? ""} onChange={(e) => live(selected.id, { text: e.target.value.slice(0, 30) })} placeholder="Scritta"
          style={{ ...sel, boxSizing: "border-box", marginTop: 6 }} />}
      </div>}
      {!selected.ally && <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, fontWeight: 700, marginBottom: 8, background: selected.glass ? "#E0F2FE" : "transparent", borderRadius: 8, padding: "4px 6px" }}>
        <input type="checkbox" checked={!!selected.glass} onChange={(e) => patch(selected.id, { glass: e.target.checked })} /> 🪟 Adesivo sui vetri (non va sulla carrozzeria)
      </label>}
      {selected.t === "text" && !selected.ally && <div style={{ marginBottom: 8 }}><span style={lbl}>Testo</span>
        <input value={selected.text ?? ""} onChange={(e) => live(selected.id, { text: e.target.value.slice(0, 40) })} style={{ ...sel, boxSizing: "border-box" }} />
        <label style={{ fontSize: 13 }}><input type="checkbox" checked={!!selected.bold} onChange={(e) => patch(selected.id, { bold: e.target.checked })} /> Grassetto</label></div>}
      {(isFillable || selected.t === "checker") && <div style={{ marginBottom: 8 }}>
        <span style={lbl}>{selected.t === "checker" ? "Colori scacchi" : "Colore"}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5 }}>
          <input type="color" value={selected.fill === "none" ? "#ffffff" : selected.fill} onChange={(e) => live(selected.id, { fill: e.target.value })} />
          {selected.t === "checker" && <input type="color" value={selected.c2 ?? "#1D4ED8"} onChange={(e) => live(selected.id, { c2: e.target.value })} />}
          {FILLABLE.includes(selected.t) && <label style={{ fontSize: 12.5 }}><input type="checkbox" checked={selected.fill !== "none"} onChange={(e) => patch(selected.id, { fill: e.target.checked ? "#F97316" : "none", sw: e.target.checked ? selected.sw : Math.max(selected.sw, 6) })} /> riempita</label>}
        </div>
        {swatches((c) => patch(selected.id, { fill: c }), selected.fill)}
      </div>}
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
      {!["line", "path"].includes(selected.t) && <div style={{ marginBottom: 8 }}><span style={lbl}>Rotazione {Math.round(selected.r)}°</span>
        <input type="range" min={-180} max={180} value={selected.r} onChange={(e) => live(selected.id, { r: +e.target.value })} style={{ width: "100%" }} /></div>}
      <div style={{ marginBottom: 8 }}><span style={lbl}>Trasparenza {Math.round((1 - selected.op) * 100)}%</span>
        <input type="range" min={10} max={100} value={Math.round(selected.op * 100)} onChange={(e) => live(selected.id, { op: +e.target.value / 100 })} style={{ width: "100%" }} /></div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {!["line", "path"].includes(selected.t) && <button style={tool(!!selected.flip)} onClick={() => patch(selected.id, { flip: !selected.flip })}>↔ Specchia</button>}
        <button style={tool()} onClick={() => layer(selected.id, 1)}>⬆️ Sopra</button>
        <button style={tool()} onClick={() => layer(selected.id, -1)}>⬇️ Sotto</button>
        {!selected.ally && <button style={tool()} onClick={() => dup(selected)}>⧉ Duplica</button>}
        <button style={tool()} onClick={() => setMode("pick")}>💧 Prendi colore</button>
        {!selected.ally && <button style={{ ...tool(), color: "#B91C1C" }} onClick={() => remove(selected)}>🗑️ Elimina</button>}
      </div>
    </div>
  ) : (
    <div style={{ color: "#64748B", fontSize: 13.5, lineHeight: 1.5 }}>
      <strong style={{ color: "#13294B" }}>Come si usa</strong><br />
      • Aggiungi una forma, un testo o una foto dalla barra.<br />
      • Tocca una forma per sceglierla e trascinala; il pallino blu la ingrandisce (con Maiusc mantiene le proporzioni).<br />
      • Qui compaiono colore, sfumatura, bordo, rotazione e trasparenza.<br />
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
          <button style={{ ...tool(), padding: "2px 6px" }} onClick={(e) => { e.stopPropagation(); layer(it.id, 1); }}>↑</button>
          <button style={{ ...tool(), padding: "2px 6px" }} onClick={(e) => { e.stopPropagation(); layer(it.id, -1); }}>↓</button>
          {!it.ally && <button style={{ ...tool(), padding: "2px 6px", color: "#B91  // ---------- modifiche non salvate ----------
  const snap = JSON.stringify(items.filter((i) => !i.ally).map(({ id: _id, ...r }) => r));   // eslint-disable-line @typescript-eslint/no-unused-vars
  const dirty = snap !== savedSnap;
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", f); return () => window.removeEventListener("beforeunload", f);
  }, [dirty]);
  // quando apro/salvo una livrea, quello è il punto "salvato"
  const markSaved = useCallback((list: Item[]) => setSavedSnap(JSON.stringify(list.filter((i) => !i.ally).map(({ id: _id, ...r }) => r))), []); // eslint-disable-line @typescript-eslint/no-unused-vars
  useEffect(() => { markSaved(cur ? items : []); }, [cur?.id, modelId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function askDiscard(): Promise<boolean> {
    return !dirty || await gameConfirm("Modifiche non salvate\nSe cambi adesso perdi le modifiche alla livrea. Continuare?");
  }
  // anteprime delle livree pronte sul mezzo scelto
  useEffect(() => {
    if (!blank) return;
    const t = setTimeout(() => {
      setThumbs(PRESETS.map((pr) => {
        const big = compose(blank, withAlly(pr.make(W, H)), paint, glass);
        const c = document.createElement("canvas"); c.width = 220; c.height = Math.round((H * 220) / W);
        c.getContext("2d")!.drawImage(big, 0, 0, c.width, c.height); return c.toDataURL("image/png");
      }));
    }, 50);
    return () => clearTimeout(t);
  }, [blank, paint, glass, W, H]); // eslint-disable-line react-hooks/exhaustive-deps
  // come la vedono gli altri sulla mappa (icona piccola)
  useEffect(() => {
    if (!blank) return;
    const t = setTimeout(() => {
      const big = compose(blank, items, paint, glass);
      const c = document.createElement("canvas"); c.width = 160; c.height = Math.round((H * 160) / W);
      const g = c.getContext("2d")!; g.imageSmoothingQuality = "high"; g.drawImage(big, 0, 0, c.width, c.height);
      setMapPrev(c.toDataURL("image/png"));
    }, 400);
    return () => clearTimeout(t);
  }, [blank, paint, glass, items, W, H]);

  if (org && !models.length) return (
    <main style={shell}><div style={{ maxWidth: 700, margin: "0 auto", padding: 16 }}>
      <a href="/" style={{ color: "#64748B", textDecoration: "none" }}>← Mappa</a>
      <div style={{ ...box, marginTop: 10 }}>🎨 Compra un mezzo nel Garage: poi potrai disegnarne la livrea qui.</div>
    </div></main>);

  const rail: [string, string, () => void, boolean, string?][] = [
    ["👆", "Scegli", () => setMode("select"), mode === "select", "V"],
    ["✋", "Vista", () => setMode(mode === "pan" ? "select" : "pan"), mode === "pan", "H o Spazio"],
    ["🔷", "Forme", () => { setShapesOpen(!shapesOpen); setStkOpen(false); }, shapesOpen],
    ["🏷️", "Adesivi", () => { setStkOpen(!stkOpen); setShapesOpen(false); }, stkOpen],
    ["🔤", "Testo", () => add("text"), false],
    ["🖼️", "Foto", () => fileRef.current?.click(), false],
    ["🖌️", "Pennello", () => { setMode("brush"); setSelId(null); setShapesOpen(false); setStkOpen(false); }, mode === "brush", "B"],
    ["💧", "Colore", () => setMode(mode === "pick" ? "select" : "pick"), mode === "pick"],
  ];
  const flyout = (shapesOpen || stkOpen) && (
    <div style={{ position: "absolute", zIndex: 30, ...(wide ? { left: 78, top: 0 } : { left: 0, right: 0, bottom: 70 }), background: "#fff", borderRadius: 14, boxShadow: "0 12px 32px rgba(15,23,42,.25)", padding: 10, width: wide ? 360 : "auto", maxHeight: "70vh", overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ flex: 1, color: "#13294B" }}>{shapesOpen ? "🔷 Forme" : "🏷️ Adesivi (solo sui vetri)"}</strong>
        <button style={{ ...tool(), padding: "2px 8px" }} onClick={() => { setShapesOpen(false); setStkOpen(false); }}>✕</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {shapesOpen && SHAPES.map((s2) => <button key={s2.t} onClick={() => add(s2.t)} style={{ ...tool(), display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 2px", fontSize: 11.5, gap: 2 }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>{s2.icon}</span>{s2.name}</button>)}
        {stkOpen && <>
          {STICKERS.map((s2) => <button key={s2.stk} onClick={() => addSticker(s2.stk)} style={{ ...tool(), display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 2px", fontSize: 11.5, gap: 2 }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{s2.icon}</span>{s2.name}</button>)}
          <div style={{ gridColumn: "1 / -1", fontSize: 11.5, fontWeight: 800, color: "#64748B", marginTop: 4, textTransform: "uppercase" }}>Forme come adesivo</div>
          {SHAPES.filter((s2) => !["line", "checker"].includes(s2.t)).map((s2) => <button key={"g" + s2.t} onClick={() => { add(s2.t, true); setStkOpen(false); }} style={{ ...tool(), display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 2px", fontSize: 11, gap: 2 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{s2.icon}</span>{s2.name}</button>)}
        </>}
      </div>
    </div>);
  const brushBar = (mode === "brush" || mode === "pick") && (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "8px 10px", background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.08)", marginBottom: 8 }}>
      <strong style={{ fontSize: 13, color: "#13294B" }}>{mode === "brush" ? "🖌️ Pennello" : "💧 Tocca il mezzo per prendere un colore"}</strong>
      {mode === "brush" && <>
        <input type="color" value={brush.color} onChange={(e) => setBrush({ ...brush, color: e.target.value })} />
        <input type="range" min={1} max={60} value={brush.size} onChange={(e) => setBrush({ ...brush, size: +e.target.value })} />
        <span style={{ display: "inline-block", width: Math.min(28, brush.size), height: Math.min(28, brush.size), borderRadius: "50%", background: brush.color, border: "1px solid #CBD5E1" }} />
        {swatches((c) => setBrush((b) => ({ ...b, color: c })), brush.color)}
      </>}
      <span style={{ flex: 1 }} />
      <button style={{ ...tool(), padding: "4px 10px" }} onClick={() => setMode("select")}>Fine</button>
    </div>);
  const start = (
    <div>
      <span style={lbl}>✨ Parti da una livrea pronta</span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
        {PRESETS.map((pr, i) => (
          <button key={pr.name} onClick={() => { commit(pr.make(W, H)); setSelId(null); setSide("props"); setMsg({ ok: true, text: "Base pronta: cambiala come vuoi." }); }}
                  style={{ border: "1px solid #E2E8F0", borderRadius: 10, background: "#F8FAFC", padding: 4, cursor: "pointer", textAlign: "center" }}>
            {thumbs[i] ? <img src={thumbs[i]} alt="" style={{ width: "100%", display: "block" }} /> : <div style={{ height: 50 }} />}
            <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginTop: 2 }}>{pr.name.replace(/^\S+\s/, "")}</div>
          </button>))}
      </div>
      {lvs.length > 0 && <>
        <span style={lbl}>📋 Copia un mio lavoro</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {lvs.map((l) => (
            <button key={l.id} onClick={() => copyFrom(l.id)} style={{ ...tool(), display: "flex", gap: 8, alignItems: "center", textAlign: "left", padding: 5 }}>
              {l.image_url && <img src={l.image_url.replace(/\.png$/, "-map.png")} alt="" style={{ width: 64 }} />}
              <span style={{ fontSize: 12.5 }}><b>{l.name}</b><br /><span style={{ color: "#64748B" }}>{models.find((m) => m.id === l.model_id)?.name ?? "?"}</span></span>
            </button>))}
        </div>
      </>}
    </div>);

  return (
    <main style={shell}>
      {/* barra in alto: sempre visibile */}
      <div style={{ position: "sticky", top: 0, zIndex: 40, background: "#13294B", color: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,.2)" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <a href="/" onClick={async (e) => { if (dirty) { e.preventDefault(); if (await askDiscard()) { setSavedSnap(snap); window.location.href = "/"; } } }} style={{ color: "#CBD5E1", textDecoration: "none", fontSize: 14 }}>← Mappa</a>
          <strong style={{ fontSize: 17 }}>🖌️ Livrea</strong>
          <select value={cur?.id ?? ""} onChange={async (e) => { if (await askDiscard()) openLivery(myLvs.find((l) => l.id === e.target.value) ?? null); }}
                  style={{ ...sel, width: "auto", minWidth: 170, padding: "6px 8px", background: "#1E3A66", color: "#fff", border: "1px solid #345" }}>
            <option value="">➕ Nuova livrea</option>
            {myLvs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          {ally && <span title="Logo dell'alleanza obbligatorio" style={{ background: "rgba(16,185,129,.2)", color: "#A7F3D0", borderRadius: 999, padding: "3px 9px", fontSize: 12, fontWeight: 700 }}>🤝 {ally.name}</span>}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12.5, color: dirty ? "#FCD34D" : "#86EFAC" }}>{dirty ? "● Modifiche non salvate" : cur ? "✓ Salvata" : ""}</span>
          <button style={tool()} onClick={doUndo} title="Annulla (Ctrl+Z)">↶</button>
          <button style={tool()} onClick={doRedo} title="Ripeti (Ctrl+Y)">↷</button>
          <button style={{ ...btn, background: "#16A34A", fontSize: 15, padding: "8px 16px" }} disabled={busy || !blank} onClick={() => setSaveOpen(true)}>💾 Salva</button>
        </div>
        {/* scelta del mezzo: miniature */}
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 12px 8px", display: "flex", gap: 6, overflowX: "auto" }}>
          {models.map((m) => (
            <button key={m.id} onClick={async () => { if (m.id === modelId || !(await askDiscard())) return; setModelId(m.id); setCur(null); setItems(withAlly([])); setSelId(null); }}
                    style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 4px", borderRadius: 10, cursor: "pointer",
                      background: m.id === modelId ? "#fff" : "rgba(255,255,255,.08)", color: m.id === modelId ? "#13294B" : "#E2E8F0", border: m.id === modelId ? "2px solid #F59E0B" : "1px solid rgba(255,255,255,.15)" }}>
              <img src={(m.image_url ?? "").replace(/\.png$/, "-map.png")} alt="" style={{ width: 54, height: 26, objectFit: "contain" }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>{m.name} <span style={{ opacity: 0.7 }}>· {vehs.filter((v) => v.model_id === m.id).length}</span></span>
            </button>))}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) addPhoto(f); }} />

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 10, display: "grid", gridTemplateColumns: wide ? "70px minmax(0, 1fr) 330px" : "1fr", gap: 10, alignItems: "start" }}>
        {/* strumenti */}
        <div style={wide ? { position: "sticky", top: 112, display: "flex", flexDirection: "column", gap: 6 }
                         : { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 45, background: "#fff", boxShadow: "0 -4px 16px rgba(0,0,0,.15)", padding: "6px 6px calc(6px + env(safe-area-inset-bottom))", display: "flex", gap: 4, overflowX: "auto" }}>
          {rail.map(([ic, name, fn, on, key]) => (
            <button key={name} onClick={fn} title={key ? `${name} (${key})` : name}
                    style={{ flex: wide ? undefined : "0 0 62px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 2px", borderRadius: 12, cursor: "pointer", fontSize: 11, fontWeight: 700,
                      background: on ? "#13294B" : "#fff", color: on ? "#fff" : "#13294B", border: on ? "1px solid #13294B" : "1px solid #E2E8F0", boxShadow: wide ? "0 1px 3px rgba(0,0,0,.06)" : undefined }}>
              <span style={{ fontSize: 21, lineHeight: 1 }}>{ic}</span>{name}
            </button>))}
          {flyout}
        </div>

        {/* tela */}
        <div style={{ minWidth: 0, paddingBottom: wide ? 0 : 80 }}>
          {brushBar}
          {msg && <div onClick={() => setMsg(null)} style={{ marginBottom: 8, padding: "8px 12px", borderRadius: 10, background: msg.ok ? "#DCFCE7" : "#FEE2E2", color: msg.ok ? "#166534" : "#991B1B", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>{msg.text} <span style={{ opacity: 0.5 }}>✕</span></div>}
          <div style={{ position: "relative" }}>
          
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
                  {sb && selected && mode === "select" && <>
                    <rect x={sb.x} y={sb.y} width={Math.max(1, sb.w)} height={Math.max(1, sb.h)} fill="none" stroke={selected.ally ? "#059669" : "#2563EB"} strokeWidth={ink} strokeDasharray={`${ink * 4} ${ink * 3}`} pointerEvents="none" />
                    <circle data-h="1" cx={selected.t === "line" ? selected.x + selected.w : sb.x + sb.w} cy={selected.t === "line" ? selected.y + selected.h : sb.y + sb.h}
                            r={handleR} fill="#2563EB" stroke="#fff" strokeWidth={ink} style={{ cursor: "nwse-resize" }} />
                  </>}
                </svg>
              </div>
              {/* sfondo e aiuto */}
              <div style={{ position: "absolute", right: 8, bottom: 8, display: "flex", gap: 4, background: "rgba(255,255,255,.9)", borderRadius: 8, padding: 3 }}>
                {([["chess", "▦"], ["light", "☀️"], ["dark", "🌙"]] as const).map(([k, ic]) => (
                  <button key={k} onClick={() => setBg(k)} title="Sfondo" style={{ ...tool(bg === k), padding: "2px 7px", fontSize: 12 }}>{ic}</button>))}
              </div>
              {view.z === 1 && <div style={{ position: "absolute", left: 8, bottom: 8, fontSize: 11.5, color: "#475569", background: "rgba(255,255,255,.85)", borderRadius: 6, padding: "2px 7px" }}>
                {wide ? "🖱️ Rotellina = zoom · Spazio + trascina = sposta" : "🤏 Due dita = zoom e sposta"}
              </div>}
            </div>
          </div>

            {/* zoom sempre a portata */}
            {!full && <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 18, display: "flex", gap: 4, alignItems: "center", background: "rgba(19,41,75,.92)", borderRadius: 999, padding: "4px 6px", zIndex: 5 }}>
              <button style={{ ...tool(), borderRadius: 999, padding: "3px 10px" }} onClick={() => zoomAt(0.8)}>−</button>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 12.5, minWidth: 46, textAlign: "center" }}>{Math.round(view.z * 100)}%</span>
              <button style={{ ...tool(), borderRadius: 999, padding: "3px 10px" }} onClick={() => zoomAt(1.25)}>+</button>
              <button style={{ ...tool(), borderRadius: 999, padding: "3px 9px" }} onClick={fitView} title="Adatta">⤢</button>
              <button style={{ ...tool(), borderRadius: 999, padding: "3px 9px" }} onClick={() => setFull(true)} title="Schermo intero">⛶</button>
            </div>}
            {/* tela vuota: suggerimento */}
            {blank && !items.some((i) => !i.ally) && !full && <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(255,255,255,.95)", borderRadius: 12, padding: "8px 12px", boxShadow: "0 4px 14px rgba(0,0,0,.12)", fontSize: 13.5, zIndex: 5, display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
              Il mezzo è bianco.
              <button style={{ ...btn, padding: "5px 10px", fontSize: 13 }} onClick={() => setSide("start")}>✨ Parti da una pronta</button>
            </div>}
          </div>
          {/* su telefono il pannello sta sotto la tela */}
          {!wide && <div style={{ ...box, marginTop: 10 }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              {([["props", "🎛️ Forma"], ["layers", `🗂️ Livelli`], ["start", "✨ Partenza"]] as const).map(([k, t]) => <button key={k} style={{ ...tool(side === k), flex: 1, padding: "6px 4px", fontSize: 12.5 }} onClick={() => setSide(k)}>{t}</button>)}
            </div>
            {side === "props" ? props : side === "layers" ? layers : start}
          </div>}
        </div>

        {/* pannello a destra */}
        {wide && <div style={{ position: "sticky", top: 112, maxHeight: "calc(100vh - 124px)", overflow: "auto" }}>
          <div style={box}>
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              {([["props", "🎛️ Forma"], ["layers", `🗂️ Livelli ${items.length}`], ["start", "✨ Partenza"]] as const).map(([k, t]) => <button key={k} style={{ ...tool(side === k), flex: 1, padding: "6px 4px", fontSize: 12.5 }} onClick={() => setSide(k)}>{t}</button>)}
            </div>
            {side === "props" ? props : side === "layers" ? layers : start}
          </div>
          {mapPrev && <div style={{ ...box, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: "#D9E4D4", borderRadius: 8, padding: 6 }}><img src={mapPrev} alt="" style={{ width: 110, display: "block" }} /></div>
            <div style={{ fontSize: 12.5, color: "#475569" }}><b style={{ color: "#13294B" }}>Sulla mappa</b><br />Così la vedono gli altri giocatori.</div>
          </div>}
        </div>}
      </div>

      {/* salvataggio: nome e a chi va */}
      {saveOpen && <div onClick={() => setSaveOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(15,23,42,.6)", display: "grid", placeItems: "center", padding: 12 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 16, width: "min(680px, 100%)", maxHeight: "90vh", overflow: "auto", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            {mapPrev && <img src={mapPrev} alt="" style={{ width: 120 }} />}
            <div style={{ flex: 1 }}><strong style={{ fontSize: 18, color: "#13294B" }}>💾 Salva la livrea</strong><div style={{ fontSize: 13, color: "#64748B" }}>{model?.name}</div></div>
            <button style={tool()} onClick={() => setSaveOpen(false)}>✕</button>
          </div>
          <span style={lbl}>Nome</span>
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} style={{ ...sel, boxSizing: "border-box", marginBottom: 12 }} />
          <span style={lbl}>A chi va</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {([["all", "🌍", `Tutti i ${model?.name ?? "mezzi"}`, `${myVehs.length} mezzi`], ["bases", "🏠", "Alcune sedi", "scegli le sedi"], ["vehicles", "🚑", "Alcuni mezzi", "scegli per sigla"]] as const).map(([k, ic, t, sub2]) => (
              <button key={k} onClick={() => setTarget(k)} style={{ border: target === k ? "2px solid #16A34A" : "1px solid #CBD5E1", background: target === k ? "#F0FDF4" : "#fff", borderRadius: 12, padding: 10, cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 22 }}>{ic}</div><div style={{ fontWeight: 800, fontSize: 13.5, color: "#13294B" }}>{t}</div><div style={{ fontSize: 11.5, color: "#64748B" }}>{sub2}</div>
              </button>))}
          </div>
          {target === "bases" && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {bases.filter((b) => myVehs.some((v) => v.base_id === b.id)).map((b) => { const on = pickB.includes(b.id); return (
              <button key={b.id} onClick={() => setPickB(on ? pickB.filter((x) => x !== b.id) : [...pickB, b.id])}
                      style={{ ...tool(), padding: "5px 9px", fontSize: 13, background: on ? "#DCFCE7" : "#fff", borderColor: on ? "#16A34A" : "#CBD5E1" }}>
                {on ? "✅ " : ""}{b.is_headquarters ? "⭐ " : ""}{b.name} · {myVehs.filter((v) => v.base_id === b.id).length}
              </button>); })}
          </div>}
          {target === "vehicles" && <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <button style={{ ...tool(), padding: "4px 9px", fontSize: 12.5 }} onClick={() => setPickV(myVehs.map((v) => v.id))}>Tutti</button>
              <button style={{ ...tool(), padding: "4px 9px", fontSize: 12.5 }} onClick={() => setPickV([])}>Nessuno</button>
              <span style={{ fontSize: 12.5, color: "#64748B", alignSelf: "center" }}>{pickV.length} scelti</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 5, maxHeight: 240, overflow: "auto" }}>
              {myVehs.map((v) => { const on = pickV.includes(v.id); return (
                <button key={v.id} onClick={() => setPickV(on ? pickV.filter((x) => x !== v.id) : [...pickV, v.id])}
                        style={{ ...tool(), textAlign: "left", padding: "5px 8px", fontSize: 12.5, background: on ? "#DCFCE7" : "#fff", borderColor: on ? "#16A34A" : "#CBD5E1" }}>
                  {on ? "✅ " : "⬜ "}<b>{v.call_sign}</b> · {baseName(v.base_id)}
                </button>); })}
            </div>
          </div>}
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 8 }}>Se un mezzo ha più livree vale quella dei mezzi scelti, poi quella delle sedi, poi quella per tutti.</div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button style={{ ...btn, background: "#16A34A", fontSize: 15, flex: 1, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={async () => { await save(); }}>{busy ? "Salvo…" : "💾 Salva e applica"}</button>
            {cur && <button style={{ ...btn, background: "#fff", color: "#B91C1C", border: "1px solid #FCA5A5" }} disabled={busy} onClick={async () => { setSaveOpen(false); await del(); }}>↩️ Rimetti l&apos;ufficiale</button>}
          </div>
        </div>
      </div>}
    </main>
  );
}
