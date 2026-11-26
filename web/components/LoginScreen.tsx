"use client";

import { useState, type FormEvent } from "react";
import { supabase, friendlyError } from "@/lib/supabase";
import { input, button, link, errorBox } from "@/lib/ui";
import IntroScene from "@/components/IntroScene";

// Pagina di accesso con la scena animata di presentazione dietro.
export default function LoginScreen() {
  const [mode, setMode] = useState<"accedi" | "registrati">("accedi");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function forgot() {
    if (!email) { setError("Scrivi prima la tua email, poi tocca “Password dimenticata”."); return; }
    setBusy(true); setError(null); setInfo(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset" });
    setBusy(false);
    if (error) { setError(friendlyError(error.message)); return; }
    setInfo("Se l'email è registrata, riceverai un link per reimpostare la password.");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      if (mode === "registrati") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Se la conferma email è disattivata la sessione è già attiva; altrimenti proviamo ad accedere
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
          if (e2) throw e2;
        }
        window.location.href = "/onboarding";
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/";
      }
    } catch (err) {
      setError(friendlyError((err as Error).message));
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", position: "relative" }}>
      <IntroScene />

      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box", gap: 18 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="FantaSoccorritore"
             style={{ width: "clamp(120px, 30vw, 168px)", height: "clamp(120px, 30vw, 168px)", borderRadius: "50%",
                      objectFit: "cover", border: "4px solid rgba(255,255,255,.92)", boxShadow: "0 12px 36px rgba(0,0,0,.5)",
                      background: "#fff" }} />
        <h1 style={{ margin: 0, color: "#fff", fontSize: "clamp(34px, 8vw, 64px)", fontWeight: 800,
                     letterSpacing: "-0.02em", textAlign: "center", textShadow: "0 4px 24px rgba(0,0,0,.6)" }}>
          Fanta<span style={{ color: "#F97316" }}>Soccorritore</span>
        </h1>
        <div style={{ marginTop: -10, color: "rgba(255,255,255,.92)", fontWeight: 600, fontSize: 15, textAlign: "center", textShadow: "0 2px 10px rgba(0,0,0,.6)" }}>
          Gestisci la tua associazione di soccorso · <span style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 900, letterSpacing: ".08em" }}>BETA</span>
        </div>

        <form onSubmit={submit}
              style={{ width: "100%", maxWidth: 400, background: "rgba(255,255,255,.94)", backdropFilter: "blur(14px)",
                       borderRadius: 26, padding: 22, boxShadow: "0 24px 60px rgba(0,0,0,.5)", boxSizing: "border-box", border: "1px solid rgba(255,255,255,.6)" }}>
          <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 16, background: "#EEF2F7", marginBottom: 16 }}>
            {(["accedi", "registrati"] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(null); }}
                      style={{ flex: 1, padding: "10px 0", border: "none", borderRadius: 12, font: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer",
                               background: mode === m ? "#fff" : "transparent", color: mode === m ? "#0B1B33" : "#64748B",
                               boxShadow: mode === m ? "0 4px 12px rgba(15,23,42,.12)" : "none" }}>
                {m === "accedi" ? "🔑 Accedi" : "🚑 Registrati"}
              </button>
            ))}
          </div>
          {error && <div style={errorBox}>{error}</div>}
          {info && <div style={{ background: "#eefbf0", color: "#15803D", border: "1px solid #b7e2c1", borderRadius: 10, padding: "10px 12px", fontSize: 14, marginBottom: 12 }}>{info}</div>}

          <input style={input} type="email" placeholder="Email" autoComplete="email"
                 value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input style={input} type="password" placeholder="Password (minimo 6 caratteri)"
                 autoComplete={mode === "accedi" ? "current-password" : "new-password"}
                 value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />

          <button style={{ ...button, background: "linear-gradient(135deg,#FB923C,#E11D48)", borderRadius: 14, boxShadow: "0 10px 24px rgba(225,29,72,.35)", opacity: busy ? 0.6 : 1 }} disabled={busy}>
            {busy ? "Attendi…" : mode === "accedi" ? "Entra in servizio" : "Arruolati"}
          </button>

          <div style={{ marginTop: 14, textAlign: "center" }}>
            <button type="button" style={link}
                    onClick={() => { setMode(mode === "accedi" ? "registrati" : "accedi"); setError(null); }}>
              {mode === "accedi" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
            </button>
          </div>
          {mode === "accedi" && (
            <div style={{ marginTop: 8, textAlign: "center" }}>
              <button type="button" style={link} disabled={busy} onClick={forgot}>Password dimenticata?</button>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
