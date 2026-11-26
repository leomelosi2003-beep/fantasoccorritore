"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase, type Organization } from "@/lib/supabase";
import LiveryContest from "@/components/LiveryContest";
import FactionEmblem from "@/components/FactionEmblem";

// ---------------------------------------------------------------------------------------------
// Classifiche: podio, barre, chi sale e chi scende, premi di fine stagione
// ---------------------------------------------------------------------------------------------

type Row = {
  org_id: string; name: string; type: Organization["type"]; logo_url: string | null; alliance: string | null;
  earnings_7d: number | null; services_7d: number | null; wealth: number | null; growth_pct: number | null; reputation: number | null;
  hidden?: boolean; stolen_7d?: number; stolen_total?: number; lost_7d?: number;
  season_points?: number; per_vehicle?: number; vehicles?: number; reds?: number; maxi?: number;
};
type Award = { season: string; category: "punti" | "rivelazione"; rank: number; org_id: string; points: number };
type AllyAward = { season: string; rank: number; alliance_name: string; points: number; prize_funds: number; prize_note: string | null };
type Theme = { a: string; b: string; soft: string; ink: string };

const TABS: { key: Key; icon: string; label: string; hint: string; th: Theme; prizes: number[] | null }[] = [
  { key: "season_points", icon: "🏁", label: "Stagione", hint: "Punti del mese: rosso 3, giallo 2, altri 1, maxi e incendi 5, obiettivo ritirato 20. Si riparte da zero ogni mese.",
    th: { a: "#F59E0B", b: "#EA580C", soft: "#FFF7ED", ink: "#9A3412" }, prizes: [50, 40, 32, 25, 20, 15, 12, 10, 7, 5] },
  { key: "per_vehicle", icon: "🌱", label: "Rivelazione", hint: "Punti di stagione per mezzo: premia chi lavora meglio, anche con pochi mezzi (per i premi servono almeno 300 punti).",
    th: { a: "#22C55E", b: "#15803D", soft: "#F0FDF4", ink: "#166534" }, prizes: [10, 8, 6.5, 5, 4, 3, 2.5, 2, 1.5, 1] },
  { key: "reds", icon: "🔴", label: "Codici rossi", hint: "Servizi in codice rosso portati a termine in questo mese. Si riparte da zero ogni mese.",
    th: { a: "#F87171", b: "#B91C1C", soft: "#FEF2F2", ink: "#991B1B" }, prizes: [10, 8, 6.5, 5, 4, 3, 2.5, 2, 1.5, 1] },
  { key: "maxi", icon: "🆘", label: "Maxi emergenze", hint: "Mezzi mandati sulle maxi emergenze in questo mese: chi ne manda di più vince. Si riparte da zero ogni mese.",
    th: { a: "#FB923C", b: "#9A3412", soft: "#FFF7ED", ink: "#7C2D12" }, prizes: [5, 4, 3.25, 2.5, 2, 1.5, 1.25, 1, 0.75, 0.5] },
  { key: "reputation", icon: "⭐", label: "Reputazione", hint: "Reputazione totale guadagnata.",
    th: { a: "#FACC15", b: "#CA8A04", soft: "#FEFCE8", ink: "#854D0E" }, prizes: [10, 8, 6.5, 5, 4, 3, 2.5, 2, 1.5, 1] },
  { key: "earnings_7d", icon: "💶", label: "Guadagni", hint: "Soldi guadagnati con i servizi negli ultimi 7 giorni.",
    th: { a: "#60A5FA", b: "#1D4ED8", soft: "#EFF6FF", ink: "#1E40AF" }, prizes: null },
  { key: "growth_pct", icon: "📈", label: "Crescita", hint: "Quanto è cresciuto il patrimonio negli ultimi 7 giorni.",
    th: { a: "#34D399", b: "#059669", soft: "#ECFDF5", ink: "#065F46" }, prizes: null },
  { key: "wealth", icon: "🏦", label: "Patrimonio", hint: "Soldi in cassa + valore di ambulanze, sedi e volontari.",
    th: { a: "#A78BFA", b: "#6D28D9", soft: "#F5F3FF", ink: "#5B21B6" }, prizes: null },
  { key: "stolen_7d", icon: "🥷", label: "Rubati", hint: "Servizi soffiati agli altri arrivando prima di loro, negli ultimi 7 giorni.",
    th: { a: "#94A3B8", b: "#334155", soft: "#F1F5F9", ink: "#1E293B" }, prizes: null },
];
type Key = "season_points" | "per_vehicle" | "reds" | "maxi" | "reputation" | "earnings_7d" | "growth_pct" | "wealth" | "stolen_7d";
const ALLY_TH: Theme = { a: "#60A5FA", b: "#1E3A8A", soft: "#EFF6FF", ink: "#1E3A8A" };
const LIV_TH: Theme = { a: "#FB7185", b: "#BE123C", soft: "#FFF1F2", ink: "#9F1239" };

const MEDAL = ["🥇", "🥈", "🥉"];
const PODIUM = [["#FDE68A", "#F59E0B", "#92400E"], ["#F1F5F9", "#94A3B8", "#334155"], ["#FED7AA", "#EA580C", "#7C2D12"]];
const euro = (n: number) => n.toLocaleString("it-IT") + " €";
const short = (n: number) => n >= 1e6 ? `${(n / 1e6).toLocaleString("it-IT", { maximumFractionDigits: 1 })} mln` : n >= 1e4 ? `${Math.round(n / 1000).toLocaleString("it-IT")}k` : Math.round(n).toLocaleString("it-IT");
const card: CSSProperties = { background: "#fff", borderRadius: 20, boxShadow: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.06)" };
const num = (r: Partial<Row>, k: Key) => Number(r[k] ?? 0);

function value(r: Row, k: Key) {
  if (r.hidden && k !== "growth_pct" && k !== "stolen_7d") return "🔒";
  switch (k) {
    case "earnings_7d": return euro(r.earnings_7d ?? 0);
    case "wealth": return euro(r.wealth ?? 0);
    case "reputation": return `⭐ ${(r.reputation ?? 0).toLocaleString("it-IT")}`;
    case "stolen_7d": return `🥷 ${r.stolen_7d ?? 0}`;
    case "season_points": return `${(r.season_points ?? 0).toLocaleString("it-IT")} pt`;
    case "per_vehicle": return `${(r.per_vehicle ?? 0).toLocaleString("it-IT")} pt/mezzo`;
    case "reds": return `${(r.reds ?? 0).toLocaleString("it-IT")} 🔴`;
    case "maxi": return `${(r.maxi ?? 0).toLocaleString("it-IT")} 🚑`;
    default: return r.growth_pct === null ? "—" : `${r.growth_pct > 0 ? "+" : ""}${r.growth_pct.toLocaleString("it-IT")}%`;
  }
}
function podiumValue(r: Row, k: Key) {
  if (r.hidden && k !== "growth_pct" && k !== "stolen_7d") return "🔒";
  if (k === "earnings_7d" || k === "wealth") return `${short(num(r, k))} €`;
  return value(r, k);
}

/** numero che sale da 0 al valore (solo effetto grafico) */
function CountUp({ to, fmt }: { to: number; fmt: (n: number) => string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const t0 = performance.now(), from = 0;
    const step = (t: number) => { const k = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - k, 3); setV(from + (to - from) * e); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{fmt(v)}</>;
}

function Chip({ children, bg, fg, title }: { children: ReactNode; bg: string; fg: string; title?: string }) {
  return <span title={title} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 999, background: bg, color: fg, fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>{children}</span>;
}

export default function Classifica() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Key>("season_points");
  const [view, setView] = useState<"tab" | "ally" | "liv">("tab");
  const [prev, setPrev] = useState<{ at: string; rows: Partial<Row>[] } | null>(null);
  const [openAlly, setOpenAlly] = useState<string | null>(null);
  const [allyAwards, setAllyAwards] = useState<AllyAward[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => { try { if (new URLSearchParams(window.location.search).get("livree")) setView("liv"); } catch { /* */ } }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const { data: o } = await supabase.from("organizations").select("id").eq("owner_id", session.user.id).maybeSingle();
      setMe(o?.id ?? null);
      const [lb, st, sb, aw, aa, pv] = await Promise.all([
        supabase.rpc("leaderboard_v2"), supabase.rpc("steals_board"), supabase.rpc("season_board_fast"),
        supabase.from("season_awards").select("*").order("season", { ascending: false }),
        supabase.from("alliance_season_awards").select("season,rank,alliance_name,points,prize_funds,prize_note").order("season", { ascending: false }).order("rank"),
        supabase.rpc("rank_snapshot_ago", { p_hours: 24 }),
      ]);
      if (lb.error) { setError("Classifica non disponibile al momento: riprova tra poco."); setLoading(false); return; }
      const steals = new Map(((st.data as { org_id: string; stolen_7d: number; stolen_total: number; lost_7d: number }[]) ?? []).map((x) => [x.org_id, x]));
      const season = new Map(((sb.data as { org_id: string; points: number; per_vehicle: number; vehicles: number; reds: number; maxi: number }[]) ?? [])
        .map((x) => [x.org_id, { season_points: Number(x.points ?? 0), per_vehicle: Number(x.per_vehicle ?? 0), vehicles: x.vehicles, reds: Number(x.reds ?? 0), maxi: Number(x.maxi ?? 0) }]));
      setRows(((lb.data as Row[]) ?? []).map((r) => ({ ...r, ...(steals.get(r.org_id) ?? {}), ...(season.get(r.org_id) ?? {}), org_id: r.org_id })));
      setAwards((aw.data as Award[]) ?? []);
      setAllyAwards((aa.data as AllyAward[]) ?? []);
      setPrev((pv.data as { at: string; rows: Partial<Row>[] } | null) ?? null);
      setLoading(false);
    })();
  }, [router]);

  const t = TABS.find((x) => x.key === tab)!;
  const th: Theme = view === "ally" ? ALLY_TH : view === "liv" ? LIV_TH : t.th;
  const isSeason = tab === "season_points" || tab === "per_vehicle";
  const keep = (r: Partial<Row>) => (!isSeason || num(r, "season_points") > 0) && (tab !== "reds" || num(r, "reds") > 0) && (tab !== "maxi" || num(r, "maxi") > 0);

  const sorted = useMemo(() => rows.filter(keep).sort((a, b) => num(b, tab) - num(a, tab)),
    [rows, tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const leadVal = Math.max(0, ...sorted.filter((r) => !r.hidden).map((r) => num(r, tab)));

  // ---------- confronto con la classifica di qualche ora fa ----------
  const prevRank = useMemo(() => {
    const m = new Map<string, number>(); if (!prev) return m;
    prev.rows.filter(keep).sort((a, b) => num(b, tab) - num(a, tab)).forEach((r, i) => { if (r.org_id) m.set(r.org_id, i + 1); });
    return m;
  }, [prev, tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevVal = useMemo(() => new Map<string, number>((prev?.rows ?? []).filter((r) => r.org_id).map((r) => [r.org_id as string, num(r, tab)])), [prev, tab]);
  const prevMin = prev ? Math.max(1, Math.round((Date.now() - new Date(prev.at).getTime()) / 60_000)) : 0;
  const ago = prevMin >= 90 ? `${Math.round(prevMin / 60)} ore` : `${prevMin} minuti`;
  const agoShort = prevMin >= 90 ? `${Math.round(prevMin / 60)}h` : `${prevMin}′`;
  const fmtDelta = (d: number) => {
    const sgn = d > 0 ? "+" : "−", a = Math.abs(d);
    if (tab === "earnings_7d" || tab === "wealth") return `${sgn}${short(a)} €`;
    if (tab === "growth_pct") return `${sgn}${a.toLocaleString("it-IT", { maximumFractionDigits: 1 })} punti %`;
    if (tab === "reputation") return `${sgn}${Math.round(a)} ⭐`;
    if (tab === "stolen_7d") return `${sgn}${Math.round(a)}`;
    if (tab === "per_vehicle") return `${sgn}${a.toLocaleString("it-IT", { maximumFractionDigits: 1 })} pt/mezzo`;
    if (tab === "reds") return `${sgn}${Math.round(a)} rossi`;
    if (tab === "maxi") return `${sgn}${Math.round(a)} mezzi`;
    return `${sgn}${Math.round(a).toLocaleString("it-IT")} pt`;
  };
  const move = (now: number, before?: number) => {
    if (!prev) return null;
    if (before == null) return <Chip bg="#DBEAFE" fg="#1D4ED8" title="Nuova in classifica">NEW</Chip>;
    const d = before - now;
    if (d === 0) return <span title={`Stessa posizione di ${ago} fa`} style={{ fontSize: 11, color: "#CBD5E1", fontWeight: 900 }}>•</span>;
    return <span title={`${d > 0 ? "Sale" : "Scende"} di ${Math.abs(d)} rispetto a ${ago} fa (era ${before}°)`}
                 style={{ fontSize: 11.5, fontWeight: 900, color: d > 0 ? "#16A34A" : "#DC2626", whiteSpace: "nowrap" }}>{d > 0 ? "▲" : "▼"}{Math.abs(d)}</span>;
  };
  const delta = (r: Row, i: number) => {
    if (r.hidden) return null;
    const cur = num(r, tab), was = prevVal.get(r.org_id);
    const d = was == null ? null : cur - was;
    const up = i > 0 ? sorted[i - 1] : null;
    const gap = up ? num(up, tab) - cur : 0;
    const upD = up ? num(up, tab) - (prevVal.get(up.org_id) ?? num(up, tab)) : 0;
    const close = !!up && d != null && d > upD && gap > 0 && gap <= (d - upD) * 3;
    return { d, gap, close };
  };

  // ---------- alleanze ----------
  const allyRows = useMemo(() => {
    const m = new Map<string, { name: string; points: number; members: Row[] }>();
    for (const r of rows) if (r.alliance) {
      const a = m.get(r.alliance) ?? { name: r.alliance, points: 0, members: [] };
      a.points += r.season_points ?? 0; a.members.push(r); m.set(r.alliance, a);
    }
    return Array.from(m.values()).map((a) => ({ ...a, members: [...a.members].sort((x, y) => (y.season_points ?? 0) - (x.season_points ?? 0)) })).sort((a, b) => b.points - a.points);
  }, [rows]);
  const prevAllyRank = useMemo(() => {
    const m = new Map<string, number>(); if (!prev) return m;
    const pts = new Map<string, number>();
    for (const r of prev.rows) if (r.alliance) pts.set(r.alliance, (pts.get(r.alliance) ?? 0) + num(r, "season_points"));
    Array.from(pts.entries()).sort((a, b) => b[1] - a[1]).forEach(([a], i) => m.set(a, i + 1));
    return m;
  }, [prev]);
  const myAlly = rows.find((r) => r.org_id === me)?.alliance ?? null;

  // ---------- varie ----------
  const badges = (id: string) => awards.filter((a) => a.org_id === id).map((a) => (a.category === "rivelazione" ? "🌱" : MEDAL[a.rank - 1])).join("");
  const monthName = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const thisMonth = monthName(new Date().toISOString().slice(0, 8) + "01");
  const daysLeft = (() => { const d = new Date(); return Math.ceil((new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() - d.getTime()) / 86_400_000); })();
  const orgName = (id: string) => rows.find((r) => r.org_id === id)?.name ?? "Associazione";
  const pastSeasons = Array.from(new Set(awards.map((a) => a.season)));
  const myIdx = sorted.findIndex((r) => r.org_id === me);
  const mine = myIdx >= 0 ? sorted[myIdx] : null;
  const list = showAll ? sorted.slice(3) : sorted.slice(3, 50);

  const tabBtn = (active: boolean, theme: Theme, icon: string, label: string, onClick: () => void, key: string) => (
    <button key={key} onClick={onClick}
            style={{ flex: "0 0 auto", minWidth: 80, padding: "9px 10px 8px", borderRadius: 16, border: "none", cursor: "pointer",
                     background: active ? `linear-gradient(135deg, ${theme.a}, ${theme.b})` : "#fff", color: active ? "#fff" : "#334155",
                     boxShadow: active ? `0 6px 16px ${theme.b}55` : "0 1px 3px rgba(15,23,42,.08)", transform: active ? "translateY(-1px)" : "none",
                     transition: "all .15s ease", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>{label}</span>
    </button>
  );

  return (
    <main style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${th.soft} 0%, #F8FAFC 380px)`, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", color: "#0F172A", paddingBottom: 40 }}>
      <style>{`@keyframes fsShine{0%{background-position:-200% 0}100%{background-position:200% 0}} @keyframes fsPop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .fs-rank-row{animation:fsPop .25s ease both} .fs-tabs::-webkit-scrollbar{display:none}
        @keyframes fsFall{0%{transform:translateY(-20px) rotate(0)}100%{transform:translateY(340px) rotate(540deg)}}
        @keyframes fsBob{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-5px) rotate(6deg)}}
        @keyframes fsSpin{to{transform:rotate(360deg)}}
        @keyframes fsBeam{0%,100%{opacity:.35;transform:rotate(var(--r)) scaleY(1)}50%{opacity:.6;transform:rotate(calc(var(--r) + 4deg)) scaleY(1.05)}}
        @keyframes fsPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
        @keyframes fsRise{from{transform:scaleY(.2);opacity:0}to{transform:scaleY(1);opacity:1}}
        .fs-fire{display:inline-block;animation:fsPulse 1s ease-in-out infinite}
        .fs-rank-row:hover{background:#F8FAFC !important}`}</style>

      {/* testata */}
      <div style={{ background: `radial-gradient(circle at 90% -30%, rgba(255,255,255,.35), transparent 50%), linear-gradient(135deg, ${th.a}, ${th.b})`, color: "#fff", borderRadius: "0 0 28px 28px", boxShadow: `0 10px 30px ${th.b}40` }}>
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "14px 16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => router.push("/")} style={{ padding: "7px 12px", borderRadius: 12, border: "none", background: "rgba(255,255,255,.22)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>← Mappa</button>
            <div style={{ flex: 1 }} />
            <Chip bg="rgba(255,255,255,.22)" fg="#fff">⏳ {daysLeft <= 1 ? "ultimo giorno!" : `${daysLeft} giorni alla fine`}</Chip>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: 12 }}>
            <div style={{ fontSize: 44, lineHeight: 1, filter: "drop-shadow(0 3px 6px rgba(0,0,0,.25))" }}>{view === "ally" ? "🤝" : view === "liv" ? "🎨" : t.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85, letterSpacing: 0.5, textTransform: "uppercase" }}>Classifiche · {thisMonth}</div>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.1 }}>{view === "ally" ? "Alleanze" : view === "liv" ? "Livree più belle" : t.label}</div>
            </div>
          </div>
          {view === "tab" && mine && <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,.18)", borderRadius: 16, padding: "8px 12px" }}>
            <div style={{ fontSize: 26, fontWeight: 900, minWidth: 44, textAlign: "center" }}>{myIdx + 1}°</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, opacity: 0.9 }}>La tua posizione {move(myIdx + 1, prevRank.get(mine.org_id)) && <span style={{ background: "#fff", borderRadius: 8, padding: "0 5px", marginLeft: 4 }}>{move(myIdx + 1, prevRank.get(mine.org_id))}</span>}</div>
              <div style={{ fontWeight: 800 }}>{value(mine, tab)}</div>
            </div>
            {(() => {
              const x = delta(mine, myIdx);
              if (myIdx === 0) return <div style={{ fontSize: 26 }}>👑</div>;
              return x && x.gap > 0 ? <div style={{ fontSize: 12, textAlign: "right" }}>{x.close ? "🔥 " : ""}a <b>{fmtDelta(x.gap).slice(1)}</b><br />dal {myIdx}°</div> : null;
            })()}
          </div>}
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 14px" }}>
        {/* schede */}
        <div className="fs-tabs" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "14px 2px 10px", scrollbarWidth: "none" }}>
          {TABS.map((x) => tabBtn(view === "tab" && tab === x.key, x.th, x.icon, x.label, () => { setTab(x.key); setView("tab"); setShowAll(false); }, x.key))}
          {tabBtn(view === "ally", ALLY_TH, "🤝", "Alleanze", () => setView("ally"), "ally")}
          {tabBtn(view === "liv", LIV_TH, "🎨", "Livree", () => setView("liv"), "liv")}
          {tabBtn(false, LIV_TH, "⚔️", "Tornei", () => router.push("/tornei?tab=classifica"), "tornei")}
        </div>

        {view === "liv" && <LiveryContest />}

        {view === "ally" && <>
          <div style={{ fontSize: 13, color: "#64748B", margin: "0 4px 12px" }}>Punti di stagione di tutti i membri sommati. Tocca un&apos;alleanza per vedere chi ha portato i punti.</div>
          <div style={{ ...card, padding: 14, marginBottom: 14, background: `linear-gradient(135deg, ${ALLY_TH.b}, #1D4ED8)`, color: "#fff" }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>🎁 Premi di fine stagione · a ogni membro</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[["🥇", "30 mln", "+ 2 ambulanze con kit completo"], ["🥈", "5 mln", "+ 1 motorino"], ["🥉", "1 mln", ""]].map(([m, v, x]) => (
                <div key={m} style={{ background: "rgba(255,255,255,.14)", borderRadius: 14, padding: "8px 6px", textAlign: "center" }}>
                  <div style={{ fontSize: 22 }}>{m}</div><div style={{ fontWeight: 900, fontSize: 17 }}>{v}</div><div style={{ fontSize: 11, opacity: 0.85 }}>{x}</div>
                </div>))}
            </div>
          </div>
          <div style={{ ...card, overflow: "hidden" }}>
            {allyRows.map((a, i) => (
              <div key={a.name} style={{ borderTop: i ? "1px solid #F1F5F9" : "none", background: a.name === myAlly ? "linear-gradient(90deg,#DBEAFE,#fff)" : undefined }}>
                <div className="fs-rank-row" onClick={() => setOpenAlly(openAlly === a.name ? null : a.name)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer", animationDelay: `${Math.min(i, 15) * 25}ms` }}>
                  <div style={{ width: 38, textAlign: "center" }}>
                    {i < 3 ? <div style={{ fontSize: 26 }}>{MEDAL[i]}</div> : <div style={{ fontWeight: 900, color: "#64748B" }}>{i + 1}</div>}
                    {move(i + 1, prevAllyRank.get(a.name))}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}{a.name === myAlly && <span style={{ color: "#1D4ED8" }}> · la tua</span>}</div>
                    <div style={{ height: 6, background: "#EEF2F7", borderRadius: 99, margin: "5px 0 3px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.max(3, (a.points / Math.max(1, allyRows[0].points)) * 100)}%`, height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${ALLY_TH.a}, ${ALLY_TH.b})` }} />
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B" }}>{a.members.length} {a.members.length === 1 ? "membro" : "membri"} · media {Math.round(a.points / a.members.length).toLocaleString("it-IT")} pt {openAlly === a.name ? "▴" : "▾"}</div>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 16, whiteSpace: "nowrap", color: ALLY_TH.ink }}>{a.points.toLocaleString("it-IT")} pt</div>
                </div>
                {openAlly === a.name && <div style={{ padding: "0 14px 12px 64px" }}>
                  {a.members.map((r) => (
                    <a key={r.org_id} href={`/profili/${r.org_id}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 13.5, color: "inherit", textDecoration: "none" }}>
                      <FactionEmblem type={r.type} size={26} logo={r.logo_url} />
                      <span style={{ flex: 1, fontWeight: r.org_id === me ? 800 : 600 }}>{r.name}{r.org_id === me && " (tu)"}</span>
                      <b>{(r.season_points ?? 0).toLocaleString("it-IT")} pt</b>
                    </a>))}
                </div>}
              </div>))}
            {allyRows.length === 0 && <div style={{ padding: 24, color: "#94A3B8", textAlign: "center" }}>{loading ? "Caricamento…" : "Nessuna alleanza ancora."}</div>}
          </div>
          {allyAwards.length > 0 && <div style={{ ...card, padding: 16, marginTop: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>🏛️ Albo d&apos;oro delle alleanze</div>
            {Array.from(new Set(allyAwards.map((a) => a.season))).map((se) => (
              <div key={se} style={{ borderTop: "1px solid #F1F5F9", padding: "8px 0", fontSize: 13 }}>
                <div style={{ fontWeight: 800, textTransform: "capitalize" }}>{monthName(se)}</div>
                {allyAwards.filter((a) => a.season === se).map((a) => <div key={a.rank} style={{ color: "#475569" }}>{MEDAL[a.rank - 1] ?? `${a.rank}°`} {a.alliance_name} · {Number(a.points).toLocaleString("it-IT")} pt</div>)}
              </div>))}
          </div>}
        </>}

        {view === "tab" && <>
          <div style={{ fontSize: 13, color: "#64748B", margin: "0 4px 12px", lineHeight: 1.45 }}>
            {t.hint}{prev && <> Accanto ai nomi: posti e punti guadagnati o persi rispetto a {ago} fa; 🔥 = sta per superare chi ha davanti.</>}
          </div>

          {t.prizes && <div style={{ ...card, padding: "12px 12px 10px", marginBottom: 16, background: `linear-gradient(135deg, ${t.th.b}, ${t.th.a})`, color: "#fff", overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(100deg, transparent 30%, rgba(255,255,255,.25) 50%, transparent 70%)", backgroundSize: "200% 100%", animation: "fsShine 4s linear infinite", pointerEvents: "none" }} />
            <div style={{ fontWeight: 900, marginBottom: 8, position: "relative" }}>🎁 Premi di fine stagione <span style={{ fontWeight: 600, opacity: 0.85, fontSize: 12.5 }}>· pagati il 1° del mese</span></div>
            <div className="fs-tabs" style={{ display: "flex", gap: 6, overflowX: "auto", position: "relative", scrollbarWidth: "none" }}>
              {t.prizes.map((m, i) => (
                <div key={i} style={{ flex: "0 0 auto", background: i < 3 ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.14)", borderRadius: 12, padding: "6px 10px", textAlign: "center", minWidth: 62 }}>
                  <div style={{ fontSize: i < 3 ? 18 : 12, fontWeight: 900, lineHeight: 1.2 }}>{MEDAL[i] ?? `${i + 1}°`}</div>
                  <div style={{ fontWeight: 900, fontSize: 13.5, whiteSpace: "nowrap" }}>{m.toLocaleString("it-IT")} mln</div>
                </div>))}
            </div>
          </div>}

          {error && <div style={{ ...card, background: "#FEF2F2", color: "#B91C1C", padding: 14 }}>{error}</div>}

          {/* podio sul palco: luci, coriandoli, corona */}
          {sorted.length > 0 && <div style={{ position: "relative", overflow: "hidden", borderRadius: 26, margin: "6px 0 18px", padding: "18px 10px 0",
                                              background: `radial-gradient(ellipse at 50% 120%, ${t.th.a}55, transparent 60%), linear-gradient(180deg, #0B1220, #1E293B)`,
                                              boxShadow: "0 18px 40px rgba(15,23,42,.35)" }}>
            {[-28, 0, 28].map((r, i) => (
              <div key={i} style={{ position: "absolute", top: -40, left: `${20 + i * 30}%`, width: 120, height: 360, marginLeft: -60, transformOrigin: "50% 0",
                                    background: `linear-gradient(180deg, ${i === 1 ? "rgba(253,230,138,.55)" : "rgba(255,255,255,.28)"}, transparent 80%)`,
                                    clipPath: "polygon(42% 0, 58% 0, 100% 100%, 0 100%)", animation: `fsBeam ${4 + i}s ease-in-out infinite`, ["--r" as string]: `${r}deg`, pointerEvents: "none" } as CSSProperties} />))}
            {Array.from({ length: 26 }, (_, i) => (
              <div key={i} style={{ position: "absolute", top: -14, left: `${(i * 37) % 100}%`, width: i % 3 ? 6 : 8, height: i % 2 ? 10 : 6, borderRadius: i % 4 ? 2 : 99,
                                    background: [t.th.a, "#FDE68A", "#fff", t.th.b, "#60A5FA", "#F472B6"][i % 6], opacity: 0.85,
                                    animation: `fsFall ${5 + (i % 5)}s linear ${-(i * 0.7) % 6}s infinite`, pointerEvents: "none" }} />))}
            <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1.25fr 1fr", alignItems: "end", gap: 8 }}>
              {[1, 0, 2].map((k) => {
                const r = sorted[k]; if (!r) return <div key={k} />;
                const C = PODIUM[k], big = k === 0, raw = num(r, tab), hiddenVal = r.hidden && tab !== "growth_pct" && tab !== "stolen_7d";
                return <a key={r.org_id} href={`/profili/${r.org_id}`} style={{ textDecoration: "none", color: "#fff", textAlign: "center", animation: `fsPop .4s ${k * 90}ms ease both` }}>
                  {big && <div style={{ fontSize: 28, lineHeight: 1, marginBottom: 2, animation: "fsBob 2.4s ease-in-out infinite", filter: "drop-shadow(0 4px 8px rgba(253,224,71,.6))" }}>👑</div>}
                  <div style={{ position: "relative", display: "inline-grid", placeItems: "center", width: big ? 92 : 72, height: big ? 92 : 72 }}>
                    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `conic-gradient(${C[0]}, ${C[1]}, #fff, ${C[0]})`, animation: `fsSpin ${big ? 3 : 5}s linear infinite`, boxShadow: `0 0 ${big ? 28 : 14}px ${C[1]}` }} />
                    <div style={{ position: "relative", width: big ? 82 : 63, height: big ? 82 : 63, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", overflow: "hidden" }}>
                      <FactionEmblem type={r.type} size={big ? 64 : 48} logo={r.logo_url} />
                    </div>
                    <div style={{ position: "absolute", bottom: -6, right: -4, fontSize: big ? 24 : 20 }}>{MEDAL[k]}</div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: big ? 14.5 : 12.5, marginTop: 8, lineHeight: 1.15, minHeight: 30, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", textShadow: "0 1px 3px rgba(0,0,0,.4)" }}>
                    {r.name}{r.org_id === me ? " (tu)" : ""}</div>
                  <div style={{ fontWeight: 900, fontSize: big ? 18 : 14.5, color: C[0], whiteSpace: "nowrap", textShadow: `0 0 12px ${C[1]}` }}>
                    {hiddenVal ? "🔒" : (tab === "earnings_7d" || tab === "wealth") ? <CountUp to={raw} fmt={(n) => `${short(n)} €`} />
                      : tab === "growth_pct" || tab === "per_vehicle" ? podiumValue(r, tab) : <CountUp to={raw} fmt={(n) => value({ ...r, [tab]: Math.round(n) } as Row, tab)} />}
                  </div>
                  <div style={{ minHeight: 18 }}>{move(k + 1, prevRank.get(r.org_id)) && <span style={{ background: "#fff", borderRadius: 8, padding: "0 5px" }}>{move(k + 1, prevRank.get(r.org_id))}</span>}</div>
                  <div style={{ marginTop: 4, height: big ? 96 : k === 1 ? 70 : 52, borderRadius: "14px 14px 0 0", transformOrigin: "50% 100%", animation: `fsRise .6s ${200 + k * 120}ms cubic-bezier(.2,.9,.3,1.2) both`,
                                background: `linear-gradient(180deg, ${C[0]}, ${C[1]} 70%, ${C[2]})`, position: "relative", overflow: "hidden",
                                display: "grid", placeItems: "center", color: "#fff", fontWeight: 900, fontSize: big ? 40 : 30, textShadow: "0 3px 6px rgba(0,0,0,.35)",
                                boxShadow: `inset 0 2px 0 rgba(255,255,255,.6), 0 -6px 24px ${C[1]}55` }}>
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(100deg, transparent 35%, rgba(255,255,255,.45) 50%, transparent 65%)", backgroundSize: "250% 100%", animation: `fsShine ${3 + k}s linear infinite` }} />
                    <span style={{ position: "relative" }}>{k + 1}</span>
                  </div>
                </a>;
              })}
            </div>
          </div>}

          {/* dal 4° in giù */}
          {list.length > 0 && <div style={{ ...card, overflow: "hidden" }}>
            {list.map((r, j) => {
              const i = j + 3, x = delta(r, i), isMe = r.org_id === me, prize = !!t.prizes && i < 10;
              return (
                <div key={r.org_id} className="fs-rank-row" style={{ position: "relative", display: "flex", alignItems: "center", gap: 11, padding: "11px 14px", borderTop: j ? "1px solid #F1F5F9" : "none",
                                                                     background: isMe ? `linear-gradient(90deg, ${t.th.soft}, #fff)` : undefined, animationDelay: `${Math.min(j, 15) * 20}ms` }}>
                  {isMe && <div style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 4, borderRadius: 4, background: `linear-gradient(${t.th.a}, ${t.th.b})` }} />}
                  <div style={{ width: 38, textAlign: "center", flexShrink: 0 }}>
                    <div style={{ display: "inline-grid", placeItems: "center", width: 32, height: 32, borderRadius: 11, fontWeight: 900, fontSize: 14,
                                  background: prize ? `linear-gradient(135deg, ${t.th.a}, ${t.th.b})` : "#F1F5F9", color: prize ? "#fff" : "#475569" }}>{i + 1}</div>
                    <div style={{ marginTop: 2, minHeight: 14 }}>{move(i + 1, prevRank.get(r.org_id))}</div>
                  </div>
                  <FactionEmblem type={r.type} size={38} logo={r.logo_url} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <a href={`/profili/${r.org_id}`} style={{ color: "inherit", textDecoration: "none" }}>{r.name}</a>
                      {badges(r.org_id) && <span title="Titoli delle stagioni passate"> {badges(r.org_id)}</span>}
                      {isMe && <span style={{ color: t.th.ink }}> · tu</span>}
                    </div>
                    {!r.hidden && leadVal > 0 && <div style={{ height: 6, background: "#EEF2F7", borderRadius: 99, margin: "5px 0 3px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.max(3, Math.min(100, (num(r, tab) / leadVal) * 100))}%`, height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${t.th.a}, ${t.th.b})` }} />
                    </div>}
                    <div style={{ fontSize: 11.5, color: "#64748B", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span>{r.hidden ? "statistiche nascoste" : isSeason || tab === "reds" || tab === "maxi" ? `${r.vehicles ?? 0} mezzi` : tab === "stolen_7d" ? `${r.stolen_total ?? 0} in totale · ${r.lost_7d ?? 0} subiti` : `${r.services_7d ?? 0} servizi in 7 giorni`}</span>
                      {r.alliance && <Chip bg="#EEF2FF" fg="#4338CA">🤝 {r.alliance}</Chip>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 15, whiteSpace: "nowrap", color: tab === "growth_pct" && r.growth_pct !== null ? (r.growth_pct >= 0 ? "#15803D" : "#B91C1C") : "#0F172A" }}>{value(r, tab)}</div>
                    {x && x.d != null && x.d !== 0 && <div style={{ marginTop: 2 }}><Chip bg={x.d > 0 ? "#DCFCE7" : "#FEE2E2"} fg={x.d > 0 ? "#15803D" : "#B91C1C"}>{fmtDelta(x.d)} · {agoShort}</Chip></div>}
                    {x && x.gap > 0 && <div style={{ fontSize: 11, marginTop: 2, color: x.close ? "#EA580C" : "#94A3B8", fontWeight: x.close ? 900 : 600, whiteSpace: "nowrap" }}>{x.close && <span className="fs-fire">🔥</span>} a {fmtDelta(x.gap).slice(1)} dal {i}°</div>}
                  </div>
                </div>);
            })}
          </div>}
          {sorted.length > 53 && !showAll && <button onClick={() => setShowAll(true)} style={{ display: "block", margin: "12px auto 0", padding: "9px 16px", borderRadius: 12, border: "none", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.1)", fontWeight: 800, cursor: "pointer" }}>Mostra tutti ({sorted.length})</button>}
          {!error && sorted.length === 0 && <div style={{ ...card, padding: 26, color: "#94A3B8", textAlign: "center" }}>{loading ? "Caricamento…" : "Ancora nessuno in questa classifica: il primo servizio vale il podio!"}</div>}

          {isSeason && <div style={{ ...card, padding: 16, marginTop: 16 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>🏛️ Albo d&apos;oro</div>
            {pastSeasons.length === 0 && <div style={{ fontSize: 13, color: "#64748B" }}>La prima stagione si chiude a fine mese: i primi 3 ricevono un titolo che resta per sempre accanto al nome.</div>}
            {pastSeasons.map((s) => (
              <div key={s} style={{ borderTop: "1px solid #F1F5F9", padding: "8px 0", fontSize: 13 }}>
                <div style={{ fontWeight: 800, textTransform: "capitalize" }}>{monthName(s)}</div>
                {(["punti", "rivelazione"] as const).map((c) => (
                  <div key={c} style={{ color: "#475569" }}>{c === "punti" ? "🏁 Stagione: " : "🌱 Rivelazione: "}
                    {awards.filter((a) => a.season === s && a.category === c).sort((a, b) => a.rank - b.rank).map((a) => `${MEDAL[a.rank - 1]} ${orgName(a.org_id)}`).join("  ·  ") || "—"}
                  </div>))}
              </div>))}
          </div>}
        </>}
      </div>
    </main>
  );
}
