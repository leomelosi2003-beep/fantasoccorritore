"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Day = { day: string; services: number; rossi: number; gialli: number; altri: number; mare: number; trasf: number;
             earnings: number; avg_arrival_sec: number | null };

const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 760, margin: "0 auto", padding: 16 };
const card: CSSProperties = { background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", padding: 16, marginBottom: 14 };
const euro = (n: number) => `${Math.round(n).toLocaleString("it-IT")} €`;
const short = (n: number) => n >= 1e6 ? `${(n / 1e6).toLocaleString("it-IT", { maximumFractionDigits: 1 })} mln` :
  n >= 1e3 ? `${Math.round(n / 1e3).toLocaleString("it-IT")} mila` : String(Math.round(n));
const dayLabel = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" });
const PERIODS = [7, 14, 30];

// Grafico a barre semplice, una sola serie: tocca o passa sopra una barra per il valore esatto
function Bars({ data, value, fmt, color }: { data: Day[]; value: (d: Day) => number; fmt: (n: number) => string; color: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 700, H = 170, pad = 22;
  const max = Math.max(1, ...data.map(value));
  const bw = (W - pad) / Math.max(1, data.length);
  const shown = hover ?? data.length - 1;
  return (
    <div>
      <div style={{ fontSize: 13, color: "#555", minHeight: 18 }}>
        {data[shown] && <><b style={{ color: "#111" }}>{fmt(value(data[shown]))}</b> · {dayLabel(data[shown].day)}</>}
      </div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} style={{ width: "100%", height: "auto", display: "block" }}
           onMouseLeave={() => setHover(null)}>
        <line x1={pad} x2={W} y1={H} y2={H} stroke="#ddd" />
        <text x={0} y={12} fontSize={11} fill="#888">{short(max)}</text>
        {data.map((d, i) => {
          const h = (value(d) / max) * (H - 20);
          const x = pad + i * bw;
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} style={{ cursor: "pointer" }}>
              <rect x={x} y={0} width={bw} height={H} fill="transparent" />
              <rect x={x + 1} y={H - h} width={Math.max(2, bw - 2)} height={Math.max(0, h)} rx={Math.min(4, bw / 3)}
                    fill={color} opacity={hover === null || hover === i ? 1 : 0.45} />
              {(i === 0 || i === data.length - 1 || (data.length > 10 && i === Math.floor(data.length / 2))) && (
                <text x={x + bw / 2} y={H + 14} fontSize={11} fill="#888" textAnchor="middle">{dayLabel(d.day)}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function Statistiche() {
  const router = useRouter();
  const [days, setDays] = useState(14);
  const [rows, setRows] = useState<Day[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const { data } = await supabase.rpc("my_daily_stats", { p_days: days });
      setRows(((data as Day[]) ?? []).map((d) => ({ ...d, earnings: Number(d.earnings), avg_arrival_sec: d.avg_arrival_sec === null ? null : Number(d.avg_arrival_sec) })));
    })();
  }, [days, router]);

  const tot = (k: keyof Day) => (rows ?? []).reduce((t, r) => t + Number(r[k] ?? 0), 0);
  const services = tot("services");
  const arr = (rows ?? []).filter((r) => r.avg_arrival_sec !== null);
  const avgArr = arr.length ? arr.reduce((t, r) => t + (r.avg_arrival_sec ?? 0) * r.services, 0) / Math.max(1, arr.reduce((t, r) => t + r.services, 0)) : null;
  const best = [...(rows ?? [])].sort((a, b) => b.earnings - a.earnings)[0];

  return (
    <main style={shell}>
      <div style={{ background: "linear-gradient(135deg,#1E40AF,#1E3A8A)", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={() => router.push("/")} style={{ padding: "8px 12px", borderRadius: 10, border: "none",
                  background: "rgba(0,0,0,.25)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>← Mappa</button>
          <div style={{ fontWeight: 800, fontSize: 18 }}>📈 Le mie statistiche</div>
        </div>
      </div>
      <div style={wrap}>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {PERIODS.map((p) => (
            <button key={p} onClick={() => { setDays(p); setRows(null); }}
                    style={{ padding: "8px 12px", borderRadius: 999, border: "none", cursor: "pointer", fontWeight: 700,
                             background: days === p ? "#111" : "#fff", color: days === p ? "#fff" : "#111",
                             boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>{p} giorni</button>
          ))}
        </div>

        {rows === null ? <div style={card}>Caricamento…</div> : rows.length === 0 ? <div style={card}>Nessun servizio concluso nel periodo.</div> : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
              {[
                ["Incassato", euro(tot("earnings"))],
                ["Servizi conclusi", services.toLocaleString("it-IT")],
                ["Arrivo medio (118)", avgArr === null ? "—" : `${Math.round(avgArr)} s`],
                ["Giorno migliore", best ? `${dayLabel(best.day)} · ${short(best.earnings)} €` : "—"],
              ].map(([l, v]) => (
                <div key={l} style={{ ...card, marginBottom: 0, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "#666" }}>{l}</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800 }}>💶 Incasso al giorno</div>
              <Bars data={rows} value={(d) => d.earnings} fmt={euro} color="#2563EB" />
            </div>
            <div style={card}>
              <div style={{ fontWeight: 800 }}>🚑 Servizi conclusi al giorno</div>
              <Bars data={rows} value={(d) => d.services} fmt={(n) => `${n.toLocaleString("it-IT")} servizi`} color="#2563EB" />
            </div>
            <div style={card}>
              <div style={{ fontWeight: 800 }}>⏱️ Tempo medio di arrivo sulle emergenze</div>
              <div style={{ fontSize: 12, color: "#777" }}>Più basso è, meglio è: sedi vicine e mezzi veloci.</div>
              <Bars data={rows} value={(d) => d.avg_arrival_sec ?? 0} fmt={(n) => `${Math.round(n)} secondi`} color="#2563EB" />
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>📋 Servizi per tipo</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, whiteSpace: "nowrap" }}>
                  <thead>
                    <tr style={{ color: "#666", textAlign: "right" }}>
                      <th style={{ textAlign: "left", padding: "4px 6px" }}>Giorno</th>
                      <th style={{ padding: "4px 6px" }}>🔴 Rossi</th><th style={{ padding: "4px 6px" }}>🟡 Gialli</th>
                      <th style={{ padding: "4px 6px" }}>Altri</th><th style={{ padding: "4px 6px" }}>⛵ Mare</th>
                      <th style={{ padding: "4px 6px" }}>🔁 Trasf.</th><th style={{ padding: "4px 6px" }}>Incasso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows].reverse().map((r) => (
                      <tr key={r.day} style={{ borderTop: "1px solid #f0f0f0", textAlign: "right" }}>
                        <td style={{ textAlign: "left", padding: "4px 6px" }}>{dayLabel(r.day)}</td>
                        <td style={{ padding: "4px 6px" }}>{r.rossi}</td><td style={{ padding: "4px 6px" }}>{r.gialli}</td>
                        <td style={{ padding: "4px 6px" }}>{r.altri}</td><td style={{ padding: "4px 6px" }}>{r.mare}</td>
                        <td style={{ padding: "4px 6px" }}>{r.trasf}</td><td style={{ padding: "4px 6px" }}>{euro(r.earnings)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
