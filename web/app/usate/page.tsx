"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase, livery } from "@/lib/supabase";

type Auction = {
  id: string; call_sign: string; model_name: string | null; image_url: string | null; seller: string; seller_type: string; mine: boolean;
  start_price: number; market_value: number; ends_at: string; status: "aperta" | "venduta" | "al_mercato" | "annullata";
  top_bid: number | null; top_bidder: string | null; bids: number; my_bid: number | null;
  wear: number | null; speed_level: number | null; equipment: string[] | null; builder: string | null; electric: boolean | null;
  final_price: number | null; winner: string | null;
};

const euro = (n: number) => n.toLocaleString("it-IT") + " €";
const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 820, margin: "0 auto", padding: 16 };
const card: CSSProperties = { background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", padding: 14 };
const btn: CSSProperties = { padding: "9px 12px", borderRadius: 10, border: "none", background: "#111", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 };

function left(t: string, now: number) {
  const s = Math.max(0, Math.floor((new Date(t).getTime() - now) / 1000));
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m}:${String(s % 60).padStart(2, "0")}`;
}
const minNext = (a: Auction) => (a.top_bid ? a.top_bid + Math.max(100, Math.round(a.top_bid * 0.02)) : a.start_price);

function bidError(m: string) {
  if (m.includes("BID_TOO_LOW")) return `Offerta troppo bassa: serve almeno ${Number(m.split("BID_TOO_LOW:")[1] ?? 0).toLocaleString("it-IT")} €.`;
  if (m.includes("INSUFFICIENT_FUNDS")) return "Non hai abbastanza soldi per questa offerta.";
  if (m.includes("AUCTION_CLOSED")) return "L'asta è già chiusa.";
  if (m.includes("OWN_AUCTION")) return "Non puoi fare offerte sulla tua ambulanza.";
  if (m.includes("HAS_BIDS")) return "Ci sono già offerte: l'asta non si può più ritirare.";
  return "Operazione non riuscita, riprova.";
}

export default function Usate() {
  const router = useRouter();
  const [list, setList] = useState<Auction[] | null>(null);
  const [offer, setOffer] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  async function load() {
    const { data } = await supabase.rpc("auctions_list");
    setList((data as Auction[]) ?? []);
  }
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      load();
    })();
    const r = setInterval(() => { if (document.visibilityState === "visible") load(); }, 10_000);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(r); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function bid(a: Auction) {
    const amount = parseInt((offer[a.id] ?? String(minNext(a))).replace(/[^0-9]/g, ""), 10);
    if (!amount) return;
    if (!window.confirm(`Offrire ${euro(amount)} per ${a.call_sign}? I soldi restano bloccati finché qualcuno non offre di più (allora ti tornano indietro).`)) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("place_bid", { p_auction: a.id, p_amount: amount });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: bidError(error.message) }); load(); return; }
    setMsg({ ok: true, text: `💶 Offerta di ${euro(amount)} per ${a.call_sign}: sei in testa!` });
    setOffer((o) => ({ ...o, [a.id]: "" }));
    load();
  }

  async function cancel(a: Auction) {
    if (!window.confirm(`Ritirare ${a.call_sign} dall'asta? Torna nel tuo garage.`)) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("cancel_auction", { p_auction: a.id });
    setBusy(false);
    setMsg(error ? { ok: false, text: bidError(error.message) } : { ok: true, text: `${a.call_sign} è tornata nel tuo garage.` });
    load();
  }

  const open = (list ?? []).filter((a) => a.status === "aperta");
  const closed = (list ?? []).filter((a) => a.status !== "aperta");

  return (
    <main style={shell}>
      <div style={{ background: "linear-gradient(135deg,#B45309,#78350F)", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={() => router.push("/")} style={{ ...btn, background: "rgba(0,0,0,.25)", fontWeight: 600 }}>← Mappa</button>
          <div style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>🏷️ Ambulanze usate</div>
          <button onClick={() => router.push("/garage")} style={{ ...btn, background: "rgba(0,0,0,.25)" }}>🚑 Garage</button>
        </div>
      </div>

      <div style={wrap}>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>
          Ambulanze messe all&apos;asta dalle altre associazioni. Fai un&apos;offerta: i soldi restano bloccati e, se qualcuno offre di più,
          ti tornano indietro. Allo scadere vince l&apos;offerta più alta e l&apos;ambulanza arriva nella tua sede con più posti liberi,
          con allestimento, presidi e potenziamenti. Se nessuno offre, la ritira il concessionario al 60% del valore di mercato.
          Per vendere una tua ambulanza: Garage → <strong>🏷️ Vendi all&apos;asta</strong>.
        </div>

        {msg && <div style={{ ...card, marginBottom: 12, fontWeight: 700, color: msg.ok ? "#15803D" : "#B91C1C" }}>{msg.text}</div>}
        {list === null && <div style={{ color: "#888", textAlign: "center", padding: 20 }}>Caricamento…</div>}
        {list !== null && open.length === 0 && <div style={{ ...card, color: "#666", textAlign: "center" }}>Nessuna ambulanza all&apos;asta in questo momento.</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {open.map((a) => {
            const lead = a.my_bid != null && a.top_bid === a.my_bid;
            const img = livery(a.image_url, a.seller_type);
            const urgent = new Date(a.ends_at).getTime() - now < 120_000;
            return (
              <div key={a.id} style={{ ...card, border: a.mine ? "2px solid #B45309" : lead ? "2px solid #15803D" : undefined }}>
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" style={{ width: "100%", height: 90, objectFit: "contain" }} />
                )}
                <div style={{ fontWeight: 800, fontSize: 16 }}>{a.call_sign}{a.electric && " ⚡"}</div>
                <div style={{ fontSize: 12, color: "#666" }}>{a.model_name}{a.builder && ` · ${a.builder}`} · di <strong>{a.mine ? "te" : a.seller}</strong></div>
                <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                  Usura {Math.round(Number(a.wear ?? 0))}% · velocità livello {a.speed_level ?? 0} · {a.equipment?.length ?? 0} presidi
                </div>
                <div style={{ fontSize: 12, color: "#555" }}>Valore di mercato: {euro(a.market_value)}</div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#666" }}>{a.top_bid ? `Offerta più alta (${a.bids} offerte)` : "Prezzo di partenza"}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#B45309" }}>{euro(a.top_bid ?? a.start_price)}</div>
                    {a.top_bidder && <div style={{ fontSize: 12, color: lead ? "#15803D" : "#666", fontWeight: lead ? 800 : 400 }}>{lead ? "✅ Sei in testa" : `di ${a.top_bidder}`}</div>}
                  </div>
                  <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 800, color: urgent ? "#DC2626" : "#111" }}>
                    ⏱ {left(a.ends_at, now)}
                  </div>
                </div>

                {a.mine ? (
                  a.bids === 0 && <button disabled={busy} onClick={() => cancel(a)} style={{ ...btn, width: "100%", marginTop: 10, background: "#6B7280" }}>Ritira dall&apos;asta</button>
                ) : (
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <input inputMode="numeric" placeholder={String(minNext(a))} value={offer[a.id] ?? ""}
                           onChange={(e) => setOffer((o) => ({ ...o, [a.id]: e.target.value }))}
                           style={{ flex: 1, minWidth: 0, padding: 9, borderRadius: 10, border: "1px solid #ccc", fontSize: 15 }} />
                    <button disabled={busy} onClick={() => bid(a)} style={{ ...btn, background: "#15803D", whiteSpace: "nowrap" }}>
                      Offri {(offer[a.id] ? "" : euro(minNext(a)))}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {closed.length > 0 && (
          <div style={{ ...card, marginTop: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Concluse nelle ultime 24 ore</div>
            {closed.map((a) => (
              <div key={a.id} style={{ fontSize: 13, padding: "6px 0", borderTop: "1px solid #f0f0f0" }}>
                <strong>{a.call_sign}</strong> ({a.model_name}) ·{" "}
                {a.status === "venduta" ? <>venduta a <strong>{a.winner}</strong> per {euro(a.final_price ?? 0)}</>
                  : a.status === "al_mercato" ? <>nessuna offerta: ritirata dal concessionario per {euro(a.final_price ?? 0)}</>
                  : "ritirata dal venditore"}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
