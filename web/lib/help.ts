// Spiegazioni semplici di ogni pagina, aperte dal tasto "?" (in basso a destra).
export type Help = { title: string; sub: string; steps: [string, string][]; links?: [string, string][] };

export const HELP: Record<string, Help> = {
  "/": {
    title: "Come si gioca", sub: "Sei il responsabile di un'associazione di soccorso",
    steps: [
      ["🗺️", "Sulla mappa le gocce colorate sono i servizi da fare: rosso = urgentissimo, giallo = urgente, verde/bianco = tranquillo."],
      ["👆", "Tocca una goccia, scegli un'ambulanza ferma in sede e l'equipaggio, poi premi Invia: il mezzo parte e lo vedi muoversi."],
      ["💶", "Quando il servizio finisce incassi i soldi e la reputazione ⭐. Chi arriva prima vince il servizio."],
      ["🦺", "I rombi gialli sono missioni di protezione civile (dispersi, allagamenti…): ci vanno i camion e furgoni maxi con i moduli."],
      ["🏠", "I quadrati sono le sedi: lì stanno i mezzi. Puoi mandare mezzi entro 25 km dalla loro sede (maxi e incendi da ovunque)."],
      ["☰", "Dal menu (tasto arancione in alto a sinistra) trovi garage, squadra, officina, sedi e tutto il resto."],
    ],
    links: [["🚑 Garage", "/garage"], ["👥 Squadra", "/squadra"], ["🎯 Obiettivi", "/obiettivi"], ["🆕 Novità", "/novita"]],
  },
  "/garage": {
    title: "Garage", sub: "I tuoi mezzi e il negozio dei mezzi nuovi",
    steps: [
      ["🛒", "«Compra un mezzo»: scegli il tipo (ambulanza, ordinaria, automedica, moto, barca, AIB, maxi), il modello e la sede dove metterlo."],
      ["🎚️", "Sulla scheda di ogni mezzo scegli l'uso: emergenze, ordinari o trasferimenti."],
      ["⛽", "Tieni d'occhio carburante, usura e km: ogni 15.000 km serve la revisione."],
      ["↔️", "Puoi spostare un mezzo in un'altra sede o venderlo."],
    ],
    links: [["🔧 Officina", "/officina"], ["🛒 Presidi", "/negozio"], ["🏠 Sedi", "/sedi"]],
  },
  "/officina": {
    title: "Officina", sub: "Riparazioni, revisioni, gomme e presidi",
    steps: [
      ["🔴", "In alto vedi cosa c'è da sistemare (guasti, revisioni, gomme, carrozzeria): tocca un riquadro per vedere i mezzi."],
      ["✅", "«Sistema tutto» ripara in un colpo tutti i mezzi fermi in sede."],
      ["🛞", "Nella scheda Gomme compri le gomme e le monti a una sede intera."],
      ["🧰", "Nella scheda Presidi monti, togli e sposti barelle, monitor, defibrillatori e i moduli maxi."],
    ],
    links: [["🚑 Garage", "/garage"], ["🛒 Negozio presidi", "/negozio"]],
  },
  "/squadra": {
    title: "Squadra", sub: "I tuoi volontari",
    steps: [
      ["🃏", "Ogni volontario è una carta con un ruolo: autista, soccorritore, infermiere, medico, bagnino, AIB."],
      ["🎁", "Apri le buste per trovare volontari nuovi; le carte rare (epiche, leggendarie) fanno arrivare prima i mezzi."],
      ["😴", "Dopo un servizio i volontari riposano: più ne hai, più ambulanze puoi far partire insieme."],
      ["📈", "Con l'esperienza salgono di livello e fanno guadagnare di più."],
    ],
    links: [["📢 Ti manca personale?", "/personale"], ["🗺️ Mappa", "/"]],
  },
  "/sedi": {
    title: "Sedi", sub: "Dove stanno i tuoi mezzi",
    steps: [
      ["🏗️", "Puoi comprare una sede nuova o prenderla in affitto (si paga ogni giorno)."],
      ["🅿️", "Ogni sede ha un numero di posti per i mezzi: amplialo con «Personalizza»."],
      ["☀️", "Con «Personalizza» compri migliorie: pannelli solari e bar fanno guadagnare ogni ora, la sala relax fa riposare prima i volontari."],
      ["🤝", "Le sedi condivise in gemellaggio le possono migliorare tutte e due le associazioni."],
    ],
    links: [["🚑 Garage", "/garage"], ["🔗 Gemellaggio", "/gemellaggio"]],
  },
  "/negozio": {
    title: "Negozio presidi", sub: "L'attrezzatura da montare sui mezzi",
    steps: [
      ["🩺", "Tocca un presidio, scegli il mezzo e premi «Compra e monta»."],
      ["⬆️", "I presidi migliori fanno salire la certificazione del mezzo: così può fare i servizi più gravi."],
      ["🆘", "In fondo ci sono i moduli per le maxi emergenze (solo per camion e furgone maxi)."],
    ],
    links: [["🔧 Officina → Presidi", "/officina"]],
  },
  "/automatico": {
    title: "Modalità automatica", sub: "Il gioco manda i mezzi al posto tuo",
    steps: [
      ["🤖", "Scegli le sedi e gli orari: in quei turni i mezzi partono da soli verso i servizi vicini."],
      ["💶", "Costa un tanto all'ora per sede aperta: lo vedi prima di attivarla."],
      ["🔧", "Nelle sedi in automatico guasti e revisioni si sistemano da soli."],
    ],
  },
  "/obiettivi": {
    title: "Obiettivi", sub: "Sfide del giorno e della settimana",
    steps: [
      ["🎯", "Ogni giorno hai 3 obiettivi e ogni settimana 2: completali facendo servizi."],
      ["🎁", "Quando uno è pronto premi «Riscuoti» per prendere il premio."],
    ],
  },
  "/alleanza/mia": {
    title: "La mia alleanza", sub: "Chat, fondo comune e alleati",
    steps: [
      ["💬", "La chat dell'alleanza la vedono solo gli aderenti e si cancella ogni lunedì."],
      ["💰", "Ogni domenica alle 23 il fondo comune si divide in parti uguali tra tutte le associazioni."],
      ["🤝", "Puoi prestare ambulanze e volontari agli alleati."],
    ],
  },
  "/alleanza": {
    title: "Alleanza", sub: "Gioca in squadra con altre associazioni",
    steps: [
      ["🤝", "Crea un'alleanza o entra in una esistente con un invito."],
      ["🔁", "Tra alleati potete prestarvi mezzi e volontari."],
      ["🏅", "Insieme raggiungete gli obiettivi di squadra (bronzo, argento, oro) e nelle maxi avete un bonus."],
    ],
    links: [["🔗 Gemellaggio", "/gemellaggio"], ["💼 Offerte", "/offerte"]],
  },
  "/gemellaggio": {
    title: "Gemellaggio", sub: "Un'amicizia stretta tra due associazioni",
    steps: [
      ["🔗", "Chiedi il gemellaggio a un'associazione: se accetta potete regalarvi soldi, mezzi e sedi."],
      ["🏠", "Una sede condivisa la usate tutti e due: mezzi, migliorie e premi si dividono a metà."],
    ],
  },
  "/offerte": {
    title: "Offerte e acquisti", sub: "Compra o scambia con le altre associazioni",
    steps: [
      ["💼", "Fai un'offerta: un prezzo più le sedi, i mezzi o i volontari che vuoi prendere o dare."],
      ["🔁", "L'altro può accettare, rifiutare o fare una controfferta (massimo 6 giri)."],
    ],
  },
  "/usate": {
    title: "Usato e aste", sub: "Mezzi di seconda mano",
    steps: [
      ["🏷️", "Metti all'asta i mezzi che non ti servono o compra quelli degli altri."],
      ["⚠️", "Controlla le condizioni: guasti, gomme e km abbassano il valore."],
    ],
  },
  "/personale": {
    title: "Richieste di personale", sub: "Quando ti mancano volontari",
    steps: [
      ["📢", "Scegli quanti volontari ti servono e avvisa tutte le associazioni."],
      ["🙌", "Se qualcuno ha bisogno, premi «Aiuta» e prestagli i tuoi volontari liberi per qualche ora."],
    ],
  },
  "/classifica": { title: "Classifica", sub: "Chi sta andando meglio", steps: [["🏆", "Classifica generale, della stagione (si chiude ogni mese) e delle rivelazioni."], ["⭐", "Si sale facendo servizi: i codici rossi, le maxi e gli incendi valgono di più."]] },
  "/finanze": { title: "Entrate e uscite", sub: "Dove vanno i tuoi soldi", steps: [["📊", "Qui vedi ogni entrata (servizi, donazioni, migliorie) e ogni spesa (mezzi, carburante, riparazioni, affitti)."]] },
  "/fatturato": { title: "Fatturato sedi", sub: "Quanto rende ogni sede", steps: [["🏢", "Confronta le sedi: tieni quelle che rendono e migliora quelle ferme."]] },
  "/statistiche": { title: "Statistiche", sub: "I tuoi numeri giorno per giorno", steps: [["📈", "Servizi fatti, incassi e tempi di arrivo degli ultimi giorni."]] },
  "/password": { title: "Cambia password", sub: "Scegli una nuova password per il tuo account", steps: [["🔑", "Scrivi due volte la nuova password e salva: dal prossimo accesso usi quella."]] },
  "/notizie": { title: "Notizie", sub: "Cosa succede nel mondo del gioco", steps: [["📰", "Maxi emergenze, incendi, record e novità delle altre associazioni."]] },
  "/novita": { title: "Novità del gioco", sub: "Gli ultimi aggiornamenti", steps: [["🆕", "Ogni volta che il gioco cambia trovi qui un riassunto semplice."]] },
  "/trasferimenti": { title: "Trasferimenti", sub: "Viaggi da un ospedale all'altro", steps: [["🔁", "Li fanno solo i mezzi a passo lungo: pagano 4.000 € più 130 € al km."], ["🩺", "I trasferimenti urgenti vogliono un medico a bordo."]] },
  "/associazione": { title: "Associazione", sub: "Nome, stemma e colori", steps: [["🎨", "Cambia lo stemma e le informazioni della tua associazione."]] },
};

export function helpFor(path: string): Help | null {
  if (HELP[path]) return HELP[path];
  const k = Object.keys(HELP).filter((p) => p !== "/" && path.startsWith(p)).sort((a, b) => b.length - a.length)[0];
  return k ? HELP[k] : null;
}
