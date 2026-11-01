"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase, type Organization } from "@/lib/supabase";
import FactionEmblem, { FACTION_STYLES, type FactionStyle } from "@/components/FactionEmblem";

const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 640, margin: "0 auto", padding: 16 };
const box: CSSProperties = { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)", marginBottom: 14 };
const btn: CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "none", background: "#111", color: "#fff",
  fontWeight: 600, cursor: "pointer", fontSize: 15 };
const inp: CSSProperties = { width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc", fontSize: 16, boxSizing: "border-box" };

// Ritaglia al centro in un quadrato 256×256 (PNG, mantiene la trasparenza)
async function squarePng(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height);
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  c.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("immagine non valida"))), "image/png"));
}

export default function Associazione() {
  const router = useRouter();
  const [org, setOrg] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<FactionStyle>("blu_giallo");
  const [logo, setLogo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const { data } = await supabase.from("organizations").select("id,name,type,funds,reputation,logo_url")
        .eq("owner_id", session.user.id).maybeSingle();
      if (!data) { router.replace("/onboarding"); return; }
      const o = data as Organization;
      setOrg(o); setName(o.name); setType(o.type); setLogo(o.logo_url ?? null);
    })();
  }, [router]);

  async function upload(file: File) {
    if (!org) return;
    setBusy(true); setMsg(null);
    try {
      const blob = await squarePng(file);
      const path = `${org.id}/logo-${Date.now()}.png`;
      const { error } = await supabase.storage.from("org-logos").upload(path, blob, { contentType: "image/png", upsert: true });
      if (error) throw error;
      setLogo(supabase.storage.from("org-logos").getPublicUrl(path).data.publicUrl);
      setMsg({ ok: true, text: "Logo caricato: premi Salva per confermarlo." });
    } catch (e) {
      setMsg({ ok: false, text: "Caricamento non riuscito: " + (e as Error).message });
    }
    setBusy(false);
  }

  async function save() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("update_org_branding", { p_name: name, p_type: type, p_logo_url: logo });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message.includes("BAD_NAME") ? "Il nome deve avere tra 3 e 60 caratteri." : error.message });
      return;
    }
    setMsg({ ok: true, text: "✅ Associazione aggiornata." });
    setOrg((o) => (o ? { ...o, name, type, logo_url: logo } : o));
  }

  if (!org) return <main style={shell}><div style={wrap}>Caricamento…</div></main>;

  return (
    <main style={shell}>
      <div style={{ background: "#111", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={() => router.push("/")} style={{ ...btn, background: "#333", padding: "8px 12px" }}>← Mappa</button>
          <div style={{ fontWeight: 700 }}>La tua associazione</div>
        </div>
      </div>

      <div style={wrap}>
        {/* Anteprima */}
        <div style={{ ...box, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 96, height: 96, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,.25)",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <FactionEmblem type={type} size={logo ? 96 : 76} logo={logo} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 20, wordBreak: "break-word" }}>{name || "—"}</div>
            <div style={{ fontSize: 13, color: "#666" }}>Così ti vedono gli altri sulla mappa</div>
          </div>
        </div>

        <div style={box}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Nome</div>
          <input style={inp} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>

        <div style={box}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Il tuo logo</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button disabled={busy} onClick={() => fileRef.current?.click()} style={{ ...btn, background: "#1E3A8A" }}>
              📷 {logo ? "Cambia immagine" : "Carica immagine"}
            </button>
            {logo && <button disabled={busy} onClick={() => setLogo(null)} style={{ ...btn, background: "#eee", color: "#111" }}>Togli logo</button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                 onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>Viene ritagliata al centro in un cerchio.</div>
        </div>

        <div style={box}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Colori {logo && <span style={{ fontWeight: 400, color: "#888", fontSize: 13 }}>(usati se togli il logo)</span>}</div>
          <div style={{ display: "flex", gap: 10 }}>
            {FACTION_STYLES.map((s) => (
              <button key={s.type} onClick={() => setType(s.type)}
                      style={{ padding: 10, borderRadius: 12, cursor: "pointer", background: "#fff",
                               border: type === s.type ? "3px solid #111" : "1px solid #ddd" }}>
                <FactionEmblem type={s.type} size={56} />
                <div style={{ display: "flex", gap: 3, justifyContent: "center", marginTop: 6 }}>
                  {s.colors.map((c) => <span key={c} style={{ width: 14, height: 8, borderRadius: 2, background: c, border: "1px solid #ccc" }} />)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {msg && <div style={{ color: msg.ok ? "#15803D" : "#B91C1C", marginBottom: 10 }}>{msg.text}</div>}
        <button disabled={busy} onClick={save} style={{ ...btn, width: "100%", padding: 14, fontSize: 17 }}>
          {busy ? "Attendi…" : "💾 Salva"}
        </button>
      </div>
    </main>
  );
}
