"use client";
// Tornei a eliminazione diretta (ogni incontro dura 1 ora: vince chi conclude più servizi del tipo del torneo)
// e sfide 1 contro 1 tra associazioni.
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import FactionEmblem from "@/components/FactionEmblem";
import { gameConfirm } from "@/lib/confirm";
import { playSound } from "@/lib/sound";

type Kind = "ordinari" | "verdi" | "gialli" | "rossi" | "servizi";
type Org = { id: string; name: string; type: string; logo_url: string | null };
type TItem = {
  id: number; kind: Kind; title: string; status: "iscrizioni" | "in_corso" | "finito" | "annullato"; starts_at: string; ends_at: string;
  rounds: number | null; current_round: number; entry_fee: number; prize: number; entries: number; joined: boolean; my_out: number | null; winner: string | null;
};
type Match = {
  round: number; slot: number; starts_at: string; ends_at: string; done: boolean; winner: string | null;
  seed_a: number | null; seed_b: number | null; a: Org | null; b: Org | null; score_a: number | null; score_b: number | null;
};
type Detail = { id: number; kind: Kind; title: string; status: TItem["status"]; starts_at: string; rounds: number | null; size: number | null;
  current_round: number; prize: number; entry_fee: number; me: string; entries: Org[]; matches: Match[] };
type BoardRow = { id: string; name: string; type: string; logo_url: string | null; wins: number; finals: number; semis: number; challenges: number; points: number; me: boolean };
type Challenge = {
  id: number; kind: Kind; stake: number; status: "in_attesa" | "in_corso" | "finita" | "rifiutata" | "scaduta" | "annullata";
  created_at: string; starts_at: string | null; ends_at: string | null; mine: boolean; winner: string | null; me: string;
  from: Org; to: Org; score_from: number | null; score_to: number | null;
};

const KIND: Record<Kind, { label: string; icon: string; a: string; b: string }> = {
  rossi: { label: "Codici rossi", icon: "🔴", a: "#FB7185", b: "#BE123C" },
  gialli: { label: "Codici gialli", icon: "🟡", a: "#FDE047", b: "#CA8A04" },
  verdi: { label: "Codici verdi", icon: "🟢", a: "#4ADE80", b: "#15803D" },
  ordinari: { label: "Ordinari", icon: "🚐", a: "#60A5FA", b: "#1D4ED8" },
  servizi: { label: "Tutti i servizi", icon: "🚑", a: "#A78BFA", b: "#6D28D9" },
};
const euro = (n: number) => `${Math.round(n).toLocaleString("it-IT")} €`;
const shell: CSSProperties = { minHeight: "100vh", background: "#EEF3FA", fontFamily: "Inter, system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 1100, margin: "0 auto", padding: 16 };
const card: CSSProperties = { background: "#fff", borderRadius: 20, boxShadow: "0 1px 2px rgba(15,23,42,.05), 0 10px 28px rgba(15,23,42,.08)", border: "1px solid #E9EEF6", padding: 16, marginBottom: 14 };
const ERR: Record<string, string> = {
  NO_FUNDS: "Non hai abbastanza soldi.", TOURNAMENT_CLOSED: "Le iscrizioni sono chiuse.", ALREADY_IN: "Sei già iscritto.",
  TOURNAMENT_FULL: "Il torneo è pieno (64 associazioni).", TOO_MANY_CHALLENGES: "Hai già 3 sfide aperte: aspetta che finiscano.",
  BAD_TARGET: "Scegli un'altra associazione.", BAD_CHALLENGE: "Questa sfida non è più valida.", NOT_IN: "Non sei iscritto.",
};
const errText = (m: string) => ERR[Object.keys(ERR).find((k) => m.includes(k)) ?? ""] ?? "Qualcosa è andato storto, riprova.";

function clock(iso: string) { return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }); }
function dayClock(iso: string) {
  const d = new Date(iso); const today = new Date();
  const same = d.toDateString() === today.toDateString();
  const tom = new Date(today.getTime() + 86400000).toDateString() === d.toDateString();
  return `${same ? "oggi" : tom ? "domani" : d.toLocaleDateString("it-IT", { day: "numeric", month: "short" })} alle ${clock(iso)}`;
}
function left(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "0:00";
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return h ? `${h} h ${m} min` : `${m}:${String(s).padStart(2, "0")}`;
}
function roundName(r: number, rounds: number) {
  const back = rounds - r;
  return back === 0 ? "Finale" : back === 1 ? "Semifinali" : back === 2 ? "Quarti" : back === 3 ? "Ottavi" : back === 4 ? "Sedicesimi" : `${r}° turno`;
}

export default function Tornei() {
  const [tab, setTab] = useState<"tornei" | "sfide" | "classifica">("tornei");
  const [board, setBoard] = useState<BoardRow[] | null>(null);
  const [list, setList] = useState<TItem[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [chs, setChs] = useState<Challenge[] | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [funds, setFunds] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [expected, setExpected] = useState<number | null>(null);
  // nuova sfida
  const [cTo, setCTo] = useState(""); const [cKind, setCKind] = useState<Kind>("servizi"); const [cStake, setCStake] = useState(0); const [cQ, setCQ] = useState("");

  const loadList = useCallback(async () => {
    const { data } = await supabase.rpc("tournaments_list");
    const l = ((data as TItem[]) ?? []);
    setList(l);
    setOpenId((cur) => cur ?? (l.find((t) => t.status === "in_corso") ?? l.find((t) => t.status === "iscrizioni") ?? l[0])?.id ?? null);
  }, []);
  const loadDetail = useCallback(async (id: number) => {
    const { data } = await supabase.rpc("tournament_detail", { p_id: id });
    setDetail((data as Detail) ?? null);
  }, []);
  const loadChs = useCallback(async () => {
    const { data } = await supabase.rpc("my_challenges");
    setChs((data as Challenge[]) ?? []);
  }, []);
  const loadFunds = useCallback(async () => {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const { data } = await supabase.from("organizations").select("funds").eq("owner_id", s.session.user.id).maybeSingle();
    if (data) setFunds(Number((data as { funds: number }).funds));
  }, []);

  useEffect(() => {
    loadList(); loadChs(); loadFunds();
    supabase.rpc("tournament_expected").then(({ data }) => setExpected(typeof data === "number" ? data : null));
    supabase.rpc("orgs_directory").then(({ data }) => setOrgs(((data as Org[]) ?? []).map((o) => ({ id: o.id, name: o.name, type: o.type, logo_url: o.logo_url }))));
    try { const q = new URLSearchParams(location.search); if (q.get("tab") === "sfide") setTab("sfide"); if (q.get("tab") === "classifica") { setTab("classifica"); supabase.rpc("tournament_board").then(({ data }) => setBoard((data as BoardRow[]) ?? [])); } } catch {}
    const t1 = setInterval(() => setNow(Date.now()), 1000);
    const t2 = setInterval(() => { if (!document.hidden) { loadList(); loadChs(); } }, 30000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [loadList, loadChs, loadFunds]);
  useEffect(() => {
    if (openId == null) return;
    loadDetail(openId);
    const t = setInterval(() => { if (!document.hidden) loadDetail(openId); }, 30000);
    return () => clearInterval(t);
  }, [openId, loadDetail]);

  const act = async (fn: string, args: Record<string, unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setMsg({ ok: false, text: errText(error.message) }); return false; }
    setMsg({ ok: true, text: ok }); playSound("money");
    loadList(); loadChs(); loadFunds(); if (openId) loadDetail(openId);
    return true;
  };

  const meId = detail?.me ?? chs?.[0]?.me ?? null;
  const incoming = (chs ?? []).filter((c) => !c.mine && c.status === "in_attesa").length;
  const live = (chs ?? []).filter((c) => c.status === "in_corso").length;
  const openT = (list ?? []).filter((t) => t.status === "iscrizioni");
  const runT = (list ?? []).filter((t) => t.status === "in_corso");
  const pastT = (list ?? []).filter((t) => t.status === "finito" || t.status === "annullato");

  return (
    <main style={shell}>
      <PageHeader icon="⚔️" title="Tornei e sfide" tone="purple" funds={funds}
        sub="Ogni incontro dura 1 ora: vince chi conclude più servizi del tipo richiesto"
        tabs={[{ key: "tornei", label: "🏆 Tornei", badge: runT.length || null },
               { key: "sfide", label: "⚔️ Sfide 1 contro 1", badge: incoming || live || null }, { key: "classifica", label: "🏅 Classifica" }]}
        tab={tab} onTab={(k) => { setTab(k as "tornei" | "sfide" | "classifica"); if (k === "classifica") supabase.rpc("tournament_board").then(({ data }) => setBoard((data as BoardRow[]) ?? [])); }}
        links={[{ href: "/classifica", label: "🏆 Classifica" }, { href: "/obiettivi", label: "🎯 Obiettivi" }]} />
      <div style={wrap}>
        {msg && <div style={{ ...card, color: msg.ok ? "#15803D" : "#B91C1C", fontWeight: 700 }}>{msg.text}</div>}

        {tab === "tornei" && (
          <>
            <details style={{ ...card, padding: "10px 14px" }}>
              <summary style={{ fontWeight: 800, cursor: "pointer", color: "#6D28D9" }}>ℹ️ Come funzionano i tornei</summary>
              <div style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.55 }}>
                Ogni giorno ci sono 3 tornei: alle 9, alle 15 e alle 21 (quello delle 21 mai sugli ordinari, che di notte non ci sono).
                Non serve iscriversi: partecipano in automatico tutte le associazioni che hanno concluso servizi negli ultimi 2 giorni (le 64 con più reputazione), gratis.
                È a eliminazione diretta: ogni incontro dura 1 ora e passa il turno chi conclude più servizi del tipo del torneo (rossi, gialli, verdi o ordinari), anche in automatica.
                In caso di pareggio passa la testa di serie (chi ha più reputazione). Con 64 iscritti il torneo dura 6 ore, con meno iscritti meno turni.
                Il torneo compare nella lista 3 ore prima. Premi: 60% del montepremi al vincitore, 25% al finalista, 7,5% a ciascun semifinalista.
              </div>
            </details>

            {list === null && <div style={card}>Caricamento…</div>}
            {list && list.length === 0 && (
              <div style={{ ...card, textAlign: "center", color: "#64748B" }}>Il prossimo torneo apre le iscrizioni 3 ore prima dell&apos;inizio (alle 6, alle 12 e alle 18).</div>
            )}

            {(runT.length > 0 || openT.length > 0) && (
              <div className="fs-tor-grid">
                {[...runT, ...openT].map((t) => {
                  const k = KIND[t.kind];
                  const live = t.status === "in_corso";
                  return (
                    <div key={t.id} className={`fs-tor-card${openId === t.id ? " sel" : ""}`} onClick={() => setOpenId(t.id)}
                         style={{ background: `linear-gradient(135deg, ${k.a}, ${k.b})` }}>
                      <div className="fs-tor-top">
                        <span className="fs-tor-k">{k.icon} {k.label}</span>
                        <span className={`fs-tor-st${live ? " live" : ""}`}>{live ? `● LIVE · ${roundName(t.current_round, t.rounds ?? 1)}` : `Inizia ${dayClock(t.starts_at)}`}</span>
                      </div>
                      <div className="fs-tor-title">{t.title}</div>
                      <div className="fs-tor-prize">🏆 {euro(t.prize)}</div>
                      <div className="fs-tor-meta">
                        <span>👥 {t.status === "iscrizioni" ? `${expected ?? "…"} associazioni` : `${t.entries} in gara`}</span>
                        <span>⏱ {live ? `finisce ${clock(t.ends_at)}` : `tra ${left(t.starts_at, now)}`}</span>
                      </div>
                      {t.status === "iscrizioni" && <div className="fs-tor-you">✓ Partecipi in automatico, non devi fare niente</div>}
                      {live && t.joined && (
                        <div className="fs-tor-you">{t.my_out ? `Eliminato al ${roundName(t.my_out, t.rounds ?? 1).toLowerCase()}` : "🔥 Sei ancora in gara!"}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {detail && <Bracket d={detail} now={now} me={meId} />}

            {pastT.length > 0 && (
              <div style={card}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>📜 Tornei passati</div>
                {pastT.map((t) => (
                  <button key={t.id} onClick={() => setOpenId(t.id)} className="fs-tor-past" style={{ background: openId === t.id ? "#F5F3FF" : "transparent" }}>
                    <span>{KIND[t.kind].icon}</span>
                    <span style={{ flex: 1, minWidth: 0 }}><b>{t.title}</b><small>{new Date(t.starts_at).toLocaleDateString("it-IT", { day: "numeric", month: "short" })} · {t.entries} iscritti</small></span>
                    <span style={{ fontWeight: 800, color: t.status === "annullato" ? "#94A3B8" : "#B45309" }}>{t.status === "annullato" ? "annullato" : `🏆 ${t.winner ?? "—"}`}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "classifica" && (
          <>
            <div style={{ ...card, padding: "10px 14px", fontSize: 13, color: "#475569" }}>
              Punti: 🏆 torneo vinto 10 · 🥈 finale 5 · 🥉 semifinale 2 · ⚔️ sfida vinta 1
            </div>
            {board === null && <div style={card}>Caricamento…</div>}
            {board && board.length === 0 && <div style={{ ...card, textAlign: "center", color: "#64748B" }}>Ancora nessun torneo concluso: il primo campione potresti essere tu!</div>}
            {board && board.length > 0 && (
              <>
                <div className="fs-tb-podium">
                  {[1, 0, 2].map((i) => board[i] && (
                    <div key={board[i].id} className={`fs-tb-p p${i + 1}${board[i].me ? " me" : ""}`}>
                      <span className="fs-tb-medal">{["🥇", "🥈", "🥉"][i]}</span>
                      <FactionEmblem type={board[i].type as never} size={i === 0 ? 64 : 50} logo={board[i].logo_url} />
                      <b>{board[i].name}</b>
                      <small>🏆 {board[i].wins} · {board[i].points} punti</small>
                      <i style={{ height: [110, 80, 60][i] }}>{i + 1}</i>
                    </div>
                  ))}
                </div>
                <div style={{ ...card, padding: 0, overflow: "hidden" }}>
                  {board.map((r, i) => (
                    <div key={r.id} className={`fs-tb-row${r.me ? " me" : ""}`}>
                      <span className="fs-tb-pos">{i + 1}</span>
                      <FactionEmblem type={r.type as never} size={32} logo={r.logo_url} />
                      <span className="fs-tb-name">{r.name}</span>
                      <span className="fs-tb-stats"><span title="Tornei vinti">🏆 {r.wins}</span><span title="Finali">🥈 {r.finals}</span><span title="Semifinali">🥉 {r.semis}</span><span title="Sfide vinte">⚔️ {r.challenges}</span></span>
                      <b className="fs-tb-pts">{r.points}</b>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === "sfide" && (
          <div className="fs-2col">
            <div>
              <div style={card}>
                <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 4 }}>⚔️ Lancia una sfida</div>
                <div style={{ fontSize: 13, color: "#64748B", marginBottom: 10 }}>
                  1 ora, parte appena l&apos;altra associazione accetta (ha 30 minuti). Chi conclude più servizi del tipo scelto vince la posta di tutti e due. Pareggio: posta restituita.
                </div>
                <input value={cQ} onChange={(e) => setCQ(e.target.value)} placeholder="🔎 Cerca l'associazione da sfidare…" className="fs-ch-in" />
                {cTo && (() => { const o = orgs.find((x) => x.id === cTo); return o ? (
                  <div className="fs-ch-picked"><FactionEmblem type={o.type as never} size={30} logo={o.logo_url} /><b>{o.name}</b><button onClick={() => setCTo("")}>Cambia</button></div>
                ) : null; })()}
                {!cTo && <div className="fs-ch-orgs">
                  {orgs.filter((o) => o.id !== meId && (!cQ || o.name.toLowerCase().includes(cQ.toLowerCase()))).slice(0, 30).map((o) => (
                    <button key={o.id} className={cTo === o.id ? "on" : ""} onClick={() => setCTo(o.id)}>
                      <FactionEmblem type={o.type as never} size={26} logo={o.logo_url} /><span>{o.name}</span>
                    </button>
                  ))}
                </div>}
                <div style={{ fontWeight: 800, fontSize: 13, margin: "12px 0 6px" }}>Su cosa</div>
                <div className="fs-ch-kinds fs-ch-row">
                  {(Object.keys(KIND) as Kind[]).map((k) => (
                    <button key={k} className={cKind === k ? "on" : ""} onClick={() => setCKind(k)}
                            style={{ ["--ka" as string]: KIND[k].a, ["--kb" as string]: KIND[k].b }}>{KIND[k].icon} {KIND[k].label}</button>
                  ))}
                </div>
                <div style={{ fontWeight: 800, fontSize: 13, margin: "12px 0 6px" }}>Posta: {cStake ? euro(cStake) : "nessuna (solo per l'onore)"}</div>
                <div className="fs-ch-kinds fs-ch-row">
                  {[0, 50000, 250000, 1000000, 5000000].map((v) => (
                    <button key={v} className={cStake === v ? "on" : ""} onClick={() => setCStake(v)}>{v ? euro(v) : "Onore"}</button>
                  ))}
                </div>
                <button className="fs-tor-btn big" disabled={busy || !cTo} onClick={async () => {
                  const o = orgs.find((x) => x.id === cTo);
                  if (!o) return;
                  if (await gameConfirm(`Sfidare ${o.name}?\n${KIND[cKind].label} · 1 ora · posta ${cStake ? euro(cStake) : "nessuna"}`)) {
                    if (await act("challenge_create", { p_to: cTo, p_kind: cKind, p_stake: cStake }, "Sfida lanciata! Aspetta che accetti.")) setCTo("");
                  }
                }}>⚔️ Lancia la sfida</button>
              </div>
            </div>
            <div>
              {chs === null && <div style={card}>Caricamento…</div>}
              {chs && chs.length === 0 && <div style={{ ...card, color: "#64748B", textAlign: "center" }}>Nessuna sfida negli ultimi 3 giorni. Lanciane una!</div>}
              {(chs ?? []).map((c) => {
                const k = KIND[c.kind];
                const meFrom = c.mine;
                const my = meFrom ? c.score_from : c.score_to;
                const their = meFrom ? c.score_to : c.score_from;
                const other = meFrom ? c.to : c.from;
                const won = c.status === "finita" && c.winner === c.me;
                const lost = c.status === "finita" && c.winner && c.winner !== c.me;
                return (
                  <div key={c.id} className={`fs-ch ${c.status}`} style={{ ...card, padding: 0, overflow: "hidden" }}>
                    <div className="fs-ch-bar" style={{ background: `linear-gradient(135deg, ${k.a}, ${k.b})` }}>
                      <span>{k.icon} {k.label}</span>
                      <span>{c.stake ? `💶 ${euro(c.stake * 2)} in palio` : "🎖️ per l'onore"}</span>
                    </div>
                    <div className="fs-ch-vs">
                      <div><FactionEmblem type={(meFrom ? c.from : c.to).type as never} size={40} logo={(meFrom ? c.from : c.to).logo_url} /><b>Tu</b></div>
                      <div className="fs-ch-score">
                        {c.status === "in_corso" || c.status === "finita" ? <><span>{my ?? 0}</span><i>–</i><span>{their ?? 0}</span></> : <i>VS</i>}
                      </div>
                      <div><FactionEmblem type={other.type as never} size={40} logo={other.logo_url} /><b>{other.name}</b></div>
                    </div>
                    <div className="fs-ch-foot">
                      {c.status === "in_corso" && <span className="live">● LIVE · mancano {left(c.ends_at!, now)}</span>}
                      {c.status === "in_attesa" && meFrom && <>
                        <span>In attesa che accetti · scade tra {left(new Date(new Date(c.created_at).getTime() + 1800000).toISOString(), now)}</span>
                        <button disabled={busy} className="fs-tor-btn ghost dark" onClick={() => act("challenge_cancel", { p_id: c.id }, "Sfida annullata, posta restituita.")}>Annulla</button>
                      </>}
                      {c.status === "in_attesa" && !meFrom && <>
                        <span><b>{c.from.name}</b> ti sfida!</span>
                        <button disabled={busy} className="fs-tor-btn ghost dark" onClick={() => act("challenge_answer", { p_id: c.id, p_accept: false }, "Sfida rifiutata.")}>Rifiuta</button>
                        <button disabled={busy} className="fs-tor-btn" onClick={async () => {
                          if (await gameConfirm(`Accettare la sfida?\n${c.stake ? `Metti anche tu ${euro(c.stake)}.` : "Nessuna posta."} Parte subito e dura 1 ora.`))
                            act("challenge_answer", { p_id: c.id, p_accept: true }, "Sfida accettata: si parte! Hai 1 ora.");
                        }}>⚔️ Accetta</button>
                      </>}
                      {won && <span className="win">🏆 Hai vinto{c.stake ? ` ${euro(c.stake * 2)}` : ""}!</span>}
                      {lost && <span className="lose">Hai perso. Rivincita?</span>}
                      {c.status === "finita" && !c.winner && <span>Pareggio: posta restituita</span>}
                      {c.status === "rifiutata" && <span>Rifiutata</span>}
                      {c.status === "scaduta" && <span>Scaduta: nessuno ha risposto</span>}
                      {c.status === "annullata" && <span>Annullata</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}

function Side({ o, seed, score, win, lose, me }: { o: Org | null; seed: number | null; score: number | null; win: boolean; lose: boolean; me: boolean }) {
  return (
    <div className={`fs-bk-side${win ? " win" : ""}${lose ? " lose" : ""}${me ? " me" : ""}`}>
      {o ? <FactionEmblem type={o.type as never} size={22} logo={o.logo_url} /> : <span className="fs-bk-empty" />}
      <span className="fs-bk-name">{o ? o.name : seed == null ? "passa il turno" : "da decidere"}</span>
      {seed != null && o && <small>#{seed}</small>}
      <b>{score ?? "–"}</b>
    </div>
  );
}

function Bracket({ d, now, me }: { d: Detail; now: number; me: string | null }) {
  const k = KIND[d.kind];
  const rounds = d.rounds ?? 0;
  const [sel, setSel] = useState<number | null>(null);
  const shown = sel ?? (d.status === "finito" ? rounds + 1 : Math.max(1, d.current_round));
  const byRound = useMemo(() => {
    const r: Match[][] = [];
    for (let i = 1; i <= rounds; i++) r.push(d.matches.filter((m) => m.round === i).sort((a, b) => a.slot - b.slot));
    return r;
  }, [d, rounds]);
  if (d.status === "iscrizioni" || d.status === "annullato") {
    return (
      <div style={card}>
        <div style={{ fontWeight: 900, fontSize: 17 }}>{k.icon} {d.title}</div>
        <div style={{ fontSize: 13, color: "#64748B", margin: "2px 0 10px" }}>
          {d.status === "annullato" ? "Annullato: servivano almeno 2 associazioni attive." : `Il tabellone si crea all'inizio, ${dayClock(d.starts_at)}, con tutte le associazioni attive.`}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {d.entries.map((o) => (
            <span key={o.id} className={`fs-bk-chip${o.id === me ? " me" : ""}`}><FactionEmblem type={o.type as never} size={20} logo={o.logo_url} />{o.name}</span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div style={{ ...card, padding: 0, overflow: "hidden" }}>
      <div className="fs-bk-head" style={{ background: `linear-gradient(135deg, ${k.a}, ${k.b})` }}>
        <div><b>{k.icon} {d.title}</b><small>{d.status === "finito" ? "Concluso" : `In corso · ${roundName(d.current_round, rounds)}`} · montepremi {euro(d.prize)}</small></div>
      </div>
      <div className="fs-bk-rtabs">
        {byRound.map((ms, i) => ms.length > 0 && (
          <button key={i} className={shown === i + 1 ? "on" : ""} onClick={() => setSel(i + 1)}>
            {d.status === "in_corso" && i + 1 === d.current_round && <i className="dot" />}{roundName(i + 1, rounds)}
          </button>
        ))}
        {d.status === "finito" && <button className={shown === rounds + 1 ? "on" : ""} onClick={() => setSel(rounds + 1)}>🏆 Campione</button>}
      </div>
      <div className="fs-bk">
        {byRound.map((ms, i) => {
          const r = i + 1;
          const running = d.status === "in_corso" && r === d.current_round;
          if (!ms.length) return null;
          return (
            <div key={r} className={`fs-bk-col${running ? " now" : ""}${shown === r ? "" : " off-m"}`}>
              <div className="fs-bk-rt">{roundName(r, rounds)}<small>{ms[0] ? `${clock(ms[0].starts_at)}–${clock(ms[0].ends_at)}` : ""}</small></div>
              <div className="fs-bk-list">
                {ms.map((m) => {
                  const liveM = !m.done && new Date(m.starts_at).getTime() <= now;
                  return (
                    <div key={m.slot} className={`fs-bk-m${liveM ? " live" : ""}${(m.a?.id === me || m.b?.id === me) ? " mine" : ""}`}>
                      <Side o={m.a} seed={m.seed_a} score={m.b ? m.score_a : null} win={m.done && m.winner === m.a?.id} lose={m.done && !!m.a && m.winner !== m.a.id} me={m.a?.id === me} />
                      <Side o={m.b} seed={m.seed_b} score={m.score_b} win={m.done && !!m.b && m.winner === m.b.id} lose={m.done && !!m.b && m.winner !== m.b.id} me={m.b?.id === me} />
                      {liveM && <div className="fs-bk-live">● LIVE · {left(m.ends_at, now)}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {d.status === "finito" && (() => {
          const f = byRound[rounds - 1]?.[0];
          const w = f ? (f.winner === f.a?.id ? f.a : f.b) : null;
          return w ? (
            <div className={`fs-bk-col champ${shown === rounds + 1 ? "" : " off-m"}`}>
              <div className="fs-bk-rt">Campione</div>
              <div className="fs-bk-list"><div className="fs-bk-champ"><span>🏆</span><FactionEmblem type={w.type as never} size={56} logo={w.logo_url} /><b>{w.name}</b></div></div>
            </div>
          ) : null;
        })()}
      </div>
    </div>
  );
}

const CSS = `
.fs-tb-podium { display: grid; grid-template-columns: 1fr 1.15fr 1fr; align-items: end; gap: 8px; margin: 6px 0 14px; padding: 18px 10px 0; border-radius: 24px;
  background: radial-gradient(circle at 50% 0%, rgba(253,224,71,.35), transparent 60%), linear-gradient(160deg, #2E1065, #0B1B33); overflow: hidden; }
.fs-tb-p { display: flex; flex-direction: column; align-items: center; gap: 4px; color: #fff; text-align: center; min-width: 0; }
.fs-tb-p b { font-size: 13.5px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fs-tb-p small { font-size: 11.5px; opacity: .85; font-weight: 700; }
.fs-tb-p i { font-style: normal; width: 100%; margin-top: 6px; border-radius: 14px 14px 0 0; display: grid; place-items: center; font-size: 28px; font-weight: 900;
  background: linear-gradient(180deg, rgba(255,255,255,.28), rgba(255,255,255,.06)); }
.fs-tb-p.p1 i { background: linear-gradient(180deg, #FDE047, #CA8A04); color: #713F12; }
.fs-tb-medal { font-size: 28px; } .fs-tb-p.p1 .fs-tb-medal { font-size: 36px; animation: fsBadge 2s ease-in-out infinite; }
.fs-tb-p.me b { color: #FDE047; }
.fs-tb-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-top: 1px solid #EEF2F7; }
.fs-tb-row:first-child { border-top: none; } .fs-tb-row.me { background: #F5F3FF; }
.fs-tb-pos { width: 28px; text-align: center; font-weight: 900; color: #6D28D9; }
.fs-tb-name { flex: 1; min-width: 0; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fs-tb-stats { display: flex; gap: 8px; font-size: 12.5px; font-weight: 700; color: #475569; }
.fs-tb-pts { min-width: 44px; text-align: right; font-size: 17px; color: #6D28D9; font-variant-numeric: tabular-nums; }
@media (max-width: 640px) { .fs-tb-stats span:nth-child(n+3) { display: none; } }
html.dark .fs-tb-row { border-color: rgba(148,163,184,.12); } html.dark .fs-tb-row.me { background: #251C47; } html.dark .fs-tb-stats { color: #A8B4C7; }
.fs-tor-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; margin-bottom: 14px; }
.fs-tor-card { position: relative; overflow: hidden; border-radius: 24px; padding: 16px; color: #fff; cursor: pointer; isolation: isolate;
  box-shadow: 0 14px 30px rgba(15,23,42,.18); transition: transform .2s, box-shadow .2s; }
.fs-tor-card::before { content: ""; position: absolute; inset: 0; z-index: -1; background: radial-gradient(circle at 90% -10%, rgba(255,255,255,.35), transparent 45%); }
.fs-tor-card::after { content: "🏆"; position: absolute; right: -10px; bottom: -18px; font-size: 96px; opacity: .14; z-index: -1; transform: rotate(-12deg); }
.fs-tor-card.sel { box-shadow: 0 0 0 4px #fff, 0 0 0 7px #7C3AED, 0 18px 36px rgba(76,29,149,.3); }
@media (hover: hover) { .fs-tor-card:hover { transform: translateY(-3px); } }
.fs-tor-top { display: flex; justify-content: space-between; gap: 8px; align-items: center; font-size: 12px; font-weight: 800; }
.fs-tor-k { background: rgba(0,0,0,.22); padding: 3px 9px; border-radius: 999px; }
.fs-tor-st { background: rgba(255,255,255,.22); padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.fs-tor-st.live { background: #fff; color: #DC2626; animation: fsBadge 1.4s ease-in-out infinite; }
.fs-tor-title { font-size: 19px; font-weight: 900; margin-top: 10px; letter-spacing: -.02em; text-shadow: 0 2px 8px rgba(0,0,0,.2); }
.fs-tor-prize { font-size: 26px; font-weight: 900; margin: 2px 0 6px; text-shadow: 0 2px 10px rgba(0,0,0,.25); }
.fs-tor-meta { display: flex; gap: 10px; flex-wrap: wrap; font-size: 12.5px; font-weight: 700; opacity: .95; }
.fs-tor-btn { margin-top: 12px; width: 100%; padding: 11px; border-radius: 14px; border: none; background: #fff; color: #0B1B33; font: inherit; font-weight: 900; font-size: 14.5px;
  cursor: pointer; box-shadow: 0 8px 18px rgba(0,0,0,.18); }
.fs-tor-btn:disabled { opacity: .5; cursor: default; }
.fs-tor-btn.ghost { background: rgba(255,255,255,.18) !important; color: #fff !important; border: 1px solid rgba(255,255,255,.4) !important; box-shadow: none !important; }
.fs-tor-btn.ghost.dark { background: #EEF2F7 !important; color: #334155 !important; border: none !important; width: auto; margin: 0; padding: 8px 12px; }
.fs-tor-btn.big { background: linear-gradient(135deg, #A78BFA, #6D28D9) !important; color: #fff !important; font-size: 16px; padding: 13px; box-shadow: 0 12px 26px rgba(109,40,217,.35) !important; }
.fs-ch-foot .fs-tor-btn { width: auto; margin: 0; padding: 8px 14px; background: linear-gradient(135deg, #A78BFA, #6D28D9) !important; color: #fff !important; }
.fs-tor-you { margin-top: 10px; background: rgba(0,0,0,.22); border-radius: 12px; padding: 7px 10px; font-weight: 800; font-size: 13px; }
.fs-tor-past { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; border: none !important; border-top: 1px solid #EEF2F7 !important; padding: 10px 6px;
  font: inherit; font-size: 14px; color: #0B1B33 !important; cursor: pointer; border-radius: 0; box-shadow: none !important; }
.fs-tor-past b, .fs-tor-past small { display: block; } .fs-tor-past small { color: #64748B; font-size: 12px; }
.fs-bk-head { color: #fff; padding: 14px 16px; } .fs-bk-head b { display: block; font-size: 17px; font-weight: 900; } .fs-bk-head small { opacity: .9; font-weight: 700; font-size: 12.5px; }
.fs-bk { display: flex; gap: 14px; overflow-x: auto; padding: 14px; scroll-snap-type: x proximity; }
.fs-bk-col { flex: 0 0 230px; display: flex; flex-direction: column; scroll-snap-align: start; }
.fs-bk-col.now .fs-bk-rt { color: #DC2626; }
.fs-bk-rt { font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #6D28D9; margin-bottom: 8px; display: flex; justify-content: space-between; }
.fs-bk-rt small { color: #94A3B8; letter-spacing: 0; text-transform: none; font-weight: 700; }
.fs-bk-list { flex: 1; display: flex; flex-direction: column; justify-content: space-around; gap: 10px; }
.fs-bk-m { position: relative; background: #fff; border: 1px solid #E2E8F0; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(15,23,42,.06); }
.fs-bk-m.live { border-color: #F87171; box-shadow: 0 0 0 3px rgba(248,113,113,.2); }
.fs-bk-m.mine { border-color: #7C3AED; box-shadow: 0 0 0 3px rgba(124,58,237,.18); }
.fs-bk-col:not(:last-child) .fs-bk-m::after { content: ""; position: absolute; right: -15px; top: 50%; width: 14px; border-top: 2px solid #CBD5E1; }
.fs-bk-side { display: flex; align-items: center; gap: 7px; padding: 7px 9px; font-size: 13px; }
.fs-bk-side + .fs-bk-side { border-top: 1px solid #F1F5F9; }
.fs-bk-side.win { background: #F0FDF4; font-weight: 800; } .fs-bk-side.win b { color: #15803D; }
.fs-bk-side.lose { opacity: .5; } .fs-bk-side.me .fs-bk-name { color: #6D28D9; font-weight: 800; }
.fs-bk-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fs-bk-side small { color: #94A3B8; font-size: 11px; } .fs-bk-side b { min-width: 22px; text-align: right; font-variant-numeric: tabular-nums; font-size: 15px; }
.fs-bk-empty { width: 22px; height: 22px; border-radius: 50%; background: #E2E8F0; flex-shrink: 0; }
.fs-bk-live { background: #DC2626; color: #fff; font-size: 11px; font-weight: 800; text-align: center; padding: 2px; }
.fs-bk-champ { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px; border-radius: 18px; background: linear-gradient(135deg, #FEF3C7, #FDE68A);
  box-shadow: 0 12px 26px rgba(217,119,6,.3); text-align: center; } .fs-bk-champ span { font-size: 34px; } .fs-bk-champ b { font-size: 15px; }
.fs-bk-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; border-radius: 999px; background: #F1F5F9; font-size: 13px; font-weight: 700; }
.fs-bk-chip.me { background: #EDE9FE; color: #5B21B6; }
.fs-ch-in { width: 100%; box-sizing: border-box; padding: 11px 12px; border-radius: 14px; border: 1px solid #E2E8F0; background: #F8FAFD; font: inherit; font-size: 14px; }
.fs-ch-orgs { display: flex; gap: 6px; overflow-x: auto; padding: 8px 0 2px; scrollbar-width: thin; }
.fs-ch-orgs button { flex-shrink: 0; display: flex; align-items: center; gap: 6px; padding: 5px 10px 5px 5px; border-radius: 999px; border: 1px solid #E2E8F0 !important;
  background: #fff !important; color: #0B1B33 !important; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: none !important; white-space: nowrap; }
.fs-ch-orgs button.on { background: linear-gradient(135deg, #A78BFA, #6D28D9) !important; color: #fff !important; border-color: transparent !important; }
.fs-ch-kinds { display: flex; gap: 6px; flex-wrap: wrap; }
.fs-ch-kinds button { padding: 7px 11px; border-radius: 999px; border: 1px solid #E2E8F0 !important; background: #fff !important; color: #334155 !important; font: inherit; font-size: 13px;
  font-weight: 700; cursor: pointer; box-shadow: none !important; }
.fs-ch-kinds button.on { background: linear-gradient(135deg, var(--ka, #A78BFA), var(--kb, #6D28D9)) !important; color: #fff !important; border-color: transparent !important; }
.fs-ch-bar { display: flex; justify-content: space-between; color: #fff; font-weight: 800; font-size: 12.5px; padding: 8px 14px; }
.fs-ch-vs { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; padding: 14px; text-align: center; }
.fs-ch-vs > div:not(.fs-ch-score) { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
.fs-ch-vs b { font-size: 13px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fs-ch-score { display: flex; align-items: center; gap: 8px; font-size: 30px; font-weight: 900; font-variant-numeric: tabular-nums; }
.fs-ch-score i { font-style: normal; color: #94A3B8; font-size: 18px; }
.fs-ch-foot { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; padding: 10px 14px; border-top: 1px solid #EEF2F7; font-size: 13px; color: #475569; }
.fs-ch-foot > span { flex: 1; min-width: 160px; }
.fs-ch-foot .live { color: #DC2626; font-weight: 800; } .fs-ch-foot .win { color: #15803D; font-weight: 900; font-size: 15px; } .fs-ch-foot .lose { color: #B91C1C; font-weight: 800; }
html.dark .fs-bk-m, html.dark .fs-ch-orgs button, html.dark .fs-ch-kinds button { background: #111A2E !important; border-color: rgba(148,163,184,.18) !important; color: #E6EDF7 !important; }
html.dark .fs-bk-side.win { background: #0F3324; } html.dark .fs-bk-side + .fs-bk-side, html.dark .fs-ch-foot, html.dark .fs-tor-past { border-color: rgba(148,163,184,.12) !important; }
html.dark .fs-bk-chip { background: #17233D; } html.dark .fs-ch-in { background: #0D1424; border-color: rgba(148,163,184,.2); color: #E6EDF7; }
html.dark .fs-tor-past { color: #E6EDF7 !important; } html.dark .fs-tor-btn.ghost.dark { background: #17233D !important; color: #CBD5E1 !important; }
.fs-bk-rtabs { display: none; }
.fs-ch-picked { display: flex; align-items: center; gap: 8px; margin-top: 8px; padding: 8px 10px; border-radius: 14px; background: #F5F3FF; border: 2px solid #A78BFA; }
.fs-ch-picked b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fs-ch-picked button { border: none !important; background: #fff !important; color: #6D28D9 !important; border-radius: 10px; padding: 6px 10px; font: inherit; font-weight: 800; font-size: 12.5px; cursor: pointer; box-shadow: none !important; }
@media (max-width: 640px) {
  .fs-tor-grid { grid-template-columns: 1fr; gap: 10px; }
  .fs-tor-card { padding: 14px; border-radius: 20px; }
  .fs-tor-title { font-size: 17px; } .fs-tor-prize { font-size: 22px; }
  .fs-bk-rtabs { display: flex; gap: 6px; overflow-x: auto; padding: 10px 12px 0; scrollbar-width: none; }
  .fs-bk-rtabs::-webkit-scrollbar { display: none; }
  .fs-bk-rtabs button { flex-shrink: 0; padding: 7px 12px; border-radius: 999px; border: 1px solid #E2E8F0 !important; background: #fff !important; color: #334155 !important;
    font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: none !important; display: inline-flex; align-items: center; gap: 6px; }
  .fs-bk-rtabs button.on { background: linear-gradient(135deg, #A78BFA, #6D28D9) !important; color: #fff !important; border-color: transparent !important; }
  .fs-bk-rtabs .dot { width: 8px; height: 8px; border-radius: 50%; background: #DC2626; animation: fsBadge 1.2s ease-in-out infinite; }
  .fs-bk { display: block; padding: 10px 12px 12px; overflow: visible; }
  .fs-bk-col { display: flex; } .fs-bk-col.off-m { display: none; }
  .fs-bk-col .fs-bk-rt { display: none; }
  .fs-bk-col:not(:last-child) .fs-bk-m::after { display: none; }
  .fs-bk-list { gap: 8px; }
  .fs-bk-side { padding: 9px 10px; font-size: 14px; }
  .fs-ch-orgs { display: grid; grid-template-columns: 1fr 1fr; max-height: 210px; overflow-y: auto; gap: 6px; }
  .fs-ch-orgs button { white-space: normal; text-align: left; line-height: 1.15; font-size: 12.5px; }
  .fs-ch-orgs button span { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .fs-ch-row { flex-wrap: nowrap !important; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
  .fs-ch-row::-webkit-scrollbar { display: none; }
  .fs-ch-row button { flex-shrink: 0; white-space: nowrap; }
  .fs-ch-vs { padding: 12px 10px; gap: 4px; }
  .fs-ch-score { font-size: 24px; gap: 5px; }
  .fs-ch-bar { font-size: 12px; padding: 7px 12px; }
  .fs-ch-foot { padding: 10px 12px; }
  .fs-ch-foot > span { min-width: 100%; }
  .fs-ch-foot .fs-tor-btn, .fs-ch-foot .fs-tor-btn.ghost.dark { flex: 1; padding: 10px; }
  .fs-tb-podium { padding: 14px 6px 0; gap: 4px; }
  .fs-tb-p b { font-size: 12px; } .fs-tb-row { padding: 9px 10px; gap: 8px; }
}
html.dark .fs-ch-picked { background: #251C47; } html.dark .fs-ch-picked button { background: #111A2E !important; color: #C4B5FD !important; }
html.dark .fs-bk-rtabs button:not(.on) { background: #111A2E !important; border-color: rgba(148,163,184,.18) !important; color: #CBD5E1 !important; }
`;
