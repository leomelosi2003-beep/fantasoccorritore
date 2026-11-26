// Colori del logo di FantaSoccorritore e stile grafico comune a tutte le pagine.
// Le pagine usano stili scritti a mano (style={{ ... }}): qui i colori "neutri" di prima (nero, grigio carta)
// vengono sostituiti con quelli del logo, solo nel tema chiaro (il tema scuro ha la sua palette in darkTheme.ts).

export const BRAND = {
  navy: "#13294B", navy2: "#1D3D6B", orange: "#EA6A1F", orange2: "#F59E0B", sky: "#3BA3DB",
  green: "#3E7D3A", yellow: "#F5D90A", paper: "#F3F6FB", ink: "#0B1B33",
};

function rgb(hex: string) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
// stessa tecnica di darkTheme: lo stile può arrivare come "background:#111" (server) o "background: rgb(17, 17, 17)" (browser)
function sel(prop: string, hex: string, extra = "") {
  const r = rgb(hex);
  return [
    `html:not(.dark) [style*="${prop}:${hex};"]${extra}`, `html:not(.dark) [style$="${prop}:${hex}"]${extra}`,
    `html:not(.dark) [style*="${prop}: ${r};"]${extra}`, `html:not(.dark) [style*="${prop}: ${r} "]${extra}`,
  ].join(",\n");
}

export const BRAND_CSS = `
  /* tenendo premuto su telefono non parte la selezione del testo né il menu "copia/salva immagine" (si lascia nei campi da scrivere e nella chat) */
  html, body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
  img, svg, canvas { -webkit-user-drag: none; -webkit-touch-callout: none; }
  input, textarea, select, [contenteditable="true"], .fs-selectable, .fs-selectable * { -webkit-user-select: text; user-select: text; -webkit-touch-callout: default; }
:root { --fs-nav-h: 0px; --fs-navy: ${BRAND.navy}; --fs-orange: ${BRAND.orange}; --fs-sky: ${BRAND.sky}; }
body.fs-has-nav { --fs-nav-h: 64px; }
html, body { -webkit-tap-highlight-color: transparent; }
body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: ${BRAND.ink}; }
html:not(.dark) body { background: ${BRAND.paper}; }

/* sfondo delle pagine: carta azzurrina come il cielo del logo */
${sel("background", "#f4f4f1")} { background: ${BRAND.paper} !important; }

/* barre in alto e tasti principali: blu notte del logo con sfumatura */
${sel("background", "#111")} { background: linear-gradient(135deg, ${BRAND.navy2}, ${BRAND.navy}) !important; }
${sel("background", "#333")} { background: rgba(255,255,255,.14) !important; border: 1px solid rgba(255,255,255,.22) !important; }
html:not(.dark) button[style*="rgb(17, 17, 17)"]:hover:not(:disabled), html:not(.dark) button[style*="background:#111"]:hover:not(:disabled) { filter: brightness(1.18); }
/* striscia arancione sotto le barre in alto delle pagine */
html:not(.dark) main > div:first-child[style*="rgb(17, 17, 17)"], html:not(.dark) main > div:first-child[style*="background:#111"] {
  box-shadow: inset 0 -4px 0 ${BRAND.orange}, 0 4px 18px rgba(19,41,75,.25);
}

/* tasti, campi e tendine più morbidi e chiari da toccare */
button { font-family: inherit; transition: filter .15s, transform .12s, box-shadow .15s; }
button:active:not(:disabled) { transform: scale(.98); }
button:disabled { opacity: .55; cursor: not-allowed; }
input, select, textarea { font-family: inherit; }
input:focus, select:focus, textarea:focus { outline: 3px solid rgba(59,163,219,.45); outline-offset: 1px; }
:focus-visible { outline: 3px solid rgba(234,106,31,.6); outline-offset: 2px; }

/* carte bianche: ombra leggera blu */
html:not(.dark) main [style*="border-radius: 14px"][style*="rgb(255, 255, 255)"],
html:not(.dark) main [style*="border-radius: 16px"][style*="rgb(255, 255, 255)"] { box-shadow: 0 2px 10px rgba(19,41,75,.08) !important; }

/* telefono: niente scroll orizzontale, tabelle scorrevoli, testi un filo più grandi da toccare */
@media (max-width: 760px) {
  html, body { overflow-x: hidden; }
  main table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  main button { min-height: 36px; }
  main input, main select { font-size: 16px; }   /* evita lo zoom automatico su iPhone */
  body.fs-has-nav main { padding-bottom: calc(var(--fs-nav-h) + env(safe-area-inset-bottom) + 12px); }
  body.fs-has-nav .fs-map { height: calc(100vh - var(--fs-nav-h) - env(safe-area-inset-bottom)) !important;
                            height: calc(100dvh - var(--fs-nav-h) - env(safe-area-inset-bottom)) !important; }
  body.fs-has-nav .fs-coach, body.fs-has-nav .fs-coach-mini { bottom: calc(14px + var(--fs-nav-h) + env(safe-area-inset-bottom)) !important; }
}

/* pannello di invio aperto: a tutto schermo sopra la barra in basso, con il pulsante «Parti» sempre visibile */
@media (max-width: 760px) {
  body.fs-panel-open .fs-nav, body.fs-panel-open .fs-help-fab { display: none !important; }
  .fs-mpanel { position: fixed !important; top: 0 !important; bottom: 0 !important; height: 100dvh; padding-bottom: env(safe-area-inset-bottom); box-sizing: border-box; }
}
/* barra in basso (solo telefono) */
.fs-nav { display: none; }
@media (max-width: 760px) {
  .fs-nav { display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 1250; height: var(--fs-nav-h);
    padding-bottom: env(safe-area-inset-bottom); box-sizing: content-box;
    background: linear-gradient(180deg, ${BRAND.navy2}, ${BRAND.navy}); box-shadow: 0 -4px 18px rgba(19,41,75,.35); border-top: 3px solid ${BRAND.orange}; }
  .fs-nav a, .fs-nav button { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    color: rgba(255,255,255,.78); text-decoration: none; font-size: 10.5px; font-weight: 800; letter-spacing: .02em;
    background: none; border: none; cursor: pointer; padding: 0; min-height: 0; position: relative; }
  .fs-nav .ico { font-size: 22px; line-height: 1; transition: transform .15s; }
  .fs-nav .on { color: #fff; }
  .fs-nav .on .ico { transform: translateY(-2px) scale(1.12); }
  .fs-nav .on::after { content: ""; position: absolute; top: 4px; width: 28px; height: 3px; border-radius: 2px; background: ${BRAND.orange}; }
}

/* tasto "Come funziona" */
.fs-help-fab { position: fixed; z-index: 1240; right: 12px; bottom: calc(16px + var(--fs-nav-h) + env(safe-area-inset-bottom));
  width: 46px; height: 46px; border-radius: 50%; border: 3px solid #fff; cursor: pointer; font-size: 21px; font-weight: 900; color: #fff;
  background: linear-gradient(135deg, ${BRAND.orange2}, ${BRAND.orange}); box-shadow: 0 6px 18px rgba(234,106,31,.45); }
.fs-help-fab:hover { transform: translateY(-2px); }
.fs-help-fab.pulse { animation: fs-help-pulse 2s ease-in-out 4; }
@keyframes fs-help-pulse { 0%,100% { box-shadow: 0 6px 18px rgba(234,106,31,.45) } 50% { box-shadow: 0 0 0 12px rgba(234,106,31,0), 0 6px 18px rgba(234,106,31,.45) } }
.fs-help-bg { position: fixed; inset: 0; z-index: 4500; background: rgba(15,30,54,.55); display: flex; align-items: flex-end; justify-content: center; animation: fs-fade .2s; }
@media (min-width: 761px) { .fs-help-bg { align-items: center; } }
.fs-help { background: #fff; color: ${BRAND.ink}; width: min(520px, 100%); max-height: 86vh; overflow-y: auto; border-radius: 22px 22px 0 0;
  box-shadow: 0 -10px 40px rgba(0,0,0,.35); animation: fs-up .28s cubic-bezier(.2,.8,.2,1); padding-bottom: env(safe-area-inset-bottom); }
@media (min-width: 761px) { .fs-help { border-radius: 22px; } }
.fs-help-head { display: flex; align-items: center; gap: 12px; padding: 16px 18px; color: #fff;
  background: linear-gradient(135deg, ${BRAND.navy2}, ${BRAND.navy}); border-bottom: 4px solid ${BRAND.orange}; position: sticky; top: 0; }
.fs-help-head img { width: 44px; height: 44px; border-radius: 50%; background: #fff; }
.fs-help-head h2 { margin: 0; font-size: 18px; }
.fs-help-head p { margin: 2px 0 0; font-size: 13px; opacity: .85; }
.fs-help-x { margin-left: auto; border: none; background: rgba(255,255,255,.18); color: #fff; width: 34px; height: 34px; border-radius: 50%; font-size: 16px; cursor: pointer; }
.fs-help-body { padding: 14px 18px 18px; }
.fs-help-step { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #E6ECF3; font-size: 14.5px; line-height: 1.45; }
.fs-help-step:last-child { border-bottom: none; }
.fs-help-step .n { flex-shrink: 0; width: 34px; height: 34px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-size: 18px;
  background: #FFF1E7; }
.fs-help-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.fs-help-links a { text-decoration: none; font-weight: 800; font-size: 13px; color: ${BRAND.navy}; background: #E8F1FA; border-radius: 999px; padding: 7px 12px; }
.fs-help-links a:hover { background: #D6E8F8; }
@keyframes fs-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes fs-up { from { transform: translateY(40px); opacity: 0 } to { transform: none; opacity: 1 } }
html.dark .fs-help { background: #1b1f27; color: #eceef3; }
html.dark .fs-help-step { border-color: #2a303c; }
html.dark .fs-help-step .n { background: #3a2a1c; }
html.dark .fs-help-links a { background: #1a2a47; color: #93b4ff; }
`;
