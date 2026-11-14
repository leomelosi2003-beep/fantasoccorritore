// Novità del gioco: ogni aggiornamento nuovo va IN CIMA, con un id nuovo (data + lettera).
// Il pallino nel menu e l'avviso sulla mappa compaiono finché il giocatore non apre /novita.
export type Novita = { id: string; date: string; title: string; items: string[] };

export const NOVITA: Novita[] = [
  {
    id: "2026-11-14a", date: "14 novembre 2026", title: "Sedi: nuovi prezzi e affitto",
    items: [
      "🏠 Nuovi prezzi delle sedi: 300.000 € la seconda, poi 150.000 € in più per ogni sede, al massimo 3.000.000 €.",
      "🔑 Ora puoi anche affittare una sede: niente spesa grossa, paghi un affitto al giorno (addebitato ogni ora).",
      "💰 Una sede in affitto si può riscattare quando vuoi (diventa tua) oppure restituire. Se non paghi l'affitto, i mezzi di quella sede restano fermi finché non saldi.",
    ],
  },
  {
    id: "2026-11-13c", date: "13 novembre 2026", title: "Officina più semplice, presidi e uso dei mezzi",
    items: [
      "🔧 Officina rifatta: in alto vedi subito cosa c'è da sistemare (guasti, revisioni, gomme, pezzi, carrozzeria) e con un tasto sistemi tutto quello che si può.",
      "🧰 Nuova scheda Presidi in Officina: togli i presidi da un'ambulanza, mettili in magazzino, spostali su un'altra o aggiornali (es. DAE → monitor). Quello vecchio torna in magazzino.",
      "🚑 Nel Garage scegli tu, gratis, se un'ambulanza fa solo emergenze o solo ordinari. I passi lunghi possono fare trasferimenti + emergenze.",
      "🆕 Questa sezione Novità: a ogni aggiornamento trovi qui un riassunto.",
    ],
  },
  {
    id: "2026-11-13b", date: "13 novembre 2026", title: "Nuovo server più veloce",
    items: [
      "⚡ Il gioco ora gira su un server dedicato: più veloce e senza i blocchi degli ultimi giorni. Il vecchio link porta qui da solo.",
      "🔑 Se hai dimenticato la password, scrivi all'amministratore che ti dà un accesso provvisorio.",
    ],
  },
  {
    id: "2026-11-13a", date: "13 novembre 2026", title: "Gemellaggio: premi divisi",
    items: [
      "🤝 I servizi fatti dai mezzi di una sede condivisa tra gemelli dividono il premio a metà tra le due associazioni.",
    ],
  },
  {
    id: "2026-11-12a", date: "12 novembre 2026", title: "Officina, limite km, donazioni e tutorial",
    items: [
      "🔧 Officina: gomme estive/invernali/4 stagioni, pezzi che si consumano, guasti, carrozzeria e segnalazioni dei volontari.",
      "📏 Revisione ogni 15.000 km; a 250.000 km le ambulanze passano per sempre agli ordinari.",
      "💝 Ogni mattina i cittadini donano in base alla tua reputazione.",
      "📖 Tutorial guidato passo passo per chi inizia (menu → Tutorial).",
    ],
  },
];

export const LATEST_NOVITA = NOVITA[0]?.id ?? "";
const KEY = "fs_novita_seen";
export function novitaUnseen(): boolean {
  try { return !!LATEST_NOVITA && localStorage.getItem(KEY) !== LATEST_NOVITA; } catch { return false; }
}
export function markNovitaSeen() {
  try { localStorage.setItem(KEY, LATEST_NOVITA); } catch {}
}
