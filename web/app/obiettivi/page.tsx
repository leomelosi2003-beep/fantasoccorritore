"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { playSound } from "@/lib/sound";

type Objective = {
  kind: "d" | "w"; key: string; period: string; icon: string; title: string;
  target: number; progress: number; reward: number; reputation: number; claimed: boolean; ends_at: string;
};

const euro = (n: number) => `${Math.round(n).toLocaleString("it-IT")} €`;
const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 760, margin: "0 auto", padding: 16 };
const card: CSSProperties = { background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", padding: 16, marginBottom: 14 };

function left(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "scaduto";
  const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000);
  return h >= 24 ? `${Math.floor(h / 24)} g ${h % 24} h` : `${h} h ${m} min`;
}

export default function Obiettivi() {
  const router = useRouter();
  const [list, setList] = useState<Objective[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    const { data, error } = await supabase.rpc("my_objectives");
    if (!error) setList((data as Objective[]) ?? []);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      if (alive) load();
    })();
    const id = setInterval(() => { if (document.visibilityState === "visible") { load(); setNow(Date.now()); } }, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, [router]);

  const claim = async (o: Objective) => {
    setBusy(o.period + o.key); setMsg(null);
    const { data, error } = await supabase.rpc("claim_objective", { p_period: o.period, p_key: o.key });
    setBusy(null);
    if (error) { setMsg("Non è stato possibile ritirare il premio: " + error.message); return; }
    playSound("money");
    setMsg(`Premio ritirato: +${euro(Number(data))} e +${o.reputation} ⭐`);
    load();
  };

  const section = (kind: "d" | "w", title: string, sub: string) => {
    const items = (list ?? []).filter((o) => o.kind === kind);
    const done = items.filter((o) => o.claimed).length;
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{title}</div>
          <div style={{ color: "#666", fontSize: 13 }}>{done}/{items.length} ritirati</div>
          <div style={{ flex: 1 }} />
          {items[0] && <div style={{ color: "#666", fontSize: 13 }}>⏳ {left(items[0].ends_at, now)}</div>}
        </div>
        <div style={{ color: "#777", fontSize: 13, marginBottom: 10 }}>{sub}</div>
        {items.map((o) => {
          const pct = Math.min(100, (o.progress / Math.max(1, o.target)) * 100);
          const ready = o.progress >= o.target && !o.claimed;
          return (
            <div key={o.key} style={{ borderTop: "1px solid #eee", padding: "12px 0", display: "flex", gap: 12, alignItems: "center",
                                       opacity: o.claimed ? 0.55 : 1 }}>
              <div style={{ fontSize: 26, width: 36, textAlign: "center" }}>{o.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{o.title}</div>
                <div style={{ height: 8, background: "#eee", borderRadius: 6, margin: "6px 0 4px", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: o.claimed ? "#9ca3af" : ready ? "#16a34a" : "#2563eb",
                                transition: "width .4s" }} />
                </div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  {o.progress.toLocaleString("it-IT")} / {o.target.toLocaleString("it-IT")} · premio {euro(o.reward)} + {o.reputation} ⭐
                </div>
              </div>
              {o.claimed ? <div style={{ fontWeight: 700, color: "#16a34a" }}>✓</div> : (
                <button disabled={!ready || busy !== null} onClick={() => claim(o)}
                        style={{ padding: "8px 12px", borderRadius: 10, border: "none", fontWeight: 700, cursor: ready ? "pointer" : "default",
                                 background: ready ? "#16a34a" : "#e5e7eb", color: ready ? "#fff" : "#9ca3af", whiteSpace: "nowrap" }}>
                  {busy === o.period + o.key ? "…" : "Ritira"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <main style={shell}>
      <div style={{ background: "linear-gradient(135deg,#15803D,#14532D)", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={() => router.push("/")} style={{ padding: "8px 12px", borderRadius: 10, border: "none",
                  background: "rgba(0,0,0,.25)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>← Mappa</button>
          <div style={{ fontWeight: 800, fontSize: 18 }}>🎯 Obiettivi</div>
        </div>
      </div>
      <div style={wrap}>
        {msg && <div style={{ ...card, background: "#ecfdf5", color: "#14532d", fontWeight: 600 }}>{msg}</div>}
        {list === null ? <div style={card}>Caricamento…</div> : (
          <>
            {section("d", "Oggi", "Cambiano ogni giorno a mezzanotte. Sono proporzionati alla tua flotta.")}
            {section("w", "Questa settimana", "Cambiano ogni lunedì. Premio più alto.")}
          </>
        )}
      </div>
    </main>
  );
}
