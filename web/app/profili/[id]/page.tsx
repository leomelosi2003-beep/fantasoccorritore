"use client";
// Profilo pubblico di un'associazione: banner, colori, livree, sedi (con la migliore), mezzi per tipo, volontari e leggendari.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, livery } from "@/lib/supabase";
import FactionEmblem, { FACTION_STYLES, type FactionStyle } from "@/components/FactionEmblem";
import { AllyChip, loadOrgAlliances, type AllyBadge } from "@/components/AllianceExtras";
import { typeColors, KIND_LABEL, ROLE_LABEL, ROLE_ONE } from "@/lib/profileStyle";

type P = {
  id: string; name: string; type: string; logo_url: string | null; banner_url: string | null; bio: string | null; reputation: number; created_at: string;
  dot_fill?: string | null; dot_border?: string | null;
  bases: { id: string; name: string; hq: boolean; level: number; color: string | null; vehicles: number; income7: number; services7: number }[];
  kinds: Record<string, number>; models: { name: string; image_url: string | null; custom: string | null; n: number }[];
  roles: Record<string, number>; rarity: Record<string, number>;
  legends: { name: string; nickname: string | null; role: string; avatar_url: string | null; services: number }[];
  services7: number;
};
const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const box: CSSProperties = { background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", marginBottom: 12 };
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

// Ritaglio del banner: trascini la foto e regoli lo zoom dentro una cornice 3:1 (la stessa forma del banner nel profilo)
function BannerCropper({ src, onDone, onCancel }: { src: string; onDone: (b: Blob) => void; onCancel: () => void }) {
  const frame = useRef<HTMLDivElement | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [fw, setFw] = useState(600);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  useEffect(() => { const i = new Image(); i.onload = () => setImg(i); i.src = src; }, [src]);
  useEffect(() => {
    const f = () => setFw(frame.current?.clientWidth ?? 600); f();
    window.addEventListener("resize", f); return () => window.removeEventListener("resize", f);
  }, []);
  const fh = fw / 3;
  const base = img ? Math.max(fw / img.naturalWidth, fh / img.naturalHeight) : 1;
  const sc = base * zoom;
  const iw = (img?.naturalWidth ?? 0) * sc, ih = (img?.naturalHeight ?? 0) * sc;
  const clamp = (x: number, y: number) => ({ x: Math.min(0, Math.max(fw - iw, x)), y: Math.min(0, Math.max(fh - ih, y)) });
  // all'inizio e quando cambia lo zoom resta centrata
  const zoomRef = useRef(zoom);
  useEffect(() => {
    if (!img) return;
    const prev = zoomRef.current; zoomRef.current = zoom;
    setPos((p) => {
      if (prev === zoom && p.x === 0 && p.y === 0) return clamp((fw - iw) / 2, (fh - ih) / 2);
      const k = zoom / prev, cx = fw / 2, cy = fh / 2;
      return clamp(cx - (cx - p.x) * k, cy - (cy - p.y) * k);
    });
  }, [img, zoom, fw]); // eslint-disable-line react-hooks/exhaustive-deps
  function done() {
    if (!img) return;
    const c = document.createElement("canvas"); c.width = 1500; c.height = 500;
    c.getContext("2d")!.drawImage(img, -pos.x / sc, -pos.y / sc, fw / sc, fh / sc, 0, 0, 1500, 500);
    c.toBlob((b) => b && onDone(b), "image/jpeg", 0.88);
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.8)", zIndex: 3000, display: "grid", placeItems: "center", padding: 12 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 14, width: "min(960px, 100%)", boxSizing: "border-box" }}>
        <strong style={{ fontSize: 17, color: "#13294B" }}>✂️ Ritaglia il banner</strong>
        <div style={{ fontSize: 13, color: "#64748B", margin: "2px 0 10px" }}>Trascina la foto per spostarla e usa lo zoom: quello che vedi nella cornice è il banner.</div>
        <div ref={frame} style={{ position: "relative", width: "100%", height: fh, overflow: "hidden", borderRadius: 10, background: "#0f172a", touchAction: "none", cursor: "grab", userSelect: "none" }}
             onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; }}
             onPointerMove={(e) => { const d = drag.current; if (d) setPos(clamp(d.px + e.clientX - d.x, d.py + e.clientY - d.y)); }}
             onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
             onWheel={(e) => setZoom((z) => Math.min(4, Math.max(1, z * (e.deltaY < 0 ? 1.08 : 0.93))))}>
          {img && <img src={src} alt="" draggable={false} style={{ position: "absolute", left: pos.x, top: pos.y, width: iw, height: ih, maxWidth: "none", pointerEvents: "none" }} />}
          <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 0 3px rgba(255,255,255,.85)", borderRadius: 10, pointerEvents: "none" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <span>🔍</span>
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(+e.target.value)} style={{ flex: 1 }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #CBD5E1", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Annulla</button>
          <button onClick={done} style={{ padding: "9px 14px", borderRadius: 10, border: "none", background: "#16A34A", color: "#fff", fontWeight: 800, cursor: "pointer" }}>✂️ Usa questo ritaglio</button>
        </div>
      </div>
    </div>
  );
}

async function bannerBlob(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const w = 1500, h = 500, r = Math.max(w / img.width, h / img.height), sw = w / r, sh = h / r;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("immagine non valida"))), "image/jpeg", 0.85));
}

export default function Profilo() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<P | null>(null);
  const [ally, setAlly] = useState<AllyBadge | null>(null);
  const [mine, setMine] = useState(false);
  const [edit, setEdit] = useState(false);
  const [bio, setBio] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [dotFill, setDotFill] = useState("#F97316");
  const [dotBorder, setDotBorder] = useState("#FFFFFF");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const logoRef = useRef<HTMLInputElement | null>(null);
  const [oName, setOName] = useState("");
  const [oType, setOType] = useState<FactionStyle>("blu_giallo");
  const [oLogo, setOLogo] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); return; }
    const [{ data: o }, { data }, al] = await Promise.all([
      supabase.from("organizations").select("id").eq("owner_id", session.user.id).maybeSingle(),
      supabase.rpc("org_profile", { p_org: id }), loadOrgAlliances(),
    ]);
    if (!data) { setErr("Associazione non trovata."); return; }
    const pp = data as P; setP(pp); setAlly(al[pp.id] ?? null);
    setMine((o as { id: string } | null)?.id === pp.id);
    setBio(pp.bio ?? ""); setBanner(pp.banner_url);
    setDotFill(pp.dot_fill ?? typeColors(pp.type).main); setDotBorder(pp.dot_border ?? "#FFFFFF");
    setOName(pp.name); setOType(pp.type as FactionStyle); setOLogo(pp.logo_url);
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("modifica") && (o as { id: string } | null)?.id === pp.id) setEdit(true);
  }, [id, router]);
  useEffect(() => { load(); }, [load]);

  async function saveProfile() {
    setBusy(true); setErr(null);
    const b = await supabase.rpc("update_org_branding", { p_name: oName.trim(), p_type: oType, p_logo_url: oLogo });
    if (b.error) { setBusy(false); setErr(b.error.message.includes("BAD_NAME") ? "Il nome deve avere tra 3 e 60 caratteri." : b.error.message); return; }
    const { error } = await supabase.rpc("set_profile_banner", { p_banner: banner, p_bio: bio });
    if (!error) await supabase.rpc("set_dot_colors", { p_fill: dotFill, p_border: dotBorder });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setEdit(false); load();
  }
  // stemma: ritagliato al centro in un quadrato 256×256 (si salva subito, così si vede sulla mappa)
  async function uploadLogo(file: File) {
    if (!p) return;
    setBusy(true); setErr(null);
    try {
      const img = await createImageBitmap(file); const side = Math.min(img.width, img.height);
      const c = document.createElement("canvas"); c.width = c.height = 256;
      c.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
      const blob: Blob = await new Promise((res, rej) => c.toBlob((x) => (x ? res(x) : rej(new Error("immagine non valida"))), "image/png"));
      const path = `${p.id}/logo-${Date.now()}.png`;
      const { error } = await supabase.storage.from("org-logos").upload(path, blob, { contentType: "image/png", upsert: true });
      if (error) throw error;
      const url = supabase.storage.from("org-logos").getPublicUrl(path).data.publicUrl;
      setOLogo(url);
      const { error: e2 } = await supabase.rpc("update_org_branding", { p_name: p.name, p_type: p.type, p_logo_url: url });
      if (e2) throw e2;
    } catch (e) { setErr("Stemma non caricato: " + String((e as Error).message ?? e)); }
    setBusy(false);
  }
  async function upload(fileOrBlob: File | Blob) {
    if (!p) return;
    setBusy(true); setErr(null);
    try {
      const blob = fileOrBlob instanceof File ? await bannerBlob(fileOrBlob) : fileOrBlob;
      const path = `${p.id}/profilo-banner-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("org-logos").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      setBanner(supabase.storage.from("org-logos").getPublicUrl(path).data.publicUrl);
    } catch (e) { setErr("Banner non caricato: " + String((e as Error).message ?? e)); }
    setBusy(false);
  }

  if (err && !p) return <main style={shell}><div style={{ padding: 20 }}>{err} <a href="/profili">Torna ai profili</a></div></main>;
  if (!p) return <main style={shell}><div style={{ padding: 20, color: "#64748B" }}>Carico il profilo…</div></main>;
  const c = typeColors(p.type);
  const best = [...p.bases].sort((a, b) => b.income7 - a.income7 || b.services7 - a.services7)[0];
  const nVeh = sum(p.kinds), nVol = sum(p.roles);
  const shown = edit ? banner : p.banner_url;
  const tile = (icon: string, v: string | number, l: string) => (
    <div style={{ flex: "1 1 120px", background: "#fff", borderRadius: 12, padding: "10px 12px", borderTop: `4px solid ${c.main}`, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#13294B" }}>{icon} {v}</div>
      <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>{l}</div>
    </div>);

  return (
    <main style={shell}>
      {/* intestazione */}
      {cropSrc && <BannerCropper src={cropSrc} onCancel={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
                                 onDone={(b) => { URL.revokeObjectURL(cropSrc); setCropSrc(null); upload(b); }} />}
      <div style={{ position: "relative", maxWidth: 1000, margin: "0 auto", aspectRatio: "3 / 1", minHeight: 150, borderRadius: "0 0 18px 18px", overflow: "hidden", background: shown ? `center/cover url("${shown}")` : `linear-gradient(120deg, ${c.main}, ${c.main} 55%, ${c.acc})` }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.55))" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 8, background: `repeating-linear-gradient(90deg, ${c.main} 0 24px, ${c.acc} 24px 48px)` }} />
        <div style={{ position: "absolute", top: 10, left: 12, display: "flex", gap: 8 }}>
          <a href="/profili" style={{ background: "rgba(0,0,0,.45)", color: "#fff", borderRadius: 999, padding: "6px 12px", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>← Profili</a>
          <a href="/" style={{ background: "rgba(0,0,0,.45)", color: "#fff", borderRadius: 999, padding: "6px 12px", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>Mappa</a>
        </div>
        {mine && !edit && <button onClick={() => setEdit(true)} style={{ position: "absolute", top: 10, right: 12, background: "#fff", color: "#13294B", border: "none", borderRadius: 999, padding: "7px 12px", fontWeight: 800, cursor: "pointer" }}>✏️ Modifica profilo</button>}
      </div>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 14px 20px" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "end", marginTop: -54, position: "relative", flexWrap: "wrap" }}>
          <div style={{ background: "#fff", borderRadius: "50%", padding: 5, boxShadow: "0 4px 14px rgba(0,0,0,.25)" }}>
            <FactionEmblem type={p.type as FactionStyle} size={104} logo={p.logo_url} />
          </div>
          <div style={{ paddingBottom: 6, flex: 1, minWidth: 200 }}>
            <h1 style={{ margin: 0, fontSize: 26, color: "#13294B" }}>{p.name}</h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
              <span style={{ background: c.main, color: c.text, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 800, border: `2px solid ${c.acc}` }}>{c.label}</span>
              {ally && <AllyChip a={ally} size={20} />}
              <span style={{ fontSize: 12.5, color: "#64748B" }}>nel gioco dal {new Date(p.created_at).toLocaleDateString("it-IT")}</span>
            </div>
          </div>
        </div>

        {edit && (
          <div style={{ ...box, marginTop: 12, border: `2px solid ${c.main}` }}>
            <strong style={{ fontSize: 16 }}>✏️ Modifica il profilo dell&apos;associazione</strong>
            {/* nome, stemma e colori (prima erano nella pagina "Associazione") */}
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
              <div style={{ position: "relative" }}>
                <div style={{ background: "#fff", borderRadius: "50%", padding: 4, boxShadow: "0 2px 8px rgba(0,0,0,.2)" }}><FactionEmblem type={oType} size={84} logo={oLogo} /></div>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#64748B" }}>NOME</span>
                <input value={oName} maxLength={60} onChange={(e) => setOName(e.target.value)}
                       style={{ width: "100%", padding: 9, borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 16, boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  <button disabled={busy} onClick={() => logoRef.current?.click()} style={{ padding: "7px 11px", borderRadius: 10, border: "1px solid #CBD5E1", background: "#fff", fontWeight: 700, cursor: "pointer" }}>📷 {oLogo ? "Cambia stemma" : "Carica stemma"}</button>
                  {oLogo && <button onClick={() => setOLogo(null)} style={{ padding: "7px 11px", borderRadius: 10, border: "1px solid #FCA5A5", background: "#fff", color: "#B91C1C", fontWeight: 700, cursor: "pointer" }}>Togli stemma</button>}
                  <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadLogo(f); }} />
                </div>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#64748B" }}>COLORI DELL&apos;ASSOCIAZIONE {oLogo ? "(usati anche per livree e profilo)" : ""}</span>
              <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                {FACTION_STYLES.map((st) => (
                  <button key={st.type} onClick={() => setOType(st.type)} style={{ padding: 8, borderRadius: 12, cursor: "pointer", background: "#fff", border: oType === st.type ? "3px solid #13294B" : "1px solid #CBD5E1" }}>
                    <FactionEmblem type={st.type} size={44} />
                    <div style={{ display: "flex", gap: 3, justifyContent: "center", marginTop: 4 }}>{st.colors.map((col) => <span key={col} style={{ width: 12, height: 7, borderRadius: 2, background: col, border: "1px solid #ccc" }} />)}</div>
                  </button>))}
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, fontWeight: 800, color: "#64748B" }}>BANNER E PRESENTAZIONE</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button disabled={busy} onClick={() => fileRef.current?.click()} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #CBD5E1", background: "#fff", fontWeight: 700, cursor: "pointer" }}>🖼️ Scegli il banner</button>
              {banner && <button onClick={() => setBanner(null)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #FCA5A5", background: "#fff", color: "#B91C1C", fontWeight: 700, cursor: "pointer" }}>Togli banner</button>}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setCropSrc(URL.createObjectURL(f)); }} />
            </div>
            <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 400))} rows={3} placeholder="Presentati: chi siete, dove operate, il vostro motto…"
                      style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 15, boxSizing: "border-box", fontFamily: "inherit" }} />
            <div style={{ fontSize: 12, color: "#64748B" }}>{bio.length}/400 · Dopo aver scelto la foto la ritagli tu (forma 3:1, come appare nel profilo).</div>
            <div style={{ marginTop: 12, background: "#F8FAFC", borderRadius: 12, padding: 10 }}>
              <strong style={{ fontSize: 14 }}>🔵 I tuoi mezzi sulla mappa da lontano</strong>
              <div style={{ fontSize: 12.5, color: "#64748B", marginBottom: 8 }}>Quando allontani lo zoom le ambulanze diventano pallini: scegli il colore e il bordo con cui tutti vedranno i tuoi.</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <label style={{ fontSize: 13, fontWeight: 700 }}>Colore <input type="color" value={dotFill} onChange={(e) => setDotFill(e.target.value)} /></label>
                <label style={{ fontSize: 13, fontWeight: 700 }}>Bordo <input type="color" value={dotBorder} onChange={(e) => setDotBorder(e.target.value)} /></label>
                <span style={{ display: "flex", gap: 10, alignItems: "center", background: "#D9E4D4", borderRadius: 10, padding: "8px 12px" }}>
                  {[13, 9].map((d) => <span key={d} style={{ width: d, height: d, borderRadius: "50%", background: dotFill, border: `${d > 10 ? 2.5 : 2}px solid ${dotBorder}`, boxShadow: "0 0 0 1px rgba(0,0,0,.4)" }} />)}
                  <span style={{ fontSize: 12, color: "#475569" }}>anteprima</span>
                </span>
              </div>
            </div>
            {err && <div style={{ color: "#B91C1C", marginTop: 6 }}>{err}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button disabled={busy} onClick={saveProfile} style={{ padding: "9px 14px", borderRadius: 10, border: "none", background: "#16A34A", color: "#fff", fontWeight: 800, cursor: "pointer" }}>{busy ? "Attendi…" : "💾 Salva"}</button>
              <button onClick={() => { setEdit(false); setBio(p.bio ?? ""); setBanner(p.banner_url); }} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #CBD5E1", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Annulla</button>
            </div>
          </div>
        )}
        {!edit && p.bio && <div style={{ ...box, marginTop: 12, fontSize: 15, color: "#334155", whiteSpace: "pre-wrap", borderLeft: `5px solid ${c.main}` }}>{p.bio}</div>}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "12px 0" }}>
          {tile("🏠", p.bases.length, "sedi")}
          {tile("🚑", nVeh, "mezzi")}
          {tile("👥", nVol, "volontari")}
          {tile("🌟", p.rarity.leggendaria ?? 0, "leggendari")}
          {tile("⭐", Math.round(p.reputation), "reputazione")}
          {tile("✅", p.services7, "servizi in 7 giorni")}
        </div>

        {/* livree */}
        <div style={box}>
          <h2 style={{ margin: "0 0 10px", fontSize: 17, color: "#13294B" }}>🎨 La flotta e le livree</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
            {p.models.map((m) => (
              <div key={m.name} style={{ background: "#F8FAFC", borderRadius: 12, padding: 8, textAlign: "center", position: "relative" }}>
                {m.custom && <span style={{ position: "absolute", top: 6, left: 6, background: c.main, color: c.text, fontSize: 10, fontWeight: 800, borderRadius: 999, padding: "1px 7px" }}>livrea propria</span>}
                <img src={m.custom ?? livery(m.image_url, p.type) ?? ""} alt={m.name} style={{ width: "100%", height: 80, objectFit: "contain" }} />
                <div style={{ fontWeight: 800, fontSize: 13.5, color: "#13294B" }}>{m.name}</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>{m.n} {m.n === 1 ? "mezzo" : "mezzi"}</div>
              </div>
            ))}
            {!p.models.length && <div style={{ color: "#64748B" }}>Nessun mezzo.</div>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          {/* mezzi per tipo */}
          <div style={{ ...box, marginBottom: 0 }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, color: "#13294B" }}>🚑 Mezzi per tipo</h2>
            {Object.entries(p.kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 140, fontSize: 13.5 }}>{KIND_LABEL[k] ?? k}</span>
                <div style={{ flex: 1, background: "#EEF2F7", borderRadius: 999, height: 10 }}><div style={{ width: `${(n / Math.max(1, nVeh)) * 100}%`, background: c.main, height: 10, borderRadius: 999 }} /></div>
                <strong style={{ width: 34, textAlign: "right" }}>{n}</strong>
              </div>
            ))}
          </div>
          {/* volontari */}
          <div style={{ ...box, marginBottom: 0 }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, color: "#13294B" }}>👥 Volontari</h2>
            {Object.entries(p.roles).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 160, fontSize: 13.5 }}>{ROLE_LABEL[k] ?? k}</span>
                <div style={{ flex: 1, background: "#EEF2F7", borderRadius: 999, height: 10 }}><div style={{ width: `${(n / Math.max(1, nVol)) * 100}%`, background: c.main, height: 10, borderRadius: 999 }} /></div>
                <strong style={{ width: 34, textAlign: "right" }}>{n}</strong>
              </div>
            ))}
            <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 6 }}>Comuni {p.rarity.comune ?? 0} · Epici {p.rarity.epica ?? 0} · Leggendari {p.rarity.leggendaria ?? 0}</div>
          </div>
        </div>

        {/* leggendari */}
        {p.legends.length > 0 && (
          <div style={{ ...box, marginTop: 12, background: "linear-gradient(135deg, #FFFBEB, #FEF3C7)" }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 17, color: "#92400E" }}>🌟 I leggendari</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
              {p.legends.map((l, i) => (
                <div key={i} style={{ background: "#fff", borderRadius: 12, padding: 10, textAlign: "center", border: "2px solid #F59E0B" }}>
                  {l.avatar_url ? <img src={l.avatar_url} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} />
                    : <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto", background: "#FDE68A", display: "grid", placeItems: "center", fontSize: 28 }}>🌟</div>}
                  <div style={{ fontWeight: 800, fontSize: 13.5, marginTop: 4 }}>{l.name}</div>
                  {l.nickname && <div style={{ fontSize: 12, color: "#92400E" }}>«{l.nickname}»</div>}
                  <div style={{ fontSize: 12, color: "#64748B" }}>{ROLE_ONE[l.role] ?? l.role} · {l.services} servizi</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* sedi */}
        <div style={{ ...box, marginTop: 12 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 17, color: "#13294B" }}>🏠 Sedi</h2>
          {best && best.services7 > 0 && (
            <div style={{ background: `linear-gradient(120deg, ${c.main}, ${c.main} 70%, ${c.acc})`, color: c.text, borderRadius: 12, padding: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9 }}>🏆 LA SEDE MIGLIORE (ultimi 7 giorni)</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{best.hq ? "⭐ " : ""}{best.name}</div>
              <div style={{ fontSize: 13 }}>{best.services7} servizi · {best.vehicles} mezzi · livello {best.level}</div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {p.bases.map((b) => (
              <div key={b.id} style={{ display: "flex", gap: 8, alignItems: "center", background: "#F8FAFC", borderRadius: 10, padding: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: b.color ?? c.main, display: "grid", placeItems: "center", color: "#fff", fontSize: 14 }}>{b.hq ? "⭐" : "🏠"}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>{b.vehicles} mezzi · liv. {b.level} · {b.services7} servizi</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
