"use client";

// Se una pagina va in errore (es. server lento), invece della pagina bianca si vede questo
export default function Errore({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f4f1",
                   fontFamily: "system-ui, -apple-system, sans-serif", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 380, textAlign: "center", boxShadow: "0 2px 10px rgba(0,0,0,.08)" }}>
        <div style={{ fontSize: 44 }}>🚑💨</div>
        <h2 style={{ margin: "8px 0" }}>Il server è un po&apos; lento</h2>
        <p style={{ color: "#555", fontSize: 15 }}>Qualcosa non si è caricato. Riprova tra un attimo.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
          <button onClick={() => reset()} style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "#111", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Riprova</button>
          <button onClick={() => { window.location.href = "/"; }} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #ccc", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Torna alla mappa</button>
        </div>
      </div>
    </main>
  );
}
