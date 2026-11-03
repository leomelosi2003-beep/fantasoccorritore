"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Row = {
  base_id: string; base_name: string; is_hq: boolean; services: number; revenue: number;
  rossi: number; gialli: number; altri: number; mare: number; vehicles: number;
  best_vehicle: string | null; best_vehicle_revenue: number | null;
};

const PERIODS = [
  { h: 1, label: "Ultima ora" },
  { h: 24, label: "Oggi (24 ore)" },
  { h: 168, label: "7 giorni" },
  { h: 720, label: "30 giorni" },
];
const euro = (n: number) => `${Math.round(n).toLocaleString("it-IT")} €`;
const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 760, margin: "0 auto", padding: 16 };
const card: CSSProperties = { background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", padding: 16, marginBottom: 14 };

export default function Fatturato() {
  const router = useRouter();
  const [hours, setHours] = useState(24);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const { data } = await supabase.rpc("my_base_revenue", { p_hours: hours });
      if (alive) setRows((data as Row[]) ?? []);
    };
    load();
    const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, [hours, router]);

  const total = (rows ?? []).reduce((t, r) => t + Number(r.revenue), 0);
  const services = (rows ?? []).reduce((t, r) => t + r.services, 0);
  const max = Math.max(1, ...(rows ?? []).map((r) => Number(r.revenue)));
  const per = PERIODS.find((p) => p.h === hours)!;

  return (
    <main style={shell}>
      <div style={{ background: "linear-gradient(135deg,#1E3A8A,#172554)", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={() => router.push("/")} style={{ padding: "8px 12px", borderRadius: 10, border: "none",
                  background: "rgba(0,0,0,.25)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>← Mappa</button>
          <div style={{ fontWeight: 800, fontSize: 18 }}>🏢 Fatturato delle sedi</div>
        </div>
      </div>

      <div style={wrap}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
          {PERIODS.map((p) => (
            <button key={p.h} onClick={() => { setHours(p.h); setRows(null); }}
                    style={{ padding: "9px 12px", borderRadius: 999, border: "none", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 700,
                             fontSize: 14, background: hours === p.h ? "#111" : "#fff", color: hours === p.h ? "#fff" : "#111",
                             boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>{p.label}</button>
          ))}
        </div>

        <div style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: "#666" }}>Fatturato totale</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#15803D" }}>{euro(total)}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#666" }}>Servizi conclusi</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{services.toLocaleString("it-IT")}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#666" }}>Media a servizio</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{euro(services ? total / services : 0)}</div>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Sedi · {per.label.toLowerCase()}</div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
            Premi dei servizi conclusi dai mezzi di ogni sede, prima delle tasse.
          </div>
          {rows === null && <div style={{ color: "#888", fontSize: 14 }}>Caricamento…</div>}
          {rows && rows.length === 0 && <div style={{ color: "#888", fontSize: 14 }}>Non hai ancora sedi.</div>}
          {rows?.map((r, i) => {
            const share = total ? Math.round((Number(r.revenue) / total) * 100) : 0;
            return (
              <div key={r.base_id} style={{ padding: "10px 0", borderTop: i ? "1px solid #f0f0f0" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 800, marginRight: 6 }}>{i === 0 && Number(r.revenue) > 0 ? "🥇" : i === 1 && Number(r.revenue) > 0 ? "🥈" : i === 2 && Number(r.revenue) > 0 ? "🥉" : "🏠"}</span>
                    <strong>{r.base_name}</strong>{r.is_hq && <span style={{ color: "#888", fontSize: 12 }}> · sede centrale</span>}
                  </span>
                  <span style={{ fontWeight: 800, whiteSpace: "nowrap", color: Number(r.revenue) > 0 ? "#15803D" : "#888" }}>{euro(Number(r.revenue))}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "#eef2ff", margin: "6px 0" }}>
                  <div style={{ height: 8, borderRadius: 4, background: "#2563EB", width: `${(Number(r.revenue) / max) * 100}%` }} />
                </div>
                <div style={{ fontSize: 12, color: "#555", display: "flex", flexWrap: "wrap", gap: "2px 12px" }}>
                  <span>{r.services} servizi · {share}% del totale</span>
                  <span>media {euro(r.services ? Number(r.revenue) / r.services : 0)}</span>
                  {r.rossi > 0 && <span>🔴 {r.rossi}</span>}
                  {r.gialli > 0 && <span>🟡 {r.gialli}</span>}
                  {r.altri > 0 && <span>🟢 {r.altri}</span>}
                  {r.mare > 0 && <span>🌊 {r.mare}</span>}
                  <span>🚑 {r.vehicles} mezzi{r.vehicles ? ` · ${euro(Number(r.revenue) / r.vehicles)} a mezzo` : ""}</span>
                  {r.best_vehicle && <span>⭐ {r.best_vehicle} ({euro(Number(r.best_vehicle_revenue ?? 0))})</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
