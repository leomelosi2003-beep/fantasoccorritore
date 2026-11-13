"use client";

// Tutorial guidato passo passo: una scheda in basso che dice cosa fare, porta alla pagina giusta,
// evidenzia il pulsante da toccare e va avanti da sola quando il giocatore ha fatto davvero la cosa.
// Lo stato sta nel database (organizations.tutorial_step / tutorial_done), così segue il giocatore su ogni dispositivo.
// Parte da solo per le associazioni nuove; dal menu "Tutorial" si riapre (tutorial_set(0,false)).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type TutPage = "map" | "garage" | "squadra" | "officina" | "obiettivi" | "automatico";
type State = { step: number; done: boolean; vehicles: number; cards: number; drivers: number; dispatched: boolean; completed: boolean; first_reward: number | null };

type Step = {
  icon: string; title: string;
  page: TutPage;                      // dove si fa
  target?: string;                    // data-tut del pulsante da evidenziare (su quella pagina)
  check?: (s: State) => boolean;      // fatto davvero? (allora si passa da soli al passo dopo)
  text: Partial<Record<TutPage | "other", string>> & { other: string };
};

const HREF: Record<TutPage, string> = { map: "/", garage: "/garage", squadra: "/squadra", officina: "/officina", obiettivi: "/obiettivi", automatico: "/automatico" };
const PAGE_NAME: Record<TutPage, string> = { map: "la mappa", garage: "il Garage", squadra: "la Squadra", officina: "l'Officina", obiettivi: "gli Obiettivi", automatico: "la Modalità automatica" };

const STEPS: Step[] = [
  { icon: "👋", title: "Benvenuto in FantaSoccorritore!", page: "map",
    text: { other: "Sei il responsabile di un'associazione di soccorso. Ti accompagno passo passo: comprerai un'ambulanza, prenderai i volontari e farai il tuo primo servizio 118. Premi Avanti." } },
  { icon: "🚑", title: "Compra la tua prima ambulanza", page: "garage", target: "buy-vehicle", check: (s) => s.vehicles >= 1,
    text: { garage: "Tocca il pulsante arancione «Compra la tua prima ambulanza», scegli il modello e l'allestimento e alla fine premi ✅ Compra.",
            other: "Senza mezzi non si parte. Vai nel Garage e compra la tua prima ambulanza." } },
  { icon: "👥", title: "Prendi i volontari", page: "squadra", target: "open-pack", check: (s) => s.drivers >= 1 && s.cards >= 2,
    text: { squadra: "Apri il «Pacchetto settimanale»: è gratis e ti dà 5 volontari, sempre con almeno un autista e un soccorritore.",
            other: "Un'ambulanza ha bisogno di un equipaggio: almeno un autista e un soccorritore. Vai nella Squadra." } },
  { icon: "🗺️", title: "Manda l'ambulanza su un servizio", page: "map", check: (s) => s.dispatched,
    text: { map: "Sulla mappa le gocce colorate sono i servizi (🔴 rosso e 🟡 giallo sono emergenze). Toccane una vicino alla tua sede, scegli l'ambulanza e l'equipaggio e premi Invia.",
            other: "Ora torna sulla mappa e manda la tua ambulanza su un servizio." } },
  { icon: "⏱️", title: "Segui il servizio", page: "map", target: "fleet-btn", check: (s) => s.completed,
    text: { map: "L'ambulanza è partita! Tocca il pulsante 🚑 qui a sinistra per vedere il conto alla rovescia. Quando il servizio finisce guadagni soldi e ⭐ reputazione.",
            other: "Torna sulla mappa per seguire la tua ambulanza." } },
  { icon: "🔧", title: "Gasolio, gomme e officina", page: "officina",
    text: { officina: "Ogni mezzo consuma gasolio, gomme e pezzi, e ogni 15.000 km va revisionato. Qui vedi tutto: se un mezzo si guasta resta fermo finché non lo ripari. Il gasolio lo compri nel Garage, al Benzinaio. Premi Avanti.",
            other: "I mezzi si consumano: gasolio, gomme, pezzi e revisione. Diamo un'occhiata all'Officina." } },
  { icon: "🎯", title: "Obiettivi e premi", page: "obiettivi",
    text: { obiettivi: "Ogni giorno e ogni settimana hai degli obiettivi: completali e ritira il premio qui. La ⭐ reputazione che guadagni porta anche donazioni dei cittadini ogni mattina. Premi Avanti.",
            other: "Ci sono obiettivi giornalieri e settimanali con premi in denaro. Vediamoli." } },
  { icon: "🤖", title: "La modalità automatica", page: "automatico",
    text: { automatico: "Quando avrai più mezzi puoi far lavorare le sedi da sole, anche mentre non giochi: scegli i codici da seguire e i turni delle sedi. Si paga a ore. Premi Avanti.",
            other: "Ultima cosa: la modalità automatica, per far lavorare le sedi mentre sei via." } },
  { icon: "🎉", title: "Sei pronto!", page: "map",
    text: { other: "Ora sai le basi. Nel menu ☰ trovi tutto il resto: alleanze, aste, classifica, statistiche. Puoi rivedere il tutorial dal menu «Tutorial». Buon soccorso! 🚑" } },
];

export default function TutorialCoach({ page, restartKey = 0 }: { page: TutPage; restartKey?: number }) {
  const router = useRouter();
  const [st, setSt] = useState<State | null>(null);
  const [mini, setMini] = useState(false);
  const [ring, setRing] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const scrolled = useRef<string>("");
  // si nasconde mentre è aperto un pannello che gli starebbe sotto (es. il servizio con il pulsante Invia)
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setCovered(!!document.querySelector("[data-tut-hide]")), 500);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("my_tutorial_state");
    if (data) setSt(data as State);
  }, []);
  const doneRef = useRef(false);
  useEffect(() => { doneRef.current = !!st?.done; }, [st?.done]);
  useEffect(() => {
    load();
    // a tutorial finito non interroga più il server (alleggerisce il database)
    const t = setInterval(() => { if (!doneRef.current && document.visibilityState === "visible") load(); }, 20_000);
    return () => clearInterval(t);
  }, [load, restartKey]);

  const save = useCallback(async (step: number, done: boolean) => {
    setSt((s) => (s ? { ...s, step, done } : s));
    await supabase.rpc("tutorial_set", { p_step: step, p_done: done });
  }, []);

  // passo attuale: quello salvato, saltando quelli già fatti davvero
  let idx = st ? Math.min(st.step, STEPS.length - 1) : 0;
  if (st) while (idx < STEPS.length - 1 && STEPS[idx].check?.(st)) idx++;
  const step = STEPS[idx];
  useEffect(() => { if (st && !st.done && idx !== st.step) save(idx, false); }, [st, idx, save]);

  // anello lampeggiante sul pulsante da toccare
  useEffect(() => {
    if (!st || st.done || mini || !step.target || step.page !== page) { setRing(null); return; }
    const find = () => {
      const el = document.querySelector(`[data-tut="${step.target}"]`) as HTMLElement | null;
      if (!el) { setRing(null); return; }
      if (scrolled.current !== step.target) { scrolled.current = step.target!; el.scrollIntoView({ block: "center", behavior: "smooth" }); }
      const r = el.getBoundingClientRect();
      setRing(r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null);
    };
    find();
    const t = setInterval(find, 400);
    return () => clearInterval(t);
  }, [st, step, page, mini]);

  if (!st || st.done || covered) return null;

  const here = step.page === page;
  const text = (here && step.text[step.page]) || step.text.other;
  const manual = !step.check;
  const last = idx === STEPS.length - 1;

  if (mini) {
    return (
      <button className="fs-coach-mini" onClick={() => setMini(false)}>📖 Tutorial {idx + 1}/{STEPS.length}</button>
    );
  }

  return (
    <>
      {ring && <div className="fs-coach-ring" style={{ left: ring.x - 6, top: ring.y - 6, width: ring.w + 12, height: ring.h + 12 }} />}
      <div className="fs-coach" role="dialog" aria-label="Tutorial">
        <div className="fs-coach-top">
          <span className="fs-coach-ico">{step.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="fs-coach-count">Tutorial · passo {idx + 1} di {STEPS.length}</div>
            <div className="fs-coach-title">{step.title}</div>
          </div>
          <button className="fs-coach-x" title="Riduci" onClick={() => setMini(true)}>–</button>
          <button className="fs-coach-x" title="Chiudi il tutorial" onClick={() => save(idx, true)}>✕</button>
        </div>
        <div className="fs-coach-bar"><span style={{ width: `${((idx + (st.completed && idx === 4 ? 1 : 0)) / (STEPS.length - 1)) * 100}%` }} /></div>
        <p className="fs-coach-text">
          {text}
          {idx === 5 && st.first_reward ? <><br /><strong>Il tuo primo servizio ti ha fatto guadagnare {Number(st.first_reward).toLocaleString("it-IT")} €.</strong></> : null}
        </p>
        <div className="fs-coach-actions">
          {idx > 0 && <button className="fs-coach-back" onClick={() => save(Math.max(0, idx - 1), false)}>‹</button>}
          {!here && <button className="fs-coach-go" onClick={() => router.push(HREF[step.page])}>Vai a {PAGE_NAME[step.page]} ›</button>}
          {here && manual && (
            <button className="fs-coach-go" onClick={() => (last ? save(idx, true) : save(idx + 1, false))}>
              {last ? "Inizia a giocare 🚑" : "Avanti ›"}
            </button>
          )}
          {here && !manual && <span className="fs-coach-wait">⏳ Ti aspetto: vado avanti da solo quando l&apos;hai fatto</span>}
        </div>
      </div>
      <style>{`
        .fs-coach { position: fixed; z-index: 3500; left: 50%; transform: translateX(-50%); bottom: calc(14px + env(safe-area-inset-bottom));
          width: min(440px, calc(100% - 20px)); background: #fff; color: #111; border-radius: 18px; box-shadow: 0 18px 50px rgba(0,0,0,.35);
          border: 2px solid #2563EB; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; animation: fs-coach-in .3s ease; }
        .fs-coach-top { display: flex; align-items: center; gap: 10px; padding: 12px 12px 6px 14px; }
        .fs-coach-ico { font-size: 30px; }
        .fs-coach-count { font-size: 11px; font-weight: 700; color: #2563EB; text-transform: uppercase; letter-spacing: .04em; }
        .fs-coach-title { font-weight: 800; font-size: 16px; }
        .fs-coach-x { border: none; background: #f1f5f9; border-radius: 8px; width: 28px; height: 28px; cursor: pointer; font-weight: 800; color: #475569; }
        .fs-coach-bar { height: 4px; background: #e2e8f0; margin: 0 14px; border-radius: 2px; overflow: hidden; }
        .fs-coach-bar > span { display: block; height: 100%; background: #2563EB; transition: width .4s; }
        .fs-coach-text { margin: 10px 14px 0; font-size: 14px; line-height: 1.45; color: #334155; }
        .fs-coach-actions { display: flex; gap: 8px; align-items: center; padding: 12px 14px 14px; flex-wrap: wrap; }
        .fs-coach-go { flex: 1; border: none; background: #2563EB; color: #fff; font-weight: 800; border-radius: 12px; padding: 10px 14px; cursor: pointer; font-size: 14px; }
        .fs-coach-back { border: none; background: #f1f5f9; border-radius: 12px; padding: 10px 14px; cursor: pointer; font-weight: 800; }
        .fs-coach-wait { flex: 1; font-size: 12.5px; color: #64748B; }
        .fs-coach-mini { position: fixed; z-index: 3500; right: 12px; bottom: calc(14px + env(safe-area-inset-bottom)); border: none; cursor: pointer;
          background: #2563EB; color: #fff; font-weight: 800; border-radius: 999px; padding: 10px 14px; box-shadow: 0 8px 22px rgba(37,99,235,.45); }
        .fs-coach-ring { position: fixed; z-index: 3400; pointer-events: none; border: 3px solid #2563EB; border-radius: 14px;
          box-shadow: 0 0 0 4000px rgba(15,23,42,.18); animation: fs-coach-pulse 1.2s ease-in-out infinite; }
        @keyframes fs-coach-pulse { 0%,100% { border-color: #2563EB; transform: scale(1) } 50% { border-color: #60A5FA; transform: scale(1.03) } }
        @keyframes fs-coach-in { from { opacity: 0; transform: translate(-50%, 20px) } to { opacity: 1; transform: translate(-50%, 0) } }
      `}</style>
    </>
  );
}
