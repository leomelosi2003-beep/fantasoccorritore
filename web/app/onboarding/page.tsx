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
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#2563EB", letterSpacing: ".08em", textTransform: "uppercase" }}>Benvenuto in FantaSoccorritore</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 10 }}>
            {[[1, "Associazione"], [2, "Prima sede"]].map(([n, l], i) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {i > 0 && <span style={{ width: 28, height: 3, borderRadius: 2, background: step >= 2 ? "#2563EB" : "#E2E8F0" }} />}
                <span style={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 13,
                               background: step >= Number(n) ? "linear-gradient(135deg,#3B82F6,#1E3A8A)" : "#E2E8F0", color: step >= Number(n) ? "#fff" : "#64748B" }}>
                  {step > Number(n) ? "✓" : n}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: step === Number(n) ? "#0B1B33" : "#94A3B8" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        {error && <div style={errorBox}>{error}</div>}

        {step === 1 && (
          <>
            <h2 style={{ marginTop: 0 }}>Scegli lo stemma e il nome</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
              {FACTION_STYLES.map((s) => (
                <button key={s.type} type="button" onClick={() => setStyle(s.type)}
                        style={{ padding: 10, borderRadius: 18, cursor: "pointer", background: style === s.type ? "#EFF6FF" : "#fff",
                                 border: style === s.type ? "3px solid #2563EB" : "1px solid #E2E8F0",
                                 boxShadow: style === s.type ? "0 10px 22px rgba(37,99,235,.22)" : "none", transform: style === s.type ? "translateY(-2px)" : "none" }}>
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
              <button style={{ ...button, background: "#EEF2F7", color: "#0B1B33", boxShadow: "none" }} onClick={() => setStep(1)}>
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
