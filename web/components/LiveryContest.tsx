"use client";
// Concorso delle livree più belle: galleria con i voti della stagione (5 voti a testa, non alle proprie) e albo d'oro.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { typeColors } from "@/lib/profileStyle";

type Entry = { livery_id: string; org_id: string; org_name: string; org_type: string; livery_name: string; model_name: string; image_url: string; votes: number; my_vote: boolean; mine: boolean };
type Award = { season: string; rank: number; org_name: string; livery_name: string; model_name: string; image_url: string | null; votes: number };
const MEDAL = ["🥇", "🥈", "🥉"];
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const seasonName = (s: string) => { const [y, m] = s.split("-").map(Number); return `${MESI[m - 1]} ${y}`; };

export default function LiveryContest() {
  const [list, setList] = useState<Entry[]>([]);
  const [hall, setHall] = useState<Award[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [big, setBig] = useState<Entry | null>(null);
  const load = useCallback(async () => {
    const [{ data: a }, { data: b }] = await Promise.all([supabase.rpc("livery_contest"), supabase.rpc("livery_hall")]);
    setList((a as Entry[]) ?? []); setHall((b as Award[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);
  const used = list.filter((e) => e.my_vote).length;
  async function vote(e: Entry) {
    setBusy(e.livery_id); setMsg(null);
    const { error } = await supabase.rpc("vote_livery", { p_livery: e.livery_id, p_on: !e.my_vote });
    setBusy(null);
    if (error) setMsg(error.message.includes("NO_VOTES_LEFT") ? "Hai già usato i tuoi 5 voti: togline uno per votarne un'altra." : error.message.includes("OWN_LIVERY") ? "Non puoi votare le tue livree." : error.message);
    load();
  }
  const now = new Date(); const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const days = Math.ceil((+end - +now) / 86400000);
  const seasons = Array.from(new Set(hall.map((h) => h.season)));
  return (
    <div>
      <div style={{ background: "linear-gradient(120deg, #13294B, #1E3A8A 60%, #F59E0B)", color: "#fff", borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>🎨 Le livree più belle</div>
        <div style={{ fontSize: 13.5, opacity: 0.95 }}>Stagione di {seasonName(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)} · finisce tra {days} {days === 1 ? "giorno" : "giorni"}. Hai <b>{5 - used} voti</b> su 5 (non alle tue). Le prime 3 vanno nell&apos;albo d&apos;oro.</div>
      </div>
      {msg && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: 10, marginBottom: 10, fontWeight: 600 }}>{msg}</div>}
      {!list.length && <div style={{ background: "#fff", borderRadius: 14, padding: 16, color: "#64748B" }}>Nessuna livrea ancora: creane una nell&apos;Editor livrea!</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
        {list.map((e, i) => { const c = typeColors(e.org_type); return (
          <div key={e.livery_id} style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.08)", border: e.mine ? `2px solid ${c.main}` : "2px solid transparent" }}>
            <div onClick={() => setBig(e)} style={{ background: "linear-gradient(#EEF2F6, #DDE5EE)", padding: 8, cursor: "zoom-in", position: "relative" }}>
              {e.votes > 0 && i < 3 && <span style={{ position: "absolute", left: 8, top: 6, fontSize: 22 }}>{MEDAL[i]}</span>}
              <img src={e.image_url} alt={e.livery_name} style={{ width: "100%", height: 100, objectFit: "contain", display: "block" }} />
            </div>
            <div style={{ padding: "8px 10px" }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#13294B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.livery_name}</div>
              <div style={{ fontSize: 12, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.model_name} · <a href={`/profili/${e.org_id}`} style={{ color: c.main, fontWeight: 700, textDecoration: "none" }}>{e.org_name}</a></div>
              <div style={{ display: "flex", alignItems: "center", marginTop: 6 }}>
                <span style={{ flex: 1, fontWeight: 800, color: "#BE123C" }}>❤️ {e.votes}</span>
                {e.mine ? <span style={{ fontSize: 12, color: "#64748B" }}>la tua</span>
                  : <button disabled={busy === e.livery_id} onClick={() => vote(e)}
                            style={{ padding: "6px 12px", borderRadius: 999, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13,
                              background: e.my_vote ? "#BE123C" : "#FFE4E6", color: e.my_vote ? "#fff" : "#BE123C" }}>{e.my_vote ? "❤️ Votata" : "🤍 Vota"}</button>}
              </div>
            </div>
          </div>); })}
      </div>

      <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginTop: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: "#92400E", marginBottom: 8 }}>🏆 Albo d&apos;oro delle livree</div>
        {!seasons.length && <div style={{ fontSize: 13.5, color: "#64748B" }}>Le prime vincitrici arriveranno a fine stagione.</div>}
        {seasons.map((s) => (
          <div key={s} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, textTransform: "capitalize", marginBottom: 4 }}>{seasonName(s)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {hall.filter((h) => h.season === s).map((h) => (
                <div key={h.rank} style={{ background: "#FFFBEB", borderRadius: 10, padding: 6, textAlign: "center", fontSize: 12 }}>
                  {h.image_url && <img src={h.image_url} alt="" style={{ width: "100%", height: 50, objectFit: "contain" }} />}
                  <div>{MEDAL[h.rank - 1]} <b>{h.org_name}</b></div><div style={{ color: "#64748B" }}>{h.livery_name} · ❤️ {h.votes}</div>
                </div>))}
            </div>
          </div>))}
      </div>

      {big && <div onClick={() => setBig(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.85)", zIndex: 3000, display: "grid", placeItems: "center", padding: 12 }}>
        <div style={{ background: "linear-gradient(#EEF2F6, #DDE5EE)", borderRadius: 16, padding: 16, width: "min(900px, 100%)", boxSizing: "border-box", textAlign: "center" }}>
          <img src={big.image_url} alt="" style={{ width: "100%", maxHeight: "60vh", objectFit: "contain" }} />
          <div style={{ fontWeight: 800, fontSize: 17, color: "#13294B" }}>{big.livery_name}</div>
          <div style={{ fontSize: 13, color: "#64748B" }}>{big.model_name} · {big.org_name} · ❤️ {big.votes}</div>
        </div>
      </div>}
    </div>
  );
}
