"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

// Zoom col pollice sul bordo (come Bump): appoggia il dito vicino al bordo destro o sinistro della mappa
// e scorri: in su avvicina, in giù allontana. Niente doppio tocco. Al centro la mappa si trascina come sempre.
export const EDGE_PX = 56; // larghezza della fascia sensibile su ciascun bordo

export default function OneFingerZoom({ enabled }: { enabled: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;
    const el = map.getContainer();
    const PX_PER_LEVEL = 110;
    let active: { y: number; zoom: number; side: "left" | "right" } | null = null;

    // guida visiva: una barra sottile sul bordo, visibile solo mentre zoomi
    const bar = document.createElement("div");
    bar.style.cssText = "position:absolute;top:12%;bottom:12%;width:6px;border-radius:6px;background:rgba(37,99,235,.55);" +
      "box-shadow:0 0 12px rgba(37,99,235,.6);z-index:1002;pointer-events:none;opacity:0;transition:opacity .15s";
    el.appendChild(bar);

    const pos = (t: Touch) => { const r = el.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top, w: r.width }; };

    function start(e: TouchEvent) {
      if (e.touches.length !== 1) { if (active) end(); return; }
      const p = pos(e.touches[0]);
      const side = p.x <= EDGE_PX ? "left" : p.x >= p.w - EDGE_PX ? "right" : null;
      if (!side) return;
      e.preventDefault(); e.stopPropagation();
      active = { y: p.y, zoom: map.getZoom(), side };
      map.dragging.disable();
      bar.style.left = side === "left" ? "3px" : "";
      bar.style.right = side === "right" ? "3px" : "";
      bar.style.opacity = "1";
    }
    function move(e: TouchEvent) {
      if (!active) return;
      e.preventDefault(); e.stopPropagation();
      const p = pos(e.touches[0]);
      const z = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), active.zoom - (p.y - active.y) / PX_PER_LEVEL));
      map.setZoom(z, { animate: false });
    }
    function end(e?: TouchEvent) {
      if (!active) return;
      e?.preventDefault();
      active = null;
      map.dragging.enable();
      bar.style.opacity = "0";
      map.setZoom(Math.round(map.getZoom() * 4) / 4, { animate: false });   // si assesta: mappa nitida
    }

    const opt = { passive: false, capture: true } as AddEventListenerOptions;
    el.addEventListener("touchstart", start, opt);
    el.addEventListener("touchmove", move, opt);
    el.addEventListener("touchend", end, opt);
    el.addEventListener("touchcancel", end, opt);
    return () => {
      el.removeEventListener("touchstart", start, opt);
      el.removeEventListener("touchmove", move, opt);
      el.removeEventListener("touchend", end, opt);
      el.removeEventListener("touchcancel", end, opt);
      bar.remove();
      map.dragging.enable();
    };
  }, [map, enabled]);

  return null;
}
