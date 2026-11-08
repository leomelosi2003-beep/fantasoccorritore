"use client";

import { useRef, useState, type PointerEvent } from "react";
import type L from "leaflet";

// Zoom col pollice: una striscia sul bordo della mappa. Trascina in su per avvicinare, in giù per allontanare.
// Zoom continuo (frazionario) mentre trascini, poi si ferma sul quarto di livello più vicino per avere la mappa nitida.
export default function ThumbZoom({ map, side }: { map: L.Map | null; side: "destra" | "sinistra" }) {
  const start = useRef<{ y: number; zoom: number } | null>(null);
  const [drag, setDrag] = useState<number | null>(null); // spostamento del pollice in px, per disegnare il pomello

  const PX_PER_LEVEL = 70;
  function down(e: PointerEvent<HTMLDivElement>) {
    if (!map) return;
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = { y: e.clientY, zoom: map.getZoom() };
    setDrag(0);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (!map || !start.current) return;
    e.preventDefault(); e.stopPropagation();
    const dy = e.clientY - start.current.y;
    const z = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), start.current.zoom - dy / PX_PER_LEVEL));
    map.setZoom(z, { animate: false });
    setDrag(Math.max(-90, Math.min(90, dy)));
  }
  function up() {
    if (!map || !start.current) return;
    start.current = null; setDrag(null);
    map.setZoom(Math.round(map.getZoom() * 4) / 4, { animate: true });
  }

  return (
    <div className={`fs-thumbzoom fs-thumbzoom-${side}${drag !== null ? " active" : ""}`}
         onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
         onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}
         role="slider" aria-label="Zoom: trascina in su per avvicinare, in giù per allontanare" aria-valuenow={map?.getZoom()}>
      <span className="fs-tz-plus">＋</span>
      <span className="fs-tz-knob" style={{ transform: `translate(-50%, calc(-50% + ${drag ?? 0}px))` }} />
      <span className="fs-tz-minus">－</span>
    </div>
  );
}

export const THUMB_ZOOM_CSS = `
  .fs-thumbzoom { position: absolute; z-index: 1001; top: 50%; transform: translateY(-50%); width: 38px; height: min(240px, 34vh);
    border-radius: 999px; background: rgba(255,255,255,.55); box-shadow: 0 2px 10px rgba(0,0,0,.25); touch-action: none;
    cursor: ns-resize; user-select: none; -webkit-user-select: none; backdrop-filter: blur(4px); transition: background .15s, width .15s; }
  .fs-thumbzoom-destra { right: 6px; }
  .fs-thumbzoom-sinistra { left: 6px; }
  .fs-thumbzoom.active { background: rgba(255,255,255,.85); width: 44px; }
  .fs-tz-plus, .fs-tz-minus { position: absolute; left: 50%; transform: translateX(-50%); font-weight: 900; font-size: 16px; color: #333; pointer-events: none; }
  .fs-tz-plus { top: 8px; } .fs-tz-minus { bottom: 8px; }
  .fs-tz-knob { position: absolute; left: 50%; top: 50%; width: 26px; height: 26px; border-radius: 50%; background: #111;
    border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.4); pointer-events: none; }
  .fs-thumbzoom:not(.active) .fs-tz-knob { transition: transform .2s; }
  html.dark .fs-thumbzoom { background: rgba(27,31,39,.6); } html.dark .fs-thumbzoom.active { background: rgba(27,31,39,.9); }
  html.dark .fs-tz-plus, html.dark .fs-tz-minus { color: #eceef3; } html.dark .fs-tz-knob { background: #7aa7ff; }
`;
