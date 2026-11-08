"use client";

import { useState } from "react";

// Chiave in localStorage: segna che il tutorial è già stato visto su questo dispositivo.
export const TUTORIAL_KEY = "fs_tutorial_done_v1";

type Step = { icon: string; title: string; body: string };

const STEPS: Step[] = [
  { icon: "🚑", title: "Benvenuto in FantaSoccorritore!",
    body: "Guidi la tua associazione di soccorso: ambulanze, volontari e missioni 118 in tempo reale sulla mappa. Ti spiego le basi in pochi passaggi." },
  { icon: "🗺️", title: "La mappa e i servizi",
    body: "I puntini colorati sono i servizi da coprire: 🟢 verde = non urgente, 🟡 giallo e 🔴 rosso = emergenze. Tocca un servizio per aprirlo e mandare un mezzo." },
  { icon: "🏥", title: "Compra un'ambulanza",
    body: "Apri il menu in alto a sinistra e vai nel Garage: compra la tua prima ambulanza. Senza un mezzo non puoi partire!" },
  { icon: "🚗", title: "Ogni mezzo ha il suo lavoro",
    body: "🚑 Ambulanze: emergenze 118. 🚗 Ordinarie: dimissioni e servizi ordinari. Passi lunghi: trasferimenti tra ospedali. 🩺 Automedica: solo gialli e rossi. ⛵ Barche: soccorsi in mare. 🔥 AIB: incendi boschivi. Se un mezzo non può partire, nel servizio vedi scritto il perché." },
  { icon: "👥", title: "La tua squadra",
    body: "Nella Squadra apri le buste e ottieni volontari: autisti, soccorritori, medici e bagnini (questi solo per le barche). Ogni servizio chiede i ruoli giusti a bordo." },
  { icon: "🤝", title: "Alleanze e trasferimenti",
    body: "Collabora con altre associazioni, scambia sedi, mezzi e volontari, e guadagna con i trasferimenti tra ospedali." },
  { icon: "🤖", title: "Modalità automatica",
    body: "Attivala per far lavorare le tue sedi da sole mentre sei via: scegli quali codici seguire e quante sedi mettere in automatico." },
  { icon: "🎯", title: "Obiettivi, meteo e stagioni",
    body: "Ogni giorno e ogni settimana hai obiettivi con premio. Il meteo cambia ogni 3 ore: col brutto tempo e di notte i servizi pagano di più. Ogni mese c'è una nuova stagione in Classifica, con titoli per i migliori. I volontari salgono di livello facendo servizi." },
  { icon: "🎉", title: "Sei pronto!",
    body: "Trovi tutto nel menu in alto a sinistra. Puoi rivedere questo tutorial quando vuoi dalla voce “Tutorial”. Buon soccorso!" },
];

export default function Tutorial({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="fs-tut-bg" role="dialog" aria-modal="true" aria-label="Tutorial">
      <div className="fs-tut-card">
        <button className="fs-tut-skip" onClick={onClose} aria-label="Salta il tutorial">Salta ✕</button>

        <div className="fs-tut-hero">
          <div className="fs-tut-ico">{step.icon}</div>
        </div>

        <div className="fs-tut-body">
          <h2 className="fs-tut-title">{step.title}</h2>
          <p className="fs-tut-text">{step.body}</p>

          <div className="fs-tut-dots">
            {STEPS.map((_, k) => (
              <span key={k} className={`fs-tut-dot${k === i ? " on" : ""}`} onClick={() => setI(k)} />
            ))}
          </div>

          <div className="fs-tut-actions">
            {i > 0
              ? <button className="fs-tut-back" onClick={() => setI(i - 1)}>← Indietro</button>
              : <button className="fs-tut-back ghost" onClick={onClose}>Salta</button>}
            <button className="fs-tut-next" onClick={() => (last ? onClose() : setI(i + 1))}>
              {last ? "Inizia a giocare 🚑" : "Avanti →"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .fs-tut-bg { position: fixed; inset: 0; z-index: 4000; display: flex; align-items: center; justify-content: center;
          padding: 16px; background: rgba(15,23,42,.55); backdrop-filter: blur(4px); animation: fs-tut-fade .25s ease; }
        .fs-tut-card { position: relative; width: min(420px, 100%); background: #fff; border-radius: 20px; overflow: hidden;
          box-shadow: 0 24px 70px rgba(0,0,0,.45); animation: fs-tut-rise .3s cubic-bezier(.2,.8,.2,1); }
        .fs-tut-skip { position: absolute; top: 12px; right: 12px; z-index: 2; border: none; cursor: pointer;
          background: rgba(255,255,255,.25); color: #fff; font-weight: 800; font-size: 12px; padding: 6px 10px; border-radius: 999px; }
        .fs-tut-skip:hover { background: rgba(255,255,255,.4); }
        .fs-tut-hero { height: 128px; display: flex; align-items: center; justify-content: center;
          background: radial-gradient(120% 140% at 50% -20%, #FDBA74 0%, #F97316 45%, #C2410C 100%); }
        .fs-tut-ico { font-size: 62px; filter: drop-shadow(0 6px 10px rgba(0,0,0,.25)); animation: fs-tut-pop .4s ease; }
        .fs-tut-body { padding: 18px 20px 20px; }
        .fs-tut-title { margin: 0 0 8px; font-size: 20px; font-weight: 800; color: #111827; }
        .fs-tut-text { margin: 0; font-size: 14.5px; line-height: 1.5; color: #475569; min-height: 86px; }
        .fs-tut-dots { display: flex; justify-content: center; gap: 7px; margin: 14px 0 16px; }
        .fs-tut-dot { width: 8px; height: 8px; border-radius: 999px; background: #e2e8f0; cursor: pointer; transition: all .2s; }
        .fs-tut-dot.on { width: 22px; background: #F97316; }
        .fs-tut-actions { display: flex; gap: 10px; align-items: center; }
        .fs-tut-back { flex-shrink: 0; border: none; background: #f1f5f9; color: #334155; font-weight: 700; font-size: 14px;
          padding: 11px 14px; border-radius: 12px; cursor: pointer; }
        .fs-tut-back:hover { background: #e2e8f0; }
        .fs-tut-back.ghost { background: transparent; color: #94a3b8; }
        .fs-tut-next { flex: 1; border: none; background: linear-gradient(135deg,#F97316,#C2410C); color: #fff; font-weight: 800;
          font-size: 15px; padding: 12px 14px; border-radius: 12px; cursor: pointer; box-shadow: 0 6px 16px rgba(249,115,22,.4); }
        .fs-tut-next:hover { filter: brightness(1.05); }
        @keyframes fs-tut-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fs-tut-rise { from { opacity: 0; transform: translateY(16px) scale(.98) } to { opacity: 1; transform: none } }
        @keyframes fs-tut-pop { 0% { transform: scale(.5); opacity: 0 } 70% { transform: scale(1.12) } 100% { transform: scale(1) } }
      `}</style>
    </div>
  );
}
