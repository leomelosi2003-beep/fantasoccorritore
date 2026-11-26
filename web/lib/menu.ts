// Voci del menu: usate dal menu della mappa (☰) e dalla barra laterale sul PC.
export type MenuItem = [icon: string, label: string, href: string];
export const MENU: [string, MenuItem[]][] = [
  ["La mia associazione", [
    ["🚑", "Garage", "/garage"], ["👥", "Squadra", "/squadra"], ["🔧", "Officina", "/officina"],
    ["🏠", "Sedi", "/sedi"], ["🤖", "Automatica", "/automatico"], ["🖌️", "Livrea", "/livrea"],
  ]],
  ["Ogni giorno", [
    ["🎯", "Obiettivi", "/obiettivi"], ["🔁", "Trasferimenti", "/trasferimenti"], ["📰", "Giornale 24", "/notizie"],
    ["🆕", "Novità", "/novita"], ["🏆", "Classifica", "/classifica"], ["🪪", "Il mio profilo", "/associazione"],
  ]],
  ["Compra e vendi", [["🛒", "Presidi", "/negozio"], ["🏷️", "Usato e aste", "/usate"], ["💼", "Offerte", "/offerte"]]],
  ["Altre associazioni", [["🤝", "Alleanza", "/alleanza"], ["🔗", "Gemellaggio", "/gemellaggio"], ["📢", "Personale", "/personale"], ["🔎", "Profili", "/profili"]]],
  ["Conti", [["📊", "Entrate e uscite", "/finanze"], ["📈", "Statistiche", "/statistiche"], ["🏢", "Fatturato sedi", "/fatturato"]]],
];
