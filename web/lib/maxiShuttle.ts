// Maxi emergenza senza PMA: le ambulanze fanno la spola tra il posto e l'ospedale più vicino.
// Stesso calcolo nella scena (/maxi/[id]) e sulla mappa principale, così si vedono nello stesso punto.
export const SHUTTLE_SCENE_S = 150;   // recupero, cure e carico del ferito sul posto
export const SHUTTLE_HOSP_S = 180;    // consegna in pronto soccorso

export function distKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = Math.PI / 180, a = Math.sin(((lat2 - lat1) * r) / 2) ** 2
    + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}
// tempo di viaggio in codice rosso (come drive_seconds: strada = linea d'aria × 1,3, primi 3 km in città)
export function shuttleTravelS(km: number) {
  const road = km * 1.3;
  return Math.max(60, Math.round((Math.min(road, 3) / 50 + Math.max(0, road - 3) / 100) * 3600));
}

export type ShuttlePhase = "scena" | "andata" | "ospedale" | "ritorno";
export type ShuttleState = { phase: ShuttlePhase; f: number; inS: number; leftS: number; n: number; delivered: number; cycleStart: number; travel: number; scene: number; hosp: number };

export function shuttleState(arrivesMs: number, travelS: number, now: number,
                             o: { scene?: number; hosp?: number } = {}): ShuttleState | null {
  if (now < arrivesMs) return null;
  const sc = o.scene ?? SHUTTLE_SCENE_S, ho = o.hosp ?? SHUTTLE_HOSP_S, T = travelS;
  const C = sc + T + ho + T; const t = (now - arrivesMs) / 1000;
  const n = Math.floor(t / C), r = t - n * C; const cycleStart = arrivesMs + n * C * 1000;
  const mk = (phase: ShuttlePhase, from: number, len: number) =>
    ({ phase, f: (r - from) / len, inS: r - from, leftS: len - (r - from), n, delivered: n + (r >= sc + T ? 1 : 0), cycleStart, travel: T, scene: sc, hosp: ho });
  if (r < sc) return mk("scena", 0, sc);
  if (r < sc + T) return mk("andata", sc, T);
  if (r < sc + T + ho) return mk("ospedale", sc + T, ho);
  return mk("ritorno", sc + T + ho, T);
}
