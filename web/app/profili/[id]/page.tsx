"use client";
// Profilo pubblico di un'associazione: banner, colori, livree, sedi (con la migliore), mezzi per tipo, volontari e leggendari.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, livery } from "@/lib/supabase";
import FactionEmblem, { type FactionStyle } from "@/components/FactionEmblem";
import { AllyChip, loadOrgAlliances, type AllyBadge } from "@/components/AllianceExtras";
import { typeColors, KIND_LABEL, ROLE_LABEL, ROLE_ONE } from "@/lib/profileStyle";

type P = {
  id: string; name: string; type: string; logo_url: string | null; banner_url: string | null; bio: string | null; reputation: number; created_at: string;
  bases: { id: string; name: string; hq: boolean; level: number; color: string | null; vehicles: number; income7: number; services7: number }[];
  kinds: Record<string, number>; models: { name: string; image_url: string | null; custom: string | null; n: number }[];
  roles: Record<string, number>; rarity: Record<string, number>;
  legends: { name: string; nickname: string | null; role: string; avatar_url: string | null; services: number }[];
  services7: number;
};
const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const box: CSSProperties = { background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", marginBottom: 12 };
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

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
  const fileRef = useRef<HTMLInputElement | null>(null);

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
  }, [id, router]);
  useEffect(() => { load(); }, [load]);

  async function saveProfile() {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("set_profile_banner", { p_banner: banner, p_bio: bio });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setEdit(false); load();
  }
  async function upload(file: File) {
    if (!p) return;
    setBusy(true); setErr(null);
    try {
      const blob = await bannerBlob(file);
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
      <div style={{ position: "relative", height: 210, background: shown ? `center/cover url("${shown}")` : `linear-gradient(120deg, ${c.main}, ${c.main} 55%, ${c.acc})` }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.55))" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 8, background: `repeating-linear-gradient(90deg, ${c.main} 0 24px, ${c.acc} 24px 48px)` }} />
        <div style={{ position: "absolute", top: 10, left: 12, display: "flex", gap: 8 }}>
          <a href="/profili" style={{ background: "rgba(0,0,0,.45)", color: "#fff", borderRadius: 999, padding: "6px 12px", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>← Profili</a>
          <a href="/" style={{ background: "rgba(0,0,0,.45)", color: "#fff", borderRadius: 999, padding: "6px 12px", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>Mappa</a>
        </div>
        {mine && !edit && <button onClick={() => setEdit(true)} style={{ position: "absolute", top: 10, right: 12, background: "#fff", color: "#13294B", border: "none", borderRadius: 999, padding: "7px 12px", fontWeight: 800, cursor: "pointer" }}>✏️ Banner e presentazione</button>}
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
            <strong>Banner e presentazione</strong>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button disabled={busy} onClick={() => fileRef.current?.click()} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #CBD5E1", background: "#fff", fontWeight: 700, cursor: "pointer" }}>🖼️ Scegli il banner</button>
              {banner && <button onClick={() => setBanner(null)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #FCA5A5", background: "#fff", color: "#B91C1C", fontWeight: 700, cursor: "pointer" }}>Togli banner</button>}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
            </div>
            <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 400))} rows={3} placeholder="Presentati: chi siete, dove operate, il vostro motto…"
                      style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 15, boxSizing: "border-box", fontFamily: "inherit" }} />
            <div style={{ fontSize: 12, color: "#64748B" }}>{bio.length}/400 · Il banner viene ritagliato a 1500×500.</div>
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
