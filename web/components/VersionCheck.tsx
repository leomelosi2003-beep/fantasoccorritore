"use client";

import { useEffect } from "react";

const BUILD = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";

// Se è uscita una nuova versione del gioco, la pagina si ricarica da sola (così tutti hanno l'ultimo aggiornamento)
export default function VersionCheck() {
  useEffect(() => {
    try { localStorage.removeItem("fs-roads-v1"); } catch { /* niente */ }
    if (BUILD === "dev") return;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const { v } = await r.json();
        if (v && v !== "dev" && v !== BUILD) location.reload();
      } catch { /* rete assente: riprovo dopo */ }
    };
    const t = setInterval(check, 120_000);
    document.addEventListener("visibilitychange", check);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", check); };
  }, []);
  return null;
}
