"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase, type Organization } from "@/lib/supabase";
import FactionEmblem from "@/components/FactionEmblem";
import { roleLabel, type Card } from "@/components/VolunteerCard";

type Org = Pick<Organization, "id" | "name" | "type" | "logo_url">;
type Alliance = { id: string; name: string; founder_org: string };
type Member = { org_id: string; alliance_id: string };
type Invite = { id: string; alliance_id: string; org_id: string };
type Offer = { id: string; buyer_org: string; seller_org: string; price: number; status: string; created_at: string };
type Loan = { id: string; from_org: string; to_org: string; ends_at: string; returned_at: string | null; vehicle_id?: string; card_id?: string };
type Fleet = { id: string; call_sign: string; status: string; mine: boolean; lent_to: string | null; lent_from: string | null };

const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 820, margin: "0 auto", padding: 16 };
const box: CSSProperties = { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)", marginBottom: 14 };
const btn: CSSProperties = { padding: "8px 12px", borderRadius: 10, border: "none", background: "#111", color: "#fff",
  fontWeight: 600, cursor: "pointer", fontSize: 14 };
const inp: CSSProperties = { padding: 9, borderRadius: 10, border: "1px solid #ccc", fontSize: 15, boxSizing: "border-box" };
const row: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #f0f0f0", flexWrap: "wrap" };
const h2: CSSProperties = { fontSize: 17, fontWeight: 800, margin: "0 0 10px" };
const euro = (n: number) => n.toLocaleString("it-IT") + " €";

const ERR: Record<string, string> = {
  ALREADY_IN_ALLIANCE: "È già in un'alleanza.", NO_ALLIANCE: "Prima crea o entra in un'alleanza.",
  NOT_ALLY: "Puoi prestare solo ai tuoi alleati.", VEHICLE_BUSY: "Il mezzo è impegnato in un servizio.",
  CARD_BUSY: "Il volontario è in servizio o ha il contratto scaduto.", ALREADY_LENT: "È già in prestito.",
  INSUFFICIENT_FUNDS: "Non hai abbastanza fondi.", OFFER_EXISTS: "Hai già un'offerta in attesa per questa associazione.",
  SELLER_BUSY: "Non puoi vendere con servizi in corso: aspetta che rientrino tutti.",
  BUYER_NO_FUNDS: "Il compratore non ha più i fondi per pagare.", NOTHING_TO_BUY: "Questa associazione non ha sedi da comprare.",
  duplicate: "Esiste già un'alleanza con questo nome.",
};
function errText(m: string) {
  const k = Object.keys(ERR).find((x) => m.includes(x));
  return k ? ERR[k] : m;
}

function OrgBadge({ o, size = 26 }: { o?: Org; size?: number }) {
  if (!o) return <span>—</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <FactionEmblem type={o.type} size={size} logo={o.logo_url} /><strong>{o.name}</strong>
    </span>
  );
}

export default function AlleanzaPage() {
  const router = useRouter();
  const [me, setMe] = useState<Organization | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [vLoans, setVLoans] = useState<Loan[]>([]);
  const [cLoans, setCLoans] = useState<Loan[]>([]);
  const [fleet, setFleet] = useState<Fleet[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [newName, setNewName] = useState("");
  const [inviteOrg, setInviteOrg] = useState("");
  const [lendTo, setLendTo] = useState("");
  const [hours, setHours] = useState(4);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); return; }
    const { data: o } = await supabase.from("organizations").select("id,name,type,funds,reputation,logo_url")
      .eq("owner_id", session.user.id).maybeSingle();
    if (!o) { router.replace("/onboarding"); return; }
    setMe(o as Organization);
    const nowIso = new Date().toISOString();
    const [og, al, mb, inv, of, vl, cl, fl, cd] = await Promise.all([
      supabase.from("organizations").select("id,name,type,logo_url").order("name"),
      supabase.from("alliances").select("id,name,founder_org"),
      supabase.from("alliance_members").select("org_id,alliance_id"),
      supabase.from("alliance_invites").select("id,alliance_id,org_id"),
      supabase.from("acquisition_offers").select("*").eq("status", "in_attesa").order("created_at", { ascending: false }),
      supabase.from("vehicle_loans").select("*").is("returned_at", null).gt("ends_at", nowIso),
      supabase.from("card_loans").select("*").is("returned_at", null).gt("ends_at", nowIso),
      supabase.from("my_fleet").select("id,call_sign,status,mine,lent_to,lent_from").order("call_sign"),
      supabase.from("my_cards").select("*").neq("state", "scaduta"),
    ]);
    const others = ((og.data as Org[]) ?? []).filter((x) => x.id !== o.id);
    setOrgs((og.data as Org[]) ?? []);
    setAlliances((al.data as Alliance[]) ?? []);
    setMembers((mb.data as Member[]) ?? []);
    setInvites((inv.data as Invite[]) ?? []);
    setOffers((of.data as Offer[]) ?? []);
    setVLoans((vl.data as Loan[]) ?? []);
    setCLoans((cl.data as Loan[]) ?? []);
    setFleet((fl.data as Fleet[]) ?? []);
    setCards((cd.data as Card[]) ?? []);
    const vals = await Promise.all(others.map((x) => supabase.rpc("org_valuation", { p_org: x.id })));
    setValues(Object.fromEntries(others.map((x, i) => [x.id, Number(vals[i].data ?? 0)])));
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function call(fn: string, args: Record<string, unknown>, ok: string) {
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setMsg({ ok: false, text: errText(error.message) }); return null; }
    setMsg({ ok: true, text: ok });
    await load();
    return data ?? true;
  }

  if (!me) return <main style={shell}><div style={wrap}>Caricamento…</div></main>;

  const orgById = (id: string) => orgs.find((x) => x.id === id);
  const myAlliance = members.find((m) => m.org_id === me.id)?.alliance_id ?? null;
  const alliance = alliances.find((a) => a.id === myAlliance);
  const allies = members.filter((m) => m.alliance_id === myAlliance && m.org_id !== me.id).map((m) => m.org_id);
  const free = orgs.filter((x) => x.id !== me.id && !members.some((m) => m.org_id === x.id));
  const myInvites = invites.filter((i) => i.org_id === me.id);
  const sentInvites = invites.filter((i) => i.alliance_id === myAlliance);
  const offersIn = offers.filter((o) => o.seller_org === me.id);
  const offersOut = offers.filter((o) => o.buyer_org === me.id);
  const myVehicles = fleet.filter((v) => v.mine);
  const myCards = cards.filter((c) => !c.lent_from);
  const lendTarget = lendTo || allies[0] || "";

  async function acceptOffer(o: Offer) {
    const buyer = orgById(o.buyer_org)?.name ?? "il compratore";
    if (!window.confirm(`Vendi a ${buyer} per ${euro(o.price)}?\n\nPasseranno a ${buyer}: tutte le sedi, tutte le ambulanze e metà dei volontari comuni (gli altri comuni se ne vanno).\nTi restano i fondi, i volontari epici e leggendari, e sceglierai una nuova sede.`)) return;
    const r = await call("answer_acquisition_offer", { p_id: o.id, p_accept: true }, "Vendita fatta!");
    if (r) router.replace("/nuova-sede");
  }

  return (
    <main style={shell}>
      <div style={{ background: "#15803D", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={() => router.push("/")} style={{ ...btn, background: "rgba(0,0,0,.25)" }}>← Mappa</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800 }}>🤝 Alleanza</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>{me.name} · {euro(me.funds)}</div>
          </div>
        </div>
      </div>

      <div style={wrap}>
        {msg && <div style={{ ...box, color: msg.ok ? "#15803D" : "#B91C1C", fontWeight: 600 }}>{msg.text}</div>}

        {/* Richieste per me */}
        {(myInvites.length > 0 || offersIn.length > 0) && (
          <div style={{ ...box, border: "2px solid #F59E0B" }}>
            <div style={h2}>📬 Richieste per te</div>
            {myInvites.map((i) => (
              <div key={i.id} style={row}>
                <span style={{ flex: 1 }}>Invito nell&apos;alleanza <strong>{alliances.find((a) => a.id === i.alliance_id)?.name}</strong></span>
                <button disabled={busy} style={{ ...btn, background: "#15803D" }}
                        onClick={() => call("answer_alliance_invite", { p_invite: i.id, p_accept: true }, "Sei entrato nell'alleanza.")}>Entra</button>
                <button disabled={busy} style={{ ...btn, background: "#eee", color: "#111" }}
                        onClick={() => call("answer_alliance_invite", { p_invite: i.id, p_accept: false }, "Invito rifiutato.")}>No</button>
              </div>
            ))}
            {offersIn.map((o) => (
              <div key={o.id} style={row}>
                <span style={{ flex: 1 }}><OrgBadge o={orgById(o.buyer_org)} /> vuole comprarti per <strong>{euro(o.price)}</strong></span>
                <button disabled={busy} style={{ ...btn, background: "#B91C1C" }} onClick={() => acceptOffer(o)}>Vendi</button>
                <button disabled={busy} style={{ ...btn, background: "#eee", color: "#111" }}
                        onClick={() => call("answer_acquisition_offer", { p_id: o.id, p_accept: false }, "Offerta rifiutata.")}>Rifiuta</button>
              </div>
            ))}
          </div>
        )}

        {/* La mia alleanza */}
        <div style={box}>
          <div style={h2}>La tua alleanza</div>
          {!alliance ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input style={{ ...inp, flex: 1, minWidth: 180 }} placeholder="Nome dell'alleanza" value={newName} maxLength={40}
                     onChange={(e) => setNewName(e.target.value)} />
              <button disabled={busy || newName.trim().length < 3} style={{ ...btn, background: "#15803D" }}
                      onClick={() => call("create_alliance", { p_name: newName }, "Alleanza creata!")}>Crea alleanza</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{alliance.name}</div>
              {members.filter((m) => m.alliance_id === alliance.id).map((m) => (
                <div key={m.org_id} style={row}>
                  <OrgBadge o={orgById(m.org_id)} />
                  {m.org_id === alliance.founder_org && <span style={{ fontSize: 12, color: "#888" }}>fondatore</span>}
                  {m.org_id === me.id && <span style={{ fontSize: 12, color: "#888" }}>(tu)</span>}
                </div>
              ))}
              {sentInvites.length > 0 && (
                <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
                  Invitati: {sentInvites.map((i) => orgById(i.org_id)?.name).join(", ")}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <select style={{ ...inp, flex: 1, minWidth: 180 }} value={inviteOrg} onChange={(e) => setInviteOrg(e.target.value)}>
                  <option value="">Invita un&apos;associazione…</option>
                  {free.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <button disabled={busy || !inviteOrg} style={{ ...btn, background: "#15803D" }}
                        onClick={() => call("invite_to_alliance", { p_org: inviteOrg }, "Invito mandato.").then(() => setInviteOrg(""))}>Invita</button>
                <button disabled={busy} style={{ ...btn, background: "#eee", color: "#B91C1C" }}
                        onClick={() => window.confirm("Uscire dall'alleanza? I prestiti finiscono subito.") && call("leave_alliance", {}, "Sei uscito dall'alleanza.")}>Esci</button>
              </div>
            </>
          )}
        </div>

        {/* Prestiti */}
        {alliance && (
          <div style={box}>
            <div style={h2}>Presta ai tuoi alleati</div>
            {allies.length === 0 ? (
              <div style={{ color: "#666" }}>Invita qualcuno nell&apos;alleanza per poter prestare mezzi e volontari.</div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
                  L&apos;ambulanza resta tua: parte dalla tua sede e si consuma, ma quando la usa l&apos;alleato
                  tu guadagni il <strong>10%</strong> del premio (5% per ogni volontario prestato).
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <select style={{ ...inp, flex: 1, minWidth: 160 }} value={lendTarget} onChange={(e) => setLendTo(e.target.value)}>
                    {allies.map((id) => <option key={id} value={id}>a {orgById(id)?.name}</option>)}
                  </select>
                  <select style={inp} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                    {[1, 4, 12, 24, 72].map((h) => <option key={h} value={h}>per {h} {h === 1 ? "ora" : "ore"}</option>)}
                  </select>
                </div>
                <div style={{ fontWeight: 700, marginTop: 8 }}>🚑 Ambulanze</div>
                {myVehicles.length === 0 && <div style={{ color: "#888", fontSize: 14 }}>Nessun mezzo.</div>}
                {myVehicles.map((v) => {
                  const loan = vLoans.find((l) => l.vehicle_id === v.id);
                  return (
                    <div key={v.id} style={row}>
                      <strong style={{ flex: 1 }}>{v.call_sign}</strong>
                      {loan ? (
                        <>
                          <span style={{ fontSize: 13, color: "#B45309" }}>a {orgById(loan.to_org)?.name} fino alle {new Date(loan.ends_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span>
                          <button disabled={busy} style={{ ...btn, background: "#eee", color: "#111" }}
                                  onClick={() => call("end_loan", { p_kind: "mezzo", p_id: loan.id }, "Ambulanza rientrata.")}>Riprendi</button>
                        </>
                      ) : (
                        <button disabled={busy || v.status !== "disponibile"} style={{ ...btn, background: "#15803D", opacity: v.status === "disponibile" ? 1 : 0.4 }}
                                onClick={() => call("lend_vehicle", { p_vehicle: v.id, p_to: lendTarget, p_hours: hours }, `${v.call_sign} prestata.`)}>
                          {v.status === "disponibile" ? "Presta" : "Impegnata"}
                        </button>
                      )}
                    </div>
                  );
                })}
                <div style={{ fontWeight: 700, marginTop: 12 }}>👥 Volontari</div>
                {myCards.map((c) => {
                  const loan = cLoans.find((l) => l.card_id === c.id);
                  const can = c.state !== "in_servizio";
                  return (
                    <div key={c.id} style={row}>
                      <span style={{ flex: 1 }}><strong>{c.first_name} {c.last_name}</strong> <span style={{ fontSize: 12, color: "#666" }}>· {roleLabel(c)}</span></span>
                      {loan ? (
                        <>
                          <span style={{ fontSize: 13, color: "#B45309" }}>a {orgById(loan.to_org)?.name}</span>
                          <button disabled={busy} style={{ ...btn, background: "#eee", color: "#111" }}
                                  onClick={() => call("end_loan", { p_kind: "volontario", p_id: loan.id }, "Volontario rientrato.")}>Riprendi</button>
                        </>
                      ) : (
                        <button disabled={busy || !can} style={{ ...btn, background: "#15803D", opacity: can ? 1 : 0.4 }}
                                onClick={() => call("lend_card", { p_card: c.id, p_to: lendTarget, p_hours: hours }, `${c.first_name} prestato.`)}>
                          {can ? "Presta" : "In servizio"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* Ricevuti in prestito */}
            {(fleet.some((v) => v.lent_from) || cards.some((c) => c.lent_from)) && (
              <>
                <div style={{ fontWeight: 700, marginTop: 14 }}>📥 Ricevuti in prestito</div>
                {fleet.filter((v) => v.lent_from).map((v) => {
                  const loan = vLoans.find((l) => l.vehicle_id === v.id);
                  return (
                    <div key={v.id} style={row}>
                      <span style={{ flex: 1 }}>🚑 <strong>{v.call_sign}</strong> da {v.lent_from}</span>
                      {loan && <button disabled={busy} style={{ ...btn, background: "#eee", color: "#111" }}
                                       onClick={() => call("end_loan", { p_kind: "mezzo", p_id: loan.id }, "Restituita.")}>Restituisci</button>}
                    </div>
                  );
                })}
                {cards.filter((c) => c.lent_from).map((c) => {
                  const loan = cLoans.find((l) => l.card_id === c.id);
                  return (
                    <div key={c.id} style={row}>
                      <span style={{ flex: 1 }}>👤 <strong>{c.first_name} {c.last_name}</strong> da {c.lent_from}</span>
                      {loan && <button disabled={busy} style={{ ...btn, background: "#eee", color: "#111" }}
                                       onClick={() => call("end_loan", { p_kind: "volontario", p_id: loan.id }, "Restituito.")}>Restituisci</button>}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Acquisto */}
        <div style={box}>
          <div style={h2}>💼 Compra un&apos;associazione</div>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
            Fai un&apos;offerta: se accetta, i soldi vanno a lei e tu prendi <strong>tutte le sedi e le ambulanze</strong> e
            <strong> metà dei volontari comuni</strong>. Epici e leggendari restano a lei, che riparte da zero.
          </div>
          {offersOut.map((o) => (
            <div key={o.id} style={{ ...row, background: "#FFFBEB" }}>
              <span style={{ flex: 1 }}>Offerta a <strong>{orgById(o.seller_org)?.name}</strong>: {euro(o.price)} · in attesa</span>
              <button disabled={busy} style={{ ...btn, background: "#eee", color: "#111" }}
                      onClick={() => call("cancel_acquisition_offer", { p_id: o.id }, "Offerta ritirata.")}>Ritira</button>
            </div>
          ))}
          {orgs.filter((x) => x.id !== me.id).map((x) => {
            const val = values[x.id] ?? 0;
            const price = prices[x.id] ?? String(Math.max(1000, Math.round(val / 1000) * 1000));
            const pending = offersOut.some((o) => o.seller_org === x.id);
            return (
              <div key={x.id} style={row}>
                <span style={{ flex: 1, minWidth: 180 }}>
                  <OrgBadge o={x} /><br />
                  <span style={{ fontSize: 12, color: "#666" }}>valore stimato {euro(val)}</span>
                </span>
                <input style={{ ...inp, width: 120 }} type="number" min={1000} step={1000} value={price}
                       onChange={(e) => setPrices((p) => ({ ...p, [x.id]: e.target.value }))} />
                <button disabled={busy || pending || Number(price) < 1000} style={{ ...btn, background: "#1E3A8A", opacity: pending ? 0.4 : 1 }}
                        onClick={() => call("make_acquisition_offer", { p_seller: x.id, p_price: Number(price) }, `Offerta mandata a ${x.name}.`)}>
                  {pending ? "Offerta fatta" : "Fai offerta"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
