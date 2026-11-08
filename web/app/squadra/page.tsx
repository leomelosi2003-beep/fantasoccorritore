"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { gameConfirm } from "@/lib/confirm";
import { useRouter } from "next/navigation";
import { supabase, friendlyError, type Organization } from "@/lib/supabase";
import FactionEmblem from "@/components/FactionEmblem";
import VolunteerCard, { ROLE, RARITY, RoleBadge, cardLevel, type Card } from "@/components/VolunteerCard";
import { avatarSvg } from "@/components/avatar";

const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: 16 };
const btn: CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "none", background: "#111", color: "#fff",
  fontWeight: 600, cursor: "pointer", fontSize: 15 };

const PACKS = [
  { kind: "comune", price: 4500, icon: "📦", leg: "2%", epi: "13%", note: "",
    bg: "linear-gradient(135deg,#4B5563,#1F2937)", glow: "0 2px 8px rgba(0,0,0,.15)" },
  { kind: "epico", price: 17000, icon: "💜", leg: "8%", epi: "42%", note: "almeno 1 epica garantita",
    bg: "linear-gradient(135deg,#7C3AED,#4C1D95)", glow: "0 0 16px rgba(139,92,246,.5)" },
  { kind: "leggendario", price: 52000, icon: "👑", leg: "25%", epi: "50%", note: "almeno 1 leggendaria garantita",
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
  const [classTarget, setClassTarget] = useState<"autista" | "soccorritore_avanzato" | null>(null);
  const [classSel, setClassSel] = useState<string[]>([]);
  const [shop, setShop] = useState<(Card & { shop_price: number; owned: boolean })[]>([]);
  const [error, setError] = useState<string | null>(null);
  // pagina a schede: niente più scorrimento infinito
  const [tab, setTab] = useState<"squadra" | "pacchetti" | "negozio" | "corsi">("squadra");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [view, setView] = useState<"lista" | "carte">("lista");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    try { const t = localStorage.getItem("fs_squadra_tab"); if (t === "pacchetti" || t === "negozio" || t === "corsi") setTab(t);
          if (localStorage.getItem("fs_squadra_view") === "carte") setView("carte"); } catch {}
  }, []);
  const goTab = (t: typeof tab) => { setTab(t); try { localStorage.setItem("fs_squadra_tab", t); } catch {} };
  const goView = (v: typeof view) => { setView(v); try { localStorage.setItem("fs_squadra_view", v); } catch {} };
  // prezzi veri dal database (pack_catalog) e quanti volontari restano da trovare per ruolo
  const [catalog, setCatalog] = useState<{ kind: string; price: number; role?: string }[]>([]);
  const [roleAvail, setRoleAvail] = useState<Record<string, number>>({});
  const priceOf = (kind: string, fallback: number) => catalog.find((c) => c.kind === kind)?.price ?? fallback;

  const load = useCallback(async () => {
    supabase.rpc("pack_catalog").then(({ data }) => setCatalog((data as { kind: string; price: number; role?: string }[]) ?? []));
    supabase.rpc("pack_role_availability").then(({ data }) => setRoleAvail((data as Record<string, number>) ?? {}));
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
    supabase.from("shop_cards").select("*").order("shop_price", { ascending: false }).then(({ data }) =>
      setShop(((data as (Omit<Card, "volunteer_id"> & { id: string; shop_price: number; owned: boolean })[]) ?? []).map((v) => ({
        ...v, volunteer_id: v.id, state: "attiva", rest_until: null, expires_at: null, services_completed: 0, energy: 100,
      }) as Card & { shop_price: number; owned: boolean })));
    setPack(p.data as { opened: boolean; next_pack_at: string });
  }, [router]);

  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);

  // Corso di formazione di gruppo: 8.000 € per una classe fino a 10 soccorritori base
  async function startClass() {
    if (!classTarget || classSel.length === 0) return;
    const label = classTarget === "autista" ? "autisti" : "soccorritori avanzati";
    if (!(await gameConfirm(`Avviare il corso per ${label} con ${classSel.length} ${classSel.length === 1 ? "persona" : "persone"}?\n\nCosto 8.000 € per tutta la classe. Dura 1 ora.`))) return;
    setBusy(true); setError(null);
    const { error } = await supabase.rpc("training_class", { p_cards: classSel, p_target: classTarget });
    setBusy(false);
    if (error) {
      const m = error.message;
      setError(m.includes("INSUFFICIENT_FUNDS") ? "Servono 8.000 € per il corso."
        : m.includes("TOO_MANY") ? "Al massimo 10 persone per corso."
        : m.includes("NOT_UPGRADABLE") ? "Qualcuno non può fare il corso (in servizio, in prestito o non è un soccorritore base)."
        : friendlyError(m));
      return;
    }
    setClassSel([]); setClassTarget(null);
    await load();
  }

  // Pacchetti a pagamento
  async function buyPack(kind: string, price: number, label?: string) {
    if (!(await gameConfirm(`Comprare il pacchetto ${label ?? kind} per ${price.toLocaleString("it-IT")} €?`))) return;
    setBusy(true); setError(null);
    const { data, error } = await supabase.rpc("buy_pack", { p_kind: kind });
    if (error) {
      setBusy(false);
      const m = error.message;
      setError(m.includes("INSUFFICIENT_FUNDS") ? "Non hai abbastanza fondi."
        : m.includes("NO_LEGENDARY_LEFT") ? "Non ci sono carte leggendarie da trovare (le hai già tutte o non ne esistono ancora): non hai pagato niente."
        : m.includes("NO_EPIC_LEFT") ? "Non ci sono carte epiche da trovare (le hai già tutte o non ne esistono ancora): non hai pagato niente."
        : m.includes("NO_ROLE_LEFT") ? "Hai già tutti i volontari di questo ruolo: non hai pagato niente."
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

  // Negozio carte: carte create dall'admin con un prezzo
  async function buyCard(c: Card & { shop_price: number }) {
    if (!(await gameConfirm(`Comprare ${c.first_name} ${c.last_name} per ${c.shop_price.toLocaleString("it-IT")} €?`))) return;
    setBusy(true); setError(null);
    const { error } = await supabase.rpc("buy_card", { p_volunteer: c.volunteer_id });
    setBusy(false);
    if (error) {
      const m = error.message;
      setError(m.includes("INSUFFICIENT_FUNDS") ? "Non hai abbastanza fondi."
        : m.includes("ALREADY_OWNED") ? "Ce l'hai già nella squadra."
        : m.includes("NOT_FOR_SALE") ? "Questa carta non è più in vendita." : friendlyError(m));
      return;
    }
    await load();
  }

  // Ricarica l'energia (servizi fatti / riposo) pagando poco: 100 € per servizio fatto, 1.500 € se è a riposo
  async function refill(list: Card[]) {
    const ids = list.filter((c) => (c.refill_cost ?? 0) > 0).map((c) => c.id);
    const cost = list.reduce((t, c) => t + (c.refill_cost ?? 0), 0);
    if (!ids.length) return;
    if (!(await gameConfirm(`Ricaricare l'energia di ${ids.length} ${ids.length === 1 ? "volontario" : "volontari"} per ${cost.toLocaleString("it-IT")} €?`))) return;
    setBusy(true); setError(null);
    const { error } = await supabase.rpc("refill_energy", { p_cards: ids });
    setBusy(false);
    if (error) { setError(error.message.includes("INSUFFICIENT_FUNDS") ? "Non hai abbastanza fondi." : friendlyError(error.message)); return; }
    await load();
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
  const ROLE_KEYS = ["autista", "soccorritore_base", "soccorritore_avanzato", "infermiere", "medico", "bagnino", "aib"] as const;
  const counts = ROLE_KEYS.map((k) => ({ key: k, ...ROLE[k], n: active.filter((c) => c.role === k).length })).filter((c) => c.n > 0);
  const shown = active.filter((c) => !roleFilter || (roleFilter === "stanchi" ? (c.refill_cost ?? 0) > 0 : c.role === roleFilter));
  const packReady = !!pack && !pack.opened;
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

      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#f4f4f1", borderBottom: "1px solid #e5e5e0" }}>
        <div style={{ ...wrap, paddingTop: 8, paddingBottom: 8, display: "flex", gap: 6, overflowX: "auto" }}>
          {([["squadra", "👥 Squadra", active.length], ["pacchetti", "📦 Pacchetti", packReady ? "!" : null],
             ["negozio", "🛒 Negozio", shop.filter((c) => !c.owned).length || null], ["corsi", "📚 Corsi", null]] as const).map(([k, l, n]) => (
            <button key={k} onClick={() => goTab(k)}
                    style={{ padding: "9px 14px", borderRadius: 999, border: "none", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 700, fontSize: 14,
                             background: tab === k ? "#111" : "#fff", color: tab === k ? "#fff" : "#111", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
              {l}{n != null && <span style={{ marginLeft: 6, fontSize: 12, padding: "1px 7px", borderRadius: 999,
                background: n === "!" ? "#F97316" : tab === k ? "rgba(255,255,255,.2)" : "#eee", color: n === "!" ? "#fff" : "inherit" }}>{n}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={wrap}>
        {tab === "pacchetti" && (<>
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
                <button onClick={() => buyPack(p.kind, priceOf(p.kind, p.price))} disabled={busy || none}
                        style={{ ...btn, background: "#fff", color: "#111", marginTop: "auto", opacity: busy || none ? 0.5 : 1 }}>
                  {none ? "Nessuna carta da trovare" : `Compra · ${priceOf(p.kind, p.price).toLocaleString("it-IT")} €`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Pacchetti specialisti: 5 volontari tutti dello stesso ruolo */}
        {catalog.some((c) => c.role) && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 18, margin: "4px 0 2px" }}>🎯 Pacchetti specialisti</div>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
              5 volontari tutti del ruolo che scegli. Costano di più, ma non sprechi carte. Leggendaria 3%, epica 17%.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              {catalog.filter((c) => c.role).map((c) => {
                const r = ROLE[c.role as Card["role"]];
                const left = roleAvail[c.role!] ?? 0;
                const none = left === 0;
                return (
                  <div key={c.kind} style={{ background: "#fff", border: `2px solid ${r.color}`, borderRadius: 14, padding: 12,
                                             display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 26, background: r.bg, borderRadius: 10, width: 40, height: 40, display: "flex",
                                     alignItems: "center", justifyContent: "center" }}>{r.icon}</span>
                      <div>
                        <div style={{ fontWeight: 800, color: r.color }}>{r.label}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>{none ? "li hai già tutti" : `${left} da trovare`}</div>
                      </div>
                    </div>
                    <button onClick={() => buyPack(c.kind, c.price, `specialisti ${r.label.toLowerCase()}`)} disabled={busy || none}
                            style={{ ...btn, background: r.color, marginTop: "auto", fontSize: 14, opacity: busy || none ? 0.5 : 1 }}>
                      {none ? "Esaurito" : `Compra · ${c.price.toLocaleString("it-IT")} €`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        </>)}

        {/* Negozio carte */}
        {tab === "negozio" && shop.length === 0 && <div style={{ color: "#777", padding: 12 }}>Nessuna carta in vendita al momento.</div>}
        {tab === "negozio" && shop.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 18, margin: "4px 0 8px" }}>🛒 Negozio carte</div>
            <div style={grid}>
              {shop.map((c) => (
                <div key={c.volunteer_id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <VolunteerCard c={c} compact />
                  <button onClick={() => buyCard(c)} disabled={busy || c.owned}
                          style={{ ...btn, background: c.owned ? "#9CA3AF" : "#B45309", opacity: busy ? 0.6 : 1 }}>
                    {c.owned ? "✅ Già in squadra" : `Compra · ${c.shop_price.toLocaleString("it-IT")} €`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div style={{ background: "#fff1f1", color: "#a00", borderRadius: 10, padding: 12, marginBottom: 12 }}>{error}</div>}

        {/* Corso di formazione */}
        {tab === "corsi" && (() => {
          const students = active.filter((c) => c.role === "soccorritore_base" && !c.lent_from && !c.lent_to && c.state !== "in_servizio");
          return (
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)",
                          border: "2px solid #DDD6FE" }}>
              <div style={{ fontWeight: 800, fontSize: 17 }}>📚 Corso di formazione · 8.000 €</div>
              <div style={{ fontSize: 13, color: "#555", margin: "2px 0 10px" }}>
                Un corso vale per tutta la classe: fino a 10 soccorritori base insieme. Dura 1 ora.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {([["autista", "🚑 Corso autisti"], ["soccorritore_avanzato", "💉 Corso soccorritori avanzati"]] as const).map(([t, l]) => (
                  <button key={t} onClick={() => { setClassTarget(classTarget === t ? null : t); }}
                          style={{ ...btn, fontSize: 14, background: classTarget === t ? "#7C3AED" : "#EDE9FE", color: classTarget === t ? "#fff" : "#5B21B6" }}>{l}</button>
                ))}
              </div>
              {classTarget && (
                <div style={{ marginTop: 10 }}>
                  {students.length === 0 && <div style={{ fontSize: 14, color: "#888" }}>Nessun soccorritore base disponibile per il corso.</div>}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {students.map((c) => {
                      const on = classSel.includes(c.id);
                      return (
                        <button key={c.id} onClick={() => setClassSel((cur) => on ? cur.filter((x) => x !== c.id) : cur.length >= 10 ? cur : [...cur, c.id])}
                                style={{ border: on ? "2px solid #7C3AED" : "1px solid #ddd", background: on ? "#F5F3FF" : "#fff",
                                         borderRadius: 999, padding: "6px 10px", cursor: "pointer", fontSize: 13 }}>
                          {on ? "✅" : "⬜"} {c.first_name} {c.last_name}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={startClass} disabled={busy || classSel.length === 0}
                          style={{ ...btn, marginTop: 10, background: "#7C3AED", opacity: busy || classSel.length === 0 ? 0.5 : 1 }}>
                    Avvia corso ({classSel.length}/10) · 8.000 €
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Ricarica energia di tutti */}
        {tab === "squadra" && (() => {
          const tired = active.filter((c) => (c.refill_cost ?? 0) > 0 && !c.lent_from && !c.lent_to);
          const cost = tired.reduce((t, c) => t + (c.refill_cost ?? 0), 0);
          return tired.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#fff", borderRadius: 14,
                          padding: 12, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <span style={{ fontSize: 26 }}>⚡</span>
              <div style={{ flex: "1 1 200px", fontSize: 14 }}>
                <strong>{tired.length} {tired.length === 1 ? "volontario stanco" : "volontari stanchi"}</strong><br />
                <span style={{ color: "#666" }}>100 € per ogni servizio fatto, 1.500 € per chi è a riposo</span>
              </div>
              <button disabled={busy} onClick={() => refill(tired)} style={{ ...btn, background: "#16A34A" }}>
                ⚡ Ricarica tutti · {cost.toLocaleString("it-IT")} €
              </button>
            </div>
          );
        })()}

        {/* Squadra: filtri per ruolo + elenco compatto (tocca per aprire la carta) */}
        {tab === "squadra" && (<>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
          {[{ key: null as string | null, icon: "👥", label: "Tutti", n: active.length },
            ...counts.map((c) => ({ key: c.key as string | null, icon: c.icon, label: c.label, n: c.n })),
            ...(active.some((c) => (c.refill_cost ?? 0) > 0) ? [{ key: "stanchi" as string | null, icon: "😴", label: "Stanchi", n: active.filter((c) => (c.refill_cost ?? 0) > 0).length }] : []),
          ].map((c) => (
            <button key={c.label} onClick={() => setRoleFilter(roleFilter === c.key ? null : c.key)}
                    style={{ border: "none", borderRadius: 999, padding: "7px 11px", fontSize: 13, cursor: "pointer", fontWeight: 600,
                             background: roleFilter === c.key ? "#111" : "#fff", color: roleFilter === c.key ? "#fff" : "#111",
                             boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
              {c.icon} {c.label} <strong>{c.n}</strong>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={() => goView(view === "lista" ? "carte" : "lista")}
                  style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontSize: 13 }}>
            {view === "lista" ? "🃏 Mostra carte" : "☰ Mostra elenco"}
          </button>
        </div>

        {active.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, textAlign: "center", color: "#666" }}>
            Nessun volontario. Vai su «📦 Pacchetti» e apri il pacchetto settimanale per formare la tua prima squadra!
          </div>
        ) : view === "carte" ? (
          <div style={grid}>{shown.map((c) => (
            <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <VolunteerCard c={c} />
              {(c.refill_cost ?? 0) > 0 && !c.lent_from && !c.lent_to && (
                <button disabled={busy} onClick={() => refill([c])}
                        style={{ ...btn, background: "#16A34A", fontSize: 13, padding: "8px 10px" }}>
                  ⚡ Ricarica energia · {(c.refill_cost ?? 0).toLocaleString("it-IT")} €
                </button>
              )}
            </div>
          ))}</div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", overflow: "hidden" }}>
            {shown.map((c, i) => {
              const lv = cardLevel(c.services_completed ?? 0);
              const rest = c.state === "riposo" && c.rest_until && new Date(c.rest_until) > new Date();
              const st = c.state === "in_servizio" ? ["🚑", "In servizio", "#2563EB"] : rest ? ["😴", "Riposo", "#A16207"]
                : c.training_until && new Date(c.training_until) > new Date() ? ["📚", "Corso", "#7C3AED"] : ["●", "Pronto", "#16A34A"];
              const isOpen = open === c.id;
              return (
                <div key={c.id} style={{ borderTop: i ? "1px solid #f0f0f0" : "none" }}>
                  <button onClick={() => setOpen(isOpen ? null : c.id)}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "none",
                                   background: isOpen ? "#f6f6f4" : "transparent", cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit" }}>
                    <span style={{ lineHeight: 0, flexShrink: 0, borderRadius: 10, overflow: "hidden", border: `2px solid ${RARITY[c.rarity].border}` }}>
                      {c.avatar_url ? <img src={c.avatar_url} alt="" style={{ width: 40, height: 40, objectFit: "cover" }} />
                        : <span dangerouslySetInnerHTML={{ __html: avatarSvg(c.volunteer_id, c.gender, c.rarity, 40) }} />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.first_name} {c.last_name}{c.rarity !== "comune" && <span style={{ color: RARITY[c.rarity].text, fontSize: 11 }}> · {RARITY[c.rarity].label}</span>}
                      </span>
                      <span style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
                        <RoleBadge c={c} small />
                        <span style={{ fontSize: 11, color: "#666" }}>{lv.icon} Liv. {lv.level}</span>
                      </span>
                    </span>
                    <span style={{ width: 70, flexShrink: 0 }} title={`Energia ${Math.round(c.energy)}%`}>
                      <span style={{ display: "block", fontSize: 11, color: st[2] as string, fontWeight: 700, textAlign: "right" }}>{st[0]} {st[1]}</span>
                      <span style={{ display: "block", height: 6, background: "#eee", borderRadius: 4, marginTop: 4 }}>
                        <span style={{ display: "block", width: `${c.energy}%`, height: 6, borderRadius: 4,
                                       background: c.energy >= 60 ? "#16A34A" : c.energy >= 30 ? "#EAB308" : "#DC2626" }} />
                      </span>
                    </span>
                    <span style={{ color: "#999", fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: "4px 12px 12px", display: "grid", gap: 8, maxWidth: 360 }}>
                      <VolunteerCard c={c} />
                      {(c.refill_cost ?? 0) > 0 && !c.lent_from && !c.lent_to && (
                        <button disabled={busy} onClick={() => refill([c])}
                                style={{ ...btn, background: "#16A34A", fontSize: 13, padding: "8px 10px" }}>
                          ⚡ Ricarica energia · {(c.refill_cost ?? 0).toLocaleString("it-IT")} €
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {shown.length === 0 && <div style={{ padding: 16, color: "#888", textAlign: "center" }}>Nessun volontario con questo filtro.</div>}
          </div>
        )}
        </>)}

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
