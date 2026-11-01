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

// Corsi di formazione disponibili per ogni ruolo
const COURSES: Record<string, { target: string; label: string; price: number }[]> = {
  soccorritore_base: [
    { target: "autista", label: "autista", price: 4000 },
    { target: "soccorritore_avanzato", label: "soccorritore avanzato", price: 6000 },
  ],
  soccorritore_avanzato: [{ target: "caposervizio", label: "caposervizio", price: 8000 }],
};

const PACKS = [
  { kind: "comune", price: 3000, icon: "📦", leg: "2%", epi: "13%", note: "",
    bg: "linear-gradient(135deg,#4B5563,#1F2937)", glow: "0 2px 8px rgba(0,0,0,.15)" },
  { kind: "epico", price: 12000, icon: "💜", leg: "8%", epi: "42%", note: "almeno 1 epica garantita",
    bg: "linear-gradient(135deg,#7C3AED,#4C1D95)", glow: "0 0 16px rgba(139,92,246,.5)" },
  { kind: "leggendario", price: 35000, icon: "👑", leg: "25%", epi: "50%", note: "almeno 1 leggendaria garantita",
    bg: "linear-gradient(135deg,#F59E0B,#B45309)", glow: "0 0 20px rgba(245,158,11,.6)" },
];
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 };

export default function Squadra() {
  const router = useRouter();
  const [org, setOrg] = useState<Organization | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [pack, setPack] = useState<{ opened: boolean; next_pack_at: string } | null>(null);
  const [reveal, setReveal] = useState<Card[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [avail, setAvail] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); return; }
    const { data: o } = await supabase.from("organizations").select("id,name,type,funds,reputation,logo_url")
      .eq("owner_id", session.user.id).maybeSingle();
    if (!o) { router.replace("/onboarding"); return; }
    setOrg(o as Organization);
    const [c, p] = await Promise.all([
      supabase.from("my_cards").select("*").order("acquired_at", { ascending: false }),
      supabase.rpc("pack_status"),
    ]);
    setCards((c.data as Card[]) ?? []);
    supabase.rpc("pack_availability").then(({ data }) => setAvail((data as Record<string, number>) ?? {}));
    setPack(p.data as { opened: boolean; next_pack_at: string });
  }, [router]);

  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);

  // Corsi di formazione: base → autista o avanzato, avanzato → caposervizio
  async function upgrade(c: Card, target: string, label: string, price: number) {
    if (!window.confirm(`Mandare ${c.first_name} ${c.last_name} al corso da ${label}?\n\nCosto ${price.toLocaleString("it-IT")} €. Il corso dura 1 ora, poi è ${label} per sempre.`)) return;
    setBusy(true); setError(null);
    const { error } = await supabase.rpc("training_course", { p_card: c.id, p_target: target });
    setBusy(false);
    if (error) {
      const m = error.message;
      setError(m.includes("INSUFFICIENT_FUNDS") ? `Servono ${price.toLocaleString("it-IT")} € per il corso.`
        : m.includes("CARD_BUSY") ? "È in servizio: aspetta che rientri."
        : m.includes("CARD_LENT") ? "È in prestito a un alleato: riprendilo prima."
        : friendlyError(m));
      return;
    }
    await load();
  }

  // Pacchetti a pagamento
  async function buyPack(kind: string, price: number) {
    if (!window.confirm(`Comprare il pacchetto ${kind} per ${price.toLocaleString("it-IT")} €?`)) return;
    setBusy(true); setError(null);
    const { data, error } = await supabase.rpc("buy_pack", { p_kind: kind });
    if (error) {
      setBusy(false);
      const m = error.message;
      setError(m.includes("INSUFFICIENT_FUNDS") ? "Non hai abbastanza fondi."
        : m.includes("NO_LEGENDARY_LEFT") ? "Non ci sono carte leggendarie da trovare (le hai già tutte o non ne esistono ancora): non hai pagato niente."
        : m.includes("NO_EPIC_LEFT") ? "Non ci sono carte epiche da trovare (le hai già tutte o non ne esistono ancora): non hai pagato niente."
        : friendlyError(m));
      return;
    }
    const ids = ((data as { id: string }[]) ?? []).map((x) => x.id);
    const { data: fresh } = await supabase.from("my_cards").select("*").in("id", ids);
    const order = new Map(ids.map((id, i) => [id, i]));
    setReveal(((fresh as Card[]) ?? []).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
    if (ids.length < 5) setError(`Non c'erano abbastanza carte nuove: ti abbiamo rimborsato ${5 - ids.length} carte.`);
    setBusy(false);
    load();
  }

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
  const counts = [
    { ...ROLE.autista, n: active.filter((c) => c.role === "autista" && !c.avanzato).length },
    { label: "Autista avanzato", icon: "🚑", n: active.filter((c) => c.role === "autista" && c.avanzato).length },
    ...(["soccorritore_base", "soccorritore_avanzato", "caposervizio"] as const).map((k) => ({ ...ROLE[k], n: active.filter((c) => c.role === k).length })),
  ];
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
          <FactionEmblem type={org.type} size={32} logo={org.logo_url} />
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

        {/* Pacchetti a pagamento */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 16 }}>
          {PACKS.map((p) => {
            const none = (p.kind === "leggendario" && !avail.leggendaria) || (p.kind === "epico" && !avail.epica && !avail.leggendaria);
            return (
              <div key={p.kind} style={{ background: p.bg, color: "#fff", borderRadius: 16, padding: 14, display: "flex",
                                         flexDirection: "column", gap: 6, boxShadow: p.glow }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 34 }}>{p.icon}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 17 }}>Pacchetto {p.kind}</div>
                    <div style={{ fontSize: 13, opacity: 0.9 }}>5 volontari nuovi</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  🟡 Leggendaria: <strong>{p.leg}</strong><br />
                  🟣 Epica: <strong>{p.epi}</strong><br />
                  {p.note && <span style={{ opacity: 0.9 }}>✨ {p.note}</span>}
                </div>
                <button onClick={() => buyPack(p.kind, p.price)} disabled={busy || none}
                        style={{ ...btn, background: "#fff", color: "#111", marginTop: "auto", opacity: busy || none ? 0.5 : 1 }}>
                  {none ? "Nessuna carta da trovare" : `Compra · ${p.price.toLocaleString("it-IT")} €`}
                </button>
              </div>
            );
          })}
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
          <div style={grid}>{active.map((c) => (
            <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <VolunteerCard c={c} />
              {!c.lent_from && !c.lent_to && COURSES[c.role]?.map((k) => (
                <button key={k.target} disabled={busy || c.state === "in_servizio"} onClick={() => upgrade(c, k.target, k.label, k.price)}
                        style={{ ...btn, background: "#7C3AED", fontSize: 13, padding: "8px 10px", opacity: c.state === "in_servizio" ? 0.5 : 1 }}>
                  📚 Corso {k.label} · {k.price.toLocaleString("it-IT")} €
                </button>
              ))}
            </div>
          ))}</div>
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
