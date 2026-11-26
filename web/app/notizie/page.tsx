"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";

// ---------- FantaGiornale 24: prima pagina col gioco di adesso ----------
type News = { at: string; icon: string; title: string; body: string };
type G = {
  now: string;
  numeri: { servizi_oggi: number; rossi_oggi: number; associazioni: number; mezzi: number; sedi: number; in_strada: number };
  emergenze: { title: string; description: string | null; venue: string; tipo: "incendio" | "maxi"; mezzi: number; ends_at: string | null }[];
  eventi: { title: string; venue: string | null; kind: string; show_at: string; score: { t1: string; t2: string; s1: number; s2: number } | null }[];
  livree: { name: string; org: string; org_id: string; logo: string | null; model: string; image: string; votes: number; at: string }[];
  sedi_nuove: { name: string; org: string; org_id: string; logo: string | null; banner: string | null; color: string | null; at: string; hq: boolean; rented: boolean }[];
  nuove_associazioni: { name: string; id: string; logo: string | null; type: string; at: string }[];
  podio: { name: string; id: string; logo: string | null; points: number }[];
  mezzi_nuovi: { model: string; image: string | null; n: number }[];
};

type Press = { id: string; org_id: string; org_name: string; logo: string | null; kind: "comunicato" | "intervista"; title: string; body: string | null; questions: { q: string; a?: string }[]; published_at: string; mine: boolean };
type Req = { id: string; questions: { q: string }[]; requested_at: string };
type LogoUp = { org_id: string; org_name: string; logo: string | null; at: string };
const ERR: Record<string, string> = { PRESS_WAIT: "Puoi pubblicare un comunicato ogni 6 ore.", PRESS_TOO_SHORT: "Titolo di almeno 5 caratteri e testo di almeno 20.",
  PRESS_ANSWER_ALL: "Rispondi a tutte le domande.", PRESS_NOT_FOUND: "L'intervista non è più disponibile." };
const errText = (m: string) => Object.entries(ERR).find(([k]) => m.includes(k))?.[1] ?? m;
const input: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid #a89f8c", borderRadius: 6, background: "#fffdf8", fontFamily: "Georgia, serif", fontSize: 15 };
const btn: CSSProperties = { padding: "8px 14px", borderRadius: 6, border: "none", background: "#B91C1C", color: "#fff", fontWeight: 800, cursor: "pointer", fontFamily: "system-ui, sans-serif" };

const INK = "#1a1a1a", PAPER = "#f6f1e7", RULE = "#2b2b2b";
const serif = "Georgia, 'Times New Roman', serif";
const wrap: CSSProperties = { maxWidth: 980, margin: "0 auto", padding: "0 14px" };
const kicker: CSSProperties = { fontFamily: "system-ui, sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#B91C1C" };
const h2: CSSProperties = { fontFamily: serif, fontSize: 22, fontWeight: 900, margin: "4px 0 8px", lineHeight: 1.15 };
const section: CSSProperties = { borderTop: `3px double ${RULE}`, paddingTop: 10, marginTop: 18 };

function when(iso: string) {
  const d = new Date(iso), mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} min fa`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} ore fa`;
  return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "short" });
}
const n = (x: number) => Number(x ?? 0).toLocaleString("it-IT");
const KIND: Record<string, string> = { calcio: "⚽", basket: "🏀", concerto: "🎶", teatro: "🎭" };

function Logo({ src, size = 28 }: { src: string | null; size?: number }) {
  return src ? <img src={src} alt="" style={{ width: size, height: size, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid #ccc" }} />
    : <div style={{ width: size, height: size, borderRadius: 8, background: "#ddd", flexShrink: 0, display: "grid", placeItems: "center", fontSize: size * 0.5 }}>🚑</div>;
}

export default function Notizie() {
  const router = useRouter();
  const [g, setG] = useState<G | null>(null);
  const [list, setList] = useState<News[] | null>(null);
  const [press, setPress] = useState<Press[]>([]);
  const [req, setReq] = useState<Req | null>(null);
  const [logos, setLogos] = useState<LogoUp[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [iTitle, setITitle] = useState("");
  const [writing, setWriting] = useState(false);
  const [cTitle, setCTitle] = useState("");
  const [cBody, setCBody] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const loadPress = () => {
    supabase.rpc("press_list", { p_days: 7 }).then(({ data }) => setPress((data as Press[]) ?? []));
    supabase.rpc("my_press_request").then(({ data }) => { const r = ((data as Req[]) ?? [])[0] ?? null; setReq(r); if (r) setAnswers((a) => a.length === r.questions.length ? a : r.questions.map(() => "")); });
    supabase.rpc("logo_updates", { p_days: 7 }).then(({ data }) => setLogos((data as LogoUp[]) ?? []));
  };
  async function sendInterview() {
    if (!req) return;
    const { error } = await supabase.rpc("press_answer", { p_id: req.id, p_title: iTitle, p_answers: answers });
    if (error) { setMsg({ ok: false, t: errText(error.message) }); return; }
    setMsg({ ok: true, t: "🎙️ Intervista pubblicata in prima pagina!" }); setReq(null); loadPress();
  }
  async function sendRelease() {
    const { error } = await supabase.rpc("press_publish", { p_title: cTitle, p_body: cBody });
    if (error) { setMsg({ ok: false, t: errText(error.message) }); return; }
    setMsg({ ok: true, t: "📣 Comunicato pubblicato!" }); setWriting(false); setCTitle(""); setCBody(""); loadPress();
  }
  async function removePress(id: string) {
    await supabase.rpc("press_remove", { p_id: id }); loadPress();
  }

  useEffect(() => {
    const load = () => {
      supabase.rpc("fanta_giornale").then(({ data }) => setG((data as G) ?? null));
      supabase.rpc("news_feed").then(({ data }) => setList((data as News[]) ?? []));
      loadPress();
    };
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 120_000);
    return () => clearInterval(t);
  }, []);

  const today = new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const top = g?.emergenze[0];
  const leadLivery = g?.livree[0];
  const headline = top ? (top.tipo === "incendio" ? `Incendio: ${top.title}` : `Maxi emergenza: ${top.title}`)
    : leadLivery ? `Nuova livrea in strada: «${leadLivery.name}» di ${leadLivery.org}`
    : g ? `${n(g.numeri.servizi_oggi)} servizi oggi sul territorio` : "";

  return (
    <main style={{ minHeight: "100vh", background: PAPER, color: INK, paddingBottom: 40 }}>
      <PageHeader icon="📰" title="FantaGiornale 24" tone="red" sub={<span style={{ textTransform: "capitalize" }}>{today} · notizie dal territorio</span>} />
      {/* testata */}
      <div style={{ ...wrap, paddingTop: 10 }}>
        
        <div style={{ textAlign: "center", borderBottom: `4px double ${RULE}`, padding: "8px 0 6px" }}>
          <div style={{ fontFamily: serif, fontWeight: 900, fontSize: "clamp(34px, 8vw, 64px)", letterSpacing: -1, lineHeight: 1 }}>FantaGiornale <span style={{ color: "#B91C1C" }}>24</span></div>
          <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 13, marginTop: 4 }}>Il quotidiano del soccorso · notizie dal territorio, sempre aggiornate</div>
        </div>
        {g && <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px 18px", borderBottom: `1px solid ${RULE}`, padding: "6px 0", fontFamily: "system-ui, sans-serif", fontSize: 12.5, fontWeight: 600 }}>
          <span>🚑 {n(g.numeri.servizi_oggi)} servizi oggi</span><span>🔴 {n(g.numeri.rossi_oggi)} codici rossi</span>
          <span>🛣️ {n(g.numeri.in_strada)} mezzi in strada</span><span>🏠 {n(g.numeri.sedi)} sedi</span>
          <span>🏥 {n(g.numeri.associazioni)} associazioni</span><span>🚐 {n(g.numeri.mezzi)} mezzi</span>
        </div>}
      </div>

      <div style={wrap}>
        {!g && <div style={{ padding: 30, textAlign: "center", fontFamily: serif, fontStyle: "italic" }}>Il giornale va in stampa…</div>}

        {g && <>
          {/* prima pagina */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginTop: 14 }}>
            <article>
              <div style={kicker}>{top ? (top.tipo === "incendio" ? "🔥 Ultim'ora" : "🆘 Ultim'ora") : "In primo piano"}</div>
              <h1 style={{ fontFamily: serif, fontSize: "clamp(26px, 5vw, 38px)", fontWeight: 900, lineHeight: 1.08, margin: "6px 0 10px" }}>{headline}</h1>
              {top ? <>
                <p style={{ fontFamily: serif, fontSize: 16, lineHeight: 1.5, margin: 0 }}>{top.description ?? "Squadre al lavoro sul posto."} Sul posto <b>{top.mezzi}</b> mezzi.
                  {top.ends_at && <> Operazioni previste fino alle {new Date(top.ends_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}.</>}</p>
                {g.emergenze.length > 1 && <p style={{ fontFamily: serif, fontSize: 14, fontStyle: "italic", marginTop: 6 }}>Altre {g.emergenze.length - 1} emergenze in corso sul territorio.</p>}
              </> : leadLivery ? <p style={{ fontFamily: serif, fontSize: 16, lineHeight: 1.5, margin: 0 }}>{leadLivery.org} presenta la nuova veste del suo {leadLivery.model}: si chiama «{leadLivery.name}» e ha già raccolto {leadLivery.votes} ❤️ nel concorso delle livree.</p>
                : <p style={{ fontFamily: serif, fontSize: 16, lineHeight: 1.5, margin: 0 }}>Giornata intensa per i soccorritori: {n(g.numeri.servizi_oggi)} servizi chiusi da stamattina, {n(g.numeri.rossi_oggi)} in codice rosso.</p>}
            </article>
            {leadLivery && <figure style={{ margin: 0 }}>
              <div style={{ background: "linear-gradient(#e9e4d8,#d8d1c1)", border: `1px solid ${RULE}`, padding: 8 }}>
                <img src={leadLivery.image} alt="" style={{ width: "100%", height: 200, objectFit: "contain", display: "block" }} />
              </div>
              <figcaption style={{ fontFamily: serif, fontStyle: "italic", fontSize: 13, marginTop: 4 }}>La livrea «{leadLivery.name}» ({leadLivery.model}) di {leadLivery.org}.</figcaption>
            </figure>}
          </div>

          {/* stampa: interviste e comunicati */}
          <section style={section}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}><div style={kicker}>🗞️ La parola alle associazioni</div><h2 style={h2}>Interviste e comunicati stampa</h2></div>
              <button style={btn} onClick={() => { setWriting(!writing); setMsg(null); }}>✍️ Scrivi un comunicato</button>
            </div>
            {msg && <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13.5, fontWeight: 700, color: msg.ok ? "#166534" : "#B91C1C", margin: "4px 0 8px" }}>{msg.t}</div>}
            {req && <div style={{ border: "2px solid #B91C1C", background: "#fffdf8", padding: 12, marginBottom: 12 }}>
              <div style={{ fontFamily: serif, fontWeight: 900, fontSize: 18 }}>🎙️ Il direttore del FantaGiornale 24 vuole intervistarvi</div>
              <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 13.5, marginBottom: 8 }}>Rispondete alle domande: l&apos;intervista uscirà in prima pagina. Avete tempo fino a {new Date(new Date(req.requested_at).getTime() + 48 * 3600_000).toLocaleString("it-IT", { weekday: "long", hour: "2-digit", minute: "2-digit" })}.</div>
              <input style={{ ...input, marginBottom: 8 }} placeholder="Titolo dell'intervista (facoltativo)" maxLength={120} value={iTitle} onChange={(e) => setITitle(e.target.value)} />
              {req.questions.map((q, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ fontFamily: serif, fontWeight: 800, marginBottom: 3 }}>D. {q.q}</div>
                  <textarea style={{ ...input, minHeight: 64 }} maxLength={700} value={answers[i] ?? ""} onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))} placeholder="La vostra risposta…" />
                </div>))}
              <button style={btn} onClick={sendInterview}>📨 Invia al giornale</button>
            </div>}
            {writing && <div style={{ border: "1px solid #a89f8c", background: "#fffdf8", padding: 12, marginBottom: 12 }}>
              <input style={{ ...input, marginBottom: 8, fontWeight: 800 }} placeholder="Titolo del comunicato" maxLength={120} value={cTitle} onChange={(e) => setCTitle(e.target.value)} />
              <textarea style={{ ...input, minHeight: 120 }} maxLength={2000} placeholder="Testo del comunicato: novità, ringraziamenti, nuove sedi, mezzi, eventi…" value={cBody} onChange={(e) => setCBody(e.target.value)} />
              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                <button style={btn} onClick={sendRelease}>📣 Pubblica</button>
                <button style={{ ...btn, background: "transparent", color: INK, border: "1px solid #a89f8c" }} onClick={() => setWriting(false)}>Annulla</button>
                <span style={{ fontSize: 12, color: "#6b6355", fontFamily: "system-ui, sans-serif" }}>{cBody.length}/2000</span>
              </div>
            </div>}
            {press.length === 0 && !req && <div style={{ fontFamily: serif, fontStyle: "italic", color: "#6b6355" }}>Nessun comunicato questa settimana: scrivete il primo!</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
              {press.map((p) => (
                <article key={p.id} style={{ background: "#fffdf8", border: "1px solid #cfc6b4", padding: 12 }}>
                  <div style={kicker}>{p.kind === "intervista" ? "🎙️ L'intervista" : "📣 Comunicato stampa"}</div>
                  <a href={`/profili/${p.org_id}`} style={{ display: "flex", alignItems: "center", gap: 8, color: INK, textDecoration: "none", margin: "4px 0" }}>
                    <Logo src={p.logo} size={30} /><b style={{ fontFamily: serif }}>{p.org_name}</b>
                  </a>
                  <h3 style={{ fontFamily: serif, fontSize: 20, fontWeight: 900, margin: "4px 0 6px", lineHeight: 1.15 }}>{p.title}</h3>
                  {p.kind === "comunicato" ? <p style={{ fontFamily: serif, fontSize: 15, lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap" }}>{p.body}</p>
                    : p.questions.map((x, i) => (
                      <div key={i} style={{ marginBottom: 6, fontFamily: serif, fontSize: 15, lineHeight: 1.45 }}>
                        <div style={{ fontWeight: 800 }}>D. {x.q}</div><div style={{ whiteSpace: "pre-wrap" }}>R. {x.a}</div>
                      </div>))}
                  <div style={{ display: "flex", alignItems: "center", fontSize: 11.5, color: "#6b6355", marginTop: 6, fontStyle: "italic" }}>
                    <span style={{ flex: 1 }}>{when(p.published_at)}</span>
                    {p.mine && <button onClick={() => removePress(p.id)} style={{ border: "none", background: "transparent", color: "#B91C1C", cursor: "pointer", fontSize: 12 }}>Ritira</button>}
                  </div>
                </article>))}
            </div>
          </section>

          {/* loghi nuovi */}
          {logos.length > 0 && <section style={section}>
            <div style={kicker}>🎨 Immagine</div>
            <h2 style={h2}>Nuovi loghi</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              {logos.map((l) => (
                <a key={l.org_id} href={`/profili/${l.org_id}`} style={{ width: 110, textAlign: "center", color: INK, textDecoration: "none" }}>
                  <Logo src={l.logo} size={84} />
                  <div style={{ fontFamily: serif, fontWeight: 700, fontSize: 13, marginTop: 4 }}>{l.org_name}</div>
                  <div style={{ fontSize: 11, color: "#6b6355" }}>{when(l.at)}</div>
                </a>))}
            </div>
          </section>}

          {/* livree */}
          {g.livree.length > 0 && <section style={section}>
            <div style={kicker}>🎨 Moda su quattro ruote</div>
            <h2 style={h2}>Le livree nuove della settimana</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {g.livree.map((l, i) => (
                <a key={i} href={`/profili/${l.org_id}`} style={{ color: INK, textDecoration: "none", background: "#fffdf8", border: "1px solid #cfc6b4" }}>
                  <img src={l.image} alt="" style={{ width: "100%", height: 110, objectFit: "contain", background: "linear-gradient(#eeeae0,#dcd5c5)", display: "block" }} />
                  <div style={{ padding: "6px 8px" }}>
                    <div style={{ fontFamily: serif, fontWeight: 800, fontSize: 15 }}>«{l.name}»</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 3 }}><Logo src={l.logo} size={18} /><span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.org} · {l.model}</span></div>
                    <div style={{ fontSize: 11.5, color: "#6b6355", marginTop: 3 }}>❤️ {l.votes} · {when(l.at)}</div>
                  </div>
                </a>))}
            </div>
          </section>}

          {/* sedi nuove */}
          {g.sedi_nuove.length > 0 && <section style={section}>
            <div style={kicker}>🏠 Territorio</div>
            <h2 style={h2}>Nuove sedi aperte</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
              {g.sedi_nuove.map((b, i) => (
                <a key={i} href={`/profili/${b.org_id}`} style={{ color: INK, textDecoration: "none", background: "#fffdf8", border: "1px solid #cfc6b4", overflow: "hidden" }}>
                  <div style={{ height: 70, background: b.banner ? `center/cover url(${b.banner})` : `linear-gradient(135deg, ${b.color ?? "#64748B"}, #1f2937)`, position: "relative" }}>
                    <div style={{ position: "absolute", left: 8, bottom: -14 }}><Logo src={b.logo} size={34} /></div>
                  </div>
                  <div style={{ padding: "18px 8px 8px" }}>
                    <div style={{ fontFamily: serif, fontWeight: 800, fontSize: 15 }}>{b.hq ? "⭐ " : ""}{b.name}</div>
                    <div style={{ fontSize: 12, color: "#4b4538" }}>{b.org}{b.rented ? " · in affitto" : ""}</div>
                    <div style={{ fontSize: 11.5, color: "#6b6355", marginTop: 2 }}>Inaugurata {when(b.at)}</div>
                  </div>
                </a>))}
            </div>
          </section>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
            {/* eventi */}
            {g.eventi.length > 0 && <section style={section}>
              <div style={kicker}>🎟️ Appuntamenti</div>
              <h2 style={h2}>Eventi e partite</h2>
              {g.eventi.map((e, i) => (
                <div key={i} style={{ borderBottom: "1px dotted #a89f8c", padding: "6px 0" }}>
                  <div style={{ fontFamily: serif, fontWeight: 700 }}>{KIND[e.kind] ?? "📣"} {e.title}</div>
                  <div style={{ fontSize: 12.5, color: "#4b4538" }}>{e.venue ?? ""} · {new Date(e.show_at).toLocaleString("it-IT", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                  {e.score && <div style={{ fontWeight: 800, fontSize: 14, marginTop: 2 }}>{e.score.t1} <span style={{ color: "#B91C1C" }}>{e.score.s1} – {e.score.s2}</span> {e.score.t2}</div>}
                </div>))}
            </section>}

            {/* classifica */}
            {g.podio.length > 0 && <section style={section}>
              <div style={kicker}>🏆 Sport</div>
              <h2 style={h2}>La corsa al titolo del mese</h2>
              {g.podio.map((p, i) => (
                <a key={p.id} href={`/profili/${p.id}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px dotted #a89f8c", color: INK, textDecoration: "none" }}>
                  <span style={{ fontSize: 22 }}>{["🥇", "🥈", "🥉"][i]}</span><Logo src={p.logo} size={28} />
                  <span style={{ flex: 1, fontFamily: serif, fontWeight: 700 }}>{p.name}</span><b>{n(p.points)} pt</b>
                </a>))}
              <a href="/classifica" style={{ fontSize: 12.5, color: "#B91C1C", fontWeight: 700 }}>Classifica completa →</a>
            </section>}

            {/* nuove associazioni + mezzi nuovi */}
            {(g.nuove_associazioni.length > 0 || g.mezzi_nuovi.length > 0) && <section style={section}>
              <div style={kicker}>👋 Benvenuti</div>
              <h2 style={h2}>Nuovi arrivi</h2>
              {g.nuove_associazioni.map((o) => (
                <a key={o.id} href={`/profili/${o.id}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", color: INK, textDecoration: "none" }}>
                  <Logo src={o.logo} size={26} /><span style={{ flex: 1, fontFamily: serif, fontWeight: 700 }}>{o.name}</span><span style={{ fontSize: 11.5, color: "#6b6355" }}>{when(o.at)}</span>
                </a>))}
              {g.mezzi_nuovi.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 8 }}>
                {g.mezzi_nuovi.map((m, i) => (
                  <div key={i} style={{ textAlign: "center", fontSize: 12 }}>
                    {m.image && <img src={m.image} alt="" style={{ width: "100%", height: 60, objectFit: "contain" }} />}
                    <div><b>{m.n}</b> × {m.model} <span style={{ color: "#6b6355" }}>nelle ultime 24 ore</span></div>
                  </div>))}
              </div>}
            </section>}
          </div>
        </>}

        {/* cronaca */}
        {list && list.length > 0 && <section style={section}>
          <div style={kicker}>📰 Cronaca</div>
          <h2 style={h2}>Notizie dal territorio</h2>
          <div style={{ columnWidth: 280, columnGap: 22, columnRule: "1px solid #cfc6b4" }}>
            {list.map((x, i) => (
              <article key={i} style={{ breakInside: "avoid", marginBottom: 12 }}>
                <div style={{ fontFamily: serif, fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>{x.icon} {x.title}</div>
                <div style={{ fontFamily: serif, fontSize: 14, lineHeight: 1.45, marginTop: 2 }}>{x.body}</div>
                <div style={{ fontSize: 11.5, color: "#6b6355", marginTop: 2, fontStyle: "italic" }}>{when(x.at)}</div>
              </article>))}
          </div>
        </section>}
      </div>
    </main>
  );
}
