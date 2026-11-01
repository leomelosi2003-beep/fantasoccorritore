"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase, friendlyError, type Organization } from "@/lib/supabase";
import FactionEmblem from "@/components/FactionEmblem";
import VolunteerCard, { ROLE, type Card } from "@/components/VolunteerCard";

const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: 16 };
const btn: CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "none", background: "#111", color: "#fff",
  fontWeight: 600, cursor: "pointer", fontSize: 15 };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 };

export default function Squadra() {
  const router = useRouter();
  const [org, setOrg] = useState<Organization | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [pack, setPack] = useState<{ opened: boolean; next_pack_at: string } | null>(null);
  const [reveal, setReveal] = useState<Card[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExpired, setShowExpired] = useState(false);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); return; }
    const { data: o } = await supabase.from("organizations").select("id,name,type,funds,reputation")
      .eq("owner_id", session.user.id).maybeSingle();
    if (!o) { router.replace("/onboarding"); return; }
    setOrg(o as Organization);
    const [c, p] = await Promise.all([
      supabase.from("my_cards").select("*").order("acquired_at", { ascending: false }),
      supabase.rpc("pack_status"),
    ]);
    setCards((c.data as Card[]) ?? []);
    setPack(p.data as { opened: boolean; next_pack_at: string });
  }, [router]);

  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);

  async function openPack() {
    setBusy(true); setError(null);
    const { data, error } = await supabase.rpc("open_weekly_pack");
    if (error) {
      setBusy(false);
      setError(error.message.includes("PACK_ALREADY_OPENED") ? "Hai già aperto il pacchetto di questa settimana." : friendlyError(error.message));
      return;
    }
    const ids = ((data as { id: string }[]) ?? []).map((x) => x.id);
    const { data: fresh } = await supabase.from("my_cards").select("*").in("id", ids);
    const order = new Map(ids.map((id, i) => [id, i]));
    setReveal(((fresh as Card[]) ?? []).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
    setBusy(false);
    load();
  }

  if (!org) return <main style={shell} />;

  const active = cards.filter((c) => c.state !== "scaduta");
  const expired = cards.filter((c) => c.state === "scaduta");
  const counts = Object.entries(ROLE).map(([k, v]) => ({ ...v, n: active.filter((c) => c.role === k).length }));
  const nextPack = pack?.next_pack_at ? new Date(pack.next_pack_at) : null;

  return (
    <main style={shell}>
      <style>{`
        @keyframes flipIn { 0% { transform: perspective(800px) rotateY(90deg) scale(.8); opacity: 0 }
                            100% { transform: perspective(800px) rotateY(0) scale(1); opacity: 1 } }
        @keyframes packPulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.04) } }
      `}</style>

      <div style={{ background: "#111", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={() => router.push("/")} style={{ ...btn, background: "#333", padding: "8px 12px" }}>← Mappa</button>
          <FactionEmblem type={org.type} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>Squadra · {org.name}</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>{active.length} volontari attivi</div>
          </div>
        </div>
      </div>

      <div style={wrap}>
        {/* Pacchetto settimanale */}
        <div style={{ background: "linear-gradient(135deg,#1E3A8A,#111827)", color: "#fff", borderRadius: 16, padding: 18,
                      display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ fontSize: 44, animation: pack && !pack.opened ? "packPulse 1.6s infinite" : undefined }}>🎴</div>
          <div style={{ flex: "1 1 220px" }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Pacchetto settimanale</div>
            <div style={{ fontSize: 14, opacity: 0.85 }}>
              {pack?.opened
                ? `Già aperto. Il prossimo arriva ${nextPack ? nextPack.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }) : "lunedì"}.`
                : "5 volontari nuovi: sempre almeno un autista e un soccorritore."}
            </div>
          </div>
          <button onClick={openPack} disabled={busy || !pack || pack.opened}
                  style={{ ...btn, background: "#F97316", padding: "12px 20px", fontSize: 16,
                           opacity: busy || !pack || pack.opened ? 0.4 : 1 }}>
            {busy ? "Apertura…" : pack?.opened ? "Già aperto" : "Apri pacchetto"}
          </button>
        </div>

        {error && <div style={{ background: "#fff1f1", color: "#a00", borderRadius: 10, padding: 12, marginBottom: 12 }}>{error}</div>}

        {/* Riepilogo ruoli */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {counts.map((c) => (
            <div key={c.label} style={{ background: "#fff", borderRadius: 10, padding: "8px 12px", fontSize: 14,
                                         boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
              {c.icon} {c.label}: <strong>{c.n}</strong>
            </div>
          ))}
        </div>

        {active.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, textAlign: "center", color: "#666" }}>
            Nessun volontario. Apri il pacchetto per formare la tua prima squadra!
          </div>
        ) : (
          <div style={grid}>{active.map((c) => <VolunteerCard key={c.id} c={c} />)}</div>
        )}

        {expired.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <button onClick={() => setShowExpired(!showExpired)} style={{ ...btn, background: "#e5e5e0", color: "#111" }}>
              {showExpired ? "Nascondi" : "Mostra"} contratti scaduti ({expired.length})
            </button>
            {showExpired && <div style={{ ...grid, marginTop: 12 }}>{expired.map((c) => <VolunteerCard key={c.id} c={c} compact />)}</div>}
          </div>
        )}
      </div>

      {/* Rivelazione del pacchetto */}
      {reveal && (
        <div onClick={() => setReveal(null)}
             style={{ position: "fixed", inset: 0, background: "rgba(5,7,15,.88)", zIndex: 50, overflowY: "auto",
                      display: "flex", flexDirection: "column", alignItems: "center", padding: 16 }}>
          <h2 style={{ color: "#fff", margin: "16px 0" }}>Nuovi volontari!</h2>
          <div style={{ ...grid, width: "100%", maxWidth: 1080 }}>
            {reveal.map((c, i) => (
              <div key={c.id} style={{ animation: `flipIn .6s ${i * 0.35}s both` }}>
                <VolunteerCard c={c} />
              </div>
            ))}
          </div>
          <button onClick={() => setReveal(null)} style={{ ...btn, background: "#F97316", marginTop: 20 }}>Benvenuti in squadra</button>
        </div>
      )}
    </main>
  );
}
