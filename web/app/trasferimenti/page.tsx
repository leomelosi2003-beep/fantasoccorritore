"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase, type MissionPin } from "@/lib/supabase";
import MissionPanel from "@/components/MissionPanel";

type Quote = {
  id: string; title: string; from_name: string; to_name: string; road_km: number; protetto: boolean; fuori: boolean;
  reward: number; reward_est: number; minutes_est: number; base_name: string | null; base_km: number | null;
  too_far: boolean; expires_at: string;
};

const euro = (n: number) => n.toLocaleString("it-IT") + " €";
const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 760, margin: "0 auto", padding: 16 };

function duration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
function left(t: string, now: number) {
  const s = Math.max(0, Math.floor((new Date(t).getTime() - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function Trasferimenti() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [pins, setPins] = useState<Record<string, MissionPin>>({});
  const [selected, setSelected] = useState<MissionPin | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  async function load() {
    const { data } = await supabase.rpc("transfer_quotes");
    const q = (data as Quote[]) ?? [];
    setQuotes(q);
    if (q.length) {
      const { data: m } = await supabase.from("missions_map").select("*").in("id", q.map((x) => x.id));
      setPins(Object.fromEntries(((m as MissionPin[]) ?? []).map((x) => [x.id, x])));
    }
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      load();
    })();
    const r = setInterval(load, 20_000);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(r); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const list = (quotes ?? []).filter((q) => new Date(q.expires_at).getTime() > now);

  return (
    <main style={shell}>
      <div style={{ background: "linear-gradient(135deg,#0E7490,#164E63)", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={() => router.push("/")} style={{ padding: "8px 12px", borderRadius: 10, border: "none",
                  background: "rgba(0,0,0,.25)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>← Mappa</button>
          <div style={{ fontWeight: 800, fontSize: 18 }}>🔁 Trasferimenti</div>
        </div>
      </div>

      <div style={wrap}>
        <div style={{ fontSize: 13, color: "#666", margin: "0 2px 12px" }}>
          Trasferimenti tra ospedali disponibili adesso. Il premio stimato tiene conto di quanto è lontana la tua sede più vicina;
          allestimento, presidi e carte rare aggiungono altri bonus. Con l&apos;M-Sprinterix XL i trasferimenti pagano il 25% in più.
          La durata è il tempo dalla partenza a quando l&apos;ambulanza si libera all&apos;ospedale di arrivo.
        </div>

        {toast && <div style={{ background: "#DCFCE7", color: "#166534", borderRadius: 10, padding: 12, marginBottom: 12, fontWeight: 600 }}>{toast}</div>}

        {quotes === null && <div style={{ padding: 20, color: "#888", textAlign: "center" }}>Caricamento…</div>}
        {quotes !== null && list.length === 0 && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, color: "#666", textAlign: "center" }}>
            Nessun trasferimento disponibile in questo momento: ne arrivano di nuovi ogni pochi minuti.
          </div>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          {list.map((q) => {
            const pin = pins[q.id];
            return (
              <div key={q.id} style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>🏥 {q.from_name}</div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>➡️ {q.to_name}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                      {q.road_km} km di strada
                      {q.fuori && <span style={{ color: "#7C3AED", fontWeight: 700 }}> · fuori regione</span>}
                      {q.protetto && <span style={{ color: "#DC2626", fontWeight: 700 }}> · protetto (serve soccorritore avanzato + DAE)</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#15803D" }}>{euro(q.reward_est)}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>premio base {euro(q.reward)}</div>
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, fontSize: 13 }}>
                  <span style={{ background: "#EFF6FF", color: "#1E40AF", borderRadius: 8, padding: "4px 8px", fontWeight: 700 }}>⏱ circa {duration(q.minutes_est)}</span>
                  {q.base_name && (
                    <span style={{ background: q.too_far ? "#fff1f1" : "#f6f6f4", color: q.too_far ? "#B91C1C" : "#555", borderRadius: 8, padding: "4px 8px" }}>
                      🏠 {q.base_name} · {String(q.base_km).replace(".", ",")} km{q.too_far && " · troppo lontana"}
                    </span>
                  )}
                  <span style={{ background: "#FEF3C7", color: "#92400E", borderRadius: 8, padding: "4px 8px" }}>⌛ scade tra {left(q.expires_at, now)}</span>
                </div>

                <button disabled={!pin || q.too_far} onClick={() => pin && setSelected(pin)}
                        style={{ marginTop: 12, width: "100%", border: "none", borderRadius: 10, padding: "10px 12px", fontSize: 15,
                                 fontWeight: 800, color: "#fff", background: "#0E7490", cursor: pin && !q.too_far ? "pointer" : "not-allowed",
                                 opacity: pin && !q.too_far ? 1 : 0.45 }}>
                  {q.too_far ? "Troppo lontano dalle tue sedi" : "🚑 Prendi il trasferimento"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,.35)" }} onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <MissionPanel mission={selected} onClose={() => setSelected(null)}
                          onClaimed={(text) => { setSelected(null); setToast(text); load(); }} />
          </div>
        </div>
      )}
    </main>
  );
}
