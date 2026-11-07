"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { supabase, friendlyError } from "@/lib/supabase";
import FactionEmblem, { FACTION_STYLES, type FactionStyle } from "@/components/FactionEmblem";
import { page, card, input, button, errorBox } from "@/lib/ui";

const PickBaseMap = dynamic(() => import("@/components/PickBaseMap"), { ssr: false });

export default function Onboarding() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [style, setStyle] = useState<FactionStyle | null>(null);
  const [name, setName] = useState("");
  const [baseName, setBaseName] = useState("Sede centrale");
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Serve un account; chi ha già un'associazione va direttamente alla mappa
  useEffect(() => {
    let cancelled = false; let tries = 0;
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) { router.replace("/login"); return; }
      const { data, error } = await supabase.from("organizations").select("id")
        .eq("owner_id", session.user.id).maybeSingle();
      if (cancelled) return;
      // se la query fallisce (server lento) riprova: non mostrare il form di una nuova associazione a chi ne ha già una
      if (error) { if (tries++ < 6) setTimeout(check, 2500); return; }
      if (data) { router.replace("/"); return; }
      setReady(true);
    }
    check();
    return () => { cancelled = true; };
  }, [router]);

  async function create() {
    if (!style || !point) return;
    setBusy(true); setError(null);
    const { error } = await supabase.rpc("create_organization", {
      p_name: name.trim(), p_type: style, p_theme: {},
      p_base_name: baseName.trim() || "Sede centrale", p_lng: point.lng, p_lat: point.lat,
    });
    setBusy(false);
    if (error) { setError(friendlyError(error.message)); return; }
    router.replace("/");
  }

  if (!ready) return <main style={page}>Caricamento…</main>;

  const color = FACTION_STYLES.find((s) => s.type === style)?.colors[0] ?? "#999";

  return (
    <main style={page}>
      <div style={{ ...card, maxWidth: 560 }}>
        {error && <div style={errorBox}>{error}</div>}

        {step === 1 && (
          <>
            <h2 style={{ marginTop: 0 }}>La tua associazione</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
              {FACTION_STYLES.map((s) => (
                <button key={s.type} type="button" onClick={() => setStyle(s.type)}
                        style={{ padding: 10, borderRadius: 12, cursor: "pointer", background: "#fff",
                                 border: style === s.type ? "3px solid #111" : "1px solid #ddd" }}>
                  <FactionEmblem type={s.type} size={72} />
                </button>
              ))}
            </div>
            <input style={input} placeholder="Nome dell'associazione" maxLength={60}
                   value={name} onChange={(e) => setName(e.target.value)} />
            <button style={{ ...button, opacity: style && name.trim().length >= 3 ? 1 : 0.4 }}
                    disabled={!style || name.trim().length < 3} onClick={() => setStep(2)}>
              Avanti
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ marginTop: 0 }}>Dove apri la prima sede?</h2>
            <p style={{ marginTop: 0, color: "#666" }}>Tocca la mappa per scegliere il punto.</p>
            <PickBaseMap value={point} color={color} onPick={setPoint} />
            <input style={{ ...input, marginTop: 12 }} placeholder="Nome della sede"
                   value={baseName} onChange={(e) => setBaseName(e.target.value)} />
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...button, background: "#e5e5e0", color: "#111" }} onClick={() => setStep(1)}>
                Indietro
              </button>
              <button style={{ ...button, opacity: point && !busy ? 1 : 0.4 }}
                      disabled={!point || busy} onClick={create}>
                {busy ? "Creazione…" : "Fonda l'associazione"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
