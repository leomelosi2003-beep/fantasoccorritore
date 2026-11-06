"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase, friendlyError } from "@/lib/supabase";
import { page, card, input, button, errorBox } from "@/lib/ui";

// Schermata per scegliere una nuova password dopo aver aperto il link di reset.
// Il link porta con sé una sessione temporanea di recupero: supabase-js la legge dall'indirizzo
// e lancia l'evento PASSWORD_RECOVERY; finché non arriva, mostriamo "verifica del link".
export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [bad, setBad] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // se la sessione di recupero c'è già (o non c'è proprio), decidiamo dopo un attimo
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) setReady(true); else setBad(true);
    }, 2500);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== password2) { setError("Le due password non coincidono."); return; }
    setBusy(true); setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setError(friendlyError(error.message)); return; }
    setDone(true);
    setTimeout(() => { window.location.href = "/"; }, 1800);
  }

  return (
    <main style={page}>
      <div style={card}>
        <h1 style={{ margin: "0 0 16px", fontSize: 22 }}>🔑 Nuova password</h1>

        {done ? (
          <div style={{ color: "#15803D", fontWeight: 600 }}>Password cambiata! Ti sto portando nel gioco…</div>
        ) : bad && !ready ? (
          <>
            <div style={errorBox}>Questo link di reset non è valido o è scaduto. Chiedi un nuovo link.</div>
            <a href="/login" style={{ ...button, display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}>Torna all&apos;accesso</a>
          </>
        ) : !ready ? (
          <div style={{ color: "#666" }}>Verifica del link in corso…</div>
        ) : (
          <form onSubmit={submit}>
            <p style={{ marginTop: 0, color: "#555", fontSize: 14 }}>Scegli la tua nuova password: la vedi solo tu.</p>
            {error && <div style={errorBox}>{error}</div>}
            <input style={input} type="password" placeholder="Nuova password (minimo 6 caratteri)" autoComplete="new-password"
                   value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            <input style={input} type="password" placeholder="Ripeti la nuova password" autoComplete="new-password"
                   value={password2} onChange={(e) => setPassword2(e.target.value)} required minLength={6} />
            <button style={{ ...button, background: "#F97316", opacity: busy ? 0.6 : 1 }} disabled={busy}>
              {busy ? "Attendi…" : "Salva la password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
