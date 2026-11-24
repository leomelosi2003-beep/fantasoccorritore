// Novità del gioco: ogni aggiornamento nuovo va IN CIMA, con un id nuovo (data + lettera).
// Il pallino nel menu e l'avviso sulla mappa compaiono finché il giocatore non apre /novita.
export type Novita = { id: string; date: string; title: string; items: string[] };

export const NOVITA: Novita[] = [
  {
    id: "2026-11-24d", date: "24 novembre 2026", title: "🗞️ Interviste, comunicati e nuovi loghi sul FantaGiornale 24",
    items: ["Ogni associazione può pubblicare un comunicato stampa (uno ogni 6 ore) con «✍️ Scrivi un comunicato».",
            "Ogni giorno il direttore chiede un'intervista a qualche associazione: arriva un avviso sulla mappa, si risponde alle domande entro 48 ore e l'intervista esce in prima pagina.",
            "Nuova rubrica «Nuovi loghi» con le associazioni che hanno cambiato logo."],
  },
  {
    id: "2026-11-24c", date: "24 novembre 2026", title: "🖼️ Banner: foto rimpicciolibile",
    items: ["Nel ritaglio del banner la foto ora si può rimpicciolire quanto vuoi (anche «⤢ Tutta» per vederla intera): lo spazio intorno si riempie con la foto sfocata o con un colore a scelta."],
  },
  {
    id: "2026-11-24b", date: "24 novembre 2026", title: "⛽ Pieno automatico sistemato",
    items: ["Con la cisterna automatica accesa i mezzi fermi in sede ora fanno il pieno ogni 2 minuti: prima a volte rientravano dal servizio e restavano a secco anche con la cisterna piena."],
  },
  {
    id: "2026-11-24a", date: "24 novembre 2026", title: "📰 Esce il FantaGiornale 24",
    items: ["Le Notizie diventano un vero giornale: prima pagina con l'ultim'ora (maxi emergenze e incendi), i numeri della giornata, le livree nuove con le foto, le sedi appena aperte, eventi e partite, la corsa al titolo del mese, i nuovi arrivati e la cronaca dal territorio."],
  },
  {
    id: "2026-11-22i", date: "22 novembre 2026", title: "🏀 Punteggio reale delle partite",
    items: ["Negli eventi delle partite in alto c'è il punteggio vero, preso dalla Lega Basket e aggiornato ogni 2 minuti; al Modigliani compare anche sul tabellone sopra l'ingresso."],
  },
  {
    id: "2026-11-22h", date: "22 novembre 2026", title: "🏟️ Modigliani Forum per tutti gli eventi",
    items: ["Ogni evento al Modigliani Forum mostra la cupola del palazzetto. Partita: tifosi amaranto, tabellone col punteggio, fari bianchi e cori. Concerto: luci colorate e note. Spettacolo: luce calda e 🎭."],
  },
  {
    id: "2026-11-22g", date: "22 novembre 2026", title: "🎨 Premi e spareggio del concorso livree",
    items: ["Le 3 livree più votate del mese vincono 🥇 1.000.000 €, 🥈 500.000 € e 🥉 250.000 €.",
            "Se c'è un pareggio che decide il podio parte uno spareggio di 24 ore: arriva un avviso a tutti e in Classifica → 🎨 Livree si sceglie la più bella tra quelle a pari voti. Le livree senza voti restano fuori."],
  },
  {
    id: "2026-11-22f", date: "22 novembre 2026", title: "🎁 Premi di stagione e premi alleanza",
    items: ["Classifiche Stagione, Reputazione e Rivelazione: a fine mese premiati i primi 10 di ognuna con 20, 15, 12, 10, 8, 6, 5, 4, 3 e 2 milioni.",
            "Classifica Alleanze: premi solo alle prime 3, a ogni membro: 🥇 30 milioni + 2 ambulanze con kit completo, 🥈 5 milioni + 1 motorino, 🥉 1 milione."],
  },
  {
    id: "2026-11-22d", date: "22 novembre 2026", title: "🎁 Premi alleanza a testa",
    items: ["I premi delle alleanze migliori ora vanno interi a ogni membro: 🥇 30 milioni, 🥈 5 milioni, 🥉 1 milione a ciascuna associazione dell'alleanza."],
  },
  {
    id: "2026-11-22c", date: "22 novembre 2026", title: "↔️ Livree: specchia e capovolgi",
    items: ["Ogni forma, testo, foto, linea o tratto di pennello si può specchiare (sinistra-destra) o capovolgere (sopra-sotto): tasti nel pannello e nella barra sotto il foglio."],
  },
  {
    id: "2026-11-22b", date: "22 novembre 2026", title: "🖌️ Livree: rotazione al grado, forme bloccate e Stella della vita",
    items: ["Rotazione precisa: −1° / +1°, numero esatto e «0°» per raddrizzare; sotto il foglio le frecce ruotano col passo scelto (1°, 5° o 15°).",
            "Nei Livelli il lucchetto 🔒 blocca una forma: non si sposta e toccando il disegno prendi quella sotto. 🔓 la sblocca.",
            "Nuove forme: Stella della vita col bastone di Esculapio (colore stella, bastone e serpente, bordo), Croce di Malta, Stella a 6 punte, Fiamma, Nuvola, Etichetta."],
  },
  {
    id: "2026-11-22a", date: "22 novembre 2026", title: "🤖 Modalità automatica a metà prezzo",
    items: ["La modalità automatica a turni ora costa la metà all'ora per ogni sede aperta."],
  },
  {
    id: "2026-11-21o", date: "21 novembre 2026", title: "🎁 Premi per le alleanze migliori",
    items: ["A fine stagione (fine mese) le prime 3 alleanze della classifica «🤝 Alleanze» vincono: 🥇 30 milioni + 2 ambulanze con kit completo, 🥈 5 milioni + 1 motorino, 🥉 1 milione.",
            "I soldi si dividono tra i membri; i mezzi vanno al membro con più punti."],
  },
  {
    id: "2026-11-21n", date: "21 novembre 2026", title: "🎶 Concerti al Modigliani Forum, classifica alleanze e multa d'uscita",
    items: ["Quando c'è un concerto al Modigliani Forum la scena dell'evento mostra la cupola del palazzetto con la cupoletta in cima e la gente che entra dai tornelli; quando inizia lo spettacolo partono luci dal tetto, note e musica che pulsa dalle porte.",
            "In Classifica c'è la scheda «🤝 Alleanze»: i punti di stagione dei membri si sommano, in cima l'alleanza con più punti. Tocca un'alleanza per vedere chi ha portato i punti.",
            "Chi esce da un'alleanza paga una multa di 25.000 € a ciascun membro che resta (se non ha i soldi non può uscire)."],
  },
  {
    id: "2026-11-21m", date: "21 novembre 2026", title: "🖌️ Editor livree più affidabile",
    items: ["Le forme e gli adesivi nuovi compaiono subito in un punto dove si vedono (prima a volte finivano sui vetri e sembravano spariti).",
            "Le parti che non si vedranno (vetri, ruote, fanali) restano in trasparenza: con 👻 le nascondi. Se una forma si vede poco esce un avviso con «📍 Spostala».",
            "Il lavoro si salva da solo come bozza: se chiudi la pagina o cade la linea, alla prossima apertura premi «Riprendi»."],
  },
  {
    id: "2026-11-21l", date: "21 novembre 2026", title: "👆 Zoom col pollice più preciso",
    items: ["La fascia per lo zoom con una mano ora è più stretta e attaccata al bordo: non parte più per sbaglio quando tocchi la mappa."],
  },
  {
    id: "2026-11-21k", date: "21 novembre 2026", title: "⚡ Bollino elettrico sempre verde",
    items: ["Sui mezzi elettrici il bollino verde col fulmine resta com'è: la livrea non lo sbianca e non ci si può dipingere sopra."],
  },
  {
    id: "2026-11-21j", date: "21 novembre 2026", title: "🗺️ Zoom a livelli per le sedi",
    items: ["Allontanando un po' lo zoom vedi solo il logo delle tue sedi, mentre quelle degli altri diventano quadratini.",
            "Allontanando ancora anche le tue sedi diventano quadratini, coi colori scelti per i pallini nel profilo. Tocca un quadratino per avvicinarti."],
  },
  {
    id: "2026-11-21i", date: "21 novembre 2026", title: "🪪 Associazione e profilo insieme",
    items: ["La pagina «Associazione» ora è il tuo profilo: con «✏️ Modifica profilo» cambi in un posto solo nome, stemma, colori, banner, presentazione e colore dei pallini sulla mappa."],
  },
  {
    id: "2026-11-21h", date: "21 novembre 2026", title: "🎨 Concorso: le livree più belle",
    items: ["In Classifica c'è la scheda «🎨 Livree»: tutte le livree dei giocatori, da guardare in grande e votare. Hai 5 voti a stagione (non alle tue) e puoi cambiarli.",
            "A fine stagione le 3 livree più votate entrano nell'albo d'oro.",
            "Il bordo del testo nelle livree ora sta solo fuori dalle lettere."],
  },
  {
    id: "2026-11-21g", date: "21 novembre 2026", title: "🎨 Livrea: comandi sotto il foglio, più forme e livree",
    items: ["Sotto il foglio di lavoro ci sono sempre i comandi per la forma scelta: frecce (passo 1, 5, 20), più grande/più piccola, ruota, sopra/sotto, duplica, elimina.",
            "I livelli si aprono sul foglio di lavoro col pulsante «🗂️ Livelli».",
            "11 forme nuove (pentagono, ottagono, croce, trapezio, parallelogramma, fulmine, anello, mezzo cerchio, luna, goccia, scudo), 4 motivi nuovi (righe oblique, pois, zig-zag, griglia) e 10 livree pronte in più (tricolore, onde, fiammata, notturna, corsa, pois, zig-zag, chevron, a blocchi, protezione civile)."],
  },
  {
    id: "2026-11-21f", date: "21 novembre 2026", title: "🔵 Mappa più leggera: pallini colorati",
    items: ["Appena allontani un po' lo zoom le ambulanze diventano pallini: la mappa è più leggera e scatta meno.",
            "Colore e bordo dei pallini dei tuoi mezzi li scegli nel tuo profilo («✏️ Banner, presentazione e pallini»): tutti li vedranno così."],
  },
  {
    id: "2026-11-21e", date: "21 novembre 2026", title: "✋ Livrea: si modifica direttamente sul disegno",
    items: ["Quando scegli una forma compaiono sul disegno: tondini negli angoli per ingrandirla, quadratini sui lati per allargarla o allungarla, ↻ per ruotarla (si ferma da solo sugli angoli giusti) e quattro frecce blu per spostarla di poco.",
            "Sopra la forma c'è una barra veloce: colore, passo delle frecce (1, 5, 20), raddrizza, duplica, porta sopra, elimina. Le linee si modificano trascinando i due estremi."],
  },
  {
    id: "2026-11-21d", date: "21 novembre 2026", title: "🎨 Editor livrea più semplice",
    items: ["Tre passi chiari: 1️⃣ scegli il mezzo (e da dove partire: una livrea pronta o un tuo lavoro), 2️⃣ disegna, 3️⃣ salva e scegli a chi va.",
            "Sulla forma scelta trovi subito colore, grandezza, rotazione e trasparenza; posizione esatta, gradiente, bordo e adesivo sono in «Altre opzioni»."],
  },
  {
    id: "2026-11-21b", date: "21 novembre 2026", title: "🏷️ Adesivi e posizione precisa",
    items: ["Nell'editor livrea c'è il menu «🏷️ Adesivi»: 118, 112, croce sanitaria, cuore e battito, DAE a bordo, etichetta, scritta, pallini riflettenti e tutte le forme. Gli adesivi stanno solo sui vetri; anche una tua foto o forma può diventare adesivo con «🪟 Adesivo sui vetri».",
            "Nel pannello della forma: frecce per spostarla di 1, 5 o 20 px, misure X/Y/larghezza/altezza da scrivere e pulsanti per centrarla."],
  },
  {
    id: "2026-11-21a", date: "21 novembre 2026", title: "🔍 Editor livrea: zoom e gradienti",
    items: ["Zoom fino al 1000% per i dettagli: rotellina del mouse (zooma dove punti), due dita sul telefono, oppure − / + / ⤢. Per spostare la vista: ✋, Spazio + trascina o due dita. C'è anche lo schermo intero ⛶ e lo sfondo chiaro, scuro o a scacchi.",
            "Gradienti da un colore all'altro con angolo a scelta, colore in mezzo opzionale, dal centro o verso il trasparente, con anteprima."],
  },
  {
    id: "2026-11-20k", date: "20 novembre 2026", title: "🖌️ Editor livrea rinnovato",
    items: ["14 forme (anche triangolo, rombo, stella, cuore, chevron, freccia, onda e sagomatura), sfumature a due colori o verso il trasparente, specchia, pannello Livelli e zoom. Dal PC anche le scorciatoie da tastiera.",
            "La livrea si applica a tutti i mezzi del modello, solo ad alcune sedi o solo ad alcuni mezzi. Si personalizzano solo i mezzi che hai comprato.",
            "Chi è in un'alleanza ha il logo dell'alleanza obbligatorio sulla livrea: si sposta e si ridimensiona, ma non si toglie."],
  },
  {
    id: "2026-11-20j", date: "20 novembre 2026", title: "🌊 Presidi su moto d'acqua e barche",
    items: ["Sulla moto d'acqua B-Jetto ci stanno solo DAE, borsoni e collari: niente cardiomonitor, massaggiatore, cucchiaio, KED, materasso, steccobende e tavole spinali.",
            "Sulle barche niente KED. Quelli già montati sono tornati nel tuo magazzino presidi, non hai perso niente."],
  },
  {
    id: "2026-11-20i", date: "20 novembre 2026", title: "🪪 Profili delle associazioni",
    items: ["Nel menu (Altre associazioni) ci sono i profili di tutte le associazioni: colori, livree, sedi con la migliore, mezzi per tipo, volontari e leggendari. Ci arrivi anche toccando un nome in Classifica.",
            "Nel tuo profilo premi «✏️ Banner e presentazione» per mettere una foto di copertina e due righe su di voi."],
  },
  {
    id: "2026-11-20h", date: "20 novembre 2026", title: "🖌️ Editor livrea",
    items: ["Nel menu, sotto La mia associazione, c'è l'«Editor livrea»: disegna la fiancata dei tuoi mezzi con strisce, cerchi, linee, pennello, scacchi, testo e i tuoi loghi o foto (max 5).",
            "Scegli a quali sedi va ogni livrea e copia un lavoro già fatto anche su un altro modello. Tutti i giocatori vedono i tuoi mezzi con la tua livrea. Consigliato dal PC, ma funziona anche dal telefono.",
            "Ci sono 8 livree pronte da cui partire. Vetri, cerchioni, fanali e gomme non si colorano: si dipinge solo la carrozzeria."],
  },
  {
    id: "2026-11-20g", date: "20 novembre 2026", title: "🚑 Due mezzi nuovi: X-Maxion e B-Jetto",
    items: ["🔁 X-Maxion (46.000 €): ambulanza a doppio uso, fa sia le emergenze sia i trasferimenti (anche urgenti col medico) senza cambiare uso. Agile in città.",
            "🌊 B-Jetto (28.000 €): moto d'acqua di soccorso con barella galleggiante, la più veloce in mare. Ci stanno solo 2 persone: 1 bagnino + 1 soccorritore."],
  },
  {
    id: "2026-11-20f", date: "20 novembre 2026", title: "🏎️ Agilità e velocità contano davvero",
    items: ["Ogni viaggio ora è fatto di città, strade con curve e rettilinei.",
            "In città e nelle curve vince il mezzo più AGILE (per esempio il V-Craftor batte l'M-Sprinterix), sui rettilinei lunghi vince la VELOCITÀ MASSIMA. Le barre sono nel Garage."],
  },
  {
    id: "2026-11-20e", date: "20 novembre 2026", title: "🛣️ Percorsi sulle strade principali",
    items: ["Le ambulanze sulla mappa non tagliano più per sterrati, strade di servizio e vicoli: seguono le strade principali e usano quelle piccole solo se non c'è altro modo."],
  },
  {
    id: "2026-11-20d", date: "20 novembre 2026", title: "✈️ Maxi lontane: si va col C-130H",
    items: ["Per le maxi emergenze lontane (oltre 300 km) le ambulanze vanno all'aeroporto più vicino, salgono sul C-130H convenzionato dell'Aeronautica e atterrano all'aeroporto più vicino alla maxi. Al ritorno lo stesso.",
            "Si prende l'aereo solo se si arriva prima che su strada. I voli partono ogni mezz'ora: le ambulanze che arrivano in aeroporto insieme salgono sullo stesso aereo, e sulla mappa si vede un solo C-130H."],
  },
  {
    id: "2026-11-20c", date: "20 novembre 2026", title: "🆘 Maxi emergenze: si finisce coi feriti",
    items: ["Ogni maxi emergenza ha i suoi feriti: le ambulanze sul posto li portano al PMA (un ferito al minuto) o fanno la spola con l'ospedale.",
            "Se all'ora di fine restano feriti, la maxi e i mezzi sul posto restano 15 minuti in più, e così via finché non sono stati trasportati tutti. Nella scena dal vivo il conto è quello vero."],
  },
  {
    id: "2026-11-20b", date: "20 novembre 2026", title: "🔧 Officina: si sistema al rientro",
    items: ["In Officina, sui mezzi in servizio o già in officina, c'è «🔧 Sistema appena rientra in sede»: appena il mezzo è fermo in sede si fanno da soli guasti, revisione, pezzi, gomme (dal magazzino) e carrozzeria, uno dopo l'altro.",
            "Anche «✅ Sistema tutto» ora finisce da solo i lavori che restano, senza doverlo ripremere."],
  },
  {
    id: "2026-11-20a", date: "20 novembre 2026", title: "🦺 Protezione civile: tutti i moduli",
    items: ["Nei presidi, tra i moduli maxi, ci sono 6 moduli nuovi: 🚤 soccorso fluviale, 🪚 motoseghe e taglio, 📡 sala radio, 🏕️ tende e brandine, 🍲 cucina da campo, ☣️ NBCR.",
            "Nuovi interventi: tromba d'aria, terremoto, nube tossica e nevicata. Anche quelli di prima accettano più moduli (basta averne uno).",
            "⛽ Gasolio: la barra sulla mappa si aggiorna da sola, la cisterna conta solo le tue sedi e il pieno non versa più gasolio nei mezzi elettrici."],
  },
  {
    id: "2026-11-18i", date: "18 novembre 2026", title: "🔑 Cambia password dal gioco",
    items: ["Nel menu, in Impostazioni, c'è «🔑 Cambia password»: puoi sceglierne una nuova senza uscire dal gioco."],
  },
  {
    id: "2026-11-18h", date: "18 novembre 2026", title: "🤖 Automatico: perché i mezzi restano in sede",
    items: ["Nella pagina Automatico c'è un riquadro che spiega quanti mezzi sono fermi e perché: niente autisti liberi, riserva, ordinari spenti, mezzi bloccati in officina o speciali.",
            "🎓 Corso autisti: con 5.000 € a volontario puoi far diventare autisti i tuoi soccorritori base (guidano subito, anche in automatico; puoi farli tornare soccorritori quando vuoi)."],
  },
  {
    id: "2026-11-18g", date: "18 novembre 2026", title: "🔥 Antincendio riattivabili mentre rientrano",
    items: ["Come le ambulanze, i mezzi antincendio tornano disponibili appena lasciano l'incendio per rientrare (anche quando l'incendio viene spento): puoi mandarli subito su un altro incendio e partono da dove si trovano."],
  },
  {
    id: "2026-11-18f", date: "18 novembre 2026", title: "Alleanza su due pagine",
    items: ["Toccando «Alleanza» nel menu vedi subito tutte le alleanze. Se sei dentro un'alleanza, in cima c'è il riquadro con il suo nome: toccalo per aprire la sua pagina con chat, fondo comune, associazioni e prestiti."],
  },
  {
    id: "2026-11-18e", date: "18 novembre 2026", title: "Nomi delle alleanze unici",
    items: ["Non si può più fondare un'alleanza con lo stesso nome di una che esiste già, nemmeno cambiando maiuscole, spazi o simboli."],
  },
  {
    id: "2026-11-18d", date: "18 novembre 2026", title: "🌐 Vetrina delle alleanze e quota giusta per tutti",
    items: ["Nella pagina Alleanza vedi tutte le alleanze con banner, logo, motto, aderenti, fondo comune e quanto riceveresti domenica entrando.",
            "🙋 Chiunque può chiedere di entrare: l'amministratore accetta o rifiuta, poi firmi il contratto e sei dentro.",
            "⚖️ La quota del fondo ora è uguale per tutti in proporzione: ogni ora lo 0,03% dei soldi in cassa (circa il 5% a settimana). I versamenti volontari si scelgono in percentuale (1%, 2%, 5%, 10%)."],
  },
  {
    id: "2026-11-18c", date: "18 novembre 2026", title: "🛞 Gomme più chiare",
    items: ["In Officina → Gomme vedi subito la situazione: quanti mezzi sono a posto, quanti hanno gomme quasi finite, fuori stagione o senza gomme.",
            "Sede per sede, ogni mezzo mostra che gomme ha, quanto le ha consumate e se vanno cambiate (puoi montarle da lì).",
            "Nel negozio ogni gomma dice quante ne hai in magazzino e su quali mezzi è montata; scegli la quantità con + e − o «quante ne mancano»."],
  },
  {
    id: "2026-11-18b", date: "18 novembre 2026", title: "Il logo dell'alleanza su ogni sede",
    items: ["🛡️ Le sedi delle associazioni che fanno parte di un'alleanza mostrano il logo dell'alleanza: sulla mappa (nell'angolo del simbolo e nel popup), nella pagina Sedi, in Officina e nel Garage.",
            "💬 La chat dell'alleanza non è più nella chat generale: si trova solo nella pagina Alleanza e la vedono solo le associazioni che sono entrate."],
  },
  {
    id: "2026-11-18a", date: "18 novembre 2026", title: "🤝 Alleanze nuove, come una federazione",
    items: ["In alto nella pagina Alleanza ci sono il logo e un banner con qualsiasi foto: li sceglie solo l'amministratore (chi l'ha fondata), insieme al motto.",
            "💰 Fondo comune: la tassa dell'alleanza e i versamenti volontari finiscono in un fondo che ogni domenica alle 23 si divide in parti uguali tra tutte le associazioni.",
            "💬 La chat dell'alleanza è nella pagina, e si cancella ogni lunedì.",
            "📜 Per entrare (o fondarne una) si firma un contratto con il logo dell'alleanza e tutte le clausole: firmato, sei dentro.",
            "🚫 L'amministratore può espellere un'associazione dall'alleanza."],
  },
  {
    id: "2026-11-17a", date: "17 novembre 2026", title: "🔥 Antincendio: ricarica alla sede più vicina",
    items: ["I mezzi antincendio ricaricano l'acqua alla sede più vicina al fuoco, di qualsiasi associazione, senza tornare alla propria.",
            "Chi arriva da lontano lavora sempre almeno 30 minuti sull'incendio, anche se l'orario di fine previsto è già passato. Vale anche per i mezzi già in servizio."],
  },
  {
    id: "2026-11-16k", date: "16 novembre 2026", title: "⚓ Porto di Genova",
    items: ["Sulla mappa c'è il porto di Genova con i traghetti per Olbia, Porto Torres (nuovo porto in Sardegna) e Palermo: tocca il porto per vedere gli orari."],
  },
  {
    id: "2026-11-16j", date: "16 novembre 2026", title: "⛴ Traghetti con orari veri",
    items: ["Tocca un porto sulla mappa: vedi i prossimi traghetti con orario di partenza, arrivo e durata. Linee: Piombino ⇄ Portoferraio (ogni ora), Livorno ⇄ Capraia, Livorno ⇄ Olbia, Livorno ⇄ Cagliari, Porto Santo Stefano ⇄ Giglio, Villa San Giovanni ⇄ Messina, Napoli ⇄ Ischia/Procida/Capri e Napoli ⇄ Palermo.",
            "🚑 Per le missioni di Protezione Civile, maxi, incendi, grandi eventi e per i trasferimenti oltre il mare, l'ambulanza s'imbarca da sola: va al porto, aspetta la nave, attraversa (sulla mappa la vedi sul mare) e prosegue. Anche il ritorno è col traghetto.",
            "I servizi 118 normali restano solo per i mezzi che hanno la sede sull'isola (o per le barche)."],
  },
  {
    id: "2026-11-16i", date: "16 novembre 2026", title: "Protezione Civile solo sulla terraferma",
    items: ["🗺️ Le missioni di Protezione Civile nascono sempre su un punto di terraferma (paesi e strade): niente più missioni in mezzo al mare. Quella finita in mare è stata spostata a terra."],
  },
  {
    id: "2026-11-16h", date: "16 novembre 2026", title: "Pacchetti epici e leggendari molto più cari",
    items: ["💜 Il pacchetto epico ora costa 250.000 € e 👑 quello leggendario 1.000.000 €: sono un traguardo da raggiungere facendo crescere l'associazione. Il pacchetto comune e gli specialisti restano com'erano."],
  },
  {
    id: "2026-11-16g", date: "16 novembre 2026", title: "Pacchetti autisti e 130 carte nuove",
    items: ["🚑 Nei Pacchetti specialisti ci sono due pacchetti nuovi: «Autista» (35.000 €) e «Autista avanzato» (55.000 €), 5 volontari tutti di quel tipo.",
            "🃏 130 volontari nuovi da trovare: 30 autisti, 30 autisti avanzati, 15 soccorritori base, 15 avanzati, 15 infermieri, 15 medici e 10 capiservizio, con epiche e leggendarie.",
            "✅ Dopo aver aperto un pacchetto il pulsante «Benvenuti in squadra» resta sempre visibile in fondo allo schermo."],
  },
  {
    id: "2026-11-16f", date: "16 novembre 2026", title: "Vendi all'asta da ogni mezzo",
    items: ["🏷️ Nel Garage ogni mezzo ha il pulsante «Vendi all'asta», sia nelle schede sia nella vista Elenco. Se il mezzo è in servizio o in officina, il gioco ti avvisa che potrai metterlo all'asta appena torna libero in sede."],
  },
  {
    id: "2026-11-16e", date: "16 novembre 2026", title: "Trasferimenti senza limite di km",
    items: ["🏥 Anche i trasferimenti tra ospedali si possono fare con qualsiasi ambulanza da trasferimenti, da qualunque sede e verso qualunque ospedale: niente più limite dei 25 km (resta solo il mare tra isole e continente)."],
  },
  {
    id: "2026-11-16d", date: "16 novembre 2026", title: "Grandi eventi senza limite di km",
    items: ["🏟️ Ai grandi eventi (concerti, partite, palazzetti) puoi mandare qualsiasi ambulanza, da qualunque sede: non c'è più il limite dei 25 km, come già per maxi emergenze, incendi e Protezione Civile. Resta solo il mare: dalle isole non si va sul continente e viceversa."],
  },
  {
    id: "2026-11-16c", date: "16 novembre 2026", title: "Telefono: il pulsante «Parti» sempre visibile",
    items: ["📱 Quando apri un servizio per mandare un mezzo (anche un trasferimento), la barra del menu in basso si nasconde, così il pulsante per partire non resta più coperto."],
  },
  {
    id: "2026-11-16b", date: "16 novembre 2026", title: "Protezione Civile: la manifestazione pubblica",
    items: ["🎤 La missione «Supporto a una manifestazione pubblica» ha una scena nuova: palco con maxischermo, luci da discoteca, laser e pubblico che balla.",
            "🚑 Servono da 3 a 5 ambulanze in postazione (è scritto nella missione): ora ci vanno anche le ambulanze normali, oltre ai camion e furgoni maxi con logistica o PMA. In alto nella scena vedi quante ne sono arrivate e quante ne mancano.",
            "Raramente qualcuno si sente male tra il pubblico: un'ambulanza in postazione lo carica e lo porta al PMA, poi torna al suo posto."],
  },
  {
    id: "2026-11-16a", date: "16 novembre 2026", title: "Grandi eventi dal vivo: concerti, partite e palazzetti",
    items: ["🎤 Anche i grandi eventi (concerti, festival, partite, palazzetti) hanno la scena dal vivo: «🎬 Guarda l'evento dal vivo» nel popup. Palco con maxischermo, luci da discoteca, laser e pubblico che balla; allo stadio spalti pieni, fari e giocatori in campo.",
            "🚑 In alto vedi quante ambulanze sono in postazione rispetto a quelle richieste dall'evento, e quante ne mancano.",
            "Ogni tanto (raramente) qualcuno si sente male tra il pubblico: un'ambulanza in postazione parte, lo carica in barella e lo porta al PMA, poi torna al suo posto."],
  },
  {
    id: "2026-11-15m", date: "15 novembre 2026", title: "Protezione Civile: vedi i moduli di ogni mezzo",
    items: ["🚛 Quando scegli il mezzo da mandare a una missione di Protezione Civile, sotto ogni camion e furgone maxi vedi i moduli montati: in verde con ✓ quelli che servono a quella missione. Se non ne ha nessuno adatto, a destra c'è scritto quale manca."],
  },
  {
    id: "2026-11-15l", date: "15 novembre 2026", title: "Nuovo modulo: pompa idrovora",
    items: ["💧 Nel negozio dei presidi, tra i moduli maxi, c'è la pompa idrovora (65.000 €) per camion e furgoni maxi. Toglie l'acqua da strade e scantinati: negli allagamenti della Protezione Civile si vedono le pompe al lavoro e l'acqua cala molto più in fretta. +25% sulle maxi."],
  },
  {
    id: "2026-11-15k", date: "15 novembre 2026", title: "Presidi: compra quanti ne vuoi e montali dove vuoi",
    items: ["🛒 Negozio e Officina → Presidi hanno un catalogo nuovo a schede: per ogni presidio vedi quanti ne hai in magazzino e su quanti mezzi è montato.",
            "Toccandolo si apre una finestra dove spunti le ambulanze (una per una o tutta una sede), scegli quanti pezzi comprare e vedi subito il totale. Prima usa quelli in magazzino; i pezzi in più restano lì per dopo."],
  },
  {
    id: "2026-11-15j", date: "15 novembre 2026", title: "Mappa più fluida da lontano",
    items: ["🗺️ Quando allontani lo zoom, servizi, sedi e ambulanze diventano puntini colorati (toccali per avvicinarti; le tue sedi sono arancioni, le tue ambulanze hanno il bordo bianco) e ospedali e porti si nascondono: lo zoom non va più a scatti.",
            "Da vicino la mappa disegna solo quello che hai sullo schermo."],
  },
  {
    id: "2026-11-15i", date: "15 novembre 2026", title: "Potenzia tutta la sede con un click",
    items: ["⚡ Nel Garage, sotto il nome di ogni sede, ci sono due pulsanti: «Tutti al livello…» alza di un livello i mezzi più lenti, «Tutti al massimo» porta tutta la sede al livello 3. Il prezzo totale è scritto sul pulsante; se i soldi non bastano si potenziano prima i mezzi più indietro."],
  },
  {
    id: "2026-11-15h", date: "15 novembre 2026", title: "Protezione Civile: la scena dal vivo",
    items: [
      "🎬 Anche le missioni di Protezione Civile hanno la scena dal vivo (pulsante nel popup), con uno scenario diverso per ogni missione: bosco con i settori di ricerca, campi, macerie, quartiere allagato, fiume in piena, frana, tendopoli, paese al buio sotto la neve, concerto, scogliera.",
      "🐕🛸 Cani e droni battono la zona settore per settore finché il disperso non viene ritrovato; la logistica accende le pompe, monta le tende e riporta la corrente nelle case.",
    ],
  },
  {
    id: "2026-11-15g", date: "15 novembre 2026", title: "Velocità e doppio logo",
    items: [
      "🚦 Velocità sistemate: ora il codice conta più del modello, quindi un mezzo in verde non va più veloce di uno in giallo, e i potenziamenti non fanno più superare i limiti.",
      "🤝 Le ambulanze che partono da una sede in gemellaggio mostrano sulla mappa i loghi di tutte e due le associazioni.",
    ],
  },
  {
    id: "2026-11-15e", date: "15 novembre 2026", title: "Missioni di Protezione Civile",
    items: [
      "🦺 Nuove missioni sulla mappa (rombo giallo-arancio): ricerca di dispersi, ricerca sotto le macerie, allagamenti, argini e frane da sorvegliare, campi di accoglienza, black-out, supporto a manifestazioni.",
      "🚛 Ci vanno i camion e i furgoni maxi con il modulo giusto: 🐕 cinofila e 🛸 droni per le ricerche, ⚡ logistica per allagamenti, gelo e tendopoli, ⛺ PMA per accoglienza ed eventi. Ogni modulo montato aumenta il premio.",
      "🕑 Compaiono vicino alle sedi di chi ha mezzi maxi, al massimo 3 insieme.",
    ],
  },
  {
    id: "2026-11-15d", date: "15 novembre 2026", title: "Ospedale di Volterra",
    items: ["🏥 Aggiunto l'ospedale di Volterra con pronto soccorso: le ambulanze della Val di Cecina ora scaricano lì."],
  },
  {
    id: "2026-11-15c", date: "15 novembre 2026", title: "Le ambulanze non attraversano il mare",
    items: ["⛴️ I mezzi di terra con sede sul continente (per esempio Piombino) non possono più fare servizi all'Elba e nelle altre isole, e viceversa: servono mezzi con sede sull'isola o le barche. Maxi emergenze e incendi restano aperti a tutti."],
  },
  {
    id: "2026-11-15b", date: "15 novembre 2026", title: "Maxi emergenze e incendi in tutta Italia",
    items: [
      "🇮🇹 Maxi emergenze e incendi boschivi ora possono scoppiare in qualsiasi parte d'Italia, e ci puoi mandare mezzi da qualunque sede.",
      "🆘 Le maxi emergenze arrivano più spesso: ogni 5-6 giorni invece di 7-8.",
    ],
  },
  {
    id: "2026-11-15a", date: "15 novembre 2026", title: "Nuova grafica e aiuto in ogni pagina",
    items: [
      "🎨 Tutto il gioco ha i colori del logo: blu notte, arancione e azzurro.",
      "❓ In basso a destra c'è il tasto «?»: in ogni pagina spiega in poche righe cosa puoi fare lì (lampeggia la prima volta). Nel menu c'è anche «Come si gioca».",
      "📱 Sul telefono c'è la barra in basso: Mappa, Garage, Squadra, Officina e «Altro» per il menu completo.",
      "👥 Squadra: in alto chi è pronto a partire, in servizio, a riposo o prestato, e un avviso chiaro se mancano autisti o soccorritori (con il link per chiedere personale).",
      "🏠 Sedi: riepilogo dei posti occupati e una barra dei posti su ogni sede.",
      "🚑 Garage: in alto il riepilogo della flotta (pronti, in servizio, in officina, da sistemare) e su ogni mezzo lo stato colorato (🟢 pronto, 🚨 in servizio, 🔧 in officina, ⚠️ guasto).",
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
