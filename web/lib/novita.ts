// Novità del gioco: ogni aggiornamento nuovo va IN CIMA, con un id nuovo (data + lettera).
// Il pallino nel menu e l'avviso sulla mappa compaiono finché il giocatore non apre /novita.
export type Novita = { id: string; date: string; title: string; items: string[] };

export const NOVITA: Novita[] = [
  {
    id: "2026-11-14j", date: "14 novembre 2026", title: "Sedi gemellate con due loghi",
    items: [
      "🤝 Le sedi condivise in gemellaggio ora mostrano sulla mappa i loghi di tutte e due le associazioni, anche nel riquadro della sede.",
      "🏗️ Anche il gemello può ampliare il garage di una sede condivisa, comprare le migliorie e cambiarle colore (in Sedi le trovi sotto le tue).",
      "🚑 Ognuno può comprare o spostare i propri mezzi nella sede condivisa (in Garage la sede ha il 🤝) e usare quelli fermi dell'altro; le entrate delle migliorie si dividono a metà.",
      "↩️ Se la condivisione o il gemellaggio finisce, i mezzi dell'ospite tornano da soli alla sua sede principale.",
    ],
  },
  {
    id: "2026-11-14i", date: "14 novembre 2026", title: "Richieste di personale",
    items: [
      "📢 Sei a corto di volontari per far partire le ambulanze? Menu → Richieste di personale: scegli chi ti serve (autisti, soccorritori, medici…) e avvisi tutte le associazioni.",
      "🔔 Gli altri vedono l'avviso sulla mappa (e la notifica del browser, se attiva) e con «Aiuta» ti prestano volontari per 1-8 ore, anche se non siete alleati.",
      "🙌 Quando qualcuno ti aiuta ti arriva l'avviso e i volontari li trovi subito in Squadra.",
    ],
  },
  {
    id: "2026-11-14h", date: "14 novembre 2026", title: "Niente più tassa patrimoniale",
    items: ["💰 La tassa patrimoniale oraria è stata eliminata: il patrimonio non viene più tassato. Resta la trattenuta sui premi dei servizi."],
  },
  {
    id: "2026-11-14g", date: "14 novembre 2026", title: "Incendi: la scena dal vivo",
    items: [
      "🔥 Nel popup di un incendio c'è «Guarda l'incendio dal vivo»: tre scenari in base alla gravità (sterpaglie, bosco, interfaccia con le case).",
      "🚒 Le autobotti e i pickup AIB arrivano dalla strada, i volontari stendono il naspo e spengono il fronte; quando finiscono l'acqua vanno a ricaricare in sede e tornano (come succede davvero nel gioco).",
      "🚙 Nella scena degli incendi i mezzi hanno la forma del modello vero (D-Daily doppia cabina con modulo, pickup Ranger e Scorpio con naspo) e si mettono in cerchio attorno al fuoco.",
      "⏱️ Nella scena i mezzi entrano solo negli ultimi secondi del viaggio, così arrivano sul posto insieme alla mappa principale; prima sono nell'elenco «In arrivo» con il conto alla rovescia.",
      "📊 In alto intensità, gravità, mezzi che spengono e quanti ne servono; il fronte si allarga o si restringe con l'intensità. Negli incendi gravi arriva anche l'elicottero con la benna.",
    ],
  },
  {
    id: "2026-11-14f", date: "14 novembre 2026", title: "Mezzi per le maxi emergenze e moduli",
    items: [
      "🚛 Nel Garage, tipo «Maxi emergenze»: il camion S-Scanix Maxi (3 moduli) e il furgone comando D-Daily Comando Maxi (2 moduli). Vanno solo sulle maxi emergenze.",
      "🧰 I moduli si comprano nel Negozio presidi (sezione «Moduli per le maxi emergenze») o in Officina → Presidi: ⛺ PMA (tenda pneumatica, i feriti vanno al PMA invece che in ospedale, +60%), ⚡ unità logistica (+25%), 🐕 ricerca e soccorso/cinofila (+30%), 🛸 unità dronistica (+30%).",
      "🎬 Nella scena dal vivo si vedono: tenda PMA, gazebo e torre faro, cani che cercano tra le macerie, droni con la termocamera.",
    ],
  },
  {
    id: "2026-11-14e", date: "14 novembre 2026", title: "Nuovi ospedali",
    items: [
      "🏥 Aggiunti gli ospedali di Castelnuovo di Garfagnana, Pontremoli e La Spezia (Sant'Andrea): le ambulanze di quelle zone ora scaricano lì.",
    ],
  },
  {
    id: "2026-11-14d", date: "14 novembre 2026", title: "Maxi senza PMA: spola con l'ospedale",
    items: [
      "🏥 Se alla maxi emergenza non c'è un PMA, le ambulanze caricano il ferito, escono dalla scena e lo portano all'ospedale più vicino.",
      "🗺️ Sulla mappa principale le vedi viaggiare a sirene accese verso l'ospedale, consegnare il ferito e tornare alla maxi.",
      "📋 Nella scena, in alto a destra, l'elenco dei mezzi fuori scena con i minuti al rientro.",
    ],
  },
  {
    id: "2026-11-14c", date: "14 novembre 2026", title: "Maxi emergenze: la scena dal vivo (prova)",
    items: [
      "🎬 Nel popup di una maxi emergenza c'è «Guarda la scena dal vivo»: la scena in stile centrale operativa, con le ambulanze che arrivano in tempo reale con la loro scia.",
      "🟠 I tuoi mezzi sono arancioni, quelli delle altre associazioni azzurri; in alto i dati della maxi (mezzi, feriti, triage).",
      "📷 Trascina per girare la scena, zoom con la rotellina o con due dita, e 4 inquadrature pronte (panoramica, dall'alto, ravvicinata, area PMA).",
      "⛺ Se un'associazione porta il PMA, le ambulanze fanno la spola portando i feriti al PMA.",
      "🚑 Modellini dettagliati (ruote, vetri, fasce, croce, lampeggianti) per ambulanza, passo lungo, automedica, moto e camion PMA.",
      "🚒 Operazioni congiunte coi Vigili del Fuoco: tagliano le lamiere e tolgono le macerie per estricare i feriti intrappolati, poi li affidano alle ambulanze; dove c'è fuoco spengono con la lancia.",
      "🎞️ Tutti più animati: braccia e gambe che si muovono, massaggio cardiaco, pompieri che tagliano, feriti che chiedono aiuto o zoppicano, porte dell'ambulanza che si aprono, cordone della polizia con curiosi che filmano.",
      "🛣️ Le ambulanze arrivano dalla strada (da quella più vicina alla loro sede), tengono la destra, e per andare al PMA o in ospedale seguono le strade.",
      "🌲 Scena più realistica: strade con la segnaletica, alberi che ondeggiano, campi e case in lontananza.",
      "🛠️ Soccorso tecnico completo: i VVF mettono i cunei, tagliano (la lamiera vibra), tolgono il pannello, poi VVF e sanitari mettono collare e tavola spinale e lo portano fuori in quattro; il coordinatore del triage gira tra i feriti; flebo, DAE e scariche del defibrillatore sui codici rossi.",
      "🩹 Feriti anche dentro la scena (nei vagoni, sotto le macerie) che chiedono aiuto; i soccorritori vanno con la barella, stabilizzano, caricano in ambulanza e portano al PMA o in ospedale.",
    ],
  },
  {
    id: "2026-11-14b", date: "14 novembre 2026", title: "Personalizza le tue sedi",
    items: [
      "⚙️ In Sedi ogni sede ha il tasto «Personalizza»: amplia il garage, metti pannelli solari, cambia la caldaia, migliora l'area volontari.",
      "🔧 Nuove migliorie: officina interna (mezzi meno usurati), centrale radio (servizi pagati di più), bar sociale (entrate ogni ora).",
      "🎨 Scegli il colore della sede: si vede sulla mappa e i colori chiari fanno risparmiare 600 €/ora.",
      "💶 Pannelli, caldaia, bar e colori chiari rendono soldi ogni ora; area volontari, officina e radio migliorano volontari e mezzi.",
    ],
  },
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
