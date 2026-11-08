"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

// Zoom con un dito (come Bump / Google Maps): tocca due volte, al secondo tocco NON alzare il dito
// e scorri: in su avvicina, in giù allontana. Funziona con il pollice destro o sinistro, ovunque sulla mappa.
// Un doppio tocco veloce senza scorrere avvicina di un livello (come prima).
export default function OneFingerZoom({ enabled }: { enabled: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;
    const el = map.getContainer();
    const touch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
    if (!touch) return;
    // il doppio tocco lo gestiamo noi (altrimenti Leaflet zooma da solo al secondo tocco)
    const hadDbl = map.doubleClickZoom.enabled();
    map.doubleClickZoom.disable();

    const PX_PER_LEVEL = 120;
    let lastTap = { t: 0, x: 0, y: 0 };
    let active: { y: number; zoom: number; x0: number; y0: number; moved: boolean } | null = null;

    const pt = (e: TouchEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
    };

    function start(e: TouchEvent) {
      if (e.touches.length !== 1) { active = null; return; }
      const p = pt(e);
      const now = Date.now();
      if (now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 45) {
        // secondo tocco: si entra nello zoom con un dito
        e.preventDefault(); e.stopPropagation();
        active = { y: p.y, zoom: map.getZoom(), x0: p.x, y0: p.y, moved: false };
        map.dragging.disable();
        lastTap = { t: 0, x: 0, y: 0 };
      } else {
        lastTap = { t: now, x: p.x, y: p.y };
      }
    }
    function move(e: TouchEvent) {
      if (!active || e.touches.length !== 1) return;
      e.preventDefault(); e.stopPropagation();
      const p = pt(e);
      const dy = p.y - active.y;
      if (Math.abs(dy) > 6) active.moved = true;
      const z = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), active.zoom - dy / PX_PER_LEVEL));
      map.setZoomAround(map.containerPointToLatLng([active.x0, active.y0]), z, { animate: false });
    }
    function end(e: TouchEvent) {
      if (!active) return;
      e.preventDefault();
      const a = active; active = null;
      map.dragging.enable();
      const around = map.containerPointToLatLng([a.x0, a.y0]);
      if (!a.moved) map.setZoomAround(around, Math.min(map.getMaxZoom(), Math.round(a.zoom) + 1), { animate: false });   // doppio tocco classico
      else map.setZoomAround(around, Math.round(map.getZoom() * 4) / 4, { animate: false });   // si assesta, mappa nitida
    }

    el.addEventListener("touchstart", start, { passive: false, capture: true });
    el.addEventListener("touchmove", move, { passive: false, capture: true });
    el.addEventListener("touchend", end, { passive: false, capture: true });
    el.addEventListener("touchcancel", end, { passive: false, capture: true });
    return () => {
      el.removeEventListener("touchstart", start, { capture: true } as EventListenerOptions);
      el.removeEventListener("touchmove", move, { capture: true } as EventListenerOptions);
      el.removeEventListener("touchend", end, { capture: true } as EventListenerOptions);
      el.removeEventListener("touchcancel", end, { capture: true } as EventListenerOptions);
      map.dragging.enable();
      if (hadDbl) map.doubleClickZoom.enable();
    };
  }, [map, enabled]);

  return null;
}
