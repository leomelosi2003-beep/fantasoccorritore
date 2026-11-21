"use client";
// Alleanza "stile ANPAS": intestazione con banner e logo (li sceglie solo l'amministratore), fondo comune diviso ogni
// domenica, chat dell'alleanza (si azzera ogni lunedì) e contratto da firmare per entrare, con la firma animata.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";

export type AllianceFull = { id: string; name: string; founder_org: string; logo_url?: string | null; banner_url?: string | null; motto?: string | null; fund?: number };
const euro = (n: number) => Math.round(n).toLocaleString("it-IT") + " €";
const box: CSSProperties = { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)", marginBottom: 14 };
const h2: CSSProperties = { fontSize: 17, fontWeight: 800, margin: "0 0 10px", color: "#13294B" };

// ---------- immagini (ritagliate nel browser e salvate nella cartella della mia associazione) ----------
async function cropTo(file: File, w: number, h: number, type: "image/png" | "image/jpeg"): Promise<Blob> {
  const img = await createImageBitmap(file);
  const r = Math.max(w / img.width, h / img.height);
  const sw = w / r, sh = h / r;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("immagine non valida"))), type, 0.88));
}
async function uploadImg(myOrg: string, allianceId: string, file: File, kind: "logo" | "banner") {
  const blob = kind === "logo" ? await cropTo(file, 256, 256, "image/png") : await cropTo(file, 1500, 500, "image/jpeg");
  const path = `${myOrg}/alleanza-${allianceId}-${kind}-${Date.now()}.${kind === "logo" ? "png" : "jpg"}`;
  const { error } = await supabase.storage.from("org-logos").upload(path, blob, { contentType: kind === "logo" ? "image/png" : "image/jpeg", upsert: true });
  if (error) throw error;
  return supabase.storage.from("org-logos").getPublicUrl(path).data.publicUrl;
}

export function AllianceLogo({ a, size = 72 }: { a: Pick<AllianceFull, "name" | "logo_url">; size?: number }) {
  return a.logo_url
    ? <img src={a.logo_url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "3px solid #fff", background: "#fff", boxShadow: "0 4px 14px rgba(0,0,0,.3)" }} />
    : <div style={{ width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#F59E0B,#EA6A1F)", color: "#fff",
                    fontWeight: 900, fontSize: size * 0.38, border: "3px solid #fff", boxShadow: "0 4px 14px rgba(0,0,0,.3)" }}>{a.name.slice(0, 2).toUpperCase()}</div>;
}

// ---------- intestazione ----------
export function AllianceHero({ a, members, isAdmin, myOrg, onChanged }: { a: AllianceFull; members: number; isAdmin: boolean; myOrg: string; onChanged: () => void }) {
  const [edit, setEdit] = useState(false);
  const [motto, setMotto] = useState(a.motto ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null), banRef = useRef<HTMLInputElement>(null);
  async function save(logo: string | null | undefined, banner: string | null | undefined, m: string) {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("set_alliance_branding", { p_logo: logo ?? null, p_banner: banner ?? null, p_motto: m });
    setBusy(false);
    if (error) setErr(error.message.includes("NOT_ADMIN") ? "Solo l'amministratore può cambiare logo e banner." : error.message); else onChanged();
  }
  async function pick(file: File | undefined, kind: "logo" | "banner") {
    if (!file) return;
    try { setBusy(true); const url = await uploadImg(myOrg, a.id, file, kind);
      await save(kind === "logo" ? url : a.logo_url, kind === "banner" ? url : a.banner_url, motto);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <div style={{ borderRadius: 18, overflow: "hidden", marginBottom: 14, boxShadow: "0 6px 24px rgba(19,41,75,.25)", background: "#13294B" }}>
      <div style={{ position: "relative", height: 170, backgroundSize: "cover", backgroundPosition: "center",
                    backgroundImage: a.banner_url ? `url(${a.banner_url})` : "linear-gradient(135deg,#13294B 0%,#1D3D6B 55%,#EA6A1F 140%)" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,0) 30%,rgba(10,20,40,.85))" }} />
        {isAdmin && (
          <button onClick={() => setEdit((x) => !x)} style={{ position: "absolute", top: 10, right: 10, border: "none", borderRadius: 999, padding: "7px 12px",
                  background: "rgba(255,255,255,.92)", color: "#13294B", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>✏️ Personalizza</button>
        )}
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 12, display: "flex", alignItems: "flex-end", gap: 14, color: "#fff" }}>
          <AllianceLogo a={a} size={78} />
          <div style={{ minWidth: 0, paddingBottom: 4 }}>
            <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.1, textShadow: "0 2px 8px rgba(0,0,0,.5)" }}>{a.name}</div>
            {a.motto && <div style={{ fontSize: 13.5, opacity: 0.9, fontStyle: "italic", marginTop: 2 }}>«{a.motto}»</div>}
            <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 3 }}>🤝 {members} associazioni · 💰 fondo comune {euro(a.fund ?? 0)}</div>
          </div>
        </div>
      </div>
      {edit && isAdmin && (
        <div style={{ background: "#fff", padding: 14, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 800, color: "#13294B" }}>Solo tu, come amministratore, puoi cambiare logo, banner e motto.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button disabled={busy} onClick={() => logoRef.current?.click()} style={{ border: "none", borderRadius: 10, padding: "9px 14px", fontWeight: 800, background: "#13294B", color: "#fff", cursor: "pointer" }}>🛡️ Carica logo</button>
            <button disabled={busy} onClick={() => banRef.current?.click()} style={{ border: "none", borderRadius: 10, padding: "9px 14px", fontWeight: 800, background: "#EA6A1F", color: "#fff", cursor: "pointer" }}>🖼️ Carica banner (qualsiasi foto)</button>
            {a.banner_url && <button disabled={busy} onClick={() => save(a.logo_url, null, motto)} style={{ border: "1px solid #CBD5E1", borderRadius: 10, padding: "9px 14px", fontWeight: 700, background: "#fff", cursor: "pointer" }}>Togli banner</button>}
          </div>
          <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0], "logo")} />
          <input ref={banRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0], "banner")} />
          <div style={{ display: "flex", gap: 8 }}>
            <input value={motto} maxLength={120} onChange={(e) => setMotto(e.target.value)} placeholder="Motto dell'alleanza (facoltativo)"
                   style={{ flex: 1, padding: 9, borderRadius: 10, border: "1px solid #ccc", fontSize: 15 }} />
            <button disabled={busy} onClick={() => save(a.logo_url, a.banner_url, motto)} style={{ border: "none", borderRadius: 10, padding: "9px 14px", fontWeight: 800, background: "#15803D", color: "#fff", cursor: "pointer" }}>Salva</button>
          </div>
          {busy && <div style={{ fontSize: 13, color: "#64748B" }}>Salvataggio…</div>}
          {err && <div style={{ fontSize: 13, color: "#B91C1C" }}>{err}</div>}
        </div>
      )}
    </div>
  );
}

// ---------- fondo comune ----------
type Fund = { fund: number; members: number; next_payout: string; week_in: number; my_week_in: number; last_payouts: { at: string; amount: number; members: number }[] };
export function AllianceFund({ onChanged, myFunds }: { onChanged: () => void; myFunds: number }) {
  const [f, setF] = useState<Fund | null>(null);
  const [pct, setPct] = useState(2);
  const amt = Math.max(1000, Math.floor((myFunds * pct) / 100));
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => { supabase.rpc("my_alliance_fund").then(({ data }) => setF(data as Fund)); }, []);
  useEffect(() => { load(); }, [load]);
  if (!f) return null;
  const left = Math.max(0, Date.parse(f.next_payout) - Date.now());
  const d = Math.floor(left / 86400000), h = Math.floor((left % 86400000) / 3600000);
  async function give() {
    setMsg(null);
    const { error } = await supabase.rpc("alliance_contribute", { p_amount: amt });
    if (error) setMsg(error.message.includes("INSUFFICIENT") ? "Non hai abbastanza soldi." : error.message.includes("MIN_1000") ? "Minimo 1.000 €." : error.message);
    else { setMsg(`💶 Versati ${euro(amt)} nel fondo.`); load(); onChanged(); }
  }
  return (
    <div style={box}>
      <div style={h2}>💰 Fondo comune</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 10 }}>
        {[["Nel fondo", euro(f.fund)], ["Quota a testa domenica", euro(f.members ? f.fund / f.members : 0)], ["Raccolti questa settimana", euro(f.week_in)], ["Versati da te", euro(f.my_week_in)]].map(([l, v]) => (
          <div key={l} style={{ background: "#EEF3F8", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 11.5, color: "#64748B", fontWeight: 700 }}>{l}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#13294B" }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13, color: "#475569", marginBottom: 10 }}>
        Come una federazione: ogni ora ogni associazione versa lo <b>0,03% dei soldi in cassa</b> (circa il 5% a settimana): chi ha tanto versa tanto, chi ha poco versa poco. Più i versamenti volontari.
        Ogni <b>domenica alle 23</b> il fondo si divide <b>in parti uguali</b> tra tutte le {f.members} associazioni. Prossima ripartizione tra {d > 0 ? `${d} g ` : ""}{h} h.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[1, 2, 5, 10].map((p) => (
          <button key={p} onClick={() => setPct(p)} style={{ borderRadius: 999, padding: "7px 12px", fontWeight: 800, cursor: "pointer",
                  border: pct === p ? "2px solid #EA6A1F" : "1px solid #CBD5E1", background: pct === p ? "#FFF7ED" : "#fff", color: "#13294B" }}>{p}%</button>
        ))}
        <span style={{ alignSelf: "center", fontWeight: 800, color: "#13294B" }}>= {euro(amt)}</span>
        <button onClick={give} style={{ border: "none", borderRadius: 10, padding: "9px 14px", fontWeight: 800, background: "linear-gradient(135deg,#F59E0B,#EA6A1F)", color: "#fff", cursor: "pointer" }}>Versa nel fondo</button>
      </div>
      {msg && <div style={{ fontSize: 13, marginTop: 8, color: msg.startsWith("💶") ? "#15803D" : "#B91C1C" }}>{msg}</div>}
      {f.last_payouts.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: "#64748B" }}>
          Ultime ripartizioni: {f.last_payouts.map((p) => `${new Date(p.at).toLocaleDateString("it-IT")} ${euro(p.amount / Math.max(1, p.members))} a testa`).join(" · ")}
        </div>
      )}
    </div>
  );
}

// ---------- chat dell'alleanza ----------
type Msg = { id: number; body: string; created_at: string; org_id: string; org_name: string; logo_url: string | null };
export function AllianceChat({ allianceId, myOrg }: { allianceId: string; myOrg: string }) {
  const ch = "alleanza:" + allianceId;
  const [list, setList] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from("chat_feed").select("id,body,created_at,org_id,org_name,logo_url").eq("channel", ch).order("created_at", { ascending: false }).limit(150);
    setList(((data as Msg[]) ?? []).reverse());
  }, [ch]);
  useEffect(() => { load(); const iv = setInterval(() => { if (!document.hidden) load(); }, 6000); return () => clearInterval(iv); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [list.length]);
  async function send() {
    const b = text.trim(); if (!b) return;
    setErr(null);
    const { error } = await supabase.rpc("send_chat", { p_channel: ch, p_body: b });
    if (error) { setErr(error.message.includes("TOO_FAST") ? "Aspetta un attimo prima di scrivere ancora." : error.message); return; }
    setText(""); load();
  }
  return (
    <div style={box}>
      <div style={{ ...h2, display: "flex", alignItems: "baseline", gap: 8 }}>💬 Chat dell&apos;alleanza <span style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8" }}>si cancella ogni lunedì</span></div>
      <div style={{ height: 300, overflowY: "auto", background: "#F8FAFC", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {list.length === 0 && <div style={{ color: "#94A3B8", fontSize: 14, margin: "auto" }}>Ancora nessun messaggio questa settimana.</div>}
        {list.map((m) => {
          const mine = m.org_id === myOrg;
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%", display: "flex", gap: 6, flexDirection: mine ? "row-reverse" : "row" }}>
              {!mine && (m.logo_url ? <img src={m.logo_url} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#13294B", color: "#fff", fontSize: 11, display: "grid", placeItems: "center" }}>{m.org_name.slice(0, 1)}</div>)}
              <div style={{ background: mine ? "#13294B" : "#fff", color: mine ? "#fff" : "#0F172A", borderRadius: 14, padding: "7px 11px", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
                {!mine && <div style={{ fontSize: 11, fontWeight: 800, color: "#EA6A1F" }}>{m.org_name}</div>}
                <div className="fs-selectable" style={{ fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</div>
                <div style={{ fontSize: 10, opacity: 0.6, textAlign: "right" }}>{new Date(m.created_at).toLocaleString("it-IT", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input value={text} maxLength={300} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }}
               placeholder="Scrivi agli alleati…" style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }} />
        <button onClick={send} style={{ border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 800, background: "#EA6A1F", color: "#fff", cursor: "pointer" }}>Invia</button>
      </div>
      {err && <div style={{ fontSize: 13, color: "#B91C1C", marginTop: 6 }}>{err}</div>}
    </div>
  );
}

// ---------- contratto con firma animata ----------
export function AllianceContract({ a, orgName, founding, onSign, onClose }: {
  a: Pick<AllianceFull, "name" | "logo_url">; orgName: string; founding?: boolean;
  onSign: (signer: string) => Promise<string | null>; onClose: (signed?: boolean) => void;
}) {
  const [signer, setSigner] = useState(`Il Presidente di ${orgName}`);
  const [phase, setPhase] = useState<"read" | "signing" | "done">("read");
  const [err, setErr] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const today = new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  const clauses = [
    ["Mutuo soccorso", "Le associazioni aderenti si aiutano a vicenda: si prestano ambulanze e volontari e rispondono insieme a maxi emergenze, incendi e grandi eventi."],
    ["Fondo comune", "Ogni ora ogni associazione aderente versa nel fondo comune lo 0,03% dei soldi in cassa (circa il 5% a settimana): chi ha di più versa di più, chi ha di meno versa di meno. Sono ammessi versamenti volontari."],
    ["Ripartizione", "Ogni domenica alle ore 23 il fondo comune viene diviso in parti uguali tra tutte le associazioni aderenti in quel momento."],
    ["Amministrazione", "L'associazione fondatrice è l'amministratore: cura il logo, il banner, il motto e gli inviti di nuove associazioni."],
    ["Comunicazioni", "La chat dell'alleanza è riservata agli aderenti; il linguaggio è rispettoso. La cronologia si cancella ogni lunedì."],
    ["Recesso", "Ogni associazione può uscire in qualsiasi momento: i prestiti in corso terminano subito e quanto già versato resta nel fondo comune."],
  ];
  async function sign() {
    setErr(null); setPhase("signing");
    await new Promise((r) => setTimeout(r, 2600));                       // tempo dell'animazione della firma
    const e = await onSign(signer.trim());
    if (e) { setErr(e); setPhase("read"); return; }
    setPhase("done");
  }
  const showSig = phase !== "read";
  return (
    <div onClick={phase === "signing" ? undefined : () => onClose(phase === "done")} style={{ position: "fixed", inset: 0, background: "rgba(5,10,25,.75)", zIndex: 3000, overflowY: "auto", padding: "20px 12px" }}>
      <style>{`
        @keyframes fsSig { from { stroke-dashoffset: 1600 } to { stroke-dashoffset: 0 } }
        @keyframes fsInk { 0%,70% { fill-opacity: 0 } 100% { fill-opacity: 1 } }
        @keyframes fsStamp { 0% { transform: scale(2.4) rotate(-18deg); opacity: 0 } 70% { transform: scale(.92) rotate(-12deg); opacity: 1 } 100% { transform: scale(1) rotate(-12deg); opacity: .9 } }
        @keyframes fsPen { from { offset-distance: 0% } to { offset-distance: 100% } }
      `}</style>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620, margin: "0 auto", background: "linear-gradient(180deg,#FFFDF6,#F7F0DC)", borderRadius: 6,
            boxShadow: "0 20px 60px rgba(0,0,0,.5)", padding: "26px 26px 22px", fontFamily: "Georgia, 'Times New Roman', serif", color: "#2B2116", border: "1px solid #E4D7B4", position: "relative" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "inline-block" }}><AllianceLogo a={a} size={84} /></div>
          <div style={{ fontSize: 12, letterSpacing: 3, marginTop: 8, color: "#7A6440" }}>{founding ? "ATTO COSTITUTIVO" : "CONTRATTO DI ADESIONE"}</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 2 }}>{a.name}</div>
          <div style={{ fontSize: 13, color: "#7A6440", marginTop: 2 }}>Federazione di associazioni di pubblica assistenza e soccorso</div>
        </div>
        <div style={{ borderTop: "2px double #C9B78B", margin: "14px 0" }} />
        <p style={{ fontSize: 14.5, lineHeight: 1.55, margin: "0 0 10px" }}>
          L&apos;associazione <b>{orgName}</b>, di seguito «l&apos;Aderente», {founding ? "costituisce" : "aderisce a"} l&apos;alleanza <b>{a.name}</b> e accetta le seguenti clausole:
        </p>
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          {clauses.map(([t, d]) => <li key={t} style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 7 }}><b>{t}.</b> {d}</li>)}
        </ol>
        <div style={{ fontSize: 13.5, marginTop: 12, color: "#4B3D28" }}>Letto, approvato e sottoscritto in data {today}.</div>

        {/* firma */}
        <div style={{ marginTop: 16, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ height: 70, position: "relative" }}>
              {showSig && (
                <svg viewBox="0 0 400 70" style={{ width: "100%", height: 70, overflow: "visible" }}>
                  <text x="6" y="52" style={{ fontFamily: "'Segoe Script','Brush Script MT','Lucida Handwriting','Snell Roundhand',cursive", fontSize: 34 }}
                        fill="#1E3A8A" fillOpacity={0} stroke="#1E3A8A" strokeWidth={1} strokeDasharray="1600" strokeDashoffset="1600"
                        className="fs-sig">{signer.replace(/^Il Presidente di /, "")}</text>
                  <style>{`.fs-sig { animation: fsSig 2.2s ease-in-out forwards, fsInk 2.6s ease forwards; }`}</style>
                  <path d="M6 60 C 120 66, 260 54, 390 62" fill="none" stroke="#1E3A8A" strokeWidth={1.4} strokeDasharray="420" strokeDashoffset="420"
                        style={{ animation: "fsSig 0.6s 2s ease-out forwards" }} />
                </svg>
              )}
            </div>
            <div style={{ borderTop: "1px solid #8C7650", paddingTop: 4, fontSize: 12, color: "#7A6440" }}>Firma: {signer}</div>
          </div>
          <div style={{ width: 96, height: 96, display: "grid", placeItems: "center" }}>
            {phase === "done" && (
              <div style={{ width: 92, height: 92, borderRadius: "50%", border: "3px solid #B91C1C", color: "#B91C1C", display: "grid", placeItems: "center", textAlign: "center",
                            fontSize: 11, fontWeight: 900, letterSpacing: 1, animation: "fsStamp .5s ease-out forwards", fontFamily: "Arial, sans-serif" }}>
                FIRMATO<br />✓<br />{new Date().toLocaleDateString("it-IT")}
              </div>
            )}
          </div>
        </div>

        {phase === "read" && (
          <div style={{ marginTop: 16, fontFamily: "system-ui, sans-serif" }}>
            <label style={{ fontSize: 13, color: "#4B3D28", fontWeight: 700 }}>Chi firma</label>
            <input value={signer} maxLength={60} onChange={(e) => setSigner(e.target.value)}
                   style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 8, border: "1px solid #C9B78B", fontSize: 16, background: "#fff", marginTop: 4 }} />
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 14 }}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 20, height: 20 }} /> Ho letto e accetto tutte le clausole
            </label>
            {err && <div style={{ color: "#B91C1C", fontSize: 13, marginTop: 8 }}>{err}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => onClose()} style={{ flex: 1, border: "1px solid #C9B78B", background: "#fff", borderRadius: 10, padding: 12, fontWeight: 700, cursor: "pointer" }}>Non ora</button>
              <button disabled={!agree || signer.trim().length < 2} onClick={sign}
                      style={{ flex: 2, border: "none", borderRadius: 10, padding: 12, fontWeight: 800, fontSize: 16, color: "#fff", cursor: "pointer",
                               background: "linear-gradient(135deg,#1E3A8A,#13294B)", opacity: !agree || signer.trim().length < 2 ? 0.45 : 1 }}>✍️ Firma il contratto</button>
            </div>
          </div>
        )}
        {phase === "signing" && <div style={{ marginTop: 14, textAlign: "center", fontStyle: "italic", color: "#7A6440" }}>Firma in corso…</div>}
        {phase === "done" && (
          <div style={{ marginTop: 14, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#15803D" }}>🤝 {founding ? "Alleanza fondata!" : `Benvenuti in ${a.name}!`}</div>
            <button onClick={() => onClose(true)} style={{ marginTop: 10, border: "none", borderRadius: 10, padding: "11px 22px", fontWeight: 800, background: "#EA6A1F", color: "#fff", cursor: "pointer" }}>Entra nell&apos;alleanza</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- logo dell'alleanza sulle sedi delle associazioni aderenti ----------
export type AllyBadge = { name: string; logo_url: string | null };
// la mia alleanza (per le pagine con le mie sedi)
export function useMyAllianceBadge(orgId: string | null | undefined) {
  const [b, setB] = useState<AllyBadge | null>(null);
  useEffect(() => {
    if (!orgId) return;
    supabase.from("alliance_members").select("alliances(name,logo_url)").eq("org_id", orgId).maybeSingle()
      .then(({ data }) => { const a = (data as unknown as { alliances: AllyBadge | null } | null)?.alliances; setB(a ?? null); });
  }, [orgId]);
  return b;
}
// tutte le associazioni → la loro alleanza (per la mappa)
export async function loadOrgAlliances(): Promise<Record<string, AllyBadge>> {
  const { data } = await supabase.from("alliance_members").select("org_id, alliances(name,logo_url)");
  const out: Record<string, AllyBadge> = {};
  for (const r of (data as unknown as { org_id: string; alliances: AllyBadge | null }[]) ?? []) if (r.alliances) out[r.org_id] = r.alliances;
  return out;
}
export function AllyChip({ a, size = 22, dark = false }: { a: AllyBadge; size?: number; dark?: boolean }) {
  return (
    <span title={`Alleanza ${a.name}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 999, padding: "2px 8px 2px 2px",
                 background: dark ? "rgba(255,255,255,.18)" : "#EEF3F8", color: dark ? "#fff" : "#13294B", fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>
      <AllianceLogo a={a} size={size} />{a.name}
    </span>
  );
}

// ---------- vetrina di tutte le alleanze ----------
type Dir = { id: string; name: string; logo_url: string | null; banner_url: string | null; motto: string | null; fund: number; members: number;
  founder_name: string | null; last_share: number | null; est_share: number; is_mine: boolean; requested: boolean; invited: boolean };
export function AllianceDirectory({ inAlliance, onChanged }: { inAlliance: boolean; onChanged: () => void }) {
  const [list, setList] = useState<Dir[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => { supabase.rpc("alliances_directory").then(({ data }) => setList((data as Dir[]) ?? [])); }, []);
  useEffect(() => { load(); }, [load]);
  async function ask(a: Dir, cancel: boolean) {
    setMsg(null);
    const { error } = await supabase.rpc(cancel ? "cancel_join_request" : "request_join_alliance", { p_alliance: a.id });
    if (error) setMsg(error.message.includes("ALREADY_IN_ALLIANCE") ? "Sei già in un'alleanza: per entrare in un'altra prima esci." : error.message);
    else { setMsg(cancel ? `Richiesta a ${a.name} annullata.` : `📨 Richiesta inviata a ${a.name}: quando l'amministratore accetta ti arriva il contratto da firmare.`); load(); onChanged(); }
  }
  if (!list) return null;
  return (
    <div style={box}>
      <div style={h2}>🌐 Tutte le alleanze</div>
      {list.length === 0 && <div style={{ color: "#64748B" }}>Non c&apos;è ancora nessuna alleanza: fondane una!</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
        {list.map((a) => (
          <div key={a.id} style={{ borderRadius: 14, overflow: "hidden", border: a.is_mine ? "2px solid #EA6A1F" : "1px solid #E2E8F0", background: "#fff", display: "flex", flexDirection: "column" }}>
            <div style={{ height: 78, position: "relative", backgroundSize: "cover", backgroundPosition: "center",
                          backgroundImage: a.banner_url ? `url(${a.banner_url})` : "linear-gradient(135deg,#13294B,#1D3D6B 60%,#EA6A1F 140%)" }}>
              <div style={{ position: "absolute", left: 10, bottom: -22 }}><AllianceLogo a={a} size={52} /></div>
              {a.is_mine && <span style={{ position: "absolute", right: 8, top: 8, background: "#EA6A1F", color: "#fff", borderRadius: 999, padding: "2px 9px", fontSize: 11.5, fontWeight: 800 }}>La tua</span>}
            </div>
            <div style={{ padding: "26px 12px 12px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: "#13294B" }}>{a.name}</div>
              {a.motto && <div style={{ fontSize: 12.5, fontStyle: "italic", color: "#64748B" }}>«{a.motto}»</div>}
              <div style={{ fontSize: 12.5, color: "#475569" }}>🤝 {a.members} associazioni{a.founder_name ? ` · amministratore ${a.founder_name}` : ""}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 800, background: "#EEF3F8", color: "#13294B", borderRadius: 999, padding: "2px 9px" }}>💰 fondo {euro(a.fund)}</span>
                <span style={{ fontSize: 12, fontWeight: 800, background: "#DCFCE7", color: "#15803D", borderRadius: 999, padding: "2px 9px" }}>
                  🎁 {a.is_mine ? "ti arrivano" : "riceveresti"} ~{euro(a.est_share)} domenica
                </span>
              </div>
              {a.last_share != null && <div style={{ fontSize: 11.5, color: "#64748B" }}>Ultima ripartizione: {euro(a.last_share)} a testa</div>}
              <div style={{ marginTop: "auto", paddingTop: 6 }}>
                {a.is_mine ? null
                  : a.invited ? <div style={{ fontSize: 12.5, fontWeight: 800, color: "#15803D" }}>✅ Accettato: firma il contratto in «Richieste per te»</div>
                  : inAlliance ? <div style={{ fontSize: 12, color: "#94A3B8" }}>Sei già in un&apos;alleanza</div>
                  : a.requested
                    ? <button onClick={() => ask(a, true)} style={{ width: "100%", border: "1px solid #CBD5E1", background: "#fff", borderRadius: 10, padding: 9, fontWeight: 700, cursor: "pointer" }}>⏳ Richiesta inviata · annulla</button>
                    : <button onClick={() => ask(a, false)} style={{ width: "100%", border: "none", background: "linear-gradient(135deg,#F59E0B,#EA6A1F)", color: "#fff", borderRadius: 10, padding: 10, fontWeight: 800, cursor: "pointer" }}>🙋 Chiedi di entrare</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
      {msg && <div style={{ fontSize: 13, marginTop: 10, color: msg.startsWith("📨") || msg.startsWith("Richiesta") ? "#15803D" : "#B91C1C" }}>{msg}</div>}
    </div>
  );
}

// ---------- richieste di entrare (solo amministratore) ----------
type Req = { id: string; org_id: string; org_name: string; logo_url: string | null; reputation: number; vehicles: number; created_at: string };
export function JoinRequestsAdmin() {
  const [list, setList] = useState<Req[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => { supabase.rpc("admin_join_requests").then(({ data }) => setList((data as Req[]) ?? [])); }, []);
  useEffect(() => { load(); }, [load]);
  if (list.length === 0) return null;
  async function answer(r: Req, ok: boolean) {
    const { error } = await supabase.rpc("answer_join_request", { p_request: r.id, p_accept: ok });
    setMsg(error ? error.message : ok ? `✅ ${r.org_name} accettata: ora deve firmare il contratto.` : `Richiesta di ${r.org_name} rifiutata.`);
    load();
  }
  return (
    <div style={{ ...box, border: "2px solid #F59E0B" }}>
      <div style={h2}>📥 Chiedono di entrare nella tua alleanza</div>
      {list.map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #F1F5F9", flexWrap: "wrap" }}>
          {r.logo_url ? <img src={r.logo_url} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }} />
            : <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#13294B", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>{r.org_name.slice(0, 1)}</div>}
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontWeight: 800 }}>{r.org_name}</div>
            <div style={{ fontSize: 12, color: "#64748B" }}>⭐ {r.reputation} · 🚑 {r.vehicles} mezzi</div>
          </div>
          <button onClick={() => answer(r, true)} style={{ border: "none", borderRadius: 10, padding: "8px 12px", fontWeight: 800, background: "#15803D", color: "#fff", cursor: "pointer" }}>Accetta</button>
          <button onClick={() => answer(r, false)} style={{ border: "1px solid #CBD5E1", borderRadius: 10, padding: "8px 12px", fontWeight: 700, background: "#fff", cursor: "pointer" }}>Rifiuta</button>
        </div>
      ))}
      {msg && <div style={{ fontSize: 13, marginTop: 6, color: "#15803D" }}>{msg}</div>}
    </div>
  );
}
