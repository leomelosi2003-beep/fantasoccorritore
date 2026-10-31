// Scena animata di presentazione (sfondo della pagina di accesso).
// Tutto in SVG + CSS: leggera, in loop, nessun file video da scaricare.
export default function IntroScene() {
  return (
    <div className="intro" aria-hidden="true">
      <style>{CSS}</style>

      {/* Cielo e stelle */}
      <div className="sky" />
      <div className="stars" />

      {/* Lampeggianti blu che illuminano la scena */}
      <div className="flash flash-a" />
      <div className="flash flash-b" />

      {/* Skyline lontano */}
      <svg className="city far" viewBox="0 0 1200 200" preserveAspectRatio="none">
        <path d="M0 200 V120 h60 v-30 h40 v50 h50 v-70 h30 v-20 h20 v20 h30 v90 h60 v-40 h50 v60 h40 v-90 h25 v-25 h20 v25 h25 v90 h70 v-50 h45 v70 h60 v-100 h40 v100 h55 v-60 h50 v40 h60 v-80 h35 v80 h45 v-30 h60 v60 h50 V200 Z" />
      </svg>
      {/* Skyline vicino con finestre accese */}
      <svg className="city near" viewBox="0 0 1200 220" preserveAspectRatio="none">
        <path d="M0 220 V150 h90 v-60 h70 v80 h40 v-110 h80 v110 h60 v-50 h90 v70 h50 v-130 h70 v130 h80 v-70 h60 v50 h90 v-100 h70 v100 h60 v-40 h90 v60 h50 V220 Z" />
        {WINDOWS.map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="8" height="10" className={`win w${i % 4}`} />
        ))}
      </svg>

      {/* Strada */}
      <div className="road"><div className="lane" /></div>

      {/* Ambulanza */}
      <div className="amb-wrap">
        <svg className="amb" viewBox="0 0 220 110">
          <ellipse cx="110" cy="104" rx="100" ry="5" fill="rgba(0,0,0,.45)" />
          <path d="M8 30 h130 v62 H8 Z" fill="#f4f4f2" />
          <path d="M138 44 h38 l30 26 v22 H138 Z" fill="#f4f4f2" />
          <path d="M146 50 h26 l20 18 h-46 Z" fill="#9cc7ea" />
          <rect x="8" y="62" width="198" height="10" fill="#F97316" />
          <rect x="60" y="40" width="10" height="34" fill="#DC2626" />
          <rect x="48" y="52" width="34" height="10" fill="#DC2626" />
          <rect x="30" y="22" width="40" height="8" rx="2" className="bar-l" />
          <rect x="76" y="22" width="40" height="8" rx="2" className="bar-r" />
          <circle cx="45" cy="92" r="13" fill="#222" /><circle cx="45" cy="92" r="5" fill="#888" />
          <circle cx="170" cy="92" r="13" fill="#222" /><circle cx="170" cy="92" r="5" fill="#888" />
          <rect x="200" y="74" width="6" height="6" fill="#fff6c4" />
        </svg>
        <div className="beam" />
      </div>

      {/* Tracciato del battito */}
      <svg className="ecg" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <polyline points="0,60 300,60 330,60 345,20 360,100 375,10 392,60 600,60 630,60 645,25 660,95 675,15 692,60 900,60 930,60 945,20 960,100 975,10 992,60 1200,60" />
      </svg>

      <div className="vignette" />
    </div>
  );
}

const WINDOWS: [number, number][] = [
  [105, 105], [125, 120], [215, 70], [235, 90], [255, 110], [215, 130], [385, 110], [405, 130],
  [455, 60], [475, 80], [495, 100], [455, 120], [555, 110], [575, 130], [665, 90], [685, 110],
  [705, 130], [805, 160], [855, 80], [875, 100], [895, 120], [960, 140], [985, 160], [1110, 170],
];

const CSS = `
.intro{position:fixed;inset:0;overflow:hidden;background:#05070f;z-index:0}
.sky{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 120%,#1b2a55 0%,#0b1230 45%,#05070f 80%)}
.stars{position:absolute;inset:0;background-image:
 radial-gradient(1px 1px at 10% 20%,#fff8,transparent),radial-gradient(1px 1px at 30% 10%,#fff6,transparent),
 radial-gradient(1px 1px at 55% 25%,#fff7,transparent),radial-gradient(1px 1px at 75% 12%,#fff5,transparent),
 radial-gradient(1px 1px at 90% 30%,#fff8,transparent),radial-gradient(1px 1px at 45% 5%,#fff6,transparent),
 radial-gradient(1.5px 1.5px at 20% 35%,#fff9,transparent),radial-gradient(1px 1px at 65% 40%,#fff5,transparent);
 animation:twinkle 4s ease-in-out infinite alternate}
@keyframes twinkle{from{opacity:.5}to{opacity:1}}

.flash{position:absolute;inset:0;mix-blend-mode:screen;opacity:0}
.flash-a{background:radial-gradient(circle at 30% 75%,rgba(40,110,255,.55),transparent 55%);animation:flashA 1.1s infinite}
.flash-b{background:radial-gradient(circle at 70% 75%,rgba(40,110,255,.45),transparent 55%);animation:flashB 1.1s infinite}
@keyframes flashA{0%,10%,20%{opacity:.9}5%,15%,25%,100%{opacity:0}}
@keyframes flashB{50%,60%,70%{opacity:.9}55%,65%,75%,100%,0%{opacity:0}}

.city{position:absolute;left:0;width:200%;bottom:22vh}
.city.far{height:22vh;fill:#0e1840;animation:pan 90s linear infinite}
.city.near{height:26vh;bottom:18vh;fill:#070b1d;animation:pan 45s linear infinite}
@keyframes pan{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.win{fill:#ffd97a;opacity:.85}
.w1{animation:blink 7s infinite}.w2{animation:blink 11s infinite 2s}.w3{animation:blink 9s infinite 4s}
@keyframes blink{0%,80%{opacity:.85}85%,100%{opacity:.1}}

.road{position:absolute;left:0;right:0;bottom:0;height:18vh;background:linear-gradient(#15182a,#0a0c16)}
.lane{position:absolute;top:45%;left:0;width:200%;height:4px;
 background:repeating-linear-gradient(90deg,#ffffff55 0 60px,transparent 60px 120px);animation:pan 1.2s linear infinite}

.amb-wrap{position:absolute;bottom:9vh;left:-260px;width:min(260px,45vw);animation:drive 9s cubic-bezier(.45,.05,.55,.95) infinite}
.amb{width:100%;display:block;animation:bump .35s ease-in-out infinite alternate}
@keyframes drive{0%{transform:translateX(0)}100%{transform:translateX(calc(100vw + 300px))}}
@keyframes bump{from{transform:translateY(0)}to{transform:translateY(-2px)}}
.bar-l{fill:#2563eb;animation:barL .5s steps(1) infinite}
.bar-r{fill:#2563eb;animation:barR .5s steps(1) infinite}
@keyframes barL{0%{fill:#60a5fa;filter:drop-shadow(0 0 8px #60a5fa)}50%{fill:#1e3a8a;filter:none}}
@keyframes barR{0%{fill:#1e3a8a;filter:none}50%{fill:#60a5fa;filter:drop-shadow(0 0 8px #60a5fa)}}
.beam{position:absolute;right:-140px;bottom:18%;width:160px;height:40px;
 background:linear-gradient(90deg,rgba(255,240,180,.55),transparent);clip-path:polygon(0 40%,100% 0,100% 100%,0 60%)}

.ecg{position:absolute;left:0;right:0;top:12vh;height:12vh;width:100%}
.ecg polyline{fill:none;stroke:#ef4444;stroke-width:3;stroke-linejoin:round;
 filter:drop-shadow(0 0 6px #ef4444);stroke-dasharray:1600;stroke-dashoffset:1600;animation:ecg 3.2s linear infinite}
@keyframes ecg{0%{stroke-dashoffset:1600;opacity:1}80%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}

.vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,.6))}

@media (prefers-reduced-motion: reduce){.intro *{animation:none!important}}
`;
