// Tema "chiaro moderno": superfici bianche a vetro, ombre morbide, angoli ampi, colori vivi del 118.
// Si applica sopra gli stili già esistenti (viene inserito dopo, quindi vince a parità di regola) e solo nel tema chiaro.

const L = "html:not(.dark)";

export const MODERN_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap");
:root {
  --m-bg: #F3F6FB; --m-surface: rgba(255,255,255,.86); --m-line: rgba(15,23,42,.07);
  --m-ink: #0B1B33; --m-sub: #5B6B82; --m-navy: #13294B; --m-blue: #2563EB; --m-red: #E11D48; --m-orange: #F26B1D;
  --m-shadow: 0 1px 2px rgba(15,23,42,.05), 0 10px 30px rgba(15,23,42,.10);
  --m-shadow-lg: 0 2px 6px rgba(15,23,42,.06), 0 22px 50px rgba(15,23,42,.18);
  --m-r: 18px;
}
${L} body { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--m-ink); background: var(--m-bg);
  -webkit-font-smoothing: antialiased; letter-spacing: -0.005em; }

/* ---------------- pagine ---------------- */
/* barra in alto delle pagine (prima blu notte piatta): sfumatura viva, angoli in basso arrotondati */
${L} main > div:first-child[style*="rgb(17, 17, 17)"], ${L} main > div:first-child[style*="background:#111"] {
  background: radial-gradient(circle at 85% -40%, rgba(255,255,255,.28), transparent 50%), linear-gradient(135deg, #1E40AF, #13294B 75%) !important;
  border-radius: 0 0 26px 26px; box-shadow: 0 12px 30px rgba(19,41,75,.28) !important; }
/* carte bianche */
${L} main [style*="border-radius: 14px"][style*="rgb(255, 255, 255)"], ${L} main [style*="border-radius: 12px"][style*="rgb(255, 255, 255)"],
${L} main [style*="border-radius: 16px"][style*="rgb(255, 255, 255)"] {
  border-radius: var(--m-r) !important; box-shadow: var(--m-shadow) !important; border: 1px solid var(--m-line); }
/* tasti scuri: diventano blu vivo con sfumatura */
${L} main button[style*="rgb(17, 17, 17)"], ${L} main button[style*="background:#111"] {
  background: linear-gradient(135deg, #3B82F6, #1D4ED8) !important; box-shadow: 0 6px 16px rgba(37,99,235,.35); border-radius: 12px !important; }
${L} main button:hover:not(:disabled) { filter: brightness(1.05); }
${L} main input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=color]), ${L} main select, ${L} main textarea {
  border-radius: 12px !important; border: 1px solid #D5DEEA !important; background: #fff; transition: box-shadow .15s, border-color .15s; }
${L} main input:focus, ${L} main select:focus, ${L} main textarea:focus { outline: none; border-color: #93C5FD !important; box-shadow: 0 0 0 4px rgba(59,130,246,.18); }
${L} ::-webkit-scrollbar { width: 10px; height: 10px; }
${L} ::-webkit-scrollbar-thumb { background: #C9D4E3; border-radius: 99px; border: 2px solid transparent; background-clip: padding-box; }

/* ---------------- mappa: comandi a vetro ---------------- */
${L} .fs-pill, ${L} .fs-fleet-btn, ${L} .fs-theme-btn, ${L} .fs-legend-btn {
  background: var(--m-surface) !important; backdrop-filter: saturate(1.6) blur(18px); -webkit-backdrop-filter: saturate(1.6) blur(18px);
  border: 1px solid rgba(255,255,255,.7) !important; box-shadow: var(--m-shadow) !important; border-radius: 18px !important; color: var(--m-ink) !important; }
${L} .fs-theme-btn, ${L} .fs-legend-btn { border-radius: 999px !important; }
${L} .fs-pill:hover, ${L} .fs-fleet-btn:hover { box-shadow: var(--m-shadow-lg) !important; }
${L} .fs-name { color: var(--m-ink) !important; font-weight: 800; letter-spacing: -0.01em; }
${L} .fs-money { color: #059669 !important; font-weight: 900; }
${L} .fs-burger { border-radius: 16px !important; background: linear-gradient(135deg, #FF8A3D, #E11D48) !important; box-shadow: 0 10px 24px rgba(225,29,72,.35) !important; }
${L} .fs-fleet-ico { border-radius: 16px !important; background: linear-gradient(135deg, #60A5FA, #1D4ED8) !important; box-shadow: 0 10px 24px rgba(37,99,235,.35) !important; }
${L} .fs-chat-btn { background: linear-gradient(135deg, #3B82F6, #1E3A8A) !important; box-shadow: 0 10px 24px rgba(30,58,138,.4) !important; }
${L} .fs-fuel-bar { background: #E7EDF5 !important; height: 8px !important; }
${L} .fs-stats-pop, ${L} .fs-fleet-list, ${L} .fs-legend-box, ${L} .fs-chat {
  border-radius: 22px !important; box-shadow: var(--m-shadow-lg) !important; border: 1px solid var(--m-line) !important;
  background: rgba(255,255,255,.96) !important; backdrop-filter: blur(16px); }
${L} .fs-stats-head, ${L} .fs-fleet-head { background: linear-gradient(135deg, #2563EB, #13294B) !important; border-bottom: none !important; }
${L} .fs-stat-btn { border-radius: 12px !important; background: #EEF3FA !important; }
${L} .fs-note { border-radius: 18px !important; background: linear-gradient(135deg, #FF8A3D, #E11D48) !important; }
${L} .leaflet-control-zoom { border: none !important; box-shadow: var(--m-shadow) !important; border-radius: 16px !important; overflow: hidden; }
${L} .leaflet-control-zoom a { width: 40px !important; height: 40px !important; line-height: 40px !important; background: var(--m-surface) !important;
  backdrop-filter: blur(14px); color: var(--m-ink) !important; border-bottom: 1px solid var(--m-line) !important; font-weight: 700; }
${L} .leaflet-popup-content-wrapper { border-radius: 20px !important; box-shadow: var(--m-shadow-lg) !important; }
${L} .fs-mis-meta span { background: #EEF3FA !important; border-radius: 10px !important; }

/* ---------------- menu laterale ---------------- */
${L} .fs-drawer-bg { background: rgba(15,23,42,.32) !important; backdrop-filter: blur(4px); }
${L} .fs-drawer { background: rgba(255,255,255,.97) !important; border-radius: 0 26px 26px 0; box-shadow: 20px 0 60px rgba(15,23,42,.25) !important; }
${L} .fs-drawer-head { background: radial-gradient(circle at 90% -30%, rgba(255,255,255,.3), transparent 55%), linear-gradient(135deg, #2563EB, #13294B) !important;
  border-radius: 0 0 24px 24px !important; box-shadow: 0 10px 26px rgba(30,58,138,.3) !important; }
${L} .fs-drawer-item { border-radius: 14px !important; font-weight: 700 !important; color: var(--m-ink) !important; }
${L} .fs-drawer-item:hover { background: #EEF3FA !important; }
${L} .fs-drawer-ico { border-radius: 13px !important; box-shadow: 0 6px 14px rgba(15,23,42,.18) !important; }
${L} .fs-drawer-group { color: #94A3B8 !important; letter-spacing: .12em !important; }

/* ---------------- barra in basso: isola di vetro galleggiante ---------------- */
@media (max-width: 760px) {
  ${L} .fs-nav { left: 10px !important; right: 10px !important; bottom: calc(8px + env(safe-area-inset-bottom)) !important; padding-bottom: 0 !important;
    height: 62px !important; border-radius: 24px; border-top: none !important; background: rgba(255,255,255,.88) !important;
    backdrop-filter: saturate(1.8) blur(22px); -webkit-backdrop-filter: saturate(1.8) blur(22px);
    box-shadow: 0 2px 6px rgba(15,23,42,.06), 0 18px 40px rgba(15,23,42,.18) !important; border: 1px solid rgba(255,255,255,.8); }
  ${L} body.fs-has-nav { --fs-nav-h: 78px; }
  ${L} .fs-nav a, ${L} .fs-nav button { color: #7C8AA0 !important; font-weight: 700 !important; font-size: 10.5px !important; }
  ${L} .fs-nav .on { color: var(--m-blue) !important; }
  ${L} .fs-nav .on::after { display: none; }
  ${L} .fs-nav .on .ico { transform: translateY(-1px) scale(1.08) !important; filter: drop-shadow(0 4px 8px rgba(37,99,235,.35)); }
  ${L} .fs-nav .on::before { content: ""; position: absolute; inset: 6px 10px; border-radius: 16px; background: linear-gradient(135deg, rgba(59,130,246,.14), rgba(37,99,235,.08)); z-index: -1; }
}
${L} .fs-help-fab { background: linear-gradient(135deg, #FF8A3D, #E11D48) !important; border: 3px solid #fff !important; box-shadow: 0 10px 24px rgba(225,29,72,.35) !important; }
${L} .fs-help { border-radius: 28px 28px 0 0 !important; }
${L} .fs-help-head { background: linear-gradient(135deg, #2563EB, #13294B) !important; border-bottom: none !important; }

/* ---------------- ingresso animato ---------------- */
.fs-splash { position: fixed; inset: 0; z-index: 99999; display: grid; place-items: center; overflow: hidden; cursor: pointer;
  background: radial-gradient(900px 500px at 50% 35%, #FFFFFF, #EAF1FB 60%, #DCE7F7); transition: opacity .5s ease, transform .5s ease; }
.fs-splash.out { opacity: 0; transform: scale(1.04); pointer-events: none; }
.fs-splash .glow { position: absolute; width: 60vmax; height: 60vmax; border-radius: 50%; filter: blur(60px); opacity: .0; top: 50%; }
.fs-splash .glow.b { left: -20vmax; background: #3B82F6; animation: fsSiren 0.9s ease-in-out infinite; }
.fs-splash .glow.r { right: -20vmax; background: #EF4444; animation: fsSiren 0.9s ease-in-out .45s infinite; }
@keyframes fsSiren { 0%,100% { opacity: .05; transform: translateY(-50%) scale(.9) } 50% { opacity: .55; transform: translateY(-50%) scale(1.05) } }
.fs-splash .box { position: relative; text-align: center; padding: 0 24px; }
.fs-splash .logo { width: 132px; height: 132px; border-radius: 34px; box-shadow: 0 24px 60px rgba(19,41,75,.35), 0 0 0 6px #fff;
  animation: fsLogo .9s cubic-bezier(.2,1.4,.3,1) both; }
@keyframes fsLogo { from { transform: scale(.4) rotate(-12deg); opacity: 0 } to { transform: none; opacity: 1 } }
.fs-splash .title { margin-top: 22px; font: 900 clamp(30px, 8vw, 46px)/1 Inter, system-ui, sans-serif; letter-spacing: -0.03em; color: #0B1B33; }
.fs-splash .title span { display: inline-block; opacity: 0; animation: fsLetter .5s cubic-bezier(.2,1.3,.3,1) forwards; }
.fs-splash .title .acc { background: linear-gradient(135deg, #FF8A3D, #E11D48); -webkit-background-clip: text; background-clip: text; color: transparent; }
@keyframes fsLetter { from { opacity: 0; transform: translateY(18px) scale(.8) } to { opacity: 1; transform: none } }
.fs-splash .sub { margin-top: 10px; font: 600 14px Inter, system-ui, sans-serif; color: #5B6B82; letter-spacing: .14em; text-transform: uppercase; opacity: 0; animation: fsFadeUp .6s .9s forwards; }
@keyframes fsFadeUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
.fs-splash .road { position: relative; width: min(360px, 78vw); height: 46px; margin: 26px auto 0; }
.fs-splash .road::before { content: ""; position: absolute; left: 0; right: 0; bottom: 8px; height: 4px; border-radius: 4px;
  background: repeating-linear-gradient(90deg, #CBD5E1 0 18px, transparent 18px 30px); }
.fs-splash .amb { position: absolute; bottom: 10px; left: -40px; font-size: 34px; animation: fsDrive 2.2s .3s cubic-bezier(.5,0,.3,1) forwards; transform: scaleX(-1); }
@keyframes fsDrive { from { left: -40px } to { left: calc(100% - 10px) } }
.fs-splash .bar { width: min(220px, 60vw); height: 6px; margin: 10px auto 0; border-radius: 99px; background: #DCE5F2; overflow: hidden; }
.fs-splash .bar > i { display: block; height: 100%; width: 0; border-radius: 99px; background: linear-gradient(90deg, #3B82F6, #E11D48); animation: fsLoad 2.3s .2s ease-in-out forwards; }
@keyframes fsLoad { to { width: 100% } }
.fs-splash .skip { position: absolute; bottom: calc(22px + env(safe-area-inset-bottom)); left: 0; right: 0; text-align: center; font: 600 12px Inter, system-ui; color: #94A3B8; }
html.dark .fs-splash { background: radial-gradient(900px 500px at 50% 35%, #1E293B, #0B1220); }
html.dark .fs-splash .title { color: #F1F5F9; }
`;

// ============================================================================================
// Sistema grafico v2: tutte le pagine (chiaro + scuro), animazioni leggere solo nel telefono/browser
// ============================================================================================
const D = "html.dark";
function rgbOf(hex: string) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
/** selettore per uno stile scritto nella pagina: "background:#111" (server) o "background: rgb(17, 17, 17)" (browser) */
function bgSel(scope: string, hex: string, tag = "") {
  const r = rgbOf(hex);
  return [`${scope} ${tag}[style*="background:${hex};"]`, `${scope} ${tag}[style$="background:${hex}"]`,
          `${scope} ${tag}[style*="background: ${r};"]`, `${scope} ${tag}[style*="background: ${r} "]`].join(",");
}
// tasti colorati → sfumatura viva con bagliore dello stesso colore
const BTN_GRAD: [string, string, string][] = [
  ["#15803D", "#22C55E", "#15803D"], ["#16A34A", "#34D399", "#16A34A"], ["#DC2626", "#FB7185", "#DC2626"], ["#B91C1C", "#F87171", "#B91C1C"],
  ["#F97316", "#FDBA74", "#EA580C"], ["#EA6A1F", "#FB923C", "#E11D48"], ["#7C3AED", "#A78BFA", "#6D28D9"], ["#2563EB", "#60A5FA", "#1D4ED8"],
  ["#1E3A8A", "#3B82F6", "#1E3A8A"], ["#13294B", "#2563EB", "#13294B"], ["#B45309", "#F59E0B", "#B45309"], ["#0369A1", "#38BDF8", "#0369A1"],
  ["#6B7280", "#94A3B8", "#475569"], ["#5B21B6", "#8B5CF6", "#5B21B6"], ["#F59E0B", "#FCD34D", "#D97706"],
];
const btnRules = BTN_GRAD.map(([hex, a, b]) =>
  `${bgSel("html", hex, "button")} { background: linear-gradient(135deg, ${a}, ${b}) !important; box-shadow: 0 6px 16px ${b}40, inset 0 1px 0 rgba(255,255,255,.25); border-radius: 12px !important; }`).join("\n");

export const MODERN_CSS_V2 = `
/* ---------- tasti: morbidi, si sollevano al passaggio e "si schiacciano" al tocco ---------- */
button { transition: transform .14s cubic-bezier(.2,.9,.3,1.3), box-shadow .18s ease, filter .18s ease, background-color .18s ease !important; }
button:not(:disabled):not([style*="transform"]):hover { transform: translateY(-1px); }
button:not(:disabled):not([style*="transform"]):active { transform: translateY(0) scale(.96); filter: brightness(.96); }
${btnRules}
/* tasto "indietro"/secondario delle testate (prima grigio scuro) → vetro */
${bgSel("html", "#333", "button")} { background: rgba(255,255,255,.16) !important; border: 1px solid rgba(255,255,255,.28) !important; border-radius: 12px !important;
  backdrop-filter: blur(6px); color: #fff !important; }

/* ---------- pagine ---------- */
main > * { animation: fsIn .35s cubic-bezier(.2,.8,.2,1) backwards; }
main > *:nth-child(2) { animation-delay: .04s } main > *:nth-child(3) { animation-delay: .08s } main > *:nth-child(4) { animation-delay: .12s }
@keyframes fsIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
/* testata della pagina */
${L} main > div:first-child[style*="rgb(17, 17, 17)"], ${L} main > div:first-child[style*="background:#111"],
${D} main > div:first-child[style*="rgb(17, 17, 17)"], ${D} main > div:first-child[style*="background:#111"] {
  position: sticky; top: 0; z-index: 50; animation: none; }
${D} main > div:first-child[style*="rgb(17, 17, 17)"], ${D} main > div:first-child[style*="background:#111"] {
  background: radial-gradient(circle at 85% -40%, rgba(96,165,250,.25), transparent 50%), linear-gradient(135deg, #172554, #0B1220 80%) !important;
  border-radius: 0 0 26px 26px; box-shadow: 0 12px 30px rgba(0,0,0,.5) !important; border-bottom: 1px solid rgba(148,163,184,.12); }
/* schede grigie chiare (#eee, #f6f6f4) → azzurrino pulito */
${bgSel(L, "#eee")}, ${bgSel(L, "#f6f6f4")}, ${bgSel(L, "#f1f1f1")}, ${bgSel(L, "#F8FAFC")} { background: #EEF3FA !important; }
/* finestre sopra la pagina: sfondo sfocato, finestra che "salta fuori" */
[style*="position: fixed"][style*="rgba(0, 0, 0, 0.5"], [style*="position: fixed"][style*="rgba(0, 0, 0, 0.4"], [style*="position: fixed"][style*="rgba(0, 0, 0, 0.6"] {
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); animation: fsFade .2s ease backwards; }
[style*="position: fixed"][style*="rgba(0, 0, 0, 0.5"] > div, [style*="position: fixed"][style*="rgba(0, 0, 0, 0.4"] > div, [style*="position: fixed"][style*="rgba(0, 0, 0, 0.6"] > div {
  animation: fsPopIn .28s cubic-bezier(.2,1.2,.3,1) backwards; border-radius: 24px !important; }
@keyframes fsFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes fsPopIn { from { opacity: 0; transform: translateY(14px) scale(.97) } to { opacity: 1; transform: none } }
/* tabelle */
${L} main table { border-collapse: separate; border-spacing: 0; }
${L} main th { background: #F1F5FA; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
/* titoli più decisi */
main h1, main h2, main h3 { letter-spacing: -0.02em; }
/* barre di avanzamento (sfondi grigi sottili) arrotondate */
${L} main [style*="height: 6px"][style*="border-radius"], ${L} main [style*="height: 8px"][style*="border-radius"] { background-color: #E7EDF5; }

/* ---------- modalità notturna nuova: blu notte profondo con vetro ---------- */
${D} { --m-bg: #070D1A; --m-surface: rgba(17,26,46,.78); --m-line: rgba(148,163,184,.14); --m-ink: #E6EDF7; --m-sub: #93A3BA;
  --m-shadow: 0 1px 2px rgba(0,0,0,.4), 0 12px 32px rgba(0,0,0,.45); --m-shadow-lg: 0 24px 60px rgba(0,0,0,.6); }
${D}, ${D} body { background: radial-gradient(1200px 600px at 50% -200px, #12203D, #070D1A 70%) fixed !important; color: #E6EDF7; font-family: Inter, system-ui, sans-serif; }
${D} main [style*="border-radius"][style*="rgb(27, 31, 39)"] { background: #111A2E !important; border: 1px solid rgba(148,163,184,.12); box-shadow: 0 10px 30px rgba(0,0,0,.35) !important; }
${D} .fs-pill, ${D} .fs-fleet-btn, ${D} .fs-theme-btn, ${D} .fs-legend-btn {
  background: rgba(17,26,46,.78) !important; backdrop-filter: saturate(1.4) blur(18px); -webkit-backdrop-filter: saturate(1.4) blur(18px);
  border: 1px solid rgba(148,163,184,.16) !important; box-shadow: 0 12px 30px rgba(0,0,0,.45) !important; border-radius: 18px !important; color: #E6EDF7 !important; }
${D} .fs-theme-btn, ${D} .fs-legend-btn { border-radius: 999px !important; }
${D} .fs-burger { border-radius: 16px !important; background: linear-gradient(135deg, #FB923C, #E11D48) !important; box-shadow: 0 10px 26px rgba(225,29,72,.35) !important; }
${D} .fs-fleet-ico { border-radius: 16px !important; background: linear-gradient(135deg, #3B82F6, #1E3A8A) !important; }
${D} .fs-chat-btn { background: linear-gradient(135deg, #3B82F6, #1E3A8A) !important; border-color: #111A2E !important; }
${D} .fs-stats-pop, ${D} .fs-fleet-list, ${D} .fs-legend-box, ${D} .fs-chat, ${D} .leaflet-popup-content-wrapper {
  background: rgba(13,20,36,.96) !important; color: #E6EDF7 !important; border: 1px solid rgba(148,163,184,.14) !important; border-radius: 22px !important; box-shadow: 0 24px 60px rgba(0,0,0,.6) !important; }
${D} .leaflet-popup-tip { background: rgba(13,20,36,.96) !important; }
${D} .fs-stats-head, ${D} .fs-fleet-head, ${D} .fs-drawer-head, ${D} .fs-help-head { background: linear-gradient(135deg, #1D4ED8, #172554) !important; border-bottom: none !important; }
${D} .fs-mis-body, ${D} .fs-amb-title, ${D} .fs-amb-row b { color: #E6EDF7 !important; }
${D} .fs-mis-meta span, ${D} .fs-stat-btn { background: #17233D !important; color: #E6EDF7 !important; }
${D} .fs-drawer-bg { background: rgba(0,0,0,.45) !important; backdrop-filter: blur(4px); }
${D} .fs-drawer { background: rgba(10,16,30,.97) !important; border-radius: 0 26px 26px 0; border-right: 1px solid rgba(148,163,184,.12); }
${D} .fs-drawer-item { color: #E6EDF7 !important; border-radius: 14px !important; }
${D} .fs-drawer-item:hover { background: #17233D !important; }
${D} .fs-drawer-group { color: #64748B !important; letter-spacing: .12em !important; }
${D} .leaflet-control-zoom a { background: rgba(17,26,46,.85) !important; color: #E6EDF7 !important; border-color: rgba(148,163,184,.14) !important; }
${D} .fs-help { background: #0D1424 !important; border-radius: 28px 28px 0 0 !important; }
${D} input, ${D} select, ${D} textarea { background: #0D1424 !important; border: 1px solid rgba(148,163,184,.22) !important; border-radius: 12px !important; }
${D} input:focus, ${D} select:focus, ${D} textarea:focus { outline: none; border-color: #3B82F6 !important; box-shadow: 0 0 0 4px rgba(59,130,246,.25); }
${D} main th { background: #17233D; color: #93A3BA; }
@media (max-width: 760px) {
  ${D} .fs-nav { left: 10px !important; right: 10px !important; bottom: calc(8px + env(safe-area-inset-bottom)) !important; padding-bottom: 0 !important;
    height: 62px !important; border-radius: 24px; border-top: none !important; background: rgba(13,20,36,.86) !important;
    backdrop-filter: saturate(1.5) blur(22px); -webkit-backdrop-filter: saturate(1.5) blur(22px); border: 1px solid rgba(148,163,184,.16);
    box-shadow: 0 18px 40px rgba(0,0,0,.55) !important; }
  ${D} body.fs-has-nav { --fs-nav-h: 78px; }
  ${D} .fs-nav a, ${D} .fs-nav button { color: #7B8BA5 !important; }
  ${D} .fs-nav .on { color: #60A5FA !important; }
  ${D} .fs-nav .on::after { display: none; }
  ${D} .fs-nav .on::before { content: ""; position: absolute; inset: 6px 10px; border-radius: 16px; background: rgba(59,130,246,.16); z-index: -1; }
}


/* ---------- mappa: testata più chiara da leggere ---------- */
.fs-pill .fs-pill-text { gap: 2px; }
.fs-pill > span:first-child, .fs-pill > div:first-child { border-radius: 12px; box-shadow: 0 0 0 2px #fff, 0 4px 10px rgba(15,23,42,.18); }
.fs-money { font-size: 17px !important; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.fs-rep { border: none !important; background: linear-gradient(135deg, #FEF3C7, #FDE68A) !important; color: #92400E !important; font-weight: 800 !important; }
.fs-chips { gap: 5px !important; margin-top: 3px !important; }
.fs-chips > span { padding: 1px 7px; border-radius: 999px; background: rgba(148,163,184,.14); }
.fs-auto { border-radius: 999px !important; background: linear-gradient(135deg, #14B8A6, #0F766E) !important; padding: 1px 8px !important; }
.fs-fuel-btn, .fs-weather-btn { border-radius: 18px !important; }
.fs-fuel-bar { border-radius: 99px !important; }
.fs-fuel-bar > span { background-image: linear-gradient(90deg, rgba(255,255,255,.25), transparent) !important; }
.fs-legend-box .fs-legend-h { color: #64748B !important; }
.fs-notes .fs-note { backdrop-filter: blur(8px); }
.fs-badge, .fs-fleet-badge { border-width: 2px !important; box-shadow: 0 2px 6px rgba(0,0,0,.25); }
.fs-mis-popup .fs-mis-bar, .fs-amb-popup .fs-amb-bar { background-image: linear-gradient(135deg, rgba(255,255,255,.18), transparent) !important; }
.fs-amb-cancel { border-radius: 12px !important; background: linear-gradient(135deg, #475569, #1E293B) !important; }
${D} .fs-chips > span { background: rgba(148,163,184,.16); }
${D} .fs-pill > span:first-child, ${D} .fs-pill > div:first-child { box-shadow: 0 0 0 2px #111A2E, 0 4px 10px rgba(0,0,0,.4); }


/* ---------- menu a riquadri ---------- */
.fs-drawer { width: min(360px, 92vw) !important; }
.fs-menu-search { margin: 8px 12px 2px; width: calc(100% - 24px); box-sizing: border-box; padding: 10px 12px; border-radius: 14px; border: 1px solid #DCE4EF;
  background: #F3F6FB; font: inherit; font-size: 14px; outline: none; }
.fs-menu-search:focus { border-color: #3B82F6; box-shadow: 0 0 0 4px rgba(59,130,246,.18); }
.fs-mgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 2px 12px 4px; }
.fs-mtile { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 4px 9px; border-radius: 16px;
  border: 1px solid #E6ECF4 !important; background: #fff !important; cursor: pointer; font: inherit; color: #0B1B33 !important;
  box-shadow: 0 2px 6px rgba(15,23,42,.05) !important; }
.fs-mtile:hover { border-color: #BFD3F5 !important; box-shadow: 0 8px 18px rgba(37,99,235,.14) !important; }
.fs-mtile-ico { width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; font-size: 21px;
  box-shadow: 0 6px 14px rgba(15,23,42,.18), inset 0 1px 0 rgba(255,255,255,.3); }
.fs-mtile-l { font-size: 12px; font-weight: 700; line-height: 1.15; text-align: center; }
.fs-mtile-b { position: absolute; top: 4px; right: 6px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px; background: #E11D48; color: #fff;
  font-size: 11px; display: grid; place-items: center; box-shadow: 0 0 0 2px #fff; animation: fsBadge 1.8s ease-in-out infinite; }
@keyframes fsBadge { 0%,100% { transform: scale(1) } 50% { transform: scale(1.15) } }
.fs-mset { margin: 2px 12px 6px; padding: 6px; border-radius: 16px; background: #F3F6FB; }
.fs-mset-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 8px; border: none !important; background: transparent !important;
  font: inherit; font-size: 14px; font-weight: 600; color: #0B1B33 !important; cursor: pointer; border-radius: 12px; box-shadow: none !important; text-align: left; }
.fs-mset-btn { flex: 1; padding: 9px; border-radius: 12px; border: 1px solid #DCE4EF !important; background: #fff !important; color: #0B1B33 !important;
  font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: none !important; }
.fs-switch { width: 40px; height: 24px; border-radius: 99px; background: #CBD5E1; position: relative; flex-shrink: 0; transition: background .2s; }
.fs-switch i { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,.25); transition: left .2s cubic-bezier(.3,1.4,.5,1); }
.fs-switch.on { background: #22C55E; } .fs-switch.on i { left: 19px; }
.fs-switch.mid { background: #60A5FA; } .fs-switch.mid i { left: 11px; }
${D} .fs-menu-search { background: #0D1424 !important; border-color: rgba(148,163,184,.2) !important; color: #E6EDF7; }
${D} .fs-mtile { background: #111A2E !important; border-color: rgba(148,163,184,.14) !important; color: #E6EDF7 !important; }
${D} .fs-mtile-b { box-shadow: 0 0 0 2px #111A2E; }
${D} .fs-mset { background: #0D1424; }
${D} .fs-mset-row { color: #E6EDF7 !important; }
${D} .fs-mset-btn { background: #111A2E !important; border-color: rgba(148,163,184,.18) !important; color: #E6EDF7 !important; }
${D} .fs-switch { background: #334155; }


/* ---------- pannello invio ---------- */
.fs-mp-chips > span { background: rgba(0,0,0,.2); border: 1px solid rgba(255,255,255,.22); border-radius: 999px; padding: 4px 10px; }
.fs-mpanel { border-radius: 24px 0 0 24px; overflow: hidden; }
.fs-mpanel > div:first-child { background-image: linear-gradient(135deg, rgba(255,255,255,.2), transparent 60%) !important; }
.fs-mp-go { background: rgba(255,255,255,.9); backdrop-filter: blur(10px); }
.fs-mp-go button { border-radius: 16px !important; box-shadow: 0 10px 24px rgba(0,0,0,.22) !important; }
.fs-mpanel details > summary { list-style: none; } .fs-mpanel details > summary::after { content: " ▾"; opacity: .6; }
.fs-mpanel details[open] > summary { margin-bottom: 4px; }
${D} .fs-mpanel { background: #0D1424 !important; }
${D} .fs-mp-go { background: rgba(13,20,36,.92); border-top-color: rgba(148,163,184,.14) !important; }
@media (max-width: 640px) { .fs-mpanel { border-radius: 0; } }

/* ---------- meno scorrimento sul telefono ---------- */
@media (max-width: 640px) {
  /* riquadri di riepilogo (numeri): una sola riga che scorre di lato invece di 2-3 righe */
  main div[style*="grid-template-columns: repeat(auto-fit, minmax(118px"], main div[style*="grid-template-columns: repeat(auto-fit, minmax(120px"],
  main div[style*="grid-template-columns: repeat(auto-fit, minmax(130px"], main div[style*="grid-template-columns: repeat(auto-fit, minmax(150px"] {
    display: flex !important; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; padding-bottom: 2px; gap: 8px !important; }
  main div[style*="grid-template-columns: repeat(auto-fit, minmax(118px"] > *, main div[style*="grid-template-columns: repeat(auto-fit, minmax(120px"] > *,
  main div[style*="grid-template-columns: repeat(auto-fit, minmax(130px"] > *, main div[style*="grid-template-columns: repeat(auto-fit, minmax(150px"] > * {
    flex: 0 0 auto; min-width: 112px; scroll-snap-align: start; }
  /* file di filtri a pastiglia: una riga che scorre di lato */
  main div[style*="flex-wrap: wrap"]:has(> button[style*="border-radius: 999px"] ~ button[style*="border-radius: 999px"] ~ button[style*="border-radius: 999px"]) {
    flex-wrap: nowrap !important; overflow-x: auto; scrollbar-width: none; }
  main div[style*="flex-wrap: wrap"]:has(> button[style*="border-radius: 999px"] ~ button[style*="border-radius: 999px"] ~ button[style*="border-radius: 999px"]) > * { flex-shrink: 0; white-space: nowrap; }
  /* spazi più stretti */
  main > div[style*="max-width"] { padding-left: 10px !important; padding-right: 10px !important; padding-top: 4px !important; }
  main [style*="padding: 16px"][style*="border-radius"] { padding: 12px !important; }
  main [style*="margin-bottom: 16px"] { margin-bottom: 10px !important; }
  main h2 { font-size: 18px !important; margin: 14px 2px 8px !important; }
  .fs-ph { margin-bottom: 8px; }
}
/* torna su */
.fs-totop { position: fixed; left: 14px; bottom: calc(var(--fs-nav-h, 0px) + 16px + env(safe-area-inset-bottom)); z-index: 1200; width: 44px; height: 44px;
  border-radius: 50%; border: none; background: linear-gradient(135deg, #3B82F6, #1E3A8A); color: #fff; font-size: 20px; cursor: pointer;
  box-shadow: 0 10px 24px rgba(30,58,138,.35); opacity: 0; transform: translateY(14px) scale(.8); pointer-events: none; transition: all .25s ease !important; }
.fs-totop.show { opacity: 1; transform: none; pointer-events: auto; }


/* ---------- barra in basso con icone disegnate ---------- */
.fs-nav .ico { line-height: 0 !important; }
.fs-nav a:not(.on) .ico svg { filter: saturate(.55) opacity(.75); }
.fs-nav .on .ico svg { filter: drop-shadow(0 4px 8px rgba(37,99,235,.35)); }

/* ---------- PC: barra laterale fissa con tutto il menu ---------- */
.fs-rail { display: none; }
@media (min-width: 900px) {
  .fs-rail { display: flex; flex-direction: column; gap: 2px; position: fixed; z-index: 1240; left: 0; top: 0; bottom: 0; width: 232px; overflow-y: auto;
    padding: 12px 10px 20px; background: rgba(255,255,255,.88); backdrop-filter: saturate(1.4) blur(18px); -webkit-backdrop-filter: saturate(1.4) blur(18px);
    border-right: 1px solid #E2E8F0; scrollbar-width: thin; }
  body:has(.fs-rail) main { margin-left: 232px; }
  body:has(.fs-rail) .fs-help-fab { right: 22px; }
  body:has(.fs-rail) .fs-totop { left: 250px; }
  .fs-rail a { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 12px; color: #0B1B33; text-decoration: none;
    font-size: 14px; font-weight: 600; transition: background .15s, transform .15s; }
  .fs-rail a:hover { background: #EEF3FA; transform: translateX(2px); }
  .fs-rail a.on { background: linear-gradient(135deg, rgba(59,130,246,.16), rgba(37,99,235,.06)); color: #1D4ED8; font-weight: 800; box-shadow: inset 3px 0 0 #2563EB; }
  .fs-rail-home { padding: 8px !important; margin-bottom: 6px; border: 1px solid #E2E8F0; background: #fff; }
  .fs-rail-home span { display: flex; flex-direction: column; line-height: 1.15; }
  .fs-rail-home b { font-size: 14px; } .fs-rail-home small { font-size: 11.5px; color: #64748B; font-weight: 600; }
  .fs-rail-h { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: #94A3B8; padding: 12px 8px 4px; }
  /* pagine più larghe sul PC, con le liste su due colonne dove ha senso */
  main > div[style*="max-width: 760px"], main > div[style*="max-width: 720px"], main > div[style*="max-width: 800px"] { max-width: 1080px !important; }
  .fs-ph-in { max-width: 1120px; }
  .fs-ph { border-radius: 0 0 28px 28px; margin-left: 12px; margin-right: 12px; }
  ${D} .fs-rail { background: rgba(10,16,30,.9); border-right-color: rgba(148,163,184,.12); }
  ${D} .fs-rail a { color: #CBD5E1; } ${D} .fs-rail a:hover { background: #17233D; }
  ${D} .fs-rail a.on { color: #93C5FD; background: rgba(59,130,246,.16); }
  ${D} .fs-rail-home { background: #111A2E; border-color: rgba(148,163,184,.14); }
}


/* ---------- numeri in evidenza e due colonne sul PC ---------- */
.fs-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
.fs-kpi { position: relative; overflow: hidden; background: #fff; border-radius: 18px; padding: 12px 14px; box-shadow: 0 2px 10px rgba(15,23,42,.06); }
.fs-kpi::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 5px; background: var(--k, #2563EB); }
.fs-kpi::after { content: ""; position: absolute; right: -30px; top: -30px; width: 90px; height: 90px; border-radius: 50%; background: var(--k, #2563EB); opacity: .08; }
.fs-kpi span { display: block; font-size: 12.5px; font-weight: 700; color: #64748B; }
.fs-kpi b { display: block; font-size: 22px; font-weight: 900; letter-spacing: -.02em; margin-top: 2px; font-variant-numeric: tabular-nums; }
@media (max-width: 640px) { .fs-kpis { gap: 6px; } .fs-kpi { padding: 10px; border-radius: 14px; } .fs-kpi b { font-size: 15px; } .fs-kpi span { font-size: 11px; } }
.fs-kpis4 { grid-template-columns: repeat(4, 1fr); }
@media (max-width: 760px) { .fs-kpis4 { grid-template-columns: 1fr 1fr; } }
.fs-2col { display: grid; grid-template-columns: 1fr; gap: 0 14px; align-items: start; }
@media (min-width: 1000px) { .fs-2col { grid-template-columns: 1fr 1fr; } }
${D} .fs-kpi { background: #111A2E; border: 1px solid rgba(148,163,184,.12); }
${D} .fs-kpi span { color: #93A3BA; }
main details > summary { list-style: none; }
main details > summary::-webkit-details-marker { display: none; }
main details > summary::after { content: "▾"; float: right; opacity: .5; transition: transform .2s; }
main details[open] > summary::after { transform: rotate(180deg); }
main details[open] > summary { margin-bottom: 8px; }


/* ---------- trasferimenti: percorso da → a ---------- */
.fs-cards2 { display: grid; gap: 10px; grid-template-columns: 1fr; }
@media (min-width: 1000px) { .fs-cards2 { grid-template-columns: 1fr 1fr; } }
.fs-trf-route { position: relative; padding-left: 20px; }
.fs-trf-route::before { content: ""; position: absolute; left: 5px; top: 11px; bottom: 11px; border-left: 2px dashed #94A3B8; }
.fs-trf-route > div { position: relative; font-weight: 800; font-size: 15px; line-height: 1.35; padding: 2px 0; }
.fs-trf-route > div > i { position: absolute; left: -20px; top: 7px; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 0 3px #fff, 0 0 0 4px #CBD5E1; }
${D} .fs-trf { background: #111A2E !important; border: 1px solid rgba(148,163,184,.12); }
${D} .fs-trf-route > div > i { box-shadow: 0 0 0 3px #111A2E, 0 0 0 4px #334155; }


/* ---------- obiettivi a carte ---------- */
.fs-obj-sec { margin-bottom: 18px; }
.fs-obj-head { display: flex; align-items: flex-end; gap: 10px; margin: 4px 2px 10px; }
.fs-obj-head > div { flex: 1; }
.fs-obj-head h2 { margin: 0 !important; font-size: 20px; } .fs-obj-head h2 small { font-size: 13px; color: #64748B; font-weight: 700; margin-left: 6px; }
.fs-obj-head p { margin: 2px 0 0; font-size: 13px; color: #64748B; }
.fs-obj-time { flex-shrink: 0; background: #FEF3C7; color: #92400E; font-weight: 800; font-size: 12.5px; padding: 5px 10px; border-radius: 999px; }
.fs-obj-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
@media (max-width: 640px) { .fs-obj-grid { grid-template-columns: 1fr 1fr; gap: 8px; } }
.fs-obj { background: #fff; border-radius: 20px; padding: 14px 12px 12px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px;
  box-shadow: 0 2px 12px rgba(15,23,42,.07); border: 2px solid transparent; transition: transform .2s; }
.fs-obj.ready { border-color: #22C55E; box-shadow: 0 0 0 4px rgba(34,197,94,.15), 0 10px 24px rgba(22,163,74,.2); animation: fsObjGlow 2s ease-in-out infinite; }
@keyframes fsObjGlow { 0%,100% { box-shadow: 0 0 0 4px rgba(34,197,94,.12), 0 10px 24px rgba(22,163,74,.15) } 50% { box-shadow: 0 0 0 8px rgba(34,197,94,.2), 0 10px 30px rgba(22,163,74,.3) } }
.fs-obj.done { opacity: .6; }
.fs-obj-ring { position: relative; width: 64px; height: 64px; }
.fs-obj-ring span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 26px; }
.fs-obj-t { font-weight: 800; font-size: 14px; line-height: 1.25; min-height: 35px; display: flex; align-items: center; }
.fs-obj-n { font-size: 12.5px; color: #64748B; font-weight: 700; font-variant-numeric: tabular-nums; }
.fs-obj-prize { font-size: 12.5px; font-weight: 800; color: #B45309; background: #FFFBEB; border-radius: 999px; padding: 2px 9px; }
.fs-obj-btn { margin-top: 6px; width: 100%; padding: 9px 8px; border: none; border-radius: 12px; font: inherit; font-weight: 800; font-size: 13.5px; cursor: pointer;
  color: #fff; background: linear-gradient(135deg, #22C55E, #15803D); box-shadow: 0 6px 14px rgba(22,163,74,.3); }
.fs-obj-btn.off { background: #EEF2F7 !important; color: #64748B !important; box-shadow: none !important; cursor: default; }
${D} .fs-obj { background: #111A2E; border-color: rgba(148,163,184,.12); }
${D} .fs-obj.ready { border-color: #22C55E; }
${D} .fs-obj-prize { background: #33290F; color: #F5C072; }
${D} .fs-obj-btn.off { background: #17233D !important; color: #93A3BA !important; }
${D} .fs-obj-ring circle:first-child { stroke: #1C2A47; }


/* ---------- novità: linea del tempo ---------- */
.fs-tl { position: relative; padding-left: 22px; }
.fs-tl::before { content: ""; position: absolute; left: 7px; top: 8px; bottom: 8px; width: 3px; border-radius: 3px; background: linear-gradient(#A78BFA, #E2E8F0); }
.fs-tl-day { margin-bottom: 14px; }
.fs-tl-date { position: relative; font-weight: 800; font-size: 13px; color: #6D28D9; margin: 0 0 8px; }
.fs-tl-date::before { content: ""; position: absolute; left: -21px; top: 2px; width: 13px; height: 13px; border-radius: 50%; background: #7C3AED; box-shadow: 0 0 0 4px #EDE9FE; }
.fs-tl-item { background: #fff; border-radius: 18px; padding: 12px 14px; margin-bottom: 8px; box-shadow: 0 2px 10px rgba(15,23,42,.06); }
.fs-tl-item.first { border: 2px solid #A78BFA; box-shadow: 0 10px 26px rgba(124,58,237,.18); }
.fs-tl-title { font-weight: 800; font-size: 15.5px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.fs-tl-new { background: linear-gradient(135deg, #A78BFA, #6D28D9); color: #fff; border-radius: 999px; padding: 1px 8px; font-size: 10.5px; font-weight: 900; letter-spacing: .06em; }
.fs-tl-item ul { margin: 6px 0 0; padding-left: 18px; color: #334155; font-size: 14px; line-height: 1.5; }
.fs-tl-item li { margin-bottom: 3px; }
.fs-tl-more { width: 100%; padding: 12px; border-radius: 14px; border: 2px dashed #C4B5FD !important; background: transparent !important; color: #6D28D9 !important; font: inherit; font-weight: 800; cursor: pointer; box-shadow: none !important; }
${D} .fs-tl-item { background: #111A2E; border: 1px solid rgba(148,163,184,.12); }
${D} .fs-tl-item ul { color: #CBD5E1; }
${D} .fs-tl-date { color: #C4B5FD; } ${D} .fs-tl-date::before { box-shadow: 0 0 0 4px #251C47; }
${D} .fs-tl::before { background: linear-gradient(#7C3AED, #1C2A47); }


/* ---------- automatica ---------- */
.fs-auto-hero { position: relative; overflow: hidden; border: 2px solid #E2E8F0; }
.fs-auto-hero.on { border-color: #14B8A6; background: linear-gradient(135deg, #F0FDFA, #fff 60%) !important; box-shadow: 0 12px 30px rgba(13,148,136,.18) !important; }
.fs-auto-hero.on::after { content: ""; position: absolute; right: -40px; top: -40px; width: 140px; height: 140px; border-radius: 50%;
  background: radial-gradient(circle, rgba(20,184,166,.25), transparent 70%); animation: fsAutoPulse 2.4s ease-in-out infinite; pointer-events: none; }
@keyframes fsAutoPulse { 0%,100% { transform: scale(.85); opacity: .6 } 50% { transform: scale(1.1); opacity: 1 } }
${D} .fs-auto-hero { border-color: rgba(148,163,184,.14); }
${D} .fs-auto-hero.on { background: linear-gradient(135deg, #0B2E2B, #111A2E 60%) !important; border-color: #14B8A6; }

/* ---------- titoli di sezione con barretta colorata (tutte le pagine) ---------- */
main h2 { position: relative; }
main > div h2:not(.fs-noaccent)::before { content: ""; display: inline-block; width: 5px; height: .9em; border-radius: 3px; margin-right: 8px; vertical-align: -1px;
  background: linear-gradient(#60A5FA, #2563EB); }
.fs-obj-head h2::before { display: none !important; }
/* pannelli bianchi: bordo leggero e ombra morbida ovunque */
${L} main div[style*="border-radius: 14px"][style*="rgb(255, 255, 255)"], ${L} main div[style*="border-radius: 16px"][style*="rgb(255, 255, 255)"] {
  border-radius: 20px !important; box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.07) !important; border: 1px solid #EDF1F7; }
/* righe delle liste: passaggio del mouse */
@media (hover: hover) { main [style*="border-top: 1px solid rgb(240, 240, 240)"]:hover { background: #F8FAFD; } }


/* ---------- intestazioni dei gruppi (sedi, tipi di mezzo) in Garage e Officina ---------- */
main button[style*="linear-gradient(135deg,#1D3D6B,#13294B)"], main button[style*="linear-gradient(135deg, rgb(29, 61, 107), rgb(19, 41, 75))"] {
  background: linear-gradient(135deg, #3B82F6, #1E3A8A) !important; border-radius: 16px !important; padding: 12px 16px !important;
  box-shadow: 0 8px 20px rgba(30,58,138,.25) !important; }
main div[style*="linear-gradient(135deg,#1D3D6B,#13294B)"], main div[style*="linear-gradient(135deg, rgb(29, 61, 107), rgb(19, 41, 75))"] {
  background: radial-gradient(circle at 90% -20%, rgba(255,255,255,.22), transparent 45%), linear-gradient(135deg, #3B82F6, #1E3A8A) !important; border-radius: 22px !important;
  box-shadow: 0 12px 28px rgba(30,58,138,.28) !important; }
${D} main button[style*="linear-gradient(135deg,#1D3D6B,#13294B)"], ${D} main button[style*="linear-gradient(135deg, rgb(29, 61, 107), rgb(19, 41, 75))"] {
  background: linear-gradient(135deg, #1D4ED8, #172554) !important; }


/* ---------- squadra: elenco volontari su due colonne sul PC ---------- */
@media (min-width: 1000px) { .fs-vlist { column-count: 2; column-gap: 0; column-rule: 1px solid #EEF2F7; } .fs-vrow { break-inside: avoid; } }
.fs-vrow > button:hover { background: #F5F8FC !important; }
${D} .fs-vlist { column-rule-color: rgba(148,163,184,.12); } ${D} .fs-vrow > button:hover { background: #17233D !important; }


/* ---------- mappa a tutto schermo sotto la barra galleggiante (telefono) ---------- */
@media (max-width: 760px) {
  body.fs-has-nav .fs-map { height: 100vh !important; height: 100dvh !important; }
  body.fs-has-nav .fs-chat-btn { display: none !important; }
  body.fs-has-nav .fs-legend { bottom: calc(var(--fs-nav-h) + 14px + env(safe-area-inset-bottom)) !important; }
  body.fs-has-nav .fs-map .leaflet-bottom { bottom: calc(var(--fs-nav-h) + env(safe-area-inset-bottom)) !important; }
  body.fs-has-nav .fs-toast { bottom: calc(var(--fs-nav-h) + 62px + env(safe-area-inset-bottom)) !important; }
  body.fs-has-nav .fs-first { bottom: calc(var(--fs-nav-h) + 60px + env(safe-area-inset-bottom)) !important; }
  body.fs-has-nav .fs-chat { bottom: calc(var(--fs-nav-h) + 16px + env(safe-area-inset-bottom)) !important; height: 58vh !important; z-index: 1245; }
  body.fs-has-nav .fs-help-fab { bottom: calc(var(--fs-nav-h) + 14px + env(safe-area-inset-bottom)) !important; }
  .fs-legend-btn { padding: 9px 14px !important; font-size: 13.5px !important; }
}
.fs-nav-chat { position: relative; }
body.fs-chat-unread .fs-nav-chat .ico::after { content: ""; position: absolute; top: 4px; margin-left: 24px; width: 10px; height: 10px; border-radius: 50%;
  background: #E11D48; box-shadow: 0 0 0 2px #fff; animation: fsBadge 1.8s ease-in-out infinite; }
body.fs-chat-open .fs-nav-chat { color: var(--m-blue, #2563EB) !important; }
body.fs-chat-open .fs-nav-chat .ico svg { filter: drop-shadow(0 4px 8px rgba(37,99,235,.35)) !important; }


/* ---------- aste ---------- */
.fs-auc { position: relative; overflow: hidden; transition: transform .2s, box-shadow .2s; }
@media (hover: hover) { .fs-auc:hover { transform: translateY(-3px); box-shadow: 0 16px 34px rgba(15,23,42,.14) !important; } }
.fs-auc-img { position: relative; margin: -14px -14px 10px; padding: 14px 10px 6px; background: radial-gradient(circle at 50% 120%, #FDE68A, #FFFBEB 70%); }
.fs-auc-time { position: absolute; top: 8px; right: 8px; background: rgba(15,23,42,.78); color: #fff; font-weight: 800; font-size: 12px; border-radius: 999px; padding: 3px 9px; font-variant-numeric: tabular-nums; }
.fs-auc-time.hot { background: #E11D48; animation: fsBadge 1s ease-in-out infinite; }
.fs-auc-lead { position: absolute; top: 8px; left: 8px; background: #16A34A; color: #fff; font-weight: 800; font-size: 11.5px; border-radius: 999px; padding: 3px 9px; }
${D} .fs-auc-img { background: radial-gradient(circle at 50% 120%, #4A3A12, #1A2238 70%); }

${D} main[style*="radial-gradient(900px"] { background: radial-gradient(900px 500px at 50% -150px, #172554, #070D1A 70%) !important; }
${D} main[style*="radial-gradient(900px"] input { background: #0D1424 !important; }


/* ---------- garage: schede dei mezzi ---------- */
.fs-vcard { transition: transform .2s, box-shadow .2s; }
@media (hover: hover) { .fs-vcard:hover { transform: translateY(-3px); box-shadow: 0 18px 36px rgba(15,23,42,.14) !important; } }
.fs-vimg { position: relative; border-radius: 16px; padding: 10px 6px 4px; background: radial-gradient(circle at 50% 130%, #DBEAFE, #F5F8FD 70%); }
.fs-vimg.st-in_servizio { background: radial-gradient(circle at 50% 130%, #FED7AA, #FFF7ED 70%); }
.fs-vimg.st-manutenzione { background: radial-gradient(circle at 50% 130%, #DDD6FE, #F5F3FF 70%); }
.fs-vimg::after { content: ""; position: absolute; left: 18%; right: 18%; bottom: 6px; height: 8px; border-radius: 50%; background: rgba(15,23,42,.12); filter: blur(3px); }
.fs-vimg > * { position: relative; z-index: 1; }
${D} .fs-vimg { background: radial-gradient(circle at 50% 130%, #1E3A8A, #111A2E 70%); }
${D} .fs-vimg.st-in_servizio { background: radial-gradient(circle at 50% 130%, #7C2D12, #111A2E 70%); }
${D} .fs-vimg.st-manutenzione { background: radial-gradient(circle at 50% 130%, #4C1D95, #111A2E 70%); }

/* niente animazioni per chi le ha tolte dal telefono o usa la modalità leggera */
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
body.fs-lite main > * { animation: none !important; }
`;
