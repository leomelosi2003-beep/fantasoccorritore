"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase, type Organization } from "@/lib/supabase";
import FactionEmblem from "@/components/FactionEmblem";

type Row = {
  org_id: string; name: string; type: Organization["type"]; logo_url: string | null; alliance: string | null;
  earnings_7d: number; services_7d: number; wealth: number; growth_pct: number | null; reputation: number;
};

const TABS = [
  { key: "earnings_7d", label: "💶 Guadagni", hint: "Soldi guadagnati con i servizi negli ultimi 7 giorni" },
  { key: "growth_pct", label: "📈 Crescita", hint: "Quanto è cresciuto il patrimonio negli ultimi 7 giorni" },
  { key: "wealth", label: "🏦 Patrimonio", hint: "Soldi in cassa + valore di ambulanze, sedi e volontari" },
  { key: "reputation", label: "⭐ Reputazione", hint: "Reputazione totale guadagnata" },
] as const;
type Key = (typeof TABS)[number]["key"];

const euro = (n: number) => n.toLocaleString("it-IT") + " €";
const MEDAL = ["🥇", "🥈", "🥉"];
const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 760, margin: "0 auto", padding: 16 };

function value(r: Row, k: Key) {
  if (k === "earnings_7d") return euro(r.earnings_7d);
  if (k === "wealth") return euro(r.wealth);
  if (k === "reputation") return `⭐ ${r.reputation}`;
  if (r.growth_pct === null) return "—";
  return `${r.growth_pct > 0 ? "+" : ""}${r.growth_pct.toLocaleString("it-IT")}%`;
}

export default function Classifica() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<Key>("earnings_7d");
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const { data: o } = await supabase.from("organizations").select("id").eq("owner_id", session.user.id).maybeSingle();
      setMe(o?.id ?? null);
      const { data, error } = await supabase.rpc("leaderboard");
      if (error) { setError("Classifica non disponibile al momento."); return; }
      setRows((data as Row[]) ?? []);
    })();
  }, [router]);

  const sorted = [...rows].sort((a, b) => {
    const x = (a[tab] ?? -Infinity) as number, y = (b[tab] ?? -Infinity) as number;
    return y - x;
  });
  const t = TABS.find((x) => x.key === tab)!;

  return (
    <main style={shell}>
      <div style={{ background: "linear-gradient(135deg,#B45309,#78350F)", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={() => router.push("/")} style={{ padding: "8px 12px", borderRadius: 10, border: "none",
                  background: "rgba(0,0,0,.25)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>← Mappa</button>
          <div style={{ fontWeight: 800, fontSize: 18 }}>🏆 Classifica</div>
        </div>
      </div>

      <div style={wrap}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
          {TABS.map((x) => (
            <button key={x.key} onClick={() => setTab(x.key)}
                    style={{ padding: "9px 12px", borderRadius: 999, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                             fontWeight: 700, fontSize: 14, background: tab === x.key ? "#111" : "#fff",
                             color: tab === x.key ? "#fff" : "#111", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>{x.label}</button>
          ))}
        </div>
        <div style={{ fontSize: 13, color: "#666", margin: "8px 2px 12px" }}>{t.hint}</div>

        {error && <div style={{ background: "#fff1f1", color: "#a00", borderRadius: 10, padding: 12 }}>{error}</div>}

        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
          {sorted.map((r, i) => (
            <div key={r.org_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                                         borderTop: i ? "1px solid #f0f0f0" : "none",
                                         background: r.org_id === me ? "#FFFBEB" : undefined }}>
              <div style={{ width: 30, textAlign: "center", fontWeight: 800, fontSize: i < 3 ? 22 : 15, color: "#666" }}>
                {MEDAL[i] ?? i + 1}
              </div>
              <FactionEmblem type={r.type} size={34} logo={r.logo_url} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.name}{r.org_id === me && <span style={{ color: "#B45309" }}> (tu)</span>}
                </div>
                <div style={{ fontSize: 12, color: "#777" }}>
                  {r.services_7d} servizi in 7 giorni{r.alliance && <> · 🤝 {r.alliance}</>}
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: "nowrap",
                            color: tab === "growth_pct" && r.growth_pct !== null ? (r.growth_pct >= 0 ? "#15803D" : "#B91C1C") : "#111" }}>
                {value(r, tab)}
              </div>
            </div>
          ))}
          {!error && rows.length === 0 && <div style={{ padding: 20, color: "#888", textAlign: "center" }}>Caricamento…</div>}
        </div>
      </div>
    </main>
  );
}
