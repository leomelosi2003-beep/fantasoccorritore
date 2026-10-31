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
                    alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box", gap: 24 }}>
        <h1 style={{ margin: 0, color: "#fff", fontSize: "clamp(34px, 8vw, 64px)", fontWeight: 800,
                     letterSpacing: "-0.02em", textAlign: "center", textShadow: "0 4px 24px rgba(0,0,0,.6)" }}>
          Fanta<span style={{ color: "#F97316" }}>Soccorritore</span>
        </h1>

        <form onSubmit={submit}
              style={{ width: "100%", maxWidth: 380, background: "rgba(255,255,255,.92)", backdropFilter: "blur(8px)",
                       borderRadius: 16, padding: 22, boxShadow: "0 10px 40px rgba(0,0,0,.5)", boxSizing: "border-box" }}>
          {error && <div style={errorBox}>{error}</div>}

          <input style={input} type="email" placeholder="Email" autoComplete="email"
                 value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input style={input} type="password" placeholder="Password (minimo 6 caratteri)"
                 autoComplete={mode === "accedi" ? "current-password" : "new-password"}
                 value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />

          <button style={{ ...button, background: "#F97316", opacity: busy ? 0.6 : 1 }} disabled={busy}>
            {busy ? "Attendi…" : mode === "accedi" ? "Entra in servizio" : "Arruolati"}
          </button>

          <div style={{ marginTop: 14, textAlign: "center" }}>
            <button type="button" style={link}
                    onClick={() => { setMode(mode === "accedi" ? "registrati" : "accedi"); setError(null); }}>
              {mode === "accedi" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
