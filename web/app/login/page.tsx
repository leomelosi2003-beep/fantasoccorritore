"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase, friendlyError } from "@/lib/supabase";
import { page, card, input, button, link, errorBox } from "@/lib/ui";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"accedi" | "registrati">("accedi");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    try {
      if (mode === "registrati") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/onboarding" },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo("Ti abbiamo mandato un'email: clicca il link per confermare, poi accedi.");
          setMode("accedi");
          return;
        }
        router.push("/onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
      }
    } catch (err) {
      setError(friendlyError((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={page}>
      <form style={card} onSubmit={submit}>
        <h1 style={{ margin: "0 0 4px", fontSize: 26 }}>FantaSoccorritore</h1>
        <p style={{ margin: "0 0 20px", color: "#666" }}>
          {mode === "accedi" ? "Accedi per giocare" : "Crea il tuo account"}
        </p>

        {error && <div style={errorBox}>{error}</div>}
        {info && <div style={{ ...errorBox, background: "#eef6ff", color: "#1E3A8A", borderColor: "#bcd4f5" }}>{info}</div>}

        <input style={input} type="email" placeholder="Email" autoComplete="email"
               value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input style={input} type="password" placeholder="Password (minimo 6 caratteri)"
               autoComplete={mode === "accedi" ? "current-password" : "new-password"}
               value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />

        <button style={{ ...button, opacity: busy ? 0.6 : 1 }} disabled={busy}>
          {busy ? "Attendi…" : mode === "accedi" ? "Accedi" : "Registrati"}
        </button>

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button type="button" style={link}
                  onClick={() => { setMode(mode === "accedi" ? "registrati" : "accedi"); setError(null); }}>
            {mode === "accedi" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
          </button>
        </div>
      </form>
    </main>
  );
}
