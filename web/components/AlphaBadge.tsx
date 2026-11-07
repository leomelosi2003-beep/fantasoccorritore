"use client";
import { useState } from "react";

// Etichetta fissa "versione ALPHA": il gioco è in fase di test.
export default function AlphaBadge() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "fixed", left: 8, bottom: "calc(8px + env(safe-area-inset-bottom))", zIndex: 100000, maxWidth: 300, fontFamily: "system-ui, sans-serif" }}>
      {open && (
        <div style={{ background: "#fff", color: "#111", border: "2px solid #F59E0B", borderRadius: 10, padding: "10px 12px", marginBottom: 6, fontSize: 13, lineHeight: 1.4, boxShadow: "0 4px 14px rgba(0,0,0,.25)" }}>
          <strong>🧪 Versione ALPHA (in test)</strong><br />
          FantaSoccorritore è ancora in fase di sviluppo: possono esserci <strong>bug</strong>, <strong>cambi di bilanciamento</strong> e brevi <strong>interruzioni</strong> durante gli aggiornamenti. Stiamo lavorando per sistemare tutto: grazie per la pazienza e per le segnalazioni!
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} title="Il gioco è in versione alpha di test"
              style={{ background: "#F59E0B", color: "#111", border: "none", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,.3)" }}>
        🧪 ALPHA TEST {open ? "✕" : "ⓘ"}
      </button>
    </div>
  );
}
