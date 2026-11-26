// Tema scuro vero (niente inversione): i colori chiari usati negli stili del gioco
// vengono sostituiti con una palette scura pensata apposta. Vale solo con <html class="dark">.

const BG: Record<string, string> = {
  // pagine e carte: blu notte profondo
  "#fff": "#111A2E", "#ffffff": "#111A2E", "#f4f4f1": "#070D1A", "#f6f6f4": "#17233D", "#f0f0ec": "#17233D",
  "#eee": "#17233D", "#f1f1f1": "#17233D", "#f3f3f3": "#17233D", "#e5e5e0": "#1C2A47", "#ddd": "#1C2A47", "#F8FAFC": "#17233D",
  "#EEF3F8": "#070D1A", "#EEF3FA": "#070D1A", "#fffdf8": "#111A2E", "#E2E8F0": "#1C2A47", "#EEF2F7": "#1C2A47", "#e5e7eb": "#1C2A47",
  // tasti scuri
  "#111": "#1E2B48", "#333": "#24324F",
  // sfondi pastello → versioni scure dello stesso colore
  "#fff1f1": "#3A1622", "#fff3f3": "#3A1622", "#FEF2F2": "#3A1622", "#FEE2E2": "#3A1622", "#FFFBEB": "#33290F", "#FFF7ED": "#3A2412", "#FEF3C7": "#33290F",
  "#DCFCE7": "#0F3324", "#effaf1": "#0F3324", "#ECFDF5": "#0F3324", "#DBEAFE": "#162A52", "#EFF6FF": "#162A52", "#E0F2FE": "#0E2C44", "#E5E7EB": "#1C2A47",
  "#F5F3FF": "#251C47", "#EDE9FE": "#2A1F55",
};
const FG: Record<string, string> = {
  "#111": "#E6EDF7", "#333": "#CBD5E1", "#374151": "#CBD5E1", "#555": "#A8B4C7", "#666": "#9AA8BD", "#777": "#8D9BB2",
  "#888": "#8D9BB2", "#999": "#7B8BA5", "#6B7280": "#9AA8BD", "#64748B": "#93A3BA", "#475569": "#A8B4C7", "#0F172A": "#E6EDF7", "#13294B": "#BFD3F5",
  "#166534": "#6EE7A0", "#15803D": "#4ADE80", "#16A34A": "#4ADE80",
  "#1E40AF": "#93B4FF", "#2563EB": "#7AA7FF", "#1E3A8A": "#93B4FF", "#1D4ED8": "#7AA7FF",
  "#92400E": "#F5C072", "#B45309": "#F0A54A", "#A16207": "#F0C14A", "#a16207": "#F0C14A", "#CA8A04": "#F0C14A", "#9A3412": "#FDBA74",
  "#B91C1C": "#FF8F8F", "#a00": "#FF8F8F", "#900": "#FF8F8F", "#DC2626": "#FF7A7A", "#991B1B": "#FCA5A5",
  "#7C3AED": "#B9A2FF", "#5B21B6": "#C9B6FF",
};
const BORDER = ["#ccc", "#ddd", "#eee", "#f0f0f0", "#e99", "#E9EEF6", "#E2E8F0", "#e5e5e0"];

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
  rules.push(`html.dark [style*="solid ${hex}"], html.dark [style*="solid ${r}"] { border-color: rgba(148,163,184,.2) !important; }`);
}

export const DARK_CSS = `
html.dark, html.dark body { background: #070D1A; color: #E6EDF7; color-scheme: dark; }
html.dark input, html.dark select, html.dark textarea {
  background: #232834 !important; color: #eceef3 !important; border-color: #3a4152 !important; }
html.dark input::placeholder, html.dark textarea::placeholder { color: #7d8594; }
html.dark ::-webkit-scrollbar { width: 10px; height: 10px; }
html.dark ::-webkit-scrollbar-thumb { background: #363e4e; border-radius: 6px; }
html.dark ::-webkit-scrollbar-track { background: #151920; }

/* mappa scura: le strade restano leggibili */
html.dark .leaflet-container { background: #070D1A; }
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
