"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { playSound } from "@/lib/sound";

type Goal = {
  alliance: string; week: string; ends_at: string; total: number; target: number;
  members: { org_id: string; name: string; points: number }[];
  tiers: { tier: number; label: string; icon: string; need: number; reward: number }[];
  claimed: number[];
};

const euro = (n: number) => `${Math.round(n).toLocaleString("it-IT")} €`;

// Obiettivo settimanale di squadra dell'alleanza: i punti di tutti i membri si sommano
export default function AllianceGoal() {
  const [g, setG] = useState<Goal | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => supabase.rpc("my_alliance_goal").then(({ data }) => setG((data as Goal) ?? null));
  useEffect(() => { load(); }, []);
  if (!g) return null;

  const max = g.tiers[g.tiers.length - 1].need;
  const pct = Math.min(100, (g.total / max) * 100);
  const days = Math.max(0, Math.ceil((new Date(g.ends_at).getTime() - Date.now()) / 86_400_000));

  async function claim(tier: number) {
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc("claim_alliance_goal", { p_tier: tier });
    setBusy(false);
    if (error) { setMsg("Non è stato possibile ritirare il premio."); return; }
    playSound("money"); setMsg(`Premio ritirato: +${euro(Number(data))}`); load();
  }

  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>🎯 Obiettivo di squadra della settimana</div>
      <div style={{ fontSize: 13, color: "#555", marginBottom: 10 }}>
        I punti di tutti i membri di «{g.alliance}» si sommano (rosso 3, giallo 2, altri 1, maxi e incendi 5).
        Ogni membro ritira il premio dei traguardi raggiunti. {days > 0 ? `Mancano ${days} giorni.` : "Ultimo giorno!"}
        <br />🤝 Bonus: su maxi-emergenze e incendi, se ci sono almeno 3 associazioni dell&apos;alleanza, tutte prendono +25%.
      </div>
      <div style={{ position: "relative", height: 14, background: "#eee", borderRadius: 8, overflow: "hidden", margin: "6px 0 4px" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#16a34a,#15803d)" }} />
        {g.tiers.map((t) => (
          <div key={t.tier} style={{ position: "absolute", top: 0, bottom: 0, left: `${(t.need / max) * 100}%`, width: 2,
                                     background: "rgba(0,0,0,.25)", transform: "translateX(-2px)" }} />
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
        {g.total.toLocaleString("it-IT")} / {max.toLocaleString("it-IT")} punti
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
        {g.tiers.map((t) => {
          const reached = g.total >= t.need, taken = g.claimed.includes(t.tier);
          return (
            <div key={t.tier} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10, opacity: taken ? 0.6 : 1 }}>
              <div style={{ fontWeight: 800 }}>{t.icon} {t.label}</div>
              <div style={{ fontSize: 12, color: "#666" }}>{t.need.toLocaleString("it-IT")} punti · {euro(t.reward)} a testa</div>
              <button disabled={!reached || taken || busy} onClick={() => claim(t.tier)}
                      style={{ marginTop: 6, width: "100%", padding: "6px 8px", borderRadius: 8, border: "none", fontWeight: 700,
                               background: reached && !taken ? "#16a34a" : "#e5e7eb", color: reached && !taken ? "#fff" : "#9ca3af",
                               cursor: reached && !taken ? "pointer" : "default" }}>
                {taken ? "✓ Ritirato" : reached ? "Ritira" : "Non ancora"}
              </button>
            </div>
          );
        })}
      </div>
      {msg && <div style={{ marginTop: 8, color: "#15803D", fontWeight: 600 }}>{msg}</div>}
      <div style={{ marginTop: 12, fontSize: 13 }}>
        {[...g.members].sort((a, b) => b.points - a.points).map((m) => (
          <div key={m.org_id} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderTop: "1px solid #f3f3f3" }}>
            <span>{m.name}</span><strong>{m.points.toLocaleString("it-IT")}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
