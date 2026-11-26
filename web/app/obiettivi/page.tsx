"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { playSound } from "@/lib/sound";
import TutorialCoach from "@/components/TutorialCoach";
import PageHeader from "@/components/PageHeader";

type Objective = {
  kind: "d" | "w"; key: string; period: string; icon: string; title: string;
  target: number; progress: number; reward: number; reputation: number; claimed: boolean; ends_at: string;
};

const euro = (n: number) => `${Math.round(n).toLocaleString("it-IT")} €`;
const shell: CSSProperties = { minHeight: "100vh", background: "#EEF3FA", fontFamily: "Inter, system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 760, margin: "0 auto", padding: 16 };
const card: CSSProperties = { background: "#fff", borderRadius: 20, boxShadow: "0 1px 2px rgba(15,23,42,.05), 0 10px 28px rgba(15,23,42,.08)", border: "1px solid #E9EEF6", padding: 16, marginBottom: 14 };

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
      <section className="fs-obj-sec">
        <div className="fs-obj-head">
          <div>
            <h2>{title} <small>{done}/{items.length} ritirati</small></h2>
            <p>{sub}</p>
          </div>
          {items[0] && <span className="fs-obj-time">⏳ {left(items[0].ends_at, now)}</span>}
        </div>
        <div className="fs-obj-grid">
          {items.map((o) => {
            const pct = Math.min(100, (o.progress / Math.max(1, o.target)) * 100);
            const ready = o.progress >= o.target && !o.claimed;
            const col = o.claimed ? "#94A3B8" : ready ? "#16A34A" : "#2563EB";
            const C = 2 * Math.PI * 26;
            return (
              <div key={o.key} className={`fs-obj${ready ? " ready" : ""}${o.claimed ? " done" : ""}`}>
                <div className="fs-obj-ring">
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#E2E8F0" strokeWidth="7" />
                    <circle cx="32" cy="32" r="26" fill="none" stroke={col} strokeWidth="7" strokeLinecap="round"
                            strokeDasharray={`${(pct / 100) * C} ${C}`} transform="rotate(-90 32 32)" style={{ transition: "stroke-dasharray .6s" }} />
                  </svg>
                  <span>{o.claimed ? "✅" : o.icon}</span>
                </div>
                <div className="fs-obj-t">{o.title}</div>
                <div className="fs-obj-n">{o.progress.toLocaleString("it-IT")} / {o.target.toLocaleString("it-IT")}</div>
                <div className="fs-obj-prize">💶 {euro(o.reward)} · ⭐ {o.reputation}</div>
                {o.claimed ? <div className="fs-obj-btn off">Ritirato</div> : (
                  <button className={`fs-obj-btn${ready ? "" : " off"}`} disabled={!ready || busy !== null} onClick={() => claim(o)}>
                    {busy === o.period + o.key ? "…" : ready ? "🎁 Ritira il premio" : `${Math.round(pct)}% fatto`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  };
  const readyN = (list ?? []).filter((o) => o.progress >= o.target && !o.claimed).length;
  const prizeLeft = (list ?? []).filter((o) => !o.claimed).reduce((t, o) => t + o.reward, 0);

  return (
    <main style={shell}>
      <TutorialCoach page="obiettivi" />
      <PageHeader icon="🎯" title="Obiettivi" tone="green"
        sub="Completa le missioni del giorno e della settimana e ritira il premio"
        links={[{ href: "/classifica", label: "🏆 Classifica" }, { href: "/alleanza", label: "🤝 Obiettivo alleanza" }]} />
      <div style={wrap}>
        {msg && <div style={{ ...card, background: "#ecfdf5", color: "#14532d", fontWeight: 600 }}>{msg}</div>}
        {list === null ? <div style={card}>Caricamento…</div> : (
          <>
            <div className="fs-kpis">
              <div className="fs-kpi" style={{ ["--k" as string]: "#16A34A" }}><span>🎁 Pronti da ritirare</span><b style={{ color: readyN ? "#15803D" : undefined }}>{readyN}</b></div>
              <div className="fs-kpi" style={{ ["--k" as string]: "#2563EB" }}><span>✅ Ritirati</span><b>{list.filter((o) => o.claimed).length}/{list.length}</b></div>
              <div className="fs-kpi" style={{ ["--k" as string]: "#D97706" }}><span>💶 Premi ancora da prendere</span><b>{euro(prizeLeft)}</b></div>
            </div>
            {section("d", "☀️ Oggi", "Cambiano ogni giorno a mezzanotte. Sono proporzionati alla tua flotta.")}
            {section("w", "📅 Questa settimana", "Cambiano ogni lunedì. Premio più alto.")}
          </>
        )}
      </div>
    </main>
  );
}
