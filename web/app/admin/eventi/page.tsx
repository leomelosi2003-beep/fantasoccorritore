"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { supabase, friendlyError } from "@/lib/supabase";

const PickBaseMap = dynamic(() => import("@/components/PickBaseMap"), { ssr: false });

type Kind = "calcio" | "basket" | "teatro" | "concerto" | "altro";
type Venue = { id: string; name: string; lat: number; lng: number };
type Ev = {
  id: string; title: string; kind: Kind; venue_id: string; venue: string; starts_at: string; ends_at: string;
  show_at: string | null; slots: number; required_roles: Record<string, number>; reward_funds: number;
  time_confirmed: boolean; source_url: string | null;
};

const KIND: Record<Kind, { label: string; icon: string; pre: number; dur: number; slots: number; reward: number;
  roles: Record<string, number> }> = {
  calcio:   { label: "Partita di calcio", icon: "⚽", pre: 60, dur: 110, slots: 2, reward: 6000, roles: { autista: 1, soccorritore_base: 1, soccorritore_avanzato: 1 } },
  basket:   { label: "Partita di basket", icon: "🏀", pre: 45, dur: 120, slots: 1, reward: 3500, roles: { autista: 1, soccorritore_base: 1 } },
  concerto: { label: "Concerto", icon: "🎤", pre: 90, dur: 120, slots: 2, reward: 5000, roles: { autista: 1, soccorritore_base: 1, soccorritore_avanzato: 1 } },
  teatro:   { label: "Teatro / spettacolo", icon: "🎭", pre: 30, dur: 150, slots: 1, reward: 2500, roles: { autista: 1, soccorritore_base: 1 } },
  altro:    { label: "Altro evento", icon: "🎪", pre: 60, dur: 180, slots: 1, reward: 3000, roles: { autista: 1, soccorritore_base: 1 } },
};
const ROLES = [["autista", "Autisti"], ["soccorritore_base", "Soccorritori"], ["soccorritore_avanzato", "Soccorritori avanzati"], ["caposervizio", "Capiservizio"]] as const;

const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 1100, margin: "0 auto", padding: 16 };
const box: CSSProperties = { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)" };
const inp: CSSProperties = { width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #ccc", fontSize: 15, boxSizing: "border-box" };
const btn: CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "none", background: "#111", color: "#fff",
  fontWeight: 600, cursor: "pointer", fontSize: 15 };
const lbl: CSSProperties = { fontSize: 13, fontWeight: 600, margin: "10px 0 4px", display: "block" };

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function blank(kind: Kind = "calcio") {
  const k = KIND[kind];
  return { title: "", kind, venue_id: "", date: localDate(new Date()), time: "20:30", dur: k.dur, pre: k.pre,
    slots: k.slots, reward: k.reward, roles: { ...k.roles } as Record<string, number>, confirmed: true, source_url: "" };
}

export default function AdminEventi() {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [f, setF] = useState(blank());
  const [editing, setEditing] = useState<Ev | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [venueForm, setVenueForm] = useState<{ id: string | null; name: string; lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const [e, v] = await Promise.all([
      supabase.from("events_map").select("*").order("starts_at"),
      supabase.from("venues_map").select("*").order("name"),
    ]);
    setEvents((e.data as Ev[]) ?? []);
    setVenues((v.data as Venue[]) ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const { data } = await supabase.from("profiles").select("is_admin").eq("id", session.user.id).maybeSingle();
      setOk(!!data?.is_admin);
      if (data?.is_admin) load();
    })();
  }, [router, load]);

  function setKind(kind: Kind) {
    const k = KIND[kind];
    setF((x) => ({ ...x, kind, dur: k.dur, pre: k.pre, slots: k.slots, reward: k.reward, roles: { ...k.roles } }));
  }

  function startEdit(e: Ev) {
    const show = new Date(e.show_at ?? e.starts_at);
    const pre = Math.round((show.getTime() - new Date(e.starts_at).getTime()) / 60000);
    const dur = Math.round((new Date(e.ends_at).getTime() - show.getTime()) / 60000) - 15;
    setEditing(e); setMsg(null);
    setF({ title: e.title, kind: e.kind, venue_id: e.venue_id, date: localDate(show), time: localTime(show),
      dur: Math.max(30, dur), pre: Math.max(0, pre), slots: e.slots, reward: e.reward_funds,
      roles: { ...e.required_roles }, confirmed: e.time_confirmed, source_url: e.source_url ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    setBusy(true); setMsg(null);
    const show = new Date(`${f.date}T${f.time}`);
    const row = {
      title: f.title.trim(), kind: f.kind, venue_id: f.venue_id,
      show_at: show.toISOString(),
      starts_at: new Date(show.getTime() - f.pre * 60000).toISOString(),
      ends_at: new Date(show.getTime() + (f.dur + 15) * 60000).toISOString(),
      slots: f.slots, reward_funds: f.reward, time_confirmed: f.confirmed,
      required_roles: Object.fromEntries(Object.entries(f.roles).filter(([, n]) => n > 0)),
      requires: ["defib"], source_url: f.source_url.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("events").update(row).eq("id", editing.id)
      : await supabase.from("events").insert(row);
    setBusy(false);
    if (error) { setMsg({ ok: false, text: friendlyError(error.message) }); return; }
    setMsg({ ok: true, text: editing ? "Evento aggiornato." : "Evento inserito: comparirà sulla mappa 2 ore prima della postazione." });
    setEditing(null); setF(blank(f.kind)); load();
  }

  async function remove(e: Ev) {
    if (!confirm(`Eliminare "${e.title}"?`)) return;
    const { error } = await supabase.from("events").delete().eq("id", e.id);
    if (error) setMsg({ ok: false, text: friendlyError(error.message) });
    load();
  }

  async function saveVenue() {
    if (!venueForm) return;
    const { error } = await supabase.rpc("admin_upsert_venue",
      { p_id: venueForm.id, p_name: venueForm.name.trim(), p_lat: venueForm.lat, p_lng: venueForm.lng });
    if (error) { setMsg({ ok: false, text: friendlyError(error.message) }); return; }
    setVenueForm(null); load();
  }

  if (ok === null) return <main style={shell} />;
  if (!ok) return <main style={{ ...shell, padding: 40, textAlign: "center" }}>Pagina riservata all&apos;amministratore.</main>;

  const now = Date.now();
  const shown = events.filter((e) => showPast || new Date(e.ends_at).getTime() > now);
  const valid = f.title.trim() && f.venue_id && f.date && f.time && f.reward > 0 && (f.roles.autista ?? 0) > 0;

  return (
    <main style={shell}>
      <div style={{ background: "#111", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12, flexWrap: "wrap" }}>
          <button onClick={() => router.push("/")} style={{ ...btn, background: "#333", padding: "8px 12px" }}>← Mappa</button>
          <button onClick={() => router.push("/admin")} style={{ ...btn, background: "#333", padding: "8px 12px" }}>Carte</button>
          <div style={{ fontWeight: 700, fontSize: 18 }}>🛠️ Pannello admin · Grandi eventi</div>
        </div>
      </div>

      <div style={wrap}>
        {msg && <div style={{ ...box, marginBottom: 12, background: msg.ok ? "#effaf1" : "#fff1f1", color: msg.ok ? "#166534" : "#a00" }}>{msg.text}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, alignItems: "start" }}>
          {/* Modulo evento */}
          <div style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>{editing ? "✏️ Modifica evento" : "Nuovo evento"}</h2>
              {editing && <button onClick={() => { setEditing(null); setF(blank()); }} style={{ ...btn, background: "#eee", color: "#111", fontSize: 13, padding: "6px 10px" }}>Annulla</button>}
            </div>

            <label style={lbl}>Tipo</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(Object.keys(KIND) as Kind[]).map((k) => (
                <button key={k} onClick={() => setKind(k)}
                        style={{ ...btn, fontSize: 13, padding: "6px 10px", background: f.kind === k ? "#111" : "#eee", color: f.kind === k ? "#fff" : "#111" }}>
                  {KIND[k].icon} {KIND[k].label}
                </button>
              ))}
            </div>

            <label style={lbl}>Titolo</label>
            <input style={inp} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="es. Livorno – Pescara (Serie C)" />

            <label style={lbl}>Luogo</label>
            <div style={{ display: "flex", gap: 6 }}>
              <select style={inp} value={f.venue_id} onChange={(e) => setF({ ...f, venue_id: e.target.value })}>
                <option value="">Scegli…</option>
                {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <button onClick={() => setVenueForm({ id: null, name: "", lat: 43.5485, lng: 10.3106 })}
                      style={{ ...btn, fontSize: 13, padding: "6px 10px", whiteSpace: "nowrap" }}>+ Luogo</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div><label style={lbl}>Data</label><input style={inp} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
              <div><label style={lbl}>Ora di inizio evento</label><input style={inp} type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></div>
              <div><label style={lbl}>Durata evento (min)</label><input style={inp} type="number" min={30} value={f.dur} onChange={(e) => setF({ ...f, dur: Number(e.target.value) })} /></div>
              <div><label style={lbl}>Postazione prima (min)</label><input style={inp} type="number" min={0} value={f.pre} onChange={(e) => setF({ ...f, pre: Number(e.target.value) })} /></div>
              <div><label style={lbl}>Ambulanze richieste</label><input style={inp} type="number" min={1} max={10} value={f.slots} onChange={(e) => setF({ ...f, slots: Number(e.target.value) })} /></div>
              <div><label style={lbl}>Compenso per mezzo (€)</label><input style={inp} type="number" min={0} step={100} value={f.reward} onChange={(e) => setF({ ...f, reward: Number(e.target.value) })} /></div>
            </div>

            <label style={lbl}>Equipaggio per ogni ambulanza</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {ROLES.map(([k, l]) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                  <input type="number" min={0} max={3} value={f.roles[k] ?? 0} style={{ ...inp, width: 56 }}
                         onChange={(e) => setF({ ...f, roles: { ...f.roles, [k]: Number(e.target.value) } })} /> {l}
                </label>
              ))}
            </div>

            <label style={{ ...lbl, display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={f.confirmed} onChange={(e) => setF({ ...f, confirmed: e.target.checked })} />
              Orario confermato (se no, sul gioco compare &quot;orario indicativo&quot;)
            </label>
            <label style={lbl}>Link della fonte (facoltativo)</label>
            <input style={inp} value={f.source_url} onChange={(e) => setF({ ...f, source_url: e.target.value })} placeholder="https://…" />

            <div style={{ fontSize: 13, color: "#555", background: "#f6f6f4", borderRadius: 8, padding: 8, marginTop: 10 }}>
              Postazione dalle <strong>{(() => { const d = new Date(`${f.date}T${f.time}`); d.setMinutes(d.getMinutes() - f.pre); return isNaN(d.getTime()) ? "—" : localTime(d); })()}</strong>.
              Il servizio compare sulla mappa 2 ore prima e si chiude all&apos;apertura della postazione.
            </div>

            <button onClick={save} disabled={!valid || busy}
                    style={{ ...btn, width: "100%", marginTop: 12, background: "#7C3AED", opacity: !valid || busy ? 0.4 : 1 }}>
              {busy ? "Salvataggio…" : editing ? "Salva modifiche" : "Inserisci evento"}
            </button>
          </div>

          {/* Luoghi */}
          <div style={box}>
            <h2 style={{ marginTop: 0 }}>Luoghi</h2>
            {venueForm ? (
              <>
                <label style={lbl}>Nome</label>
                <input style={inp} value={venueForm.name} onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })} />
                <div style={{ fontSize: 13, color: "#666", margin: "8px 0" }}>Tocca la mappa per mettere il segnaposto nel punto esatto.</div>
                <PickBaseMap value={{ lat: venueForm.lat, lng: venueForm.lng }} color="#7C3AED"
                             onPick={(p) => setVenueForm({ ...venueForm, lat: p.lat, lng: p.lng })} />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={() => setVenueForm(null)} style={{ ...btn, background: "#eee", color: "#111" }}>Annulla</button>
                  <button onClick={saveVenue} disabled={!venueForm.name.trim()} style={{ ...btn, flex: 1, background: "#7C3AED" }}>Salva luogo</button>
                </div>
              </>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {venues.map((v) => (
                  <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14,
                                           borderBottom: "1px solid #eee", padding: "6px 0" }}>
                    <span>📍 {v.name}</span>
                    <button onClick={() => setVenueForm({ id: v.id, name: v.name, lat: v.lat, lng: v.lng })}
                            style={{ ...btn, fontSize: 12, padding: "4px 8px", background: "#eee", color: "#111" }}>✏️ Sposta</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Calendario */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "24px 0 10px" }}>
          <h2 style={{ margin: 0, flex: 1 }}>Calendario eventi</h2>
          <label style={{ fontSize: 14 }}><input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> Mostra passati</label>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {shown.length === 0 && <div style={{ ...box, color: "#666" }}>Nessun evento in calendario.</div>}
          {shown.map((e) => {
            const show = new Date(e.show_at ?? e.starts_at);
            return (
              <div key={e.id} style={{ ...box, padding: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
                                       border: editing?.id === e.id ? "2px solid #7C3AED" : undefined }}>
                <div style={{ fontSize: 26 }}>{KIND[e.kind]?.icon}</div>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{e.title}</div>
                  <div style={{ fontSize: 13, color: "#555" }}>
                    {show.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })} · ore {localTime(show)}
                    {!e.time_confirmed && <span style={{ color: "#B45309" }}> (indicativo)</span>} · {e.venue}
                  </div>
                  <div style={{ fontSize: 12, color: "#777" }}>
                    {e.slots} {e.slots > 1 ? "ambulanze" : "ambulanza"} · {e.reward_funds.toLocaleString("it-IT")} € ciascuna
                    {e.source_url && <> · <a href={e.source_url} target="_blank" rel="noreferrer">fonte</a></>}
                  </div>
                </div>
                <button onClick={() => startEdit(e)} style={{ ...btn, fontSize: 12, padding: "6px 10px" }}>✏️ Modifica</button>
                <button onClick={() => remove(e)} style={{ ...btn, fontSize: 12, padding: "6px 10px", background: "#DC2626" }}>Elimina</button>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
