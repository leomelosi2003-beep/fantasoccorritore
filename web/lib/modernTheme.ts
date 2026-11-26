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
