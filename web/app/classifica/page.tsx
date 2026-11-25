"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase, type Organization } from "@/lib/supabase";
import LiveryContest from "@/components/LiveryContest";
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
  const [livTab, setLivTab] = useState(false);
  const [prev, setPrev] = useState<{ at: string; rows: Partial<Row>[] } | null>(null);   // classifica di circa 24 ore fa
  useEffect(() => { supabase.rpc("rank_snapshot_ago", { p_hours: 24 }).then(({ data }) => setPrev((data as typeof prev) ?? null)); }, []);
  useEffect(() => { try { if (new URLSearchParams(window.location.search).get("livree")) setLivTab(true); } catch { /* */ } }, []);
  const [allyTab, setAllyTab] = useState(false);
  const [openAlly, setOpenAlly] = useState<string | null>(null);
  const [allyAwards, setAllyAwards] = useState<{ season: string; rank: number; alliance_name: string; points: number; prize_funds: number; prize_note: string | null }[]>([]);
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
      const { data: aa } = await supabase.from("alliance_season_awards").select("season,rank,alliance_name,points,prize_funds,prize_note").order("season", { ascending: false }).order("rank");
      setAllyAwards((aa as typeof allyAwards) ?? []);
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
  // posizioni di circa 24 ore fa, calcolate con le stesse regole di adesso
  const prevRank = (() => {
    const m = new Map<string, number>();
    if (!prev) return m;
    const pr = prev.rows.filter((r) => !isSeason || Number(r.season_points ?? 0) > 0)
      .sort((a, b) => Number(b[tab] ?? -Infinity) - Number(a[tab] ?? -Infinity));
    pr.forEach((r, i) => r.org_id && m.set(r.org_id, i + 1));
    return m;
  })();
  const prevAllyRank = (() => {
    const m = new Map<string, number>(); if (!prev) return m;
    const pts = new Map<string, number>();
    for (const r of prev.rows) if (r.alliance) pts.set(r.alliance, (pts.get(r.alliance) ?? 0) + Number(r.season_points ?? 0));
    [...pts.entries()].sort((a, b) => b[1] - a[1]).forEach(([a], i) => m.set(a, i + 1));
    return m;
  })();
  const prevVal = new Map<string, number>((prev?.rows ?? []).filter((r) => r.org_id).map((r) => [r.org_id!, Number(r[tab] ?? 0)]));
  const fmtDelta = (d: number) => {
    const sgn = d > 0 ? "+" : "−", a = Math.abs(d);
    if (tab === "earnings_7d" || tab === "wealth") return `${sgn}${a >= 1e6 ? (a / 1e6).toLocaleString("it-IT", { maximumFractionDigits: 1 }) + " mln" : a >= 1000 ? Math.round(a / 1000).toLocaleString("it-IT") + "k" : Math.round(a)} €`;
    if (tab === "growth_pct") return `${sgn}${a.toLocaleString("it-IT", { maximumFractionDigits: 1 })} punti %`;
    if (tab === "reputation") return `${sgn}${Math.round(a)} ⭐`;
    if (tab === "stolen_7d") return `${sgn}${Math.round(a)}`;
    if (tab === "per_vehicle") return `${sgn}${a.toLocaleString("it-IT", { maximumFractionDigits: 1 })} pt/mezzo`;
    return `${sgn}${Math.round(a).toLocaleString("it-IT")} pt`;
  };
  const prevMin = prev ? Math.max(1, Math.round((Date.now() - new Date(prev.at).getTime()) / 60_000)) : 0;
  const prevHours = prevMin >= 90 ? `${Math.round(prevMin / 60)} ore` : `${prevMin} minuti`;
  const Move = ({ now, before }: { now: number; before?: number }) => {
    if (!prev) return null;
    if (before == null) return <span title="Nuova in classifica" style={{ fontSize: 10.5, fontWeight: 800, color: "#2563EB", background: "#DBEAFE", borderRadius: 6, padding: "1px 4px" }}>NEW</span>;
    const d = before - now;
    if (d === 0) return <span title={`Stessa posizione di ${prevHours} fa`} style={{ fontSize: 11, color: "#94A3B8", fontWeight: 800 }}>=</span>;
    return <span title={`${d > 0 ? "Sale" : "Scende"} di ${Math.abs(d)} rispetto a ${prevHours} fa (era ${before}°)`}
                 style={{ fontSize: 11.5, fontWeight: 800, color: d > 0 ? "#16A34A" : "#DC2626", whiteSpace: "nowrap" }}>{d > 0 ? "▲" : "▼"}{Math.abs(d)}</span>;
  };
  // classifica alleanze: somma dei punti di stagione dei membri
  const allyRows = (() => {
    const m = new Map<string, { name: string; points: number; members: Row[] }>();
    for (const r of rows) if (r.alliance) {
      const a = m.get(r.alliance) ?? { name: r.alliance, points: 0, members: [] };
      a.points += r.season_points ?? 0; a.members.push(r); m.set(r.alliance, a);
    }
    return [...m.values()].map((a) => ({ ...a, members: a.members.sort((x, y) => (y.season_points ?? 0) - (x.season_points ?? 0)) }))
      .sort((a, b) => b.points - a.points);
  })();
  const myAlly = rows.find((r) => r.org_id === me)?.alliance ?? null;

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
          <button onClick={() => { setAllyTab(true); setLivTab(false); }}
                  style={{ padding: "9px 12px", borderRadius: 999, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                           fontWeight: 700, fontSize: 14, background: allyTab ? "#1D4ED8" : "#DBEAFE",
                           color: allyTab ? "#fff" : "#1D4ED8", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>🤝 Alleanze</button>
          <button onClick={() => { setLivTab(true); setAllyTab(false); }}
                  style={{ padding: "9px 12px", borderRadius: 999, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                           fontWeight: 700, fontSize: 14, background: livTab ? "#BE123C" : "#FFE4E6",
                           color: livTab ? "#fff" : "#BE123C", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>🎨 Livree</button>
          {TABS.map((x) => (
            <button key={x.key} onClick={() => { setTab(x.key); setLivTab(false); setAllyTab(false); }}
                    style={{ padding: "9px 12px", borderRadius: 999, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                             fontWeight: 700, fontSize: 14, background: !livTab && !allyTab && tab === x.key ? "#111" : "#fff",
                             color: !livTab && !allyTab && tab === x.key ? "#fff" : "#111", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>{x.label}</button>
          ))}
        </div>
        {allyTab ? <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 13, color: "#666", margin: "0 2px 12px" }}>
            <b style={{ color: "#1D4ED8" }}>Stagione di {monthName(new Date().toISOString().slice(0, 8) + "01")} · {endOfSeason}. </b>
            Punti di stagione di tutti i membri sommati: l&apos;alleanza con più punti è in cima. Tocca un&apos;alleanza per vedere chi ha portato i punti.
          </div>
          <div style={{ background: "linear-gradient(135deg,#1E3A8A,#1D4ED8)", color: "#fff", borderRadius: 14, padding: 12, marginBottom: 12, fontSize: 13.5 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>🎁 Premi di fine stagione</div>
            <div>🥇 <b>30.000.000 € a ogni membro</b> + 2 ambulanze con kit completo</div>
            <div>🥈 <b>5.000.000 € a ogni membro</b> + 1 motorino</div>
            <div>🥉 <b>1.000.000 € a ogni membro</b></div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>Ogni associazione dell&apos;alleanza riceve la cifra intera; i mezzi vanno al membro che ha fatto più punti e arrivano nella sua sede principale.</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
            {allyRows.map((a, i) => (
              <div key={a.name} style={{ borderTop: i ? "1px solid #f0f0f0" : "none", background: a.name === myAlly ? "#EFF6FF" : undefined }}>
                <div onClick={() => setOpenAlly(openAlly === a.name ? null : a.name)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer" }}>
                  <div style={{ width: 34, textAlign: "center", fontWeight: 800, fontSize: i < 3 ? 22 : 15, color: "#666", lineHeight: 1.05 }}>{MEDAL[i] ?? i + 1}
                    <div style={{ lineHeight: 1 }}><Move now={i + 1} before={prevAllyRank.get(a.name)} /></div></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>🤝 {a.name}{a.name === myAlly && <span style={{ color: "#1D4ED8" }}> (la tua)</span>}</div>
                    <div style={{ fontSize: 12, color: "#777" }}>{a.members.length} {a.members.length === 1 ? "membro" : "membri"} · media {Math.round(a.points / a.members.length).toLocaleString("it-IT")} pt {openAlly === a.name ? "▴" : "▾"}</div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: "nowrap" }}>{a.points.toLocaleString("it-IT")} pt</div>
                </div>
                {openAlly === a.name && <div style={{ padding: "0 12px 10px 52px" }}>
                  {a.members.map((r) => (
                    <div key={r.org_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13.5 }}>
                      <FactionEmblem type={r.type} size={24} logo={r.logo_url} />
                      <a href={`/profili/${r.org_id}`} style={{ flex: 1, color: "inherit", textDecoration: "none", fontWeight: r.org_id === me ? 700 : 500 }}>{r.name}{r.org_id === me && " (tu)"}</a>
                      <span style={{ fontWeight: 700 }}>{(r.season_points ?? 0).toLocaleString("it-IT")} pt</span>
                    </div>))}
                </div>}
              </div>
            ))}
            {allyRows.length === 0 && <div style={{ padding: 20, color: "#888", textAlign: "center" }}>{rows.length ? "Nessuna alleanza ancora." : "Caricamento…"}</div>}
          </div>
          {allyAwards.length > 0 && <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", padding: 14, marginTop: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>🏛️ Albo d&apos;oro delle alleanze</div>
            {[...new Set(allyAwards.map((a) => a.season))].map((se) => (
              <div key={se} style={{ borderTop: "1px solid #f0f0f0", padding: "8px 0", fontSize: 13 }}>
                <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{monthName(se)}</div>
                {allyAwards.filter((a) => a.season === se).map((a) => <div key={a.rank} style={{ color: "#555" }}>{MEDAL[a.rank - 1] ?? `${a.rank}°`} {a.alliance_name} · {Number(a.points).toLocaleString("it-IT")} pt</div>)}
              </div>))}
          </div>}
        </div> : livTab ? <div style={{ marginTop: 10 }}><LiveryContest /></div> : <>
        <div style={{ fontSize: 13, color: "#666", margin: "8px 2px 12px" }}>
          {isSeason && <b style={{ color: "#B45309" }}>Stagione di {monthName(new Date().toISOString().slice(0, 8) + "01")} · {endOfSeason}. </b>}
          {t.hint}
          {prev && <span style={{ color: "#94A3B8" }}> · ▲▼ posti e +/− punti guadagnati o persi negli ultimi/e {prevHours}; 🔥 = sta per superare chi ha davanti.</span>}
        </div>
        {(isSeason || tab === "reputation") && <div style={{ background: "linear-gradient(135deg,#92400E,#D97706)", color: "#fff", borderRadius: 14, padding: 12, marginBottom: 12, fontSize: 13.5 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>🎁 Premi di fine stagione · {t.label}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "2px 12px" }}>
            {(tab === "season_points" ? [50, 40, 32, 25, 20, 15, 12, 10, 7, 5] : [10, 8, 6.5, 5, 4, 3, 2.5, 2, 1.5, 1]).map((m, i) => <div key={i}>{MEDAL[i] ?? `${i + 1}°`} <b>{m.toLocaleString("it-IT")} milioni</b></div>)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>Pagati il 1° del mese ai primi 10 di questa classifica{tab === "per_vehicle" ? " (serve almeno 300 punti di stagione)" : ""}.</div>
        </div>}

        {error && <div style={{ background: "#fff1f1", color: "#a00", borderRadius: 10, padding: 12 }}>{error}</div>}

        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
          {sorted.map((r, i) => (
            <div key={r.org_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                                         borderTop: i ? "1px solid #f0f0f0" : "none",
                                         background: r.org_id === me ? "#FFFBEB" : undefined }}>
              <div style={{ width: 34, textAlign: "center", fontWeight: 800, fontSize: i < 3 ? 22 : 15, color: "#666", lineHeight: 1.05 }}>
                {MEDAL[i] ?? i + 1}
                <div style={{ lineHeight: 1 }}><Move now={i + 1} before={prevRank.get(r.org_id)} /></div>
              </div>
              <FactionEmblem type={r.type} size={34} logo={r.logo_url} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <a href={`/profili/${r.org_id}`} style={{ color: "inherit", textDecoration: "none" }}>{r.name}</a>{badges(r.org_id) && <span title="Titoli vinti nelle stagioni passate"> {badges(r.org_id)}</span>}
                  {r.org_id === me && <span style={{ color: "#B45309" }}> (tu)</span>}
                </div>
                <div style={{ fontSize: 12, color: "#777" }}>
                  {isSeason ? (r.hidden ? "statistiche nascoste" : `${r.vehicles ?? 0} mezzi`)
                    : tab === "stolen_7d" ? `${r.stolen_total ?? 0} in totale · ${r.lost_7d ?? 0} subiti in 7 giorni`
                    : r.hidden ? "statistiche nascoste" : `${r.services_7d ?? 0} servizi in 7 giorni`}{r.alliance && <> · 🤝 {r.alliance}</>}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: "nowrap",
                              color: tab === "growth_pct" && r.growth_pct !== null ? (r.growth_pct >= 0 ? "#15803D" : "#B91C1C") : "#111" }}>
                  {value(r, tab)}
                </div>
                {!r.hidden && (() => {
                  const cur = Number(r[tab] ?? 0), was = prevVal.get(r.org_id);
                  const d = was == null ? null : cur - was;
                  const up = i > 0 ? sorted[i - 1] : null;
                  const gap = up ? Number(up[tab] ?? 0) - cur : 0;
                  // rimonta: guadagna più di chi sta sopra e lo raggiunge presto
                  const upD = up ? Number(up[tab] ?? 0) - (prevVal.get(up.org_id) ?? Number(up[tab] ?? 0)) : 0;
                  const close = up && d != null && d > upD && gap > 0 && gap <= (d - upD) * 3;
                  return <div style={{ fontSize: 11.5, whiteSpace: "nowrap", lineHeight: 1.3 }}>
                    {d != null && d !== 0 && <span style={{ fontWeight: 800, color: d > 0 ? "#16A34A" : "#DC2626" }}>{fmtDelta(d)}</span>}
                    {d != null && d !== 0 && <span style={{ color: "#94A3B8" }}> in {prevMin >= 90 ? `${Math.round(prevMin / 60)}h` : `${prevMin} min`}</span>}
                    {up && gap > 0 && <div style={{ color: close ? "#EA580C" : "#94A3B8", fontWeight: close ? 800 : 500 }}>
                      {close ? "🔥 " : ""}a {fmtDelta(gap).slice(1)} dal {i}°</div>}
                  </div>;
                })()}
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
        </>}
      </div>
    </main>
  );
}
