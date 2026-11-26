"use client";
import { useState } from "react";

// Piccola etichetta "BETA" (nel menu e nella barra laterale del PC): tocca per sapere cosa vuol dire.
export function BetaChip() {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }} title="Il gioco è in beta"
              style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)", color: "#fff", border: "none", borderRadius: 999, padding: "1px 8px",
                       fontSize: 10.5, fontWeight: 900, letterSpacing: ".08em", cursor: "pointer", verticalAlign: "middle", boxShadow: "none" }}>BETA</button>
      {open && (
        <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }}
              style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 5, width: 240, background: "#fff", color: "#0B1B33", borderRadius: 12,
                       padding: "9px 11px", fontSize: 12.5, fontWeight: 500, lineHeight: 1.4, boxShadow: "0 10px 28px rgba(15,23,42,.25)", whiteSpace: "normal" }}>
          <b>FantaSoccorritore è in beta.</b> Il gioco è completo ma lo stiamo rifinendo: possono capitare piccoli bug o ritocchi di bilanciamento. Grazie per le segnalazioni!
        </span>
      )}
    </span>
  );
}

export default function AlphaBadge() { return null; }
