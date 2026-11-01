"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase, friendlyError } from "@/lib/supabase";
import VolunteerCard, { ROLE, RARITY, type Card } from "@/components/VolunteerCard";

type Vol = Omit<Card, "id" | "state" | "rest_until" | "expires_at" | "services_completed" | "energy" | "volunteer_id"> & {
  id: string; source: string; is_pack_eligible: boolean; contract_days: number | null; shop_price: number | null;
  trait_mods: { night_fatigue?: number; rosso_fatigue?: number };
};

const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 1100, margin: "0 auto", padding: 16 };
const box: CSSProperties = { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)" };
const inp: CSSProperties = { width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #ccc", fontSize: 15, boxSizing: "border-box" };
const btn: CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "none", background: "#111", color: "#fff",
  fontWeight: 600, cursor: "pointer", fontSize: 15 };
const lbl: CSSProperties = { fontSize: 13, fontWeight: 600, margin: "10px 0 4px", display: "block" };

const EMPTY = {
  first_name: "", last_name: "", nickname: "", gender: "m", role: "autista" as Card["role"],
  rarity: "epica" as Card["rarity"], stat_guida: 80, stat_soccorso: 80, stat_resilienza: 80,
  pros: "", cons: "", night_fatigue: 0, rosso_fatigue: 0, contract_days: "", is_pack_eligible: true, avanzato: false, shop_price: "",
};

// Ritaglia la foto al centro in un quadrato 512×512 e la comprime in JPEG prima di caricarla
async function squareJpeg(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  canvas.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 512, 512);
  return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error("Immagine non valida"))), "image/jpeg", 0.85));
}

async function uploadPhoto(file: File): Promise<string> {
  const blob = await squareJpeg(file);
  const path = `${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage.from("volunteer-photos").upload(path, blob, { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  return supabase.storage.from("volunteer-photos").getPublicUrl(path).data.publicUrl;
}

export default function Admin() {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);
  const [list, setList] = useState<Vol[]>([]);
  const [filter, setFilter] = useState<"rare" | "comune">("rare");
  const [f, setF] = useState(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [editing, setEditing] = useState<Vol | null>(null);

  // Carica una carta esistente nel modulo per modificarla
  function startEdit(v: Vol) {
    setEditing(v); setMsg(null); setPhoto(null); setPreview(v.avatar_url);
    setF({
      first_name: v.first_name, last_name: v.last_name, nickname: v.nickname ?? "", gender: v.gender ?? "m",
      role: v.role, rarity: v.rarity, stat_guida: v.stat_guida, stat_soccorso: v.stat_soccorso,
      stat_resilienza: v.stat_resilienza, pros: (v.pros ?? []).join("\n"), cons: (v.cons ?? []).join("\n"),
      night_fatigue: v.trait_mods?.night_fatigue ?? 0, rosso_fatigue: v.trait_mods?.rosso_fatigue ?? 0,
      contract_days: v.contract_days ? String(v.contract_days) : "", is_pack_eligible: v.is_pack_eligible,
      shop_price: v.shop_price != null ? String(v.shop_price) : "",
      avanzato: !!v.avanzato,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null); setF(EMPTY); setPhoto(null); setPreview(null);
  }

  const load = useCallback(async () => {
    const { data } = await supabase.from("volunteers").select("*").order("created_at", { ascending: false });
    setList((data as Vol[]) ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const { data } = await supabase.from("profiles").select("is_admin").eq("id", session.user.id).maybeSingle();
      setOk(!!data?.is_admin);
      if (data?.is_admin) load();
    })();
  }, [router, load]);

  function set<K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) { setF((x) => ({ ...x, [k]: v })); }

  function usePhoto(file: File | null) {
    if (file && !file.type.startsWith("image/")) { setMsg({ ok: false, text: "Il file deve essere un'immagine." }); return; }
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }
  function pickPhoto(e: ChangeEvent<HTMLInputElement>) { usePhoto(e.target.files?.[0] ?? null); e.target.value = ""; }

  async function changePhoto(v: Vol, file: File | undefined) {
    if (!file) return;
    setMsg(null);
    try {
      const url = await uploadPhoto(file);
      const { error } = await supabase.from("volunteers").update({ avatar_url: url }).eq("id", v.id);
      if (error) throw error;
      setMsg({ ok: true, text: `Foto di ${v.first_name} ${v.last_name} aggiornata.` });
      load();
    } catch (e) { setMsg({ ok: false, text: friendlyError((e as Error).message) }); }
  }

  async function clearPhoto(v: Vol) {
    await supabase.from("volunteers").update({ avatar_url: null }).eq("id", v.id);
    load();
  }

  async function save() {
    setBusy(true); setMsg(null);
    try {
      // foto: nuova se caricata, altrimenti quella attuale (o nessuna se è stata rimossa)
      const avatar_url = photo ? await uploadPhoto(photo) : editing ? preview : null;
      const { data: { session } } = await supabase.auth.getSession();
      const mods: Record<string, number> = {};
      if (f.night_fatigue) mods.night_fatigue = f.night_fatigue;
      if (f.rosso_fatigue) mods.rosso_fatigue = f.rosso_fatigue;
      const fields = {
        first_name: f.first_name.trim(), last_name: f.last_name.trim(), nickname: f.nickname.trim() || null,
        gender: f.gender, role: f.role, rarity: f.rarity,
        stat_guida: f.role === "autista" ? f.stat_guida : 1, stat_soccorso: f.stat_soccorso, stat_resilienza: f.stat_resilienza,
        pros: f.pros.split("\n").map((s) => s.trim()).filter(Boolean),
        cons: f.cons.split("\n").map((s) => s.trim()).filter(Boolean),
        trait_mods: mods, contract_days: f.contract_days ? Number(f.contract_days) : null,
        is_pack_eligible: f.is_pack_eligible, avatar_url, avanzato: f.role === "autista" && f.avanzato,
        shop_price: f.shop_price.trim() === "" ? null : Math.max(0, Math.round(Number(f.shop_price))),
      };
      const { error } = editing
        ? await supabase.from("volunteers")
            .update({ ...fields, source: f.rarity !== "comune" ? "admin" : editing.source }).eq("id", editing.id)
        : await supabase.from("volunteers").insert({ ...fields, source: "admin", created_by: session?.user.id });
      if (error) throw error;
      setMsg({ ok: true, text: editing ? `Modifiche a ${f.first_name} ${f.last_name} salvate.` : `${f.first_name} ${f.last_name} è nel catalogo!` });
      setEditing(null); setF(EMPTY); setPhoto(null); setPreview(null);
      load();
    } catch (e) {
      const m = (e as Error).message;
      setMsg({ ok: false, text: m.includes("volunteers_unique_name") ? "Esiste già un volontario con questo nome e cognome." : friendlyError(m) });
    } finally { setBusy(false); }
  }

  async function toggle(v: Vol) {
    await supabase.from("volunteers").update({ is_pack_eligible: !v.is_pack_eligible }).eq("id", v.id);
    load();
  }

  async function remove(v: Vol) {
    if (!confirm(`Eliminare ${v.first_name} ${v.last_name} dal catalogo?`)) return;
    const { error } = await supabase.from("volunteers").delete().eq("id", v.id);
    if (error) {
      setMsg({ ok: false, text: "Qualcuno ha già questa carta: invece di eliminarla, toglila dai pacchetti." });
      return;
    }
    load();
  }

  if (ok === null) return <main style={shell} />;
  if (!ok) return <main style={{ ...shell, padding: 40, textAlign: "center" }}>Pagina riservata all&apos;amministratore.</main>;

  const previewCard: Card = {
    id: "preview", state: "attiva", rest_until: null, expires_at: null, services_completed: 0, energy: 100,
    volunteer_id: editing?.id ?? ((f.first_name + f.last_name) || "preview"), first_name: f.first_name || "Nome", last_name: f.last_name || "Cognome",
    nickname: f.nickname || null, role: f.role, rarity: f.rarity, gender: f.gender, avatar_url: preview,
    stat_guida: f.stat_guida, stat_soccorso: f.stat_soccorso, stat_resilienza: f.stat_resilienza, avanzato: f.avanzato,
    pros: f.pros.split("\n").filter((s) => s.trim()), cons: f.cons.split("\n").filter((s) => s.trim()),
  };
  const shown = list.filter((v) => (filter === "rare" ? v.rarity !== "comune" : v.rarity === "comune"));
  const valid = f.first_name.trim() && f.last_name.trim();

  return (
    <main style={shell}>
      <div style={{ background: "#111", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={() => router.push("/")} style={{ ...btn, background: "#333", padding: "8px 12px" }}>← Mappa</button>
          <div style={{ fontWeight: 700, fontSize: 18 }}>🛠️ Pannello admin · Carte volontari</div>
          <button onClick={() => router.push("/admin/eventi")} style={{ ...btn, background: "#7C3AED", padding: "8px 12px", marginLeft: "auto" }}>🏟️ Grandi eventi</button>
        </div>
      </div>

      <div style={wrap}>
        {msg && <div style={{ ...box, marginBottom: 12, background: msg.ok ? "#effaf1" : "#fff1f1", color: msg.ok ? "#166534" : "#a00" }}>{msg.text}</div>}

        {/* Nuova carta */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, alignItems: "start" }}>
          <div style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0 }}>{editing ? `✏️ Modifica: ${editing.first_name} ${editing.last_name}` : "Nuova carta"}</h2>
              {editing && <button onClick={cancelEdit} style={{ ...btn, background: "#eee", color: "#111", fontSize: 13, padding: "6px 10px" }}>Annulla</button>}
            </div>
            {editing && (
              <div style={{ fontSize: 13, background: "#FFF7ED", color: "#9A3412", borderRadius: 8, padding: 8, marginTop: 8 }}>
                Le modifiche valgono anche per i giocatori che hanno già questa carta in squadra.
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div><label style={lbl}>Nome</label><input style={inp} value={f.first_name} onChange={(e) => set("first_name", e.target.value)} /></div>
              <div><label style={lbl}>Cognome</label><input style={inp} value={f.last_name} onChange={(e) => set("last_name", e.target.value)} /></div>
            </div>
            <label style={lbl}>Soprannome</label>
            <input style={inp} value={f.nickname} onChange={(e) => set("nickname", e.target.value)} placeholder="es. il Fulmine" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div><label style={lbl}>Rarità</label>
                <select style={inp} value={f.rarity} onChange={(e) => set("rarity", e.target.value as Card["rarity"])}>
                  {Object.entries(RARITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select></div>
              <div><label style={lbl}>Ruolo</label>
                <select style={inp} value={f.role} onChange={(e) => set("role", e.target.value as Card["role"])}>
                  {Object.entries(ROLE).filter(([k]) => k !== "caposervizio").map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select></div>
              <div><label style={lbl}>Sesso (avatar)</label>
                <select style={inp} value={f.gender} onChange={(e) => set("gender", e.target.value)}>
                  <option value="m">M</option><option value="f">F</option>
                </select></div>
            </div>

            {f.role === "autista" && (
              <label style={{ ...lbl, display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={f.avanzato} onChange={(e) => set("avanzato", e.target.checked)} />
                Autista avanzato (vale anche come soccorritore avanzato)
              </label>
            )}

            {(["stat_guida", "stat_soccorso", "stat_resilienza"] as const)
              .filter((k) => k !== "stat_guida" || f.role === "autista").map((k) => (
              <div key={k}>
                <label style={lbl}>{{ stat_guida: "Guida", stat_soccorso: "Soccorso", stat_resilienza: "Resilienza" }[k]}: {f[k]}</label>
                <input type="range" min={1} max={100} value={f[k]} onChange={(e) => set(k, Number(e.target.value))} style={{ width: "100%" }} />
              </div>
            ))}

            <label style={lbl}>Pregi (uno per riga)</label>
            <textarea style={{ ...inp, minHeight: 60 }} value={f.pros} onChange={(e) => set("pros", e.target.value)} />
            <label style={lbl}>Difetti (uno per riga)</label>
            <textarea style={{ ...inp, minHeight: 44 }} value={f.cons} onChange={(e) => set("cons", e.target.value)} />

            <label style={lbl}>Fatica di notte: {f.night_fatigue > 0 ? "+" : ""}{Math.round(f.night_fatigue * 100)}%</label>
            <input type="range" min={-0.4} max={0.4} step={0.05} value={f.night_fatigue}
                   onChange={(e) => set("night_fatigue", Number(e.target.value))} style={{ width: "100%" }} />
            <label style={lbl}>Fatica sui codici rossi: {f.rosso_fatigue > 0 ? "+" : ""}{Math.round(f.rosso_fatigue * 100)}%</label>
            <input type="range" min={-0.4} max={0.4} step={0.05} value={f.rosso_fatigue}
                   onChange={(e) => set("rosso_fatigue", Number(e.target.value))} style={{ width: "100%" }} />

            <label style={lbl}>Foto del soccorritore</label>
            <label onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                   onDragLeave={() => setDragOver(false)}
                   onDrop={(e) => { e.preventDefault(); setDragOver(false); usePhoto(e.dataTransfer.files?.[0] ?? null); }}
                   style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, cursor: "pointer",
                            border: `2px dashed ${dragOver ? "#F97316" : "#ccc"}`, background: dragOver ? "#FFF7ED" : "#fafafa" }}>
              {preview
                ? <img src={preview} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover" }} />
                : <div style={{ width: 72, height: 72, borderRadius: 12, background: "#eee", display: "flex",
                                alignItems: "center", justifyContent: "center", fontSize: 30 }}>📷</div>}
              <div style={{ fontSize: 13, color: "#555", flex: 1 }}>
                {preview ? "Clicca per cambiarla" : "Trascina qui la foto oppure clicca per sceglierla"}
                <div style={{ fontSize: 12, color: "#888" }}>Viene ritagliata quadrata al centro. Senza foto si usa l&apos;avatar disegnato.</div>
              </div>
              <input type="file" accept="image/*" onChange={pickPhoto} style={{ display: "none" }} />
            </label>
            {preview && (
              <button type="button" onClick={() => usePhoto(null)}
                      style={{ ...btn, background: "#eee", color: "#111", fontSize: 12, padding: "6px 10px", marginTop: 6 }}>Rimuovi foto</button>
            )}

            <label style={{ ...lbl, display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={f.is_pack_eligible} onChange={(e) => set("is_pack_eligible", e.target.checked)} />
              Esce nei pacchetti dei giocatori
            </label>

            <label style={lbl}>🛒 Prezzo nel negozio (€) — lascia vuoto per non venderla</label>
            <input style={inp} type="number" min={0} step={500} value={f.shop_price} placeholder="es. 25000"
                   onChange={(e) => set("shop_price", e.target.value)} />

            <button onClick={save} disabled={!valid || busy} style={{ ...btn, width: "100%", marginTop: 12, background: "#F97316", opacity: !valid || busy ? 0.4 : 1 }}>
              {busy ? "Salvataggio…" : editing ? "Salva modifiche" : "Crea carta"}
            </button>
          </div>

          <div style={{ position: "sticky", top: 16 }}>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>Anteprima</div>
            <VolunteerCard c={previewCard} />
          </div>
        </div>

        {/* Catalogo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "24px 0 10px" }}>
          <h2 style={{ margin: 0, flex: 1 }}>Catalogo</h2>
          <button onClick={() => setFilter("rare")} style={{ ...btn, background: filter === "rare" ? "#111" : "#ddd", color: filter === "rare" ? "#fff" : "#111" }}>Epiche e leggendarie</button>
          <button onClick={() => setFilter("comune")} style={{ ...btn, background: filter === "comune" ? "#111" : "#ddd", color: filter === "comune" ? "#fff" : "#111" }}>Comuni</button>
        </div>
        {shown.length === 0 && <div style={{ ...box, color: "#666" }}>Nessuna carta in questa categoria.</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {shown.map((v) => (
            <div key={v.id}>
              <VolunteerCard compact c={{ ...v, volunteer_id: v.id, state: "attiva", rest_until: null, expires_at: null, services_completed: 0, energy: 100 }} />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button onClick={() => toggle(v)} style={{ ...btn, flex: 1, fontSize: 12, padding: "6px 8px",
                                                           background: v.is_pack_eligible ? "#16A34A" : "#9CA3AF" }}>
                  {v.is_pack_eligible ? "Nei pacchetti" : "Fuori dai pacchetti"}
                </button>
                {v.shop_price != null && <span style={{ ...btn, fontSize: 12, padding: "6px 8px", background: "#B45309", cursor: "default" }}>🛒 {v.shop_price.toLocaleString("it-IT")} €</span>}
                <button onClick={() => startEdit(v)} title="Modifica"
                        style={{ ...btn, fontSize: 12, padding: "6px 8px", background: editing?.id === v.id ? "#F97316" : "#111" }}>✏️</button>
                <label style={{ ...btn, fontSize: 12, padding: "6px 8px", background: "#1E3A8A" }} title="Cambia foto">
                  📷
                  <input type="file" accept="image/*" style={{ display: "none" }}
                         onChange={(e) => { changePhoto(v, e.target.files?.[0]); e.target.value = ""; }} />
                </label>
                {v.avatar_url && (
                  <button onClick={() => clearPhoto(v)} title="Togli foto"
                          style={{ ...btn, fontSize: 12, padding: "6px 8px", background: "#9CA3AF" }}>✕📷</button>
                )}
                {v.source === "admin" && (
                  <button onClick={() => remove(v)} style={{ ...btn, fontSize: 12, padding: "6px 8px", background: "#DC2626" }}>Elimina</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
