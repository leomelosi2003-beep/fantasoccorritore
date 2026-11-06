"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import OfferEditor, { itemsSummary, listToItems, offerError, type ItemsList, type OfferItems } from "@/components/OfferEditor";

type Details = {
  id: string; buyer_name: string; seller_name: string; price: number; first_price: number; rounds: number; turn: string;
  my_role: "venditore" | "compratore" | null; seller_funds: number; buyer_funds: number;
};
type Side = ItemsList["prendo"];

const euro = (n: number) => `${Math.round(Number(n)).toLocaleString("it-IT")} €`;
const btn: CSSProperties = { padding: "12px 14px", borderRadius: 12, border: "none", fontWeight: 800, fontSize: 15, cursor: "pointer", flex: "1 1 120px" };
const col: CSSProperties = { flex: "1 1 240px", borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 1.5 };

function SideList({ s, money }: { s?: Side; money?: number }) {
  const empty = !s || (!s.sedi.length && !s.mezzi.length && !s.volontari.length);
  return (
    <>
      {money != null && money > 0 && <>💶 {euro(money)}<br /></>}
      {s?.sedi.map((x) => <span key={x.id}>🏠 {x.name}{x.mezzi > 0 && <span style={{ color: "#666" }}> · con {x.mezzi} {x.mezzi === 1 ? "mezzo" : "mezzi"}</span>}<br /></span>)}
      {s && s.mezzi.length > 0 && <>🚑 {s.mezzi.map((m) => m.call_sign).join(", ")}<br /></>}
      {s && s.volontari.length > 0 && (
        <>👥 {s.volontari.length} {s.volontari.length === 1 ? "volontario" : "volontari"}
          <span style={{ color: "#666", fontSize: 12 }}> ({s.volontari.slice(0, 6).map((v) => v.name).join(", ")}{s.volontari.length > 6 ? "…" : ""})</span><br /></>
      )}
      {empty && !(money != null && money > 0) && <span style={{ color: "#888" }}>niente</span>}
    </>
  );
}

// Notifica a tutto schermo: offerta (o controfferta) di acquisto/scambio, quando tocca a me rispondere
export default function AcquisitionModal({ onDone }: { onDone?: (text: string) => void }) {
  const [d, setD] = useState<Details | null>(null);
  const [items, setItems] = useState<ItemsList | null>(null);
  const [orgIds, setOrgIds] = useState<{ buyer: string; seller: string } | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [countering, setCountering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.rpc("my_pending_offers");
      const ids = ((data as string[]) ?? []).filter((x) => !hidden.includes(x));
      if (!ids.length) { if (alive) setD(null); return; }
      const [r, it, row] = await Promise.all([
        supabase.rpc("acquisition_offer_details", { p_id: ids[0] }),
        supabase.rpc("acquisition_offer_items_list", { p_id: ids[0] }),
        supabase.from("acquisition_offers").select("buyer_org,seller_org").eq("id", ids[0]).maybeSingle(),
      ]);
      const det = ((r.data as Details[]) ?? [])[0] ?? null;
      if (!alive) return;
      setD((cur) => (cur && det && cur.id === det.id && cur.price === det.price && cur.turn === det.turn ? cur : det));
      setItems((it.data as ItemsList) ?? null);
      setOrgIds(row.data ? { buyer: row.data.buyer_org as string, seller: row.data.seller_org as string } : null);
    };
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible" && !countering) load(); }, 15_000);
    return () => { alive = false; clearInterval(t); };
  }, [hidden, countering]);

  if (!d || !d.my_role) return null;
  const seller = d.my_role === "venditore";
  const other = seller ? d.buyer_name : d.seller_name;
  const isCounter = d.rounds > 0;

  async function answer(accept: boolean) {
    if (!d) return;
    if (accept && !window.confirm(`Confermi lo scambio con ${other}?\n\n📤 ${seller ? "Dai" : "Ricevi"}: ${itemsSummary(items?.prendo)}\n📥 ${seller ? "Ricevi" : "Dai"}: ${euro(d.price)}${items?.do && itemsSummary(items.do) !== "niente" ? ` + ${itemsSummary(items.do)}` : ""}`)) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("answer_acquisition_offer", { p_id: d.id, p_accept: accept });
    setBusy(false);
    if (error) { setErr(offerError(error.message)); return; }
    const id = d.id; setD(null); setHidden((h) => [...h, id]);
    onDone?.(accept ? `💼 Scambio fatto con ${other}!` : seller ? "Offerta rifiutata." : "Controfferta rifiutata.");
  }

  async function sendCounter(price: number, take: OfferItems, give: OfferItems) {
    if (!d) return null;
    const { error } = await supabase.rpc("counter_acquisition_offer", { p_id: d.id, p_price: price, p_take: take, p_give: give });
    if (error) return offerError(error.message);
    const id = d.id; setCountering(false); setD(null); setHidden((h) => [...h, id]);
    onDone?.(`🤝 Controfferta mandata a ${other}.`);
    return null;
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(10,10,20,.82)", display: "flex", alignItems: "center",
                  justifyContent: "center", padding: 12, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 18, maxWidth: 760, width: "100%", maxHeight: "94vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,.4)" }}>
        <div style={{ background: "linear-gradient(135deg,#1E3A8A,#7C3AED)", color: "#fff", padding: "18px 18px 14px", borderRadius: "18px 18px 0 0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.85, textTransform: "uppercase" }}>
            {isCounter ? "Controfferta" : "Offerta di acquisto"} · {d.rounds} {d.rounds === 1 ? "rilancio" : "rilanci"} su 6
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25, marginTop: 4 }}>
            {seller ? <>💼 {d.buyer_name} vuole fare uno scambio con te</> : <>🤝 {d.seller_name} ti risponde</>}
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, marginTop: 8 }}>{euro(d.price)}</div>
          {isCounter && d.first_price !== d.price && <div style={{ fontSize: 13, opacity: 0.85 }}>offerta iniziale {euro(d.first_price)}</div>}
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <div style={{ ...col, background: "#FEF2F2" }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>➡️ Da {d.seller_name} a {d.buyer_name}</div>
              <SideList s={items?.prendo} />
            </div>
            <div style={{ ...col, background: "#F0FDF4" }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>⬅️ Da {d.buyer_name} a {d.seller_name}</div>
              <SideList s={items?.do} money={d.price} />
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>
            Tutto il resto rimane a chi lo ha. Se un mezzo o un volontario che passa è in servizio, quel servizio si chiude senza premio.
            {!seller && <> I tuoi soldi: {euro(d.buyer_funds)}.</>}
          </div>

          {err && <div style={{ color: "#B91C1C", fontWeight: 700, marginBottom: 10 }}>{err}</div>}

          {!countering ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button disabled={busy} onClick={() => answer(true)} style={{ ...btn, background: "#15803D", color: "#fff" }}>✅ Accetto</button>
              <button disabled={busy || d.rounds >= 6 || !orgIds} onClick={() => setCountering(true)}
                      style={{ ...btn, background: "#F59E0B", color: "#111", opacity: d.rounds >= 6 ? 0.5 : 1 }}>🤝 Contratto</button>
              <button disabled={busy} onClick={() => answer(false)} style={{ ...btn, background: "#e5e7eb", color: "#111" }}>❌ Rifiuto</button>
            </div>
          ) : orgIds && (
            <OfferEditor buyerId={orgIds.buyer} sellerId={orgIds.seller} buyerName={d.buyer_name} sellerName={d.seller_name}
                         viewerIsBuyer={!seller} initialPrice={Number(d.price)} initialTake={listToItems(items?.prendo)} initialGive={listToItems(items?.do)}
                         submitLabel="🤝 Manda controfferta" myFunds={seller ? undefined : Number(d.buyer_funds)}
                         onSubmit={sendCounter} onCancel={() => setCountering(false)} />
          )}
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <button onClick={() => { setCountering(false); setHidden((h) => [...h, d.id]); }}
                    style={{ background: "none", border: "none", color: "#666", cursor: "pointer", textDecoration: "underline" }}>
              Decido più tardi (la trovi in Alleanza)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
