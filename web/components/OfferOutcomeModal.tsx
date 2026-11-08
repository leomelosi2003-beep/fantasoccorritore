"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { playSound } from "@/lib/sound";
import { itemsSummary, type ItemsList } from "@/components/OfferEditor";

type Outcome = {
  id: string; status: "accettata" | "rifiutata"; price: number; decided_at: string;
  my_role: "compratore" | "venditore"; other_name: string; items: ItemsList | null;
};

const euro = (n: number) => `${Math.round(Number(n)).toLocaleString("it-IT")} €`;

// Avviso a tutta pagina: la mia ultima offerta (o controfferta) è stata accettata o rifiutata dall'altra associazione
export default function OfferOutcomeModal({ onAccepted }: { onAccepted?: () => void }) {
  const [list, setList] = useState<Outcome[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () => supabase.rpc("my_offer_outcomes").then(({ data }) => { if (alive) setList((data as Outcome[]) ?? []); });
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 20_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const o = list[0];
  useEffect(() => { if (o?.status === "accettata") { playSound("money"); onAccepted?.(); } }, [o?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!o) return null;

  const ok = o.status === "accettata";
  const buyer = o.my_role === "compratore";
  // "prendo" = cosa passa al compratore, "do" = cosa dà il compratore
  const mine = buyer ? o.items?.prendo : o.items?.do;
  const theirs = buyer ? o.items?.do : o.items?.prendo;

  // soldi (se sono di questa parte) + sedi/mezzi/volontari
  const side = (withMoney: boolean, l?: ItemsList["prendo"]) => {
    const parts = [...(withMoney && o.price > 0 ? [euro(o.price)] : []), ...(itemsSummary(l) !== "niente" ? [itemsSummary(l)] : [])];
    return parts.length ? parts.join(" + ") : "niente";
  };

  async function close() {
    await supabase.rpc("mark_offer_outcome_seen", { p_id: o.id });
    setList((l) => l.slice(1));
  }

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,.6)",
         display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "min(460px, 100%)", background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
        <div style={{ background: ok ? "linear-gradient(135deg,#16A34A,#15803D)" : "linear-gradient(135deg,#DC2626,#991B1B)",
                      color: "#fff", padding: "28px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 64, lineHeight: 1 }}>{ok ? "✅" : "❌"}</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 8 }}>{ok ? "Offerta accettata!" : "Offerta rifiutata"}</div>
        </div>
        <div style={{ padding: 20, fontSize: 15, lineHeight: 1.5 }}>
          <div>
            <strong>{o.other_name}</strong> ha {ok ? "accettato" : "rifiutato"} la tua {buyer ? "offerta" : "proposta"}
            {o.price > 0 && <> da <strong>{euro(o.price)}</strong></>}.
          </div>
          <div style={{ marginTop: 10, fontSize: 14, color: "#444", background: "#f6f6f4", borderRadius: 12, padding: 12 }}>
            <div>{ok ? "📥 Ricevi" : "📥 Avresti ricevuto"}: {side(!buyer, mine)}</div>
            <div>{ok ? "📤 Dai" : "📤 Avresti dato"}: {side(buyer, theirs)}</div>
          </div>
          {ok
            ? <div style={{ marginTop: 10, color: "#15803D", fontWeight: 600 }}>Lo scambio è già fatto: soldi, sedi, mezzi e volontari sono stati trasferiti.</div>
            : <div style={{ marginTop: 10, color: "#666" }}>Puoi fare una nuova offerta dalla pagina Alleanza.</div>}
          {list.length > 1 && <div style={{ marginTop: 8, fontSize: 13, color: "#888" }}>Ci sono altre {list.length - 1} risposte.</div>}
          <button onClick={close} style={{ marginTop: 16, width: "100%", padding: "14px", borderRadius: 12, border: "none", cursor: "pointer",
                  fontWeight: 800, fontSize: 16, background: ok ? "#16A34A" : "#111", color: "#fff" }}>OK</button>
        </div>
      </div>
    </div>
  );
}
