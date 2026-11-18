"use client";
// Pagina ponte per i link di reimpostazione password: le anteprime di WhatsApp/Telegram aprono solo questa pagina
// (che non consuma niente); il link vero si usa solo quando la persona preme il pulsante.
import { useEffect, useState } from "react";

export default function Recupero() {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => { setT(new URLSearchParams(window.location.search).get("t")); }, []);
  const go = () => {
    if (!t) return;
    const base = window.location.origin;
    window.location.href = `${base}/sb/auth/v1/verify?token=${encodeURIComponent(t)}&type=recovery&redirect_to=${encodeURIComponent(base + "/reset")}`;
  };
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#13294B,#1D3D6B)", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: 26, maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,.35)" }}>
        <img src="/logo-192.jpg" alt="" style={{ width: 72, height: 72, borderRadius: 16 }} />
        <h1 style={{ fontSize: 21, color: "#13294B", margin: "12px 0 6px" }}>Reimposta la password</h1>
        <p style={{ fontSize: 14.5, color: "#475569", margin: "0 0 18px" }}>Premi il pulsante per scegliere una password nuova per il tuo account di FantaSoccorritore.</p>
        {t ? (
          <button onClick={go} style={{ width: "100%", border: "none", borderRadius: 12, padding: 14, fontSize: 17, fontWeight: 800, color: "#fff", cursor: "pointer",
                  background: "linear-gradient(135deg,#F59E0B,#EA6A1F)" }}>🔑 Reimposta la password</button>
        ) : <p style={{ color: "#B91C1C" }}>Link non valido: chiedi all&apos;amministratore un link nuovo.</p>}
        <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 14 }}>Il link vale una sola volta e per circa un&apos;ora.</p>
      </div>
    </main>
  );
}
