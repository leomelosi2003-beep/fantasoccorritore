"use client";

import { useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { supabase, friendlyError } from "@/lib/supabase";

const PickBaseMap = dynamic(() => import("@/components/PickBaseMap"), { ssr: false });
const btn: CSSProperties = { padding: "12px 14px", borderRadius: 10, border: "none", background: "#111", color: "#fff",
  fontWeight: 700, cursor: "pointer", fontSize: 16, width: "100%" };

// Dopo la vendita dell'associazione: si riparte da una nuova sede (gratis)
export default function NuovaSede() {
  const router = useRouter();
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState("Sede centrale");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!point) return;
    setBusy(true); setError(null);
    const { error } = await supabase.rpc("build_base", { p_name: name.trim() || "Sede centrale", p_lng: point.lng, p_lat: point.lat });
    setBusy(false);
    if (error) { setError(friendlyError(error.message)); return; }
    router.replace("/");
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
        <h1 style={{ fontSize: 22, margin: "8px 0" }}>Si riparte da zero</h1>
        <p style={{ color: "#555", marginTop: 0 }}>
          Hai venduto l&apos;associazione: ti restano i fondi della vendita e i volontari epici e leggendari.
          Tocca la mappa per scegliere la nuova sede (gratis).
        </p>
        <PickBaseMap value={point} color="#111" onPick={setPoint} />
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
               style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc", fontSize: 16, margin: "12px 0", boxSizing: "border-box" }} />
        {error && <div style={{ color: "#B91C1C", marginBottom: 8 }}>{error}</div>}
        <button disabled={!point || busy} onClick={save} style={{ ...btn, opacity: point ? 1 : 0.4 }}>
          {busy ? "Attendi…" : "🏠 Apri la nuova sede"}
        </button>
      </div>
    </main>
  );
}
