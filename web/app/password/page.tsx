"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase, friendlyError } from "@/lib/supabase";
import { page, card, input, button, errorBox } from "@/lib/ui";
import PageHeader from "@/components/PageHeader";

// Cambio password da dentro il gioco (utente già collegato). Menu → Impostazioni → Cambia password.
export default function CambiaPassword() {
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { window.location.href = "/login"; return; }
      setEmail(data.session.user.email ?? "");
    });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError("La password deve avere almeno 6 caratteri."); return; }
    if (password !== password2) { setError("Le due password non coincidono."); return; }
    setBusy(true); setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      const m = error.message || "";
      setError(/different from the old|same/i.test(m) ? "La nuova password è uguale a quella di prima: scegline un'altra." : friendlyError(m));
      return;
    }
    setDone(true); setPassword(""); setPassword2("");
  }

  return (
    <main style={{ ...page, display: "block", padding: 0 }}>
      <PageHeader icon="🔑" title="Cambia password" tone="slate" sub="Scegli una password nuova per il tuo account" />
      <div style={{ ...card, margin: "0 auto", maxWidth: 420 }}>
        {email && <p style={{ marginTop: 0, color: "#555", fontSize: 14 }}>Account: <b>{email}</b></p>}

        {done ? (
          <>
            <div style={{ color: "#15803D", fontWeight: 600, margin: "12px 0" }}>✅ Password cambiata! Dal prossimo accesso usa quella nuova.</div>
            <a href="/" style={{ ...button, display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}>Torna al gioco</a>
          </>
        ) : (
          <form onSubmit={submit}>
            {error && <div style={errorBox}>{error}</div>}
            <input style={input} type={show ? "text" : "password"} placeholder="Nuova password (minimo 6 caratteri)" autoComplete="new-password"
                   value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            <input style={input} type={show ? "text" : "password"} placeholder="Ripeti la nuova password" autoComplete="new-password"
                   value={password2} onChange={(e) => setPassword2(e.target.value)} required minLength={6} />
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: "#555", margin: "0 0 12px" }}>
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Mostra password
            </label>
            <button style={{ ...button, background: "linear-gradient(135deg,#3B82F6,#1E3A8A)", borderRadius: 14, opacity: busy ? 0.6 : 1 }} disabled={busy}>
              {busy ? "Attendi…" : "Salva la nuova password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
