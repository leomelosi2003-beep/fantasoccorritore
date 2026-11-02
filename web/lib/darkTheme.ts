// Tema scuro vero (niente inversione): i colori chiari usati negli stili del gioco
// vengono sostituiti con una palette scura pensata apposta. Vale solo con <html class="dark">.

const BG: Record<string, string> = {
  // pagine e carte
  "#fff": "#1b1f27", "#ffffff": "#1b1f27", "#f4f4f1": "#0f1217", "#f6f6f4": "#232834", "#f0f0ec": "#232834",
  "#eee": "#2a303c", "#f1f1f1": "#2a303c", "#f3f3f3": "#2a303c", "#e5e5e0": "#2a303c", "#ddd": "#2a303c",
  // tasti scuri: un po' più chiari per staccare dallo sfondo
  "#111": "#2b3240", "#333": "#363e4e",
  // sfondi pastello → versioni scure dello stesso colore
  "#fff1f1": "#3a1d22", "#fff3f3": "#3a1d22", "#FFFBEB": "#3a3120", "#FFF7ED": "#3a2a1c", "#FEF3C7": "#3a3120",
  "#DCFCE7": "#163321", "#effaf1": "#163321", "#DBEAFE": "#1a2a47", "#EFF6FF": "#1a2a47", "#E5E7EB": "#2f3542",
  "#F5F3FF": "#2a2342", "#EDE9FE": "#2f2650",
};
const FG: Record<string, string> = {
  "#111": "#eceef3", "#333": "#d5d9e1", "#374151": "#d5d9e1", "#555": "#b4bac6", "#666": "#a9b0bd", "#777": "#9aa1ad",
  "#888": "#959cab", "#999": "#8d93a0", "#6B7280": "#a3aab8",
  "#166534": "#6ee7a0", "#15803D": "#4ade80", "#16A34A": "#4ade80",
  "#1E40AF": "#93b4ff", "#2563EB": "#7aa7ff", "#1E3A8A": "#93b4ff",
  "#92400E": "#f5c072", "#B45309": "#f0a54a", "#A16207": "#f0c14a", "#a16207": "#f0c14a", "#CA8A04": "#f0c14a",
  "#B91C1C": "#ff8f8f", "#a00": "#ff8f8f", "#900": "#ff8f8f", "#DC2626": "#ff7a7a",
  "#7C3AED": "#b9a2ff", "#5B21B6": "#c9b6ff",
};
const BORDER = ["#ccc", "#ddd", "#eee", "#f0f0f0", "#e99"];

function rgb(hex: string) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

// Lo stile scritto nella pagina può essere "background:#fff" (dal server) o "background: rgb(255, 255, 255)" (dal browser)
function sel(prop: string, hex: string) {
  const r = rgb(hex);
  return [
    `html.dark [style*="${prop}:${hex};"]`, `html.dark [style$="${prop}:${hex}"]`,
    `html.dark [style*="${prop}: ${r};"]`, `html.dark [style*="${prop}: ${r} "]`,
  ].join(",\n");
}

const rules: string[] = [];
for (const [hex, dark] of Object.entries(BG)) rules.push(`${sel("background", hex)} { background: ${dark} !important; }`);
for (const [hex, light] of Object.entries(FG)) {
  rules.push(`${sel("color", hex)} { color: ${light} !important; }`);
}
for (const hex of BORDER) {
  const r = rgb(hex);
  rules.push(`html.dark [style*="solid ${hex}"], html.dark [style*="solid ${r}"] { border-color: #3a4152 !important; }`);
}

export const DARK_CSS = `
html.dark, html.dark body { background: #0f1217; color: #eceef3; color-scheme: dark; }
html.dark input, html.dark select, html.dark textarea {
  background: #232834 !important; color: #eceef3 !important; border-color: #3a4152 !important; }
html.dark input::placeholder, html.dark textarea::placeholder { color: #7d8594; }
html.dark ::-webkit-scrollbar { width: 10px; height: 10px; }
html.dark ::-webkit-scrollbar-thumb { background: #363e4e; border-radius: 6px; }
html.dark ::-webkit-scrollbar-track { background: #151920; }

/* mappa scura: le strade restano leggibili */
html.dark .leaflet-container { background: #0f1217; }
html.dark .leaflet-tile-pane { filter: brightness(.62) invert(1) contrast(1.15) hue-rotate(195deg) saturate(.35) brightness(.95); }
html.dark .leaflet-popup-content-wrapper, html.dark .leaflet-popup-tip { background: #1b1f27; color: #eceef3;
  box-shadow: 0 6px 22px rgba(0,0,0,.6); }
html.dark .leaflet-popup-content-wrapper a, html.dark .leaflet-container a.leaflet-popup-close-button { color: #a9b0bd; }
html.dark .leaflet-bar a, html.dark .leaflet-bar a:hover { background: #1b1f27; color: #eceef3; border-bottom-color: #2a303c; }
html.dark .leaflet-control-attribution { background: rgba(15,18,23,.75) !important; color: #8d93a0; }
html.dark .leaflet-control-attribution a { color: #a9b0bd; }

/* pezzi della mappa disegnati con le classi del gioco */
html.dark .fs-pill, html.dark .fs-fleet-btn, html.dark .fs-fleet-list, html.dark .fs-chat, html.dark .fs-theme-btn {
  background: #1b1f27 !important; color: #eceef3 !important; box-shadow: 0 4px 16px rgba(0,0,0,.55) !important; }
html.dark .fs-name { color: #eceef3 !important; }
html.dark .fs-money { color: #4ade80 !important; }
html.dark .fs-rep { color: #f0a54a !important; }
html.dark .fs-drawer { background: #1b1f27; box-shadow: 6px 0 28px rgba(0,0,0,.7); }
html.dark .fs-drawer-head { border-bottom-color: #2a303c; }
html.dark .fs-drawer-name, html.dark .fs-drawer-item { color: #eceef3; }
html.dark .fs-drawer-sub { color: #4ade80; }
html.dark .fs-drawer-item:hover { background: #2a303c; }
html.dark .fs-drawer-x { background: #2a303c; color: #eceef3; }
html.dark .fs-drawer-exit { color: #a9b0bd; }
html.dark .fs-burger { background: #2b3240; }
html.dark .fs-chat-btn { background: #2b3240; box-shadow: 0 3px 14px rgba(0,0,0,.6); }
html.dark .fs-pop-label { background: rgba(43,50,64,.95); }

${rules.join("\n")}
`;
