// Motore dell'editor livrea: forme, sfumature, immagine "bianca" del mezzo, maschera della carrozzeria, composizione finale.
export type Kind = "rect" | "ellipse" | "line" | "path" | "text" | "image" | "checker"
  | "roundrect" | "tri" | "diamond" | "star" | "hex" | "chevron" | "arrow" | "wave" | "swoosh" | "heart" | "sticker"
  | "pent" | "oct" | "plus" | "trap" | "para" | "bolt" | "ring" | "halfc" | "crescent" | "drop" | "shield"
  | "stripes" | "polka" | "zigzag" | "grid";
export type Item = {
  id: string; t: Kind; x: number; y: number; w: number; h: number; r: number;
  fill: string; stroke: string; sw: number; op: number;
  text?: string; bold?: boolean; src?: string; pts?: [number, number][]; c2?: string;
  g2?: string; gdir?: "h" | "v" | "r"; gfade?: boolean;   // sfumatura: secondo colore, direzione, verso il trasparente
  gang?: number; g3?: string;                             // gradiente: angolo (gradi) e colore centrale
  flip?: boolean;                                         // specchiata
  ally?: boolean;                                         // logo dell'alleanza (obbligatorio)
  glass?: boolean;                                        // adesivo: sta sopra tutto, anche sui vetri
  stk?: string;                                           // tipo di adesivo
};
export type Design = { v: 1; w: number; h: number; items: Item[] };
export const uid = () => Math.random().toString(36).slice(2, 10);

export const SHAPES: { t: Kind; icon: string; name: string }[] = [
  { t: "rect", icon: "▬", name: "Striscia" }, { t: "roundrect", icon: "▢", name: "Arrotondato" }, { t: "ellipse", icon: "●", name: "Cerchio" },
  { t: "tri", icon: "▲", name: "Triangolo" }, { t: "diamond", icon: "◆", name: "Rombo" }, { t: "hex", icon: "⬢", name: "Esagono" },
  { t: "star", icon: "★", name: "Stella" }, { t: "heart", icon: "♥", name: "Cuore" }, { t: "chevron", icon: "❯", name: "Chevron" },
  { t: "arrow", icon: "➜", name: "Freccia" }, { t: "wave", icon: "〰", name: "Onda" }, { t: "swoosh", icon: "⌒", name: "Sagomatura" },
  { t: "pent", icon: "⬟", name: "Pentagono" }, { t: "oct", icon: "⯃", name: "Ottagono" }, { t: "plus", icon: "✚", name: "Croce" },
  { t: "trap", icon: "⏢", name: "Trapezio" }, { t: "para", icon: "▱", name: "Parallelogr." }, { t: "bolt", icon: "⚡", name: "Fulmine" },
  { t: "ring", icon: "◯", name: "Anello" }, { t: "halfc", icon: "◗", name: "Mezzo cerchio" }, { t: "crescent", icon: "☾", name: "Luna" },
  { t: "drop", icon: "💧", name: "Goccia" }, { t: "shield", icon: "🛡", name: "Scudo" }, { t: "line", icon: "╱", name: "Linea" },
];
// motivi: riempiono un rettangolo con due colori (fill e c2)
export const PATTERNS: { t: Kind; icon: string; name: string }[] = [
  { t: "checker", icon: "▦", name: "Scacchi" }, { t: "stripes", icon: "▨", name: "Righe oblique" },
  { t: "polka", icon: "⁘", name: "Pois" }, { t: "zigzag", icon: "〽", name: "Zig-zag" }, { t: "grid", icon: "▦", name: "Griglia" },
];
export const PATTERN_KINDS: Kind[] = PATTERNS.map((p) => p.t);
export const KIND_NAME: Record<Kind, string> = Object.fromEntries([...SHAPES.map((s) => [s.t, s.name]), ...PATTERNS.map((s) => [s.t, s.name]), ["path", "Pennello"], ["text", "Testo"], ["image", "Foto"], ["sticker", "Adesivo"]]) as Record<Kind, string>;

// Adesivi pronti (fill = sfondo, c2 = simbolo/scritta). Si mettono anche sui vetri.
export const STICKERS: { stk: string; icon: string; name: string; w: number; h: number; fill: string; c2: string; text?: string }[] = [
  { stk: "118", icon: "🔵", name: "118", w: 1.6, h: 1, fill: "#1D4ED8", c2: "#FFFFFF", text: "118" },
  { stk: "112", icon: "🟡", name: "112", w: 1.6, h: 1, fill: "#FACC15", c2: "#111827", text: "112" },
  { stk: "plus", icon: "➕", name: "Croce sanitaria", w: 1, h: 1, fill: "#1D4ED8", c2: "#FFFFFF" },
  { stk: "ecg", icon: "💓", name: "Cuore e battito", w: 1.2, h: 1, fill: "#DC2626", c2: "#FFFFFF" },
  { stk: "dae", icon: "⚡", name: "DAE a bordo", w: 1, h: 1, fill: "#16A34A", c2: "#FFFFFF" },
  { stk: "label", icon: "🏷️", name: "Etichetta", w: 3.2, h: 0.8, fill: "#F97316", c2: "#FFFFFF", text: "VOLONTARI DEL SOCCORSO" },
  { stk: "glasstext", icon: "🪟", name: "Scritta", w: 3.2, h: 0.7, fill: "#FFFFFF", c2: "#FFFFFF", text: "AMBULANZA" },
  { stk: "dots", icon: "⬤", name: "Pallini riflettenti", w: 3, h: 0.5, fill: "#FACC15", c2: "#FACC15" },
];
export const FILLABLE: Kind[] = ["rect", "roundrect", "ellipse", "tri", "diamond", "hex", "star", "heart", "chevron", "arrow", "wave", "swoosh",
  "pent", "oct", "plus", "trap", "para", "bolt", "ring", "halfc", "crescent", "drop", "shield"];

// ---------- livree pronte da cui partire (posizioni in proporzione al mezzo) ----------
const R = (W: number, H: number, x: number, y: number, w: number, h: number, fill: string, extra: Partial<Item> = {}): Item =>
  ({ id: uid(), t: "rect", x: x * W, y: y * H, w: w * W, h: h * H, r: 0, fill, stroke: "#000", sw: 0, op: 1, ...extra });
const S = (W: number, H: number, t: Kind, x: number, y: number, w: number, h: number, fill: string, extra: Partial<Item> = {}): Item =>
  ({ id: uid(), t, x: x * W, y: y * H, w: w * W, h: h * H, r: 0, fill, stroke: "#000", sw: 0, op: 1, ...extra });
const CK = (W: number, H: number, y: number, h: number, a: string, b: string): Item =>
  ({ id: uid(), t: "checker", x: 0, y: y * H, w: W, h: h * H, r: 0, fill: a, c2: b, stroke: "#000", sw: 0, op: 1 });
export const PRESETS: { name: string; make: (W: number, H: number) => Item[] }[] = [
  { name: "🟧 Classica arancio (118)", make: (W, H) => [R(W, H, 0, 0.52, 1, 0.075, "#F97316"), CK(W, H, 0.72, 0.05, "#F97316", "#FACC15"), CK(W, H, 0.16, 0.035, "#F97316", "#FACC15")] },
  { name: "🟦 Blu e gialla", make: (W, H) => [R(W, H, 0, 0.52, 1, 0.075, "#1E3A8A"), CK(W, H, 0.72, 0.05, "#1E3A8A", "#FACC15"), CK(W, H, 0.16, 0.035, "#FACC15", "#1E3A8A")] },
  { name: "🟥 Rossa e bianca", make: (W, H) => [R(W, H, 0, 0.52, 1, 0.075, "#DC2626"), CK(W, H, 0.72, 0.05, "#DC2626", "#FFFFFF"), R(W, H, 0, 0.17, 1, 0.025, "#DC2626")] },
  { name: "🟩 Verde e gialla", make: (W, H) => [R(W, H, 0, 0.52, 1, 0.075, "#16A34A"), CK(W, H, 0.72, 0.05, "#16A34A", "#FACC15"), CK(W, H, 0.16, 0.035, "#16A34A", "#FACC15")] },
  { name: "🏁 Scacchi grandi (Battenburg)", make: (W, H) => [CK(W, H, 0.5, 0.2, "#FACC15", "#16A34A"), R(W, H, 0, 0.16, 1, 0.03, "#16A34A")] },
  { name: "⚡ Sportiva a righe oblique", make: (W, H) => [R(W, H, 0, 0.58, 1, 0.06, "#1D4ED8"),
      R(W, H, 0.55, 0.3, 0.06, 0.55, "#F97316", { r: 25 }), R(W, H, 0.63, 0.3, 0.03, 0.55, "#FACC15", { r: 25 }), R(W, H, 0.68, 0.3, 0.015, 0.55, "#1D4ED8", { r: 25 })] },
  { name: "➖ Elegante a doppia linea", make: (W, H) => [R(W, H, 0, 0.56, 1, 0.02, "#13294B"), R(W, H, 0, 0.6, 1, 0.008, "#F59E0B")] },
  { name: "🚨 Fascia larga con scritta", make: (W, H) => [R(W, H, 0, 0.5, 1, 0.13, "#F97316"),
      { id: uid(), t: "text", x: W * 0.3, y: H * 0.515, w: W * 0.4, h: H * 0.1, r: 0, fill: "#FFFFFF", stroke: "#000", sw: 0, op: 1, text: "AMBULANZA", bold: true }] },
  { name: "🇮🇹 Tricolore", make: (W, H) => [R(W, H, 0, 0.5, 1, 0.035, "#16A34A"), R(W, H, 0, 0.535, 1, 0.035, "#FFFFFF", { sw: 0 }), R(W, H, 0, 0.57, 1, 0.035, "#DC2626")] },
  { name: "🌊 Onde marine", make: (W, H) => [S(W, H, "wave", 0, 0.5, 1, 0.12, "#0EA5E9"), S(W, H, "wave", 0, 0.6, 1, 0.08, "#1E3A8A")] },
  { name: "🔥 Fiammata", make: (W, H) => [S(W, H, "swoosh", 0.05, 0.35, 0.75, 0.4, "#DC2626", { g2: "#F59E0B", gdir: "h", gang: 0 }), S(W, H, "swoosh", 0.1, 0.45, 0.6, 0.3, "#FACC15", { op: 0.85 })] },
  { name: "🌙 Notturna", make: (W, H) => [R(W, H, 0, 0.47, 1, 0.16, "#111827", { g2: "#374151", gdir: "v" }), R(W, H, 0, 0.47, 1, 0.012, "#F59E0B"), R(W, H, 0, 0.62, 1, 0.012, "#F59E0B")] },
  { name: "🏎️ Corsa a righe", make: (W, H) => [S(W, H, "stripes", 0, 0.5, 1, 0.09, "#F97316", { c2: "#FFFFFF" }), R(W, H, 0, 0.6, 1, 0.02, "#13294B")] },
  { name: "⚪ Pois allegri", make: (W, H) => [S(W, H, "polka", 0, 0.5, 1, 0.12, "#1D4ED8", { c2: "#FACC15" })] },
  { name: "〽 Zig-zag", make: (W, H) => [S(W, H, "zigzag", 0, 0.52, 1, 0.08, "#FFFFFF", { c2: "#DC2626" }), R(W, H, 0, 0.61, 1, 0.02, "#DC2626")] },
  { name: "🎯 Chevron posteriore", make: (W, H) => [R(W, H, 0, 0.55, 0.75, 0.05, "#1D4ED8"),
      S(W, H, "chevron", 0.76, 0.42, 0.08, 0.3, "#FACC15"), S(W, H, "chevron", 0.84, 0.42, 0.08, 0.3, "#DC2626")] },
  { name: "💠 Moderna a blocchi", make: (W, H) => [S(W, H, "para", 0.05, 0.48, 0.35, 0.12, "#0EA5E9"), S(W, H, "para", 0.35, 0.48, 0.35, 0.12, "#1E3A8A"), S(W, H, "para", 0.65, 0.48, 0.3, 0.12, "#F97316")] },
  { name: "🟨 Protezione civile", make: (W, H) => [R(W, H, 0, 0.48, 1, 0.1, "#1E3A8A"), R(W, H, 0, 0.58, 1, 0.04, "#FACC15"), CK(W, H, 0.17, 0.035, "#1E3A8A", "#FACC15")] },
];

// ---------- immagine "bianca" del mezzo: tolgo i colori della livrea ufficiale, tengo ombre, vetri e ruote ----------
export async function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
export function blankOf(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
  const W = c.width, H = c.height;
  const d = g.getImageData(0, 0, W, H); const p = d.data;
  // bianco della carrozzeria (mediana dei pixel chiari e grigi), per ridipingere le strisce dello stesso bianco
  const hist = new Array(256).fill(0); let nb = 0;
  for (let i = 0; i < p.length; i += 4) {
    const mx = Math.max(p[i], p[i + 1], p[i + 2]), mn = Math.min(p[i], p[i + 1], p[i + 2]);
    if (p[i + 3] > 200 && mx > 190 && (mx - mn) / mx < 0.08) { hist[mx]++; nb++; }
  }
  let w0 = 240, acc = 0;
  for (let v = 0; v < 256 && nb; v++) { acc += hist[v]; if (acc >= nb / 2) { w0 = v; break; } }
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const r = p[i], gg = p[i + 1], b = p[i + 2];
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dl = mx - mn, s = mx ? dl / mx : 0;
    if (!((s >= 0.15 && mx >= 95) || (s >= 0.45 && mx >= 45))) continue;
    let h = 0;
    if (mx === r) h = ((gg - b) / dl) % 6; else if (mx === gg) h = (b - r) / dl + 2; else h = (r - gg) / dl + 4;
    h = (h * 60 + 360) % 360;
    const px = (i / 4) % W, py = Math.floor(i / 4 / W);
    if (py < 0.2 * H && h >= 190 && h <= 260) continue;                          // lampeggianti blu sul tetto
    if ((h < 12 || h > 345) && s > 0.5 && px > 0.93 * W) continue;              // fanali posteriori rossi
    p[i] = w0; p[i + 1] = w0; p[i + 2] = w0;                                    // ogni colore della livrea → bianco
  }
  g.putImageData(d, 0, 0);
  return c;
}

// ---------- dove si può dipingere: solo la carrozzeria (niente vetri, cerchioni, fanali, gomme, pavimento) ----------
export function paintMaskOf(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
  const W = c.width, H = c.height, N = W * H;
  const p = g.getImageData(0, 0, W, H).data;
  const mx = new Uint8Array(N), al = new Uint8Array(N), sat = new Float32Array(N), hue = new Float32Array(N);
  const hist = new Array(256).fill(0); let nb = 0;
  for (let k = 0, i = 0; k < N; k++, i += 4) {
    const r = p[i], gg = p[i + 1], b = p[i + 2], M = Math.max(r, gg, b), m = Math.min(r, gg, b), d = M - m;
    mx[k] = M; al[k] = p[i + 3]; sat[k] = M ? d / M : 0;
    let h = 0; if (d) { if (M === r) h = ((gg - b) / d) % 6; else if (M === gg) h = (b - r) / d + 2; else h = (r - gg) / d + 4; h = (h * 60 + 360) % 360; }
    hue[k] = h;
    if (al[k] > 200 && M > 190 && sat[k] < 0.08) { hist[M]++; nb++; }
  }
  let w0 = 240, acc = 0; for (let v = 0; v < 256 && nb; v++) { acc += hist[v]; if (acc >= nb / 2) { w0 = v; break; } }
  const cand = new Uint8Array(N), dark = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    const x = k % W, y = (k / W) | 0, h = hue[k], s = sat[k], M = mx[k];
    const blueLight = y < 0.2 * H && h >= 190 && h <= 260, tail = (h < 12 || h > 345) && s > 0.5 && x > 0.93 * W;
    const liv = al[k] > 0 && !blueLight && !tail && ((s >= 0.15 && M >= 95) || (s >= 0.45 && M >= 45));
    cand[k] = al[k] > 200 && (liv || (s < 0.15 && M >= 0.62 * w0)) ? 1 : 0;
    dark[k] = M < 80 && al[k] > 100 ? 1 : 0;
  }
  // componenti connesse (4 vicini) di una maschera dentro un rettangolo di righe
  const label = (mask: Uint8Array, y0: number) => {
    const lab = new Int32Array(N); const comps: { n: number; x0: number; x1: number; y0: number; y1: number; edge: boolean }[] = [{ n: 0, x0: 0, x1: 0, y0: 0, y1: 0, edge: false }];
    const st: number[] = [];
    for (let k = y0 * W; k < N; k++) {
      if (!mask[k] || lab[k]) continue;
      const id = comps.length; const cp = { n: 0, x0: W, x1: 0, y0: H, y1: 0, edge: false }; comps.push(cp);
      lab[k] = id; st.push(k);
      while (st.length) {
        const q = st.pop()!; const x = q % W, y = (q / W) | 0;
        cp.n++; if (x < cp.x0) cp.x0 = x; if (x > cp.x1) cp.x1 = x; if (y < cp.y0) cp.y0 = y; if (y > cp.y1) cp.y1 = y;
        if (x === 0 || x === W - 1 || y === y0 || y === H - 1) cp.edge = true;
        const nb4 = [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, y > y0 ? q - W : -1, y < H - 1 ? q + W : -1];
        for (const t of nb4) if (t >= 0 && mask[t] && !lab[t]) { lab[t] = id; st.push(t); }
      }
    }
    return { lab, comps };
  };
  // cerchioni: zone chiare chiuse dentro le gomme, tonde, nella metà bassa
  const y0 = Math.floor(0.45 * H);
  const notDark = new Uint8Array(N); for (let k = y0 * W; k < N; k++) notDark[k] = dark[k] ? 0 : 1;
  const w = label(notDark, y0);
  const wheelIds = new Set<number>();
  w.comps.forEach((cp, id) => { if (!id || cp.edge) return; const hh = cp.y1 - cp.y0 + 1, ww = cp.x1 - cp.x0 + 1; if (ww / hh >= 0.6 && ww / hh <= 1.7 && hh >= 0.08 * H) wheelIds.add(id); });
  if (wheelIds.size) for (let k = y0 * W; k < N; k++) if (wheelIds.has(w.lab[k])) {
    const x = k % W, y = (k / W) | 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < W && yy >= 0 && yy < H) cand[yy * W + xx] = 0; }
  }
  // sfondo rimasto sotto la carrozzeria: dal fondo, saltata l'ombra a terra, si toglie il chiaro fino al primo scuro
  for (let x = 0; x < W; x++) {
    let phase = 0;
    for (let y = H - 1; y >= Math.floor(H * 0.78); y--) {
      const k = y * W + x; if (al[k] < 10) continue;
      if (!phase) { if (cand[k]) { phase = 1; cand[k] = 0; } else if (y < H * 0.92) break; }
      else if (cand[k]) cand[k] = 0; else break;
    }
  }
  // solo le zone grandi (via fanali, riflessi, maniglie)
  const b = label(cand, 0);
  const out = g.createImageData(W, H);
  for (let k = 0; k < N; k++) if (cand[k] && b.comps[b.lab[k]].n >= 0.004 * N) out.data[k * 4 + 3] = 255;
  g.putImageData(out, 0, 0);
  return c;
}


// ---------- vetri: dove si possono attaccare gli adesivi ----------
/** zone scure e grandi nella parte alta del mezzo (finestrini e parabrezza). Se non ne trova (barche, pick-up), null. */
export function glassMaskOf(img: HTMLImageElement): HTMLCanvasElement | null {
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
  const W = c.width, H = c.height, N = W * H, p = g.getImageData(0, 0, W, H).data;
  const m = new Uint8Array(N);
  for (let k = 0, i = 0; k < N; k++, i += 4) {
    const M = Math.max(p[i], p[i + 1], p[i + 2]), mn = Math.min(p[i], p[i + 1], p[i + 2]);
    m[k] = p[i + 3] > 200 && M < 150 && (M ? (M - mn) / M : 0) < 0.45 && k / W < 0.66 * H ? 1 : 0;
  }
  // componenti connesse: tengo quelle grandi, larghe, abbastanza piene e tutte nella parte alta
  const lab = new Int32Array(N); const keep: boolean[] = [false]; const st: number[] = [];
  for (let k = 0; k < N; k++) {
    if (!m[k] || lab[k]) continue;
    const id = keep.length; let n = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
    lab[k] = id; st.push(k);
    while (st.length) {
      const q = st.pop()!; const x = q % W, y = (q / W) | 0; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const nb = [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, y > 0 ? q - W : -1, y < H - 1 ? q + W : -1];
      for (const t of nb) if (t >= 0 && m[t] && !lab[t]) { lab[t] = id; st.push(t); }
    }
    const ww = x1 - x0 + 1, hh = y1 - y0 + 1;
    keep.push(n >= 0.004 * N && y1 < 0.66 * H && ww >= 0.04 * W && n / (ww * hh) > 0.45);
  }
  const win = new Uint8Array(N); let area = 0;
  for (let k = 0; k < N; k++) if (lab[k] && keep[lab[k]]) { win[k] = 1; area++; }
  if (area < 0.01 * N) return null;
  // riempio i buchi (riflessi chiari dentro i vetri): ciò che non si raggiunge dal bordo senza passare dai vetri
  const out = new Uint8Array(N);
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const k = y * W + x; if (!win[k] && !out[k]) { out[k] = 1; st.push(k); } }
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const k = y * W + x; if (!win[k] && !out[k]) { out[k] = 1; st.push(k); } }
  while (st.length) {
    const q = st.pop()!; const x = q % W, y = (q / W) | 0;
    const nb = [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, y > 0 ? q - W : -1, y < H - 1 ? q + W : -1];
    for (const t of nb) if (t >= 0 && !win[t] && !out[t]) { out[t] = 1; st.push(t); }
  }
  const im = g.createImageData(W, H);
  for (let k = 0; k < N; k++) if (!out[k]) im.data[k * 4 + 3] = 255;
  g.putImageData(im, 0, 0);
  return c;
}

// ---------- adesivi ----------
function drawSticker(g: CanvasRenderingContext2D, it: Item, w: number, h: number) {
  const bg = it.fill, fg = it.c2 ?? "#FFFFFF", W2 = w / 2, H2 = h / 2, r = Math.min(w, h) * 0.18;
  const rr = () => { g.beginPath(); g.moveTo(-W2 + r, -H2); g.arcTo(W2, -H2, W2, H2, r); g.arcTo(W2, H2, -W2, H2, r); g.arcTo(-W2, H2, -W2, -H2, r); g.arcTo(-W2, -H2, W2, -H2, r); g.closePath(); };
  const txt = (t: string, size: number, color: string) => {
    g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `900 ${size}px Arial, sans-serif`;
    const tw = g.measureText(t).width || 1, k = Math.min(1, (w * 0.86) / tw);
    g.save(); g.scale(k, 1); g.fillText(t, 0, size * 0.04); g.restore();
  };
  const s = it.stk;
  if (s === "118" || s === "112" || s === "label") { rr(); g.fillStyle = bg; g.fill(); txt(it.text ?? s, h * (s === "label" ? 0.5 : 0.72), fg); }
  else if (s === "glasstext") txt(it.text ?? "AMBULANZA", h * 0.8, fg);
  else if (s === "plus") {
    g.beginPath(); g.ellipse(0, 0, W2, H2, 0, 0, Math.PI * 2); g.fillStyle = bg; g.fill();
    g.fillStyle = fg; const a = w * 0.17, b = w * 0.36; g.fillRect(-a, -b, a * 2, b * 2); g.fillRect(-b, -a, b * 2, a * 2);
  } else if (s === "ecg") {
    g.beginPath(); g.moveTo(0, H2); g.bezierCurveTo(-W2 * 1.1, H2 * 0.1, -W2 * 0.9, -H2 * 1.1, 0, -H2 * 0.45);
    g.bezierCurveTo(W2 * 0.9, -H2 * 1.1, W2 * 1.1, H2 * 0.1, 0, H2); g.fillStyle = bg; g.fill();
    g.strokeStyle = fg; g.lineWidth = h * 0.07; g.lineJoin = "round"; g.lineCap = "round"; g.beginPath();
    const pts: [number, number][] = [[-0.62, 0], [-0.25, 0], [-0.12, -0.35], [0.02, 0.35], [0.14, -0.15], [0.22, 0], [0.62, 0]];
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h))); g.stroke();
  } else if (s === "dae") {
    rr(); g.fillStyle = bg; g.fill();
    g.beginPath(); const hw = W2 * 0.62, hh = H2 * 0.62;
    g.moveTo(0, hh); g.bezierCurveTo(-hw * 1.1, hh * 0.1, -hw * 0.9, -hh * 1.1, 0, -hh * 0.45); g.bezierCurveTo(hw * 0.9, -hh * 1.1, hw * 1.1, hh * 0.1, 0, hh);
    g.fillStyle = fg; g.fill();
    g.beginPath(); g.moveTo(w * 0.04, -h * 0.22); g.lineTo(-w * 0.1, h * 0.04); g.lineTo(0, h * 0.04); g.lineTo(-w * 0.04, h * 0.24); g.lineTo(w * 0.1, -h * 0.02); g.lineTo(0, -h * 0.02); g.closePath();
    g.fillStyle = bg; g.fill();
  } else if (s === "dots") {
    const n = Math.max(2, Math.round(w / h)); g.fillStyle = bg;
    for (let i = 0; i < n; i++) { g.beginPath(); g.arc(-W2 + (w / n) * (i + 0.5), 0, Math.min(H2, w / n / 2) * 0.8, 0, Math.PI * 2); g.fill(); }
  }
}

// ---------- disegno delle forme ----------
export const imgCache = new Map<string, HTMLImageElement>();
function shapePath(g: CanvasRenderingContext2D, t: Kind, w: number, h: number) {
  const W2 = w / 2, H2 = h / 2;
  const poly = (pts: [number, number][]) => { g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); };
  g.beginPath();
  if (t === "rect") g.rect(-W2, -H2, w, h);
  else if (t === "roundrect") {
    const r = Math.min(w, h) * 0.3;
    g.moveTo(-W2 + r, -H2); g.arcTo(W2, -H2, W2, H2, r); g.arcTo(W2, H2, -W2, H2, r); g.arcTo(-W2, H2, -W2, -H2, r); g.arcTo(-W2, -H2, W2, -H2, r); g.closePath();
  } else if (t === "ellipse") g.ellipse(0, 0, W2, H2, 0, 0, Math.PI * 2);
  else if (t === "tri") poly([[0, -H2], [W2, H2], [-W2, H2]]);
  else if (t === "diamond") poly([[0, -H2], [W2, 0], [0, H2], [-W2, 0]]);
  else if (t === "hex") poly(Array.from({ length: 6 }, (_, i) => [Math.cos((Math.PI / 3) * i) * W2, Math.sin((Math.PI / 3) * i) * H2] as [number, number]));
  else if (t === "star") poly(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (Math.PI / 5) * i, k = i % 2 ? 0.45 : 1; return [Math.cos(a) * W2 * k, Math.sin(a) * H2 * k] as [number, number]; }));
  else if (t === "chevron") { const k = w * 0.38; poly([[-W2, -H2], [-W2 + k, -H2], [W2, 0], [-W2 + k, H2], [-W2, H2], [W2 - k, 0]]); }
  else if (t === "arrow") poly([[-W2, -h / 4], [w / 6, -h / 4], [w / 6, -H2], [W2, 0], [w / 6, H2], [w / 6, h / 4], [-W2, h / 4]]);
  else if (t === "wave") {
    const n = 48, top: [number, number][] = [], bot: [number, number][] = [];
    for (let i = 0; i <= n; i++) { const x = -W2 + (w * i) / n, c = (h / 4) * Math.sin((i / n) * Math.PI * 4); top.push([x, c - h / 4]); bot.push([x, c + h / 4]); }
    poly([...top, ...bot.reverse()]);
  } else if (t === "swoosh") {
    g.moveTo(-W2, H2); g.quadraticCurveTo(-W2 * 0.1, H2 * 0.9, W2, -H2);
    g.lineTo(W2, -H2 + h * 0.38); g.quadraticCurveTo(-W2 * 0.05, H2 * 1.05, -W2 + w * 0.12, H2); g.closePath();
  } else if (t === "pent" || t === "oct") {
    const n = t === "pent" ? 5 : 8, off = t === "pent" ? -Math.PI / 2 : Math.PI / 8;
    poly(Array.from({ length: n }, (_, i) => [Math.cos(off + (2 * Math.PI * i) / n) * W2, Math.sin(off + (2 * Math.PI * i) / n) * H2] as [number, number]));
  } else if (t === "plus") { const a = w / 6, b = h / 6; poly([[-a, -H2], [a, -H2], [a, -b], [W2, -b], [W2, b], [a, b], [a, H2], [-a, H2], [-a, b], [-W2, b], [-W2, -b], [-a, -b]]); }
  else if (t === "trap") poly([[-W2 * 0.6, -H2], [W2 * 0.6, -H2], [W2, H2], [-W2, H2]]);
  else if (t === "para") poly([[-W2 + w * 0.25, -H2], [W2, -H2], [W2 - w * 0.25, H2], [-W2, H2]]);
  else if (t === "bolt") poly([[w * 0.1, -H2], [-W2 * 0.7, h * 0.08], [-w * 0.02, h * 0.08], [-w * 0.12, H2], [W2 * 0.7, -h * 0.1], [w * 0.02, -h * 0.1]]);
  else if (t === "ring") { g.ellipse(0, 0, W2, H2, 0, 0, Math.PI * 2); g.moveTo(W2 * 0.6, 0); g.ellipse(0, 0, W2 * 0.6, H2 * 0.6, 0, 0, Math.PI * 2, true); }
  else if (t === "halfc") { g.ellipse(-W2, 0, w, H2, 0, -Math.PI / 2, Math.PI / 2); g.closePath(); }
  else if (t === "crescent") { g.ellipse(0, 0, W2, H2, 0, Math.PI / 2, (Math.PI * 3) / 2); g.ellipse(-W2 * 0.35, 0, W2 * 0.55, H2, 0, (Math.PI * 3) / 2, Math.PI / 2, true); g.closePath(); }
  else if (t === "drop") { g.moveTo(0, -H2); g.bezierCurveTo(W2 * 0.4, -H2 * 0.3, W2, H2 * 0.15, W2, H2 * 0.4); g.arc(0, H2 * 0.4, W2, 0, Math.PI); g.bezierCurveTo(-W2, H2 * 0.15, -W2 * 0.4, -H2 * 0.3, 0, -H2); g.closePath(); }
  else if (t === "shield") { g.moveTo(-W2, -H2); g.lineTo(W2, -H2); g.lineTo(W2, 0); g.quadraticCurveTo(W2, H2 * 0.7, 0, H2); g.quadraticCurveTo(-W2, H2 * 0.7, -W2, 0); g.closePath(); }
  else if (t === "heart") {
    g.moveTo(0, H2); g.bezierCurveTo(-W2 * 1.1, H2 * 0.1, -W2 * 0.9, -H2 * 1.1, 0, -H2 * 0.45);
    g.bezierCurveTo(W2 * 0.9, -H2 * 1.1, W2 * 1.1, H2 * 0.1, 0, H2); g.closePath();
  }
}
function fillOf(g: CanvasRenderingContext2D, it: Item, w: number, h: number): string | CanvasGradient {
  if (!it.g2 && !it.gfade) return it.fill;
  const end = it.gfade ? it.fill + "00" : (it.g2 ?? "#ffffff");
  let gr: CanvasGradient;
  if (it.gdir === "r") gr = g.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) / 2);
  else {
    const a = ((it.gang ?? (it.gdir === "v" ? 90 : 0)) * Math.PI) / 180;
    const dx = (Math.cos(a) * w) / 2, dy = (Math.sin(a) * h) / 2;
    gr = g.createLinearGradient(-dx, -dy, dx, dy);
  }
  gr.addColorStop(0, it.fill);
  if (it.g3 && !it.gfade) gr.addColorStop(0.5, it.g3);
  gr.addColorStop(1, end);
  return gr;
}
export function drawItems(g: CanvasRenderingContext2D, items: Item[]) {
  for (const it of items) {
    g.save();
    g.globalAlpha = it.op;
    const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
    if (it.t === "line") {
      g.strokeStyle = it.stroke; g.lineWidth = Math.max(1, it.sw); g.lineCap = "round";
      g.beginPath(); g.moveTo(it.x, it.y); g.lineTo(it.x + it.w, it.y + it.h); g.stroke();
    } else if (it.t === "path") {
      const pts = it.pts ?? [];
      if (pts.length > 1) {
        g.strokeStyle = it.stroke; g.lineWidth = Math.max(1, it.sw); g.lineCap = "round"; g.lineJoin = "round";
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts.slice(1)) g.lineTo(x, y); g.stroke();
      }
    } else {
      g.translate(cx, cy); g.rotate((it.r * Math.PI) / 180); if (it.flip) g.scale(-1, 1);
      const w = Math.abs(it.w), h = Math.abs(it.h);
      if (FILLABLE.includes(it.t)) {
        shapePath(g, it.t, w, h);
        if (it.fill !== "none") { g.fillStyle = fillOf(g, it, w, h); g.fill(it.t === "ring" ? "evenodd" : "nonzero"); }
        if (it.sw > 0) { g.strokeStyle = it.stroke; g.lineWidth = it.sw; g.lineJoin = "round"; g.stroke(); }
      } else if (it.t === "stripes" || it.t === "polka" || it.t === "zigzag" || it.t === "grid") {
        g.save(); g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.clip();
        const c2 = it.c2 ?? "#1D4ED8", u = Math.max(4, Math.min(w, h) / 3);
        g.fillStyle = it.fill; g.fillRect(-w / 2, -h / 2, w, h);
        if (it.t === "stripes") {
          g.fillStyle = c2;
          for (let x = -w / 2 - h; x < w / 2 + h; x += u * 2) { g.beginPath(); g.moveTo(x, h / 2); g.lineTo(x + u, h / 2); g.lineTo(x + u + h, -h / 2); g.lineTo(x + h, -h / 2); g.closePath(); g.fill(); }
        } else if (it.t === "polka") {
          g.fillStyle = c2; const st = u * 1.2;
          for (let y = -h / 2 + st / 2, row = 0; y < h / 2 + st; y += st, row++) for (let x = -w / 2 + (row % 2 ? st : st / 2); x < w / 2 + st; x += st) { g.beginPath(); g.arc(x, y, st * 0.28, 0, Math.PI * 2); g.fill(); }
        } else if (it.t === "zigzag") {
          g.strokeStyle = c2; g.lineWidth = Math.max(2, h * 0.18); g.lineJoin = "miter"; g.beginPath();
          const st = h * 0.8; let up = true; g.moveTo(-w / 2, h * 0.25);
          for (let x = -w / 2; x <= w / 2 + st; x += st / 2, up = !up) g.lineTo(x, up ? -h * 0.25 : h * 0.25);
          g.stroke();
        } else {
          g.strokeStyle = c2; g.lineWidth = Math.max(1.5, u * 0.12);
          for (let x = -w / 2; x <= w / 2; x += u) { g.beginPath(); g.moveTo(x, -h / 2); g.lineTo(x, h / 2); g.stroke(); }
          for (let y = -h / 2; y <= h / 2; y += u) { g.beginPath(); g.moveTo(-w / 2, y); g.lineTo(w / 2, y); g.stroke(); }
        }
        g.restore();
      } else if (it.t === "checker") {
        const cell = h / 2, n = Math.max(1, Math.round(w / cell));
        const cw = w / n;
        for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
          g.fillStyle = (i + j) % 2 ? (it.c2 ?? "#1D4ED8") : it.fill;
          g.fillRect(-w / 2 + i * cw, -h / 2 + j * cell, cw + 0.5, cell + 0.5);
        }
      } else if (it.t === "text") {
        g.textAlign = "center"; g.textBaseline = "middle";
        g.font = `${it.bold ? "900 " : "600 "}${Math.max(6, h * 0.82)}px Arial, sans-serif`;
        const tw = g.measureText(it.text ?? "").width || 1;
        g.save(); g.scale(w / tw, 1);
        // bordo solo all'esterno delle lettere: prima il contorno (doppio e arrotondato), poi le lettere sopra
        if (it.sw > 0) { g.strokeStyle = it.stroke; g.lineWidth = it.sw * 2; g.lineJoin = "round"; g.lineCap = "round"; g.miterLimit = 2; g.strokeText(it.text ?? "", 0, 0); }
        g.fillStyle = fillOf(g, it, tw, h); g.fillText(it.text ?? "", 0, 0);
        g.restore();
      } else if (it.t === "sticker") {
        drawSticker(g, it, w, h);
      } else if (it.t === "image" && it.src) {
        const im = imgCache.get(it.src);
        if (im?.complete) g.drawImage(im, -w / 2, -h / 2, w, h);
      }
    }
    g.restore();
  }
}
/** livrea finale: le forme stanno solo sulla carrozzeria, e vetri/ruote/ombre restano visibili sopra (moltiplica) */
export function compose(blank: HTMLCanvasElement, items: Item[], paint?: HTMLCanvasElement | null, glass?: HTMLCanvasElement | null): HTMLCanvasElement {
  const W = blank.width, H = blank.height;
  const d = document.createElement("canvas"); d.width = W; d.height = H;
  const dg = d.getContext("2d")!; drawItems(dg, items.filter((i) => !i.glass));
  dg.globalCompositeOperation = "destination-in"; dg.drawImage(paint ?? blank, 0, 0);
  const o = document.createElement("canvas"); o.width = W; o.height = H;
  const og = o.getContext("2d")!;
  og.drawImage(blank, 0, 0);
  og.globalCompositeOperation = "multiply"; og.drawImage(d, 0, 0);
  og.globalCompositeOperation = "destination-in"; og.drawImage(blank, 0, 0);
  // adesivi: solo sui vetri (se il mezzo non ha vetri riconoscibili, su tutta la sagoma)
  const top = items.filter((i) => i.glass);
  if (top.length) {
    const t = document.createElement("canvas"); t.width = W; t.height = H;
    const tg = t.getContext("2d")!; drawItems(tg, top);
    tg.globalCompositeOperation = "destination-in"; tg.drawImage(glass ?? blank, 0, 0);
    og.globalCompositeOperation = "source-over"; og.drawImage(t, 0, 0);
  }
  return o;
}
export const bbox = (it: Item) => {
  if (it.t === "path" && it.pts?.length) {
    const xs = it.pts.map((p) => p[0]), ys = it.pts.map((p) => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  return { x: Math.min(it.x, it.x + it.w), y: Math.min(it.y, it.y + it.h), w: Math.abs(it.w), h: Math.abs(it.h) };
};
