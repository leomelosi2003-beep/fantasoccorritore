"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase, type Organization } from "@/lib/supabase";
import FactionEmblem from "@/components/FactionEmblem";

type Row = {
  org_id: string; name: string; type: Organization["type"]; logo_url: string | null; alliance: string | null;
  earnings_7d: number | null; services_7d: number | null; wealth: number | null; growth_pct: number | null; reputation: number | null;
  hidden?: boolean; stolen_7d?: number; stolen_total?: number; lost_7d?: number;
  season_points?: number; per_vehicle?: number; vehicles?: number;
};
type Award = { season: string; category: "punti" | "rivelazione"; rank: number; org_id: string; points: number };

const TABS = [
  { key: "season_points", label: "🏁 Stagione", hint: "Punti di questo mese: rosso 3, giallo 2, altri 1, maxi e incendi 5, obiettivo ritirato 20. Si riparte da zero ogni mese (solo la classifica: soldi e mezzi restano)." },
  { key: "per_vehicle", label: "🌱 Rivelazione", hint: "Punti di stagione per mezzo: premia chi lavora meglio, anche con pochi mezzi." },
  { key: "earnings_7d", label: "💶 Guadagni", hint: "Soldi guadagnati con i servizi negli ultimi 7 giorni" },
  { key: "growth_pct", label: "📈 Crescita", hint: "Quanto è cresciuto il patrimonio negli ultimi 7 giorni" },
  { key: "wealth", label: "🏦 Patrimonio", hint: "Soldi in cassa + valore di ambulanze, sedi e volontari" },
  { key: "reputation", label: "⭐ Reputazione", hint: "Reputazione totale guadagnata" },
  { key: "stolen_7d", label: "🥷 Rubati", hint: "Servizi soffiati agli altri giocatori arrivando prima di loro, negli ultimi 7 giorni" },
] as const;
type Key = (typeof TABS)[number]["key"];

const euro = (n: number) => n.toLocaleString("it-IT") + " €";
const MEDAL = ["🥇", "🥈", "🥉"];
const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 760, margin: "0 auto", padding: 16 };

function value(r: Row, k: Key) {
  if (r.hidden && k !== "growth_pct" && k !== "stolen_7d") return "🔒";
  if (k === "earnings_7d") return euro(r.earnings_7d ?? 0);
  if (k === "wealth") return euro(r.wealth ?? 0);
  if (k === "reputation") return `⭐ ${r.reputation ?? 0}`;
  if (k === "stolen_7d") return `🥷 ${r.stolen_7d ?? 0}`;
  if (k === "season_points") return `${(r.season_points ?? 0).toLocaleString("it-IT")} pt`;
  if (k === "per_vehicle") return `${(r.per_vehicle ?? 0).toLocaleString("it-IT")} pt/mezzo`;
  if (r.growth_pct === null) return "—";
  return `${r.growth_pct > 0 ? "+" : ""}${r.growth_pct.toLocaleString("it-IT")}%`;
}

export default function Classifica() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<Key>("season_points");
  const [awards, setAwards] = useState<Award[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const { data: o } = await supabase.from("organizations").select("id").eq("owner_id", session.user.id).maybeSingle();
      setMe(o?.id ?? null);
      const [{ data, error }, st, se, aw] = await Promise.all([
        supabase.rpc("leaderboard_v2"), supabase.rpc("steals_board"), supabase.rpc("season_board"),
        supabase.from("season_awards").select("*").order("season", { ascending: false }),
      ]);
      if (error) { setError("Classifica non disponibile al momento."); return; }
      const steals = new Map(((st.data as { org_id: string; stolen_7d: number; stolen_total: number; lost_7d: number }[]) ?? []).map((x) => [x.org_id, x]));
      const season = new Map(((se.data as { org_id: string; points: number; per_vehicle: number; vehicles: number }[]) ?? [])
        .map((x) => [x.org_id, { season_points: Number(x.points), per_vehicle: Number(x.per_vehicle), vehicles: x.vehicles }]));
      setRows(((data as Row[]) ?? []).map((r) => ({ ...r, ...(steals.get(r.org_id) ?? {}), ...(season.get(r.org_id) ?? {}), org_id: r.org_id })));
      setAwards((aw.data as Award[]) ?? []);
    })();
  }, [router]);

  const isSeason = tab === "season_points" || tab === "per_vehicle";
  const badges = (id: string) => awards.filter((a) => a.org_id === id)
    .map((a) => `${a.category === "rivelazione" ? "🌱" : MEDAL[a.rank - 1]}`).join("");
  const monthName = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const endOfSeason = (() => {
    const d = new Date(); const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const days = Math.ceil((end.getTime() - d.getTime()) / 86_400_000);
    return days <= 1 ? "ultimo giorno!" : `mancano ${days} giorni`;
  })();
  const pastSeasons = [...new Set(awards.map((a) => a.season))];
  const orgName = (id: string) => rows.find((r) => r.org_id === id)?.name ?? "Associazione";

  const sorted = [...rows].filter((r) => !isSeason || (r.season_points ?? 0) > 0).sort((a, b) => {
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
        <div style={{ fontSize: 13, color: "#666", margin: "8px 2px 12px" }}>
          {isSeason && <b style={{ color: "#B45309" }}>Stagione di {monthName(new Date().toISOString().slice(0, 8) + "01")} · {endOfSeason}. </b>}
          {t.hint}
        </div>

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
                  {r.name}{badges(r.org_id) && <span title="Titoli vinti nelle stagioni passate"> {badges(r.org_id)}</span>}
                  {r.org_id === me && <span style={{ color: "#B45309" }}> (tu)</span>}
                </div>
                <div style={{ fontSize: 12, color: "#777" }}>
                  {isSeason ? (r.hidden ? "statistiche nascoste" : `${r.vehicles ?? 0} mezzi`)
                    : tab === "stolen_7d" ? `${r.stolen_total ?? 0} in totale · ${r.lost_7d ?? 0} subiti in 7 giorni`
                    : r.hidden ? "statistiche nascoste" : `${r.services_7d ?? 0} servizi in 7 giorni`}{r.alliance && <> · 🤝 {r.alliance}</>}
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

        {isSeason && (
          <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", padding: 14, marginTop: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>🏛️ Albo d&apos;oro</div>
            {pastSeasons.length === 0 && <div style={{ fontSize: 13, color: "#777" }}>
              La prima stagione si chiude a fine mese: i primi 3 di ogni classifica ricevono un titolo che resta per sempre accanto al nome.
            </div>}
            {pastSeasons.map((s) => (
              <div key={s} style={{ borderTop: "1px solid #f0f0f0", padding: "8px 0", fontSize: 13 }}>
                <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{monthName(s)}</div>
                {(["punti", "rivelazione"] as const).map((c) => (
                  <div key={c} style={{ color: "#555" }}>
                    {c === "punti" ? "🏁 Stagione: " : "🌱 Rivelazione: "}
                    {awards.filter((a) => a.season === s && a.category === c).sort((a, b) => a.rank - b.rank)
                      .map((a) => `${MEDAL[a.rank - 1]} ${orgName(a.org_id)}`).join("  ·  ") || "—"}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
