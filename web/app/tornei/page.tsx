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
  const [demo, setDemo] = useState<number | null>(null); // inizio della simulazione (ms)
  const [list, setList] = useState<TItem[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [chs, setChs] = useState<Challenge[] | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [funds, setFunds] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
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
    supabase.rpc("orgs_directory").then(({ data }) => setOrgs(((data as Org[]) ?? []).map((o) => ({ id: o.id, name: o.name, type: o.type, logo_url: o.logo_url }))));
    try { const q = new URLSearchParams(location.search); if (q.get("tab") === "sfide") setTab("sfide"); if (q.get("tab") === "classifica") { setTab("classifica"); supabase.rpc("tournament_board").then(({ data }) => setBoard((data as BoardRow[]) ?? [])); } if (q.get("demo")) setDemo(Date.now()); } catch {}
    const t1 = setInterval(() => setNow(Date.now()), 250);
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
        tabs={[{ key: "tornei", label: "🏆 Tornei", badge: openT.filter((t) => !t.joined).length || null },
               { key: "sfide", label: "⚔️ Sfide 1 contro 1", badge: incoming || live || null }, { key: "classifica", label: "🏅 Classifica" }]}
        tab={tab} onTab={(k) => { setTab(k as "tornei" | "sfide" | "classifica"); if (k === "classifica") supabase.rpc("tournament_board").then(({ data }) => setBoard((data as BoardRow[]) ?? [])); }}
        links={[{ href: "/classifica", label: "🏆 Classifica" }, { href: "/obiettivi", label: "🎯 Obiettivi" }]} />
      <div style={wrap}>
        {msg && <div style={{ ...card, color: msg.ok ? "#15803D" : "#B91C1C", fontWeight: 700 }}>{msg.text}</div>}

        {tab === "tornei" && demo !== null && (
          <SimDemo start={demo} now={now} orgs={orgs} me={meId} onRestart={() => setDemo(Date.now())} onClose={() => setDemo(null)} />
        )}
        {tab === "tornei" && demo === null && (
          <>
            <button className="fs-sim-open" onClick={() => { setDemo(Date.now()); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <span>▶️</span><span><b>Guarda una simulazione</b><small>Un torneo di 6 ore mostrato in 50 secondi, con il tabellone che avanza</small></span>
            </button>
            <details style={{ ...card, padding: "10px 14px" }}>
              <summary style={{ fontWeight: 800, cursor: "pointer", color: "#6D28D9" }}>ℹ️ Come funzionano i tornei</summary>
              <div style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.55 }}>
                Ogni giorno ci sono 3 tornei: alle 9, alle 15 e alle 21 (quello delle 21 mai sugli ordinari, che di notte non ci sono).
                Le iscrizioni aprono 3 ore prima e costano 100.000 €, che vanno nel montepremi.
                È a eliminazione diretta: ogni incontro dura 1 ora e passa il turno chi conclude più servizi del tipo del torneo (rossi, gialli, verdi o ordinari), anche in automatica.
                In caso di pareggio passa la testa di serie (chi ha più reputazione). Con 64 iscritti il torneo dura 6 ore, con meno iscritti meno turni.
                Premi: 60% del montepremi al vincitore, 25% al finalista, 7,5% a ciascun semifinalista.
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
                        <span>👥 {t.entries}/64</span>
                        <span>⏱ {live ? `finisce ${clock(t.ends_at)}` : `tra ${left(t.starts_at, now)}`}</span>
                        {t.status === "iscrizioni" && <span>🎟 {euro(t.entry_fee)}</span>}
                      </div>
                      {t.status === "iscrizioni" && (t.joined ? (
                        <button className="fs-tor-btn ghost" disabled={busy} onClick={async (e) => {
                          e.stopPropagation();
                          if (await gameConfirm(`Ritirarti dal torneo?\nTi vengono restituiti ${euro(t.entry_fee)}.`)) act("tournament_leave", { p_id: t.id }, "Ti sei ritirato, quota restituita.");
                        }}>✓ Iscritto · ritirati</button>
                      ) : (
                        <button className="fs-tor-btn" disabled={busy} onClick={async (e) => {
                          e.stopPropagation();
                          if (await gameConfirm(`Iscriversi al torneo?\nLa quota è ${euro(t.entry_fee)} e va nel montepremi.`)) act("tournament_join", { p_id: t.id }, "Iscrizione fatta! Il torneo parte all'ora indicata.");
                        }}>🎟 Iscriviti</button>
                      ))}
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
                <div className="fs-ch-orgs">
                  {orgs.filter((o) => o.id !== meId && (!cQ || o.name.toLowerCase().includes(cQ.toLowerCase()))).slice(0, 30).map((o) => (
                    <button key={o.id} className={cTo === o.id ? "on" : ""} onClick={() => setCTo(o.id)}>
                      <FactionEmblem type={o.type as never} size={26} logo={o.logo_url} /><span>{o.name}</span>
                    </button>
                  ))}
                </div>
                <div style={{ fontWeight: 800, fontSize: 13, margin: "12px 0 6px" }}>Su cosa</div>
                <div className="fs-ch-kinds">
                  {(Object.keys(KIND) as Kind[]).map((k) => (
                    <button key={k} className={cKind === k ? "on" : ""} onClick={() => setCKind(k)}
                            style={{ ["--ka" as string]: KIND[k].a, ["--kb" as string]: KIND[k].b }}>{KIND[k].icon} {KIND[k].label}</button>
                  ))}
                </div>
                <div style={{ fontWeight: 800, fontSize: 13, margin: "12px 0 6px" }}>Posta: {cStake ? euro(cStake) : "nessuna (solo per l'onore)"}</div>
                <div className="fs-ch-kinds">
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

// ---------------- simulazione (solo nel browser, non tocca il gioco) ----------------
const SIM_H = 8000; // 1 ora di torneo = 8 secondi
const FAKE = ["Croce Azzurra Pisa", "Misericordia Cecina", "Pubblica Assistenza Rosignano", "Croce Rossa Piombino", "SVS Livorno", "Misericordia Volterra",
  "PA Castiglioncello", "Croce Verde Portoferraio", "Misericordia Collesalvetti", "PA Vada", "Croce Bianca Bibbona", "Misericordia San Vincenzo",
  "PA Campiglia", "Croce Gialla Donoratico", "Misericordia Riparbella", "PA Capraia"];
function rnd(seed: number) { let x = seed; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; }

function SimDemo({ start, now, orgs, me, onRestart, onClose }: { start: number; now: number; orgs: Org[]; me: string | null; onRestart: () => void; onClose: () => void }) {
  const sim = useMemo(() => {
    const r = rnd(Math.floor(start / 1000));
    const meOrg = orgs.find((o) => o.id === me);
    const pool: Org[] = orgs.filter((o) => o.id !== me).slice(0, 15);
    while (pool.length < 15) pool.push({ id: `f${pool.length}`, name: FAKE[pool.length], type: (["blu_giallo", "arancio_nero", "rosso_bianco"] as const)[pool.length % 3], logo_url: null });
    const players = [...pool.slice(0, 4), meOrg ?? { id: "me", name: "La tua associazione", type: "blu_giallo", logo_url: null }, ...pool.slice(4, 15)];
    const pace = new Map(players.map((p) => [p.id, 8 + Math.floor(r() * 22)]));
    const T0 = new Date(); T0.setHours(15, 0, 0, 0);
    const t0 = T0.getTime();
    const rounds = 4; const all: (Match & { fa: number; fb: number })[] = [];
    let prev: { org: Org; seed: number }[] = [];
    for (let k = 0; k < 8; k++) prev.push({ org: players[k], seed: k + 1 }, { org: players[15 - k], seed: 16 - k });
    for (let rd = 1; rd <= rounds; rd++) {
      const M = prev.length / 2; const next: { org: Org; seed: number }[] = [];
      for (let j = 0; j < M; j++) {
        const a = rd === 1 ? prev[2 * j] : prev[j]; const b = rd === 1 ? prev[2 * j + 1] : prev[prev.length - 1 - j];
        if (rd > 1 && j >= M) break;
        const fa = Math.round((pace.get(a.org.id) ?? 10) * (0.7 + r() * 0.6)); const fb = Math.round((pace.get(b.org.id) ?? 10) * (0.7 + r() * 0.6));
        const wA = fa > fb || (fa === fb && a.seed < b.seed);
        all.push({ round: rd, slot: j, starts_at: new Date(t0 + (rd - 1) * 3600000).toISOString(), ends_at: new Date(t0 + rd * 3600000).toISOString(),
          done: false, winner: (wA ? a : b).org.id, seed_a: a.seed, seed_b: b.seed, a: a.org, b: b.org, score_a: 0, score_b: 0, fa, fb });
        next.push(wA ? a : b);
      }
      prev = next;
      if (rd === 1) { /* round 2 si accoppia j contro M-1-j */ }
    }
    // al primo turno le coppie sono già in ordine; dal secondo uso l'accoppiamento del gioco (j contro M-1-j)
    return { t0, rounds, all, players, meId: meOrg?.id ?? "me" };
  }, [start, orgs, me]);
  const elapsed = Math.max(0, now - start);
  const simNow = sim.t0 + (elapsed / SIM_H) * 3600000;
  const cur = Math.min(sim.rounds, Math.floor(elapsed / SIM_H) + 1);
  const finished = elapsed >= sim.rounds * SIM_H;
  const matches: Match[] = sim.all.filter((m) => m.round <= cur).map((m) => {
    const st = new Date(m.starts_at).getTime(), en = new Date(m.ends_at).getTime();
    const p = Math.max(0, Math.min(1, (simNow - st) / (en - st)));
    const done = simNow >= en;
    const wobble = (v: number) => Math.floor(v * p * (0.85 + 0.15 * Math.sin(p * 9 + v)));
    return { ...m, done, winner: done ? m.winner : null, score_a: done ? m.fa : Math.min(m.fa, wobble(m.fa)), score_b: done ? m.fb : Math.min(m.fb, wobble(m.fb)) };
  });
  const d: Detail = { id: -1, kind: "rossi", title: "Simulazione: torneo codici rossi", status: finished ? "finito" : "in_corso", starts_at: new Date(sim.t0).toISOString(),
    rounds: sim.rounds, size: 16, current_round: cur, prize: 3000000 + 16 * 100000, entry_fee: 100000, me: sim.meId, entries: sim.players, matches };
  const pct = Math.min(100, (elapsed / (sim.rounds * SIM_H)) * 100);
  const hh = new Date(simNow).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const myLast = [...matches].reverse().find((m) => m.a?.id === sim.meId || m.b?.id === sim.meId);
  const myState = !myLast ? "" : !myLast.done ? `🔥 Stai giocando: ${roundName(myLast.round, sim.rounds)}` : myLast.winner === sim.meId ? (finished ? "🏆 HAI VINTO IL TORNEO!" : "✅ Passi il turno!") : `❌ Eliminato: ${roundName(myLast.round, sim.rounds).toLowerCase()}`;
  return (
    <>
      <div className="fs-sim-bar">
        <div><b>🎬 SIMULAZIONE</b><small>1 ora di torneo = 8 secondi · non è un torneo vero, nessun soldo in gioco</small></div>
        <div className="fs-sim-clock">🕒 {hh}</div>
        <div className="fs-sim-prog"><i style={{ width: `${pct}%` }} /></div>
        <div className="fs-sim-btns">
          <button onClick={onRestart}>↻ Ricomincia</button>
          <button onClick={onClose}>✕ Chiudi</button>
        </div>
        {myState && <div className="fs-sim-me">{myState}</div>}
      </div>
      <Bracket d={d} now={simNow} me={sim.meId} />
      {finished && (
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 17 }}>Fine simulazione</div>
          <div style={{ fontSize: 13.5, color: "#64748B", margin: "4px 0 10px" }}>Premi veri: 60% al vincitore, 25% al finalista, 7,5% ai semifinalisti. Il prossimo torneo vero è nella lista dei tornei.</div>
          <button className="fs-tor-btn big" style={{ maxWidth: 320 }} onClick={onClose}>Vai ai tornei veri</button>
        </div>
      )}
    </>
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
          {d.status === "annullato" ? "Annullato: servivano almeno 2 iscritti. Le quote sono state restituite." : `Il tabellone si crea all'inizio, ${dayClock(d.starts_at)}. Iscritti:`}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {d.entries.map((o) => (
            <span key={o.id} className={`fs-bk-chip${o.id === me ? " me" : ""}`}><FactionEmblem type={o.type as never} size={20} logo={o.logo_url} />{o.name}</span>
          ))}
          {d.entries.length === 0 && <span style={{ color: "#94A3B8", fontSize: 13 }}>Ancora nessuno: sii il primo!</span>}
        </div>
      </div>
    );
  }
  return (
    <div style={{ ...card, padding: 0, overflow: "hidden" }}>
      <div className="fs-bk-head" style={{ background: `linear-gradient(135deg, ${k.a}, ${k.b})` }}>
        <div><b>{k.icon} {d.title}</b><small>{d.status === "finito" ? "Concluso" : `In corso · ${roundName(d.current_round, rounds)}`} · montepremi {euro(d.prize)}</small></div>
      </div>
      <div className="fs-bk">
        {byRound.map((ms, i) => {
          const r = i + 1;
          const running = d.status === "in_corso" && r === d.current_round;
          return (
            <div key={r} className={`fs-bk-col${running ? " now" : ""}`}>
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
            <div className="fs-bk-col champ">
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
.fs-sim-open { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 14px 16px; margin-bottom: 14px; border: none !important; border-radius: 20px;
  background: linear-gradient(135deg, #A78BFA, #5B21B6) !important; color: #fff !important; font: inherit; cursor: pointer; box-shadow: 0 12px 28px rgba(91,33,182,.3) !important; }
.fs-sim-open > span:first-child { font-size: 30px; } .fs-sim-open b, .fs-sim-open small { display: block; } .fs-sim-open b { font-size: 16px; } .fs-sim-open small { opacity: .9; font-weight: 600; }
.fs-sim-bar { display: grid; grid-template-columns: 1fr auto; gap: 8px 12px; align-items: center; background: #0B1B33; color: #fff; border-radius: 20px; padding: 12px 14px; margin-bottom: 12px;
  box-shadow: 0 12px 28px rgba(11,27,51,.3); }
.fs-sim-bar b { display: block; letter-spacing: .08em; color: #FDE047; } .fs-sim-bar small { opacity: .8; font-size: 12px; }
.fs-sim-clock { font-size: 22px; font-weight: 900; font-variant-numeric: tabular-nums; }
.fs-sim-prog { grid-column: 1 / -1; height: 8px; border-radius: 99px; background: rgba(255,255,255,.15); overflow: hidden; }
.fs-sim-prog i { display: block; height: 100%; background: linear-gradient(90deg, #A78BFA, #FDE047); border-radius: 99px; transition: width .25s linear; }
.fs-sim-btns { grid-column: 1 / -1; display: flex; gap: 6px; }
.fs-sim-btns button { flex: 1; padding: 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,.25) !important; background: rgba(255,255,255,.1) !important; color: #fff !important; font: inherit; font-weight: 800; cursor: pointer; box-shadow: none !important; }
.fs-sim-me { grid-column: 1 / -1; text-align: center; font-weight: 900; font-size: 16px; background: rgba(255,255,255,.1); border-radius: 12px; padding: 8px; }
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
`;
