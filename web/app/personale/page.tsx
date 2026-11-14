"use client";
// Richieste di personale: chi è a corto di volontari lo segnala a tutti; gli altri possono prestargli volontari per qualche ora.
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase, friendlyError, type Organization } from "@/lib/supabase";
import FactionEmblem from "@/components/FactionEmblem";
import { roleLabel, type Card } from "@/components/VolunteerCard";

type Req = { id: string; org_id: string; org_name: string; org_type: Organization["type"]; logo_url: string | null; roles: Record<string, number>;
  message: string | null; created_at: string; expires_at: string; mine: boolean; ally: boolean; helped: number; last_helper: string | null };
type MyCard = Card & { lent_to?: string | null; lent_from?: string | null };

const ROLES: [string, string][] = [
  ["autista", "🚗 Autisti"], ["soccorritore_base", "🩹 Soccorritori"], ["soccorritore_avanzato", "🚑 Soccorritori avanzati"],
  ["infermiere", "💉 Infermieri"], ["medico", "🩺 Medici"], ["aib", "🔥 AIB"], ["bagnino", "🛟 Bagnini"],
];
const roleName = (k: string) => ROLES.find(([r]) => r === k)?.[1] ?? k;
const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 820, margin: "0 auto", padding: 16 };
const box: CSSProperties = { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)", marginBottom: 12 };
const btn: CSSProperties = { padding: "8px 12px", borderRadius: 10, border: "none", background: "#111", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 };
const ERR: Record<string, string> = {
  NO_ROLES: "Scegli almeno un volontario che ti serve.", REQUEST_CLOSED: "La richiesta è già chiusa o scaduta.",
  CARD_BUSY: "Il volontario è in servizio.", ALREADY_LENT: "Il volontario è già prestato.", OWN_REQUEST: "È la tua richiesta.",
};
const errText = (m: string) => Object.entries(ERR).find(([k]) => m.includes(k))?.[1] ?? friendlyError(m);
const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 1 ? "adesso" : m < 60 ? `${m} min fa` : `${Math.floor(m / 60)} h fa`; };
const left = (iso: string) => { const m = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };

export default function Personale() {
  const router = useRouter();
  const [org, setOrg] = useState<Organization | null>(null);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [cards, setCards] = useState<MyCard[]>([]);
  const [want, setWant] = useState<Record<string, number>>({ autista: 1, soccorritore_base: 1 });
  const [text, setText] = useState("");
  const [hours, setHours] = useState(2);
  const [helpFor, setHelpFor] = useState<string | null>(null);
  const [lendHours, setLendHours] = useState(2);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); return; }
    const { data: o } = await supabase.from("organizations").select("id,name,type,funds,reputation,logo_url").eq("owner_id", session.user.id).maybeSingle();
    if (!o) { router.replace("/onboarding"); return; }
    setOrg(o as Organization);
    const [r, c] = await Promise.all([supabase.rpc("staff_requests_open"), supabase.from("my_cards").select("*").neq("state", "scaduta")]);
    setReqs((r.data as Req[]) ?? []);
    setCards(((c.data as MyCard[]) ?? []).filter((x) => !x.lent_from));
  }, [router]);
  useEffect(() => { load(); const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 30_000); return () => clearInterval(t); }, [load]);
  useEffect(() => { try { localStorage.setItem("fs_staff_seen", JSON.stringify(reqs.map((r) => r.id))); } catch {} }, [reqs]);

  async function call(fn: string, args: Record<string, unknown>, ok: string) {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setMsg({ ok: false, text: errText(error.message) }); return; }
    setMsg({ ok: true, text: ok }); load();
  }

  if (!org) return <main style={shell} />;
  const mine = reqs.find((r) => r.mine);
  const others = reqs.filter((r) => !r.mine);
  const free = cards.filter((c) => !c.lent_to && c.state !== "in_servizio");

  return (
    <main style={shell}>
      <div style={{ background: "#111", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={() => router.push("/")} style={{ ...btn, background: "#333" }}>← Mappa</button>
          <FactionEmblem type={org.type} size={32} logo={org.logo_url} />
          <div style={{ fontWeight: 800, flex: 1 }}>📢 Richieste di personale</div>
        </div>
      </div>
      <div style={wrap}>
        {msg && <div style={{ ...box, background: msg.ok ? "#effaf1" : "#fff1f1", color: msg.ok ? "#166534" : "#a00" }}>{msg.text}</div>}

        {/* la mia richiesta */}
        <div style={box}>
          <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Sei a corto di personale?</h2>
          {mine ? (
            <>
              <div style={{ marginBottom: 6 }}>La tua richiesta è visibile a tutti per altri <strong>{left(mine.expires_at)}</strong>.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {Object.entries(mine.roles).map(([k, n]) => <span key={k} style={{ background: "#FEF3C7", borderRadius: 999, padding: "3px 10px", fontWeight: 700 }}>{n} × {roleName(k)}</span>)}
              </div>
              {mine.message && <div style={{ color: "#555", marginBottom: 6 }}>«{mine.message}»</div>}
              <div style={{ marginBottom: 10, color: mine.helped ? "#166534" : "#666" }}>
                {mine.helped ? `🙌 Volontari ricevuti: ${mine.helped}${mine.last_helper ? ` (ultimo da ${mine.last_helper})` : ""}. Li trovi in Squadra e puoi usarli subito.` : "Nessuno ti ha ancora prestato volontari."}
              </div>
              <button disabled={busy} onClick={() => call("close_staff_request", {}, "Richiesta chiusa.")} style={{ ...btn, background: "#eee", color: "#111" }}>Chiudi la richiesta</button>
            </>
          ) : (
            <>
              <div style={{ color: "#555", fontSize: 14, marginBottom: 10 }}>
                Avvisa tutte le associazioni che ti mancano volontari per far partire le ambulanze: chi vuole te ne presta qualcuno per qualche ora.
              </div>
              <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                {ROLES.map(([k, label]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ flex: 1 }}>{label}</span>
                    <button onClick={() => setWant((w) => ({ ...w, [k]: Math.max(0, (w[k] ?? 0) - 1) }))} style={{ ...btn, background: "#eee", color: "#111", padding: "4px 12px" }}>−</button>
                    <strong style={{ minWidth: 22, textAlign: "center" }}>{want[k] ?? 0}</strong>
                    <button onClick={() => setWant((w) => ({ ...w, [k]: Math.min(10, (w[k] ?? 0) + 1) }))} style={{ ...btn, background: "#eee", color: "#111", padding: "4px 12px" }}>+</button>
                  </div>
                ))}
              </div>
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={140} placeholder="Messaggio (facoltativo), es. «Turno di notte scoperto a Livorno»"
                     style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 10, border: "1px solid #ccc", marginBottom: 8 }} />
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span>Visibile per</span>
                <select value={hours} onChange={(e) => setHours(Number(e.target.value))} style={{ padding: 8, borderRadius: 8 }}>
                  {[1, 2, 4, 8].map((h) => <option key={h} value={h}>{h} {h === 1 ? "ora" : "ore"}</option>)}
                </select>
                <button disabled={busy || !(Object.values(want) as number[]).some((n) => n > 0)}
                        onClick={() => call("request_staff", { p_roles: want, p_message: text, p_hours: hours }, "📢 Richiesta inviata a tutte le associazioni.")}
                        style={{ ...btn, background: "#DC2626", marginLeft: "auto" }}>📢 Chiedi aiuto a tutti</button>
              </div>
            </>
          )}
        </div>

        {/* richieste degli altri */}
        <h2 style={{ fontSize: 18, margin: "16px 0 8px" }}>Chi ha bisogno di personale</h2>
        {others.length === 0 && <div style={{ ...box, color: "#666" }}>Al momento nessuna associazione ha chiesto personale.</div>}
        {others.map((r) => {
          const needed = Object.keys(r.roles);
          const list = [...free].sort((a, b) => Number(needed.includes(b.role)) - Number(needed.includes(a.role)));
          return (
            <div key={r.id} style={box}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <FactionEmblem type={r.org_type} size={36} logo={r.logo_url} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>{r.org_name}{r.ally && <span style={{ fontSize: 12, color: "#15803D" }}> · alleato</span>}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{ago(r.created_at)} · scade tra {left(r.expires_at)}{r.helped ? ` · già aiutata ${r.helped} ${r.helped === 1 ? "volta" : "volte"}` : ""}</div>
                </div>
                <button onClick={() => setHelpFor(helpFor === r.id ? null : r.id)} style={{ ...btn, background: "#15803D" }}>🙌 Aiuta</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {Object.entries(r.roles).map(([k, n]) => <span key={k} style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 999, padding: "3px 10px", fontWeight: 700, fontSize: 13 }}>servono {n} × {roleName(k)}</span>)}
              </div>
              {r.message && <div style={{ color: "#555", marginTop: 6 }}>«{r.message}»</div>}
              {helpFor === r.id && (
                <div style={{ marginTop: 10, borderTop: "1px solid #eee", paddingTop: 10 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap", fontSize: 14 }}>
                    Presta per
                    <select value={lendHours} onChange={(e) => setLendHours(Number(e.target.value))} style={{ padding: 6, borderRadius: 8 }}>
                      {[1, 2, 4, 8].map((h) => <option key={h} value={h}>{h} {h === 1 ? "ora" : "ore"}</option>)}
                    </select>
                    <span style={{ color: "#666" }}>Poi il volontario torna da te. Puoi riprenderlo prima dalla pagina Alleanza.</span>
                  </div>
                  {list.length === 0 && <div style={{ color: "#666" }}>Non hai volontari liberi in questo momento.</div>}
                  <div style={{ display: "grid", gap: 6 }}>
                    {list.slice(0, 30).map((c) => (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, background: needed.includes(c.role) ? "#F0FDF4" : "#fafafa", borderRadius: 8, padding: "6px 8px" }}>
                        <span style={{ flex: 1 }}><strong>{c.first_name} {c.last_name}</strong> <span style={{ fontSize: 12, color: "#666" }}>· {roleLabel(c)}{needed.includes(c.role) ? " · ✅ serve" : ""}</span></span>
                        <button disabled={busy} onClick={() => call("help_staff_request", { p_request: r.id, p_card: c.id, p_hours: lendHours }, `🙌 ${c.first_name} prestato a ${r.org_name} per ${lendHours} ${lendHours === 1 ? "ora" : "ore"}.`)}
                                style={{ ...btn, background: "#15803D", padding: "6px 10px", fontSize: 13 }}>Presta</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
