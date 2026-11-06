"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";

// Scelta di cosa si prende e cosa si dà in un'offerta di acquisto (anche nelle controfferte)
export type OfferItems = { sedi: string[]; mezzi: string[]; volontari: string[] };
type Assets = {
  sedi: { id: string; name: string; hq: boolean; mezzi: number }[];
  mezzi: { id: string; call_sign: string; base_id: string | null; base_name: string | null; status: string }[];
  volontari: { id: string; name: string; role: string; rarity: string; state: string }[];
};

export const emptyItems = (): OfferItems => ({ sedi: [], mezzi: [], volontari: [] });

// contenuto di un'offerta con i nomi (rpc acquisition_offer_items_list)
type ListSide = { sedi: { id: string; name: string; mezzi: number }[]; mezzi: { id: string; call_sign: string }[];
                  volontari: { id: string; name: string; role: string; rarity: string }[] };
export type ItemsList = { prendo: ListSide; do: ListSide };
export const listToItems = (l?: ListSide): OfferItems =>
  l ? { sedi: l.sedi.map((x) => x.id), mezzi: l.mezzi.map((x) => x.id), volontari: l.volontari.map((x) => x.id) } : emptyItems();
// riassunto in testo
export function itemsSummary(l?: ListSide) {
  if (!l) return "niente";
  const parts = [
    ...l.sedi.map((s) => `sede ${s.name}${s.mezzi ? ` (con ${s.mezzi} ${s.mezzi === 1 ? "mezzo" : "mezzi"})` : ""}`),
    ...(l.mezzi.length ? [`${l.mezzi.length} ${l.mezzi.length === 1 ? "mezzo" : "mezzi"} (${l.mezzi.map((m) => m.call_sign).join(", ")})`] : []),
    ...(l.volontari.length ? [`${l.volontari.length} ${l.volontari.length === 1 ? "volontario" : "volontari"}`] : []),
  ];
  return parts.length ? parts.join(", ") : "niente";
}
const euro = (n: number) => `${Math.round(Number(n)).toLocaleString("it-IT")} €`;
const ROLE: Record<string, string> = {
  autista: "autista", soccorritore_base: "soccorritore", soccorritore_avanzato: "soccorritore avanzato",
  caposervizio: "caposervizio", infermiere: "infermiere", medico: "medico",
};
const RARITY: Record<string, string> = { comune: "", rara: "⭐", epica: "💜", leggendaria: "🏆" };

const btn: CSSProperties = { padding: "12px 14px", borderRadius: 12, border: "none", fontWeight: 800, fontSize: 15, cursor: "pointer", flex: "1 1 140px" };
const list: CSSProperties = { maxHeight: 220, overflowY: "auto", border: "1px solid #eee", borderRadius: 10, padding: 4, marginBottom: 8 };
const item = (on: boolean, locked = false): CSSProperties => ({
  display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "6px 8px", marginBottom: 2,
  borderRadius: 8, border: "none", font: "inherit", fontSize: 13, cursor: locked ? "default" : "pointer",
  background: on ? "#DBEAFE" : "transparent", color: locked ? "#999" : "#111",
});

function Picker({ title, assets, sel, setSel }: { title: string; assets: Assets | null; sel: OfferItems; setSel: (x: OfferItems) => void }) {
  if (!assets) return <div style={{ color: "#888", fontSize: 13, padding: 8 }}>Caricamento…</div>;
  const toggle = (k: keyof OfferItems, id: string) =>
    setSel({ ...sel, [k]: sel[k].includes(id) ? sel[k].filter((x) => x !== id) : [...sel[k], id] });
  const viaSede = (baseId: string | null) => !!baseId && sel.sedi.includes(baseId);
  const n = sel.sedi.length + sel.mezzi.length + sel.volontari.length;
  return (
    <div style={{ flex: "1 1 260px", minWidth: 0 }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{title} {n > 0 && <span style={{ color: "#1E40AF" }}>({n})</span>}</div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>🏠 Sedi</div>
      <div style={list}>
        {assets.sedi.length === 0 && <div style={{ fontSize: 12, color: "#999", padding: 4 }}>Nessuna</div>}
        {assets.sedi.map((s) => (
          <button key={s.id} disabled={s.hq} onClick={() => toggle("sedi", s.id)} style={item(sel.sedi.includes(s.id), s.hq)}>
            <span>{s.hq ? "🔒" : sel.sedi.includes(s.id) ? "✅" : "⬜"}</span>
            <span style={{ flex: 1 }}>{s.name}{s.mezzi > 0 && <span style={{ color: "#666" }}> · con {s.mezzi} {s.mezzi === 1 ? "mezzo" : "mezzi"}</span>}</span>
            {s.hq && <span style={{ fontSize: 11 }}>sede principale</span>}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>🚑 Mezzi</div>
      <div style={list}>
        {assets.mezzi.length === 0 && <div style={{ fontSize: 12, color: "#999", padding: 4 }}>Nessuno</div>}
        {assets.mezzi.map((m) => {
          const locked = viaSede(m.base_id);
          const on = locked || sel.mezzi.includes(m.id);
          return (
            <button key={m.id} disabled={locked} onClick={() => toggle("mezzi", m.id)} style={item(on, locked)}>
              <span>{on ? "✅" : "⬜"}</span>
              <span style={{ flex: 1 }}><strong>{m.call_sign}</strong>{m.base_name && <span style={{ color: "#666" }}> · {m.base_name}</span>}</span>
              {locked ? <span style={{ fontSize: 11 }}>con la sede</span> : m.status === "in_servizio" ? <span style={{ fontSize: 11, color: "#B45309" }}>in servizio</span> : null}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>👥 Volontari</div>
      <div style={list}>
        {assets.volontari.length === 0 && <div style={{ fontSize: 12, color: "#999", padding: 4 }}>Nessuno</div>}
        {assets.volontari.map((v) => (
          <button key={v.id} onClick={() => toggle("volontari", v.id)} style={item(sel.volontari.includes(v.id))}>
            <span>{sel.volontari.includes(v.id) ? "✅" : "⬜"}</span>
            <span style={{ flex: 1 }}>{RARITY[v.rarity] ?? ""} {v.name} <span style={{ color: "#666" }}>· {ROLE[v.role] ?? v.role}</span></span>
            {v.state === "in_servizio" && <span style={{ fontSize: 11, color: "#B45309" }}>in servizio</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function OfferEditor({ buyerId, sellerId, buyerName, sellerName, viewerIsBuyer, initialPrice, initialTake, initialGive,
  submitLabel, myFunds, onSubmit, onCancel }: {
  buyerId: string; sellerId: string; buyerName: string; sellerName: string; viewerIsBuyer: boolean;
  initialPrice: number; initialTake?: OfferItems; initialGive?: OfferItems; submitLabel: string; myFunds?: number;
  onSubmit: (price: number, take: OfferItems, give: OfferItems) => Promise<string | null>; onCancel?: () => void;
}) {
  const [sellerAssets, setSellerAssets] = useState<Assets | null>(null);
  const [buyerAssets, setBuyerAssets] = useState<Assets | null>(null);
  const [take, setTake] = useState<OfferItems>(initialTake ?? emptyItems());
  const [give, setGive] = useState<OfferItems>(initialGive ?? emptyItems());
  const [price, setPrice] = useState(String(initialPrice));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("trade_assets", { p_org: sellerId }).then(({ data }) => setSellerAssets((data as Assets) ?? null));
    supabase.rpc("trade_assets", { p_org: buyerId }).then(({ data }) => setBuyerAssets((data as Assets) ?? null));
  }, [buyerId, sellerId]);

  const empty = useMemo(() => Number(price) <= 0 && [take, give].every((x) => !x.sedi.length && !x.mezzi.length && !x.volontari.length), [price, take, give]);
  // titoli dal punto di vista di chi sta guardando
  const takeTitle = viewerIsBuyer ? `📥 Prendi da ${sellerName}` : `📤 Dai a ${buyerName}`;
  const giveTitle = viewerIsBuyer ? `📤 Dai a ${sellerName}` : `📥 Ricevi da ${buyerName}`;

  async function send() {
    setBusy(true); setErr(null);
    const e = await onSubmit(Math.max(0, Math.round(Number(price) || 0)), take, give);
    setBusy(false);
    if (e) setErr(e);
  }

  return (
    <div style={{ background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 14, padding: 12, marginTop: 8 }}>
      <div style={{ fontSize: 13, color: "#555", marginBottom: 10 }}>
        Scegli cosa passa di mano: quello che non scegli resta a chi lo ha. Una sede passa con i mezzi parcheggiati lì;
        la sede principale non si può scambiare. Se un mezzo o un volontario è in servizio, il servizio si chiude senza premio.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Picker title={takeTitle} assets={sellerAssets} sel={take} setSel={setTake} />
        <Picker title={giveTitle} assets={buyerAssets} sel={give} setSel={setGive} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 4 }}>
        <span style={{ fontWeight: 700 }}>💶 {viewerIsBuyer ? "Soldi che dai:" : "Soldi che chiedi:"}</span>
        <input type="number" min={0} step={1000} value={price} onChange={(e) => setPrice(e.target.value)}
               style={{ flex: "1 1 140px", padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }} />
        {myFunds != null && <span style={{ fontSize: 12, color: "#666" }}>hai {euro(myFunds)}</span>}
      </div>
      {err && <div style={{ color: "#B91C1C", fontWeight: 700, marginTop: 8 }}>{err}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        <button disabled={busy || empty} onClick={send} style={{ ...btn, background: "#1E3A8A", color: "#fff", opacity: empty ? 0.5 : 1 }}>{submitLabel}</button>
        {onCancel && <button disabled={busy} onClick={onCancel} style={{ ...btn, flex: "0 0 auto", background: "#e5e7eb", color: "#111" }}>Indietro</button>}
      </div>
    </div>
  );
}

// messaggi di errore delle offerte
export function offerError(m: string) {
  if (m.includes("EMPTY_OFFER")) return "L'offerta è vuota: scegli qualcosa o metti dei soldi.";
  if (m.includes("HQ_NOT_TRADABLE")) return "La sede principale non si può scambiare.";
  if (m.includes("BASE_AT_AUCTION")) return "Una delle sedi è all'asta.";
  if (m.includes("VEHICLE_AT_AUCTION")) return "Uno dei mezzi è all'asta.";
  if (m.includes("BASE_NOT_AVAILABLE")) return "Una delle sedi non è più disponibile.";
  if (m.includes("VEHICLE_NOT_AVAILABLE")) return "Uno dei mezzi non è più disponibile (o è in prestito).";
  if (m.includes("VOLUNTEER_NOT_AVAILABLE")) return "Uno dei volontari non è più disponibile (o è in prestito).";
  if (m.includes("INSUFFICIENT_FUNDS")) return "Non hai abbastanza soldi per questa cifra.";
  if (m.includes("BUYER_NO_FUNDS")) return "Il compratore non ha più abbastanza soldi.";
  if (m.includes("OFFER_EXISTS")) return "Hai già un'offerta aperta per questa associazione.";
  if (m.includes("TOO_MANY_ROUNDS")) return "Avete già trattato troppe volte: ora accetta o rifiuta.";
  if (m.includes("NOT_YOUR_TURN")) return "Non tocca a te rispondere.";
  if (m.includes("NOT_FOUND")) return "L'offerta non è più valida.";
  if (m.includes("BAD_PRICE")) return "Cifra non valida.";
  return m;
}
