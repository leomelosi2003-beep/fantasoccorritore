"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Details = {
  id: string; buyer_name: string; seller_name: string; price: number; first_price: number; rounds: number; turn: string;
  my_role: "venditore" | "compratore" | null; bases: number; vehicles: number; assets_value: number; common_cards: number;
  common_moving: number; rare_cards: number; seller_funds: number; buyer_funds: number; active_services: number;
};

const euro = (n: number) => `${Math.round(Number(n)).toLocaleString("it-IT")} €`;
const btn: CSSProperties = { padding: "12px 14px", borderRadius: 12, border: "none", fontWeight: 800, fontSize: 15, cursor: "pointer", flex: "1 1 120px" };
const col: CSSProperties = { flex: "1 1 240px", borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 1.5 };

// Notifica a tutto schermo: offerta (o controfferta) per comprare un'associazione, quando tocca a me rispondere
export default function AcquisitionModal({ onDone }: { onDone?: (text: string) => void }) {
  const router = useRouter();
  const [d, setD] = useState<Details | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [counter, setCounter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.rpc("my_pending_offers");
      const ids = ((data as string[]) ?? []).filter((x) => !hidden.includes(x));
      if (!ids.length) { if (alive) setD(null); return; }
      const r = await supabase.rpc("acquisition_offer_details", { p_id: ids[0] });
      const det = ((r.data as Details[]) ?? [])[0] ?? null;
      if (alive) setD((cur) => (cur && det && cur.id === det.id && cur.price === det.price && cur.turn === det.turn ? cur : det));
    };
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15_000);
    return () => { alive = false; clearInterval(t); };
  }, [hidden]);

  if (!d || !d.my_role) return null;
  const seller = d.my_role === "venditore";
  const other = seller ? d.buyer_name : d.seller_name;
  const isCounter = d.rounds > 0;

  async function answer(accept: boolean) {
    if (!d) return;
    if (accept && !window.confirm(seller ? `Confermi la vendita a ${d.buyer_name} per ${euro(d.price)}?` : `Confermi l'acquisto di ${d.seller_name} per ${euro(d.price)}?`)) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("answer_acquisition_offer", { p_id: d.id, p_accept: accept });
    setBusy(false);
    if (error) {
      setErr(error.message.includes("BUYER_NO_FUNDS") ? "Il compratore non ha più abbastanza soldi."
        : error.message.includes("NOT_YOUR_TURN") ? "Non tocca a te rispondere." : error.message.includes("NOT_FOUND") ? "L'offerta non è più valida." : error.message);
      return;
    }
    const id = d.id; setD(null); setHidden((h) => [...h, id]);
    if (accept && seller) { router.replace("/nuova-sede"); return; }
    onDone?.(accept ? `💼 Hai comprato ${d.seller_name}: sedi e mezzi sono tuoi!` : seller ? "Offerta rifiutata." : "Controfferta rifiutata.");
  }
  async function sendCounter() {
    if (!d || !counter) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("counter_acquisition_offer", { p_id: d.id, p_price: Number(counter) });
    setBusy(false);
    if (error) {
      setErr(error.message.includes("TOO_MANY_ROUNDS") ? "Avete già trattato troppe volte: ora accetta o rifiuta."
        : error.message.includes("INSUFFICIENT_FUNDS") ? "Non hai abbastanza soldi per questa cifra." : error.message.includes("BAD_PRICE") ? "Cifra non valida." : error.message);
      return;
    }
    const id = d.id; setCounter(null); setD(null); setHidden((h) => [...h, id]);
    onDone?.(`🤝 Controfferta di ${euro(Number(counter))} mandata a ${other}.`);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(10,10,20,.82)", display: "flex", alignItems: "center",
                  justifyContent: "center", padding: 12, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 18, maxWidth: 640, width: "100%", maxHeight: "94vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,.4)" }}>
        <div style={{ background: "linear-gradient(135deg,#1E3A8A,#7C3AED)", color: "#fff", padding: "18px 18px 14px", borderRadius: "18px 18px 0 0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.85, textTransform: "uppercase" }}>
            {seller ? (isCounter ? "Nuova offerta dopo la trattativa" : "Offerta di acquisto") : "Controfferta"}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25, marginTop: 4 }}>
            {seller ? <>💼 {d.buyer_name} vuole comprare la tua associazione</> : <>🤝 {d.seller_name} chiede di più per vendersi</>}
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, marginTop: 8 }}>{euro(d.price)}</div>
          {isCounter && d.first_price !== d.price && (
            <div style={{ fontSize: 13, opacity: 0.85 }}>offerta iniziale {euro(d.first_price)} · {d.rounds} {d.rounds === 1 ? "rilancio" : "rilanci"}</div>
          )}
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <div style={{ ...col, background: "#FEF2F2" }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>➡️ Va {seller ? `a ${d.buyer_name}` : "a te"}</div>
              🏠 tutte le sedi ({d.bases})<br />
              🚑 tutti i mezzi ({d.vehicles})<br />
              👥 metà dei volontari comuni (circa {d.common_moving} su {d.common_cards})<br />
              <span style={{ color: "#666", fontSize: 12 }}>valore di sedi e mezzi circa {euro(d.assets_value)}</span>
            </div>
            <div style={{ ...col, background: "#F0FDF4" }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>🔒 Resta {seller ? "a te" : `a ${d.seller_name}`}</div>
              💶 i soldi in cassa ({euro(d.seller_funds)}) + il prezzo pagato ({euro(d.price)})<br />
              ⭐ i volontari epici e leggendari ({d.rare_cards})<br />
              🏆 il nome e la reputazione<br />
              <span style={{ color: "#666", fontSize: 12 }}>l&apos;altra metà dei volontari comuni se ne va; poi {seller ? "scegli" : "sceglie"} una nuova sede e {seller ? "riparti" : "riparte"}</span>
            </div>
          </div>
          {d.active_services > 0 && (
            <div style={{ fontSize: 13, background: "#FFFBEB", borderRadius: 10, padding: 8, marginBottom: 12 }}>
              ⚠️ {seller ? "Hai" : `${d.seller_name} ha`} {d.active_services} servizi in corso: con la vendita si chiudono subito senza premio.
            </div>
          )}
          {!seller && (
            <div style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>I tuoi soldi: {euro(d.buyer_funds)}</div>
          )}

          {err && <div style={{ color: "#B91C1C", fontWeight: 700, marginBottom: 10 }}>{err}</div>}

          {counter === null ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button disabled={busy} onClick={() => answer(true)} style={{ ...btn, background: "#15803D", color: "#fff" }}>
                ✅ {seller ? "Accetto e vendo" : "Accetto e compro"}
              </button>
              <button disabled={busy} onClick={() => setCounter(String(Math.round((Number(d.price) * (seller ? 1.2 : 0.9)) / 1000) * 1000))}
                      style={{ ...btn, background: "#F59E0B", color: "#111" }}>🤝 Contratto</button>
              <button disabled={busy} onClick={() => answer(false)} style={{ ...btn, background: "#e5e7eb", color: "#111" }}>❌ Rifiuto</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span style={{ fontWeight: 700 }}>{seller ? "Chiedo:" : "Offro:"}</span>
              <input type="number" min={1000} step={1000} value={counter} onChange={(e) => setCounter(e.target.value)}
                     style={{ flex: "1 1 140px", padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }} />
              <button disabled={busy || Number(counter) < 1000} onClick={sendCounter} style={{ ...btn, background: "#F59E0B", color: "#111" }}>Manda controfferta</button>
              <button disabled={busy} onClick={() => setCounter(null)} style={{ ...btn, flex: "0 0 auto", background: "#e5e7eb", color: "#111" }}>Indietro</button>
            </div>
          )}
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <button onClick={() => setHidden((h) => [...h, d.id])} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", textDecoration: "underline" }}>
              Decido più tardi (la trovi in Alleanza)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
