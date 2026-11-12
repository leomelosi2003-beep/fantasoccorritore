"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase, friendlyError } from "@/lib/supabase";
import { gameConfirm } from "@/lib/confirm";
import TutorialCoach from "@/components/TutorialCoach";

type Org = { id: string; name: string; funds: number };
type Base = { id: string; name: string; is_headquarters: boolean };
type Model = { id: string; name: string; boat: boolean | null; electric: boolean | null };
type Vehicle = { id: string; call_sign: string; base_id: string; model_id: string; status: string; maintenance_until: string | null;
  odometer_km: number; tire_model_id: string | null; tire_wear_km: number; issue_open: boolean; body_damage: number; wear: number; service_km: number };
type Tire = { id: string; brand: string; name: string; season: "estiva" | "invernale" | "4stagioni"; price: number; life_km: number; grip: number; sort: number };
type PartType = { code: string; name: string; life_km: number; cost: number; minutes: number; kind: string; sort: number };
type Part = { vehicle_id: string; part_code: string; installed_km: number };
type Issue = { id: string; vehicle_id: string; kind: string; title: string; cost: number; minutes: number; created_at: string };
type Report = { id: string; vehicle_id: string; volunteer_name: string | null; damage: string; damage_pct: number; cost: number;
  created_at: string; seen_at: string | null; fixed_at: string | null };

const euro = (n: number) => Math.round(n).toLocaleString("it-IT") + " €";
const kmFmt = (n: number) => Math.round(n).toLocaleString("it-IT") + " km";
const SEASON: Record<Tire["season"], { label: string; icon: string; color: string }> = {
  estiva: { label: "Estive", icon: "☀️", color: "#EA580C" },
  invernale: { label: "Invernali", icon: "❄️", color: "#0369A1" },
  "4stagioni": { label: "4 stagioni", icon: "🌦️", color: "#15803D" },
};
const KIND_ICON: Record<string, string> = { foratura: "🛞", freni: "🛑", elettronico: "⚡", meccanico: "⚙️" };

const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 980, margin: "0 auto", padding: 16 };
const box: CSSProperties = { background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)" };
const btn: CSSProperties = { padding: "8px 12px", borderRadius: 10, border: "none", background: "#111", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14 };
const small: CSSProperties = { ...btn, padding: "5px 10px", fontSize: 12 };

function winterNow(d = new Date()) {
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  return md >= 1115 || md < 416;
}

function Bar({ label, pct, text, color }: { label: string; pct: number; text: string; color: string }) {
  return (
    <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>{label}</span><span style={{ whiteSpace: "nowrap" }}>{text}</span></div>
      <div style={{ height: 6, background: "#eee", borderRadius: 3 }}>
        <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: 6, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}
const lifeColor = (r: number) => (r >= 1 ? "#DC2626" : r >= 0.8 ? "#EAB308" : "#16A34A");

function shopError(m: string) {
  if (m.includes("INSUFFICIENT_FUNDS")) return "Soldi insufficienti.";
  if (m.includes("VEHICLE_BUSY")) return "Il mezzo deve essere fermo in sede.";
  if (m.includes("NO_TIRE_STOCK")) return "In magazzino non hai quelle gomme: comprale nella scheda 🛞 Gomme.";
  if (m.includes("NOTHING_TO_REPAIR")) return "Non c'è niente da riparare.";
  if (m.includes("NO_TIRES_BOAT")) return "Le barche non hanno gomme.";
  if (m.includes("BAD_QTY")) return "Scegli quanti treni di gomme comprare (1-50).";
  return friendlyError(m);
}

export default function Officina() {
  const router = useRouter();
  const [org, setOrg] = useState<Org | null>(null);
  const [bases, setBases] = useState<Base[]>([]);
  const [models, setModels] = useState<Record<string, Model>>({});
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tires, setTires] = useState<Tire[]>([]);
  const [ptypes, setPtypes] = useState<PartType[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<"mezzi" | "gomme" | "segnalazioni">("mezzi");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [openV, setOpenV] = useState<string | null>(null);
  const [only, setOnly] = useState<"tutti" | "problemi">("tutti");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [pickTire, setPickTire] = useState<Record<string, string>>({});
  const [bulkBase, setBulkBase] = useState<Record<string, string>>({}); // gomma -> sede ("" = tutte)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); return; }
    const { data: o } = await supabase.from("organizations").select("id,name,funds").eq("owner_id", session.user.id).maybeSingle();
    if (!o) { router.replace("/onboarding"); return; }
    setOrg(o as Org);
    const [bs, ms, vs, ts, pt, st, rp] = await Promise.all([
      supabase.from("bases").select("id,name,is_headquarters").eq("org_id", o.id).order("built_at"),
      supabase.from("vehicle_models").select("id,name,boat,electric"),
      supabase.from("vehicles").select("id,call_sign,base_id,model_id,status,maintenance_until,odometer_km,tire_model_id,tire_wear_km,issue_open,body_damage,wear,service_km")
        .eq("org_id", o.id).order("call_sign"),
      supabase.from("tire_models").select("*").order("sort"),
      supabase.from("vehicle_part_types").select("*").order("sort"),
      supabase.from("org_tire_stock").select("tire_model_id,qty").eq("org_id", o.id),
      supabase.from("vehicle_reports").select("*").eq("org_id", o.id).order("created_at", { ascending: false }).limit(150),
    ]);
    setBases((bs.data as Base[]) ?? []);
    setModels(Object.fromEntries(((ms.data as Model[]) ?? []).map((m) => [m.id, m])));
    const vlist = (vs.data as Vehicle[]) ?? [];
    setVehicles(vlist);
    setTires((ts.data as Tire[]) ?? []);
    setPtypes((pt.data as PartType[]) ?? []);
    setStock(Object.fromEntries(((st.data as { tire_model_id: string; qty: number }[]) ?? []).map((s) => [s.tire_model_id, s.qty])));
    setReports((rp.data as Report[]) ?? []);
    // pezzi e guasti dei miei mezzi (a blocchi, per non superare i limiti delle richieste)
    const ids = vlist.map((v) => v.id);
    const allParts: Part[] = []; const allIssues: Issue[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const [p, is] = await Promise.all([
        supabase.from("vehicle_parts").select("vehicle_id,part_code,installed_km").in("vehicle_id", chunk).limit(1000),
        supabase.from("vehicle_issues").select("id,vehicle_id,kind,title,cost,minutes,created_at").in("vehicle_id", chunk).is("fixed_at", null),
      ]);
      allParts.push(...((p.data as Part[]) ?? [])); allIssues.push(...((is.data as Issue[]) ?? []));
    }
    setParts(allParts); setIssues(allIssues);
  }, [router]);
  useEffect(() => { load(); }, [load]);

  const unseen = reports.filter((r) => !r.seen_at).length;
  useEffect(() => {
    if (tab === "segnalazioni" && unseen > 0) {
      supabase.rpc("mark_reports_seen").then(() => setReports((rs) => rs.map((r) => (r.seen_at ? r : { ...r, seen_at: new Date().toISOString() }))));
    }
  }, [tab, unseen]);

  const tireById = useMemo(() => Object.fromEntries(tires.map((t) => [t.id, t])), [tires]);
  const ptByCode = useMemo(() => Object.fromEntries(ptypes.map((p) => [p.code, p])), [ptypes]);
  const partsOf = useCallback((vid: string) => parts.filter((p) => p.vehicle_id === vid)
    .sort((a, b) => (ptByCode[a.part_code]?.sort ?? 0) - (ptByCode[b.part_code]?.sort ?? 0)), [parts, ptByCode]);
  const land = vehicles.filter((v) => !models[v.model_id]?.boat);
  const winter = winterNow();

  function health(v: Vehicle) {
    const t = v.tire_model_id ? tireById[v.tire_model_id] : undefined;
    const tr = t ? v.tire_wear_km / t.life_km : 0;
    const due = partsOf(v.id).filter((p) => { const pt = ptByCode[p.part_code]; return pt && (v.odometer_km - p.installed_km) / pt.life_km >= 0.8; });
    const wrongSeason = !!t && ((winter && t.season === "estiva") || (!winter && t.season === "invernale"));
    const iss = issues.filter((i) => i.vehicle_id === v.id);
    const serviceDue = v.odometer_km - Number(v.service_km ?? 0) >= 15000;
    const problems = iss.length > 0 || tr >= 0.8 || due.length > 0 || Number(v.body_damage) > 0 || wrongSeason || serviceDue;
    const reasons = [iss.length ? "guasto" : "", tr >= 1 ? "gomme finite" : tr >= 0.8 ? "gomme quasi finite" : "", wrongSeason ? "gomme fuori stagione" : "",
      due.length ? `${due.length} pezzi da cambiare` : "", Number(v.body_damage) > 0 ? "carrozzeria" : "", serviceDue ? "revisione scaduta" : ""].filter(Boolean);
    return { t, tr, due, wrongSeason, iss, problems, reasons, serviceDue };
  }

  async function call(fn: string, args: Record<string, unknown>, ok: string, confirm?: string) {
    setMsg(null);
    if (confirm && !(await gameConfirm(confirm))) return;
    setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setMsg({ ok: false, text: shopError(error.message) }); return; }
    setMsg({ ok: true, text: ok });
    load();
  }

  // quanti mezzi (di terra) in quella sede/tutte non hanno ancora quella gomma, e quanti treni mancano
  function bulkInfo(tireId: string, baseId: string) {
    const scope = land.filter((v) => (!baseId || v.base_id === baseId) && v.tire_model_id !== tireId);
    const have = stock[tireId] ?? 0;
    return { need: scope.length, free: scope.filter((v) => v.status === "disponibile").length, have, missing: Math.max(0, scope.length - have) };
  }
  async function bulkMount(tireId: string, baseId: string) {
    const t = tireById[tireId]; if (!t) return;
    const info = bulkInfo(tireId, baseId);
    const where = baseId ? bases.find((b) => b.id === baseId)?.name ?? "sede" : "tutte le sedi";
    if (info.free === 0) { setMsg({ ok: false, text: "Nessun mezzo fermo in sede a cui montarle (quelli in servizio si fanno dopo)." }); return; }
    if (info.have === 0) { setMsg({ ok: false, text: `Non hai treni ${t.brand} ${t.name} in magazzino: te ne servono ${info.need}.` }); return; }
    const n = Math.min(info.free, info.have);
    if (!(await gameConfirm(`Montare ${t.brand} ${t.name} · ${where}\n\n${n} mezzi su ${info.need} (${info.have} treni in magazzino${info.missing ? `, te ne mancano ${info.missing}` : ""}).\nMontaggio ${euro(n * 120)} · ogni mezzo resta in officina 15 minuti.`))) return;
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc("mount_tires_bulk", { p_model: tireId, p_base: baseId || null });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: shopError(error.message) }); return; }
    const r = data as { mounted: number; needed: number; missing: number; cost: number };
    setMsg({ ok: true, text: `🛞 Montate su ${r.mounted} mezzi (${euro(r.cost)}).${r.missing ? ` Ne restano ${r.missing}: ti mancano treni o sono in servizio.` : " Fatto per tutti!"}` });
    load();
  }

  if (!org) return <main style={shell} />;
  const brokenCount = land.filter((v) => v.issue_open).length;
  const brokenCost = issues.reduce((t, i) => t + i.cost, 0);

  const groups = bases.map((b) => ({ b, list: land.filter((v) => v.base_id === b.id && (only === "tutti" || health(v).problems)) }))
    .filter((g) => g.list.length);

  return (
    <main style={shell}>
      <TutorialCoach page="officina" />
      <div style={{ background: "#111", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 10, paddingTop: 12, paddingBottom: 12, flexWrap: "wrap" }}>
          <button onClick={() => router.push("/garage")} style={{ ...btn, background: "#333" }}>← Garage</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>🔧 Officina · {org.name}</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>{euro(org.funds)}</div>
          </div>
        </div>
      </div>

      <div style={wrap}>
        {msg && <div style={{ ...box, marginBottom: 12, background: msg.ok ? "#effaf1" : "#fff1f1", color: msg.ok ? "#166534" : "#a00" }}>{msg.text}</div>}

        <div style={{ ...box, marginBottom: 12, background: winter ? "#EFF6FF" : "#FFF7ED", fontSize: 13 }}>
          {winter
            ? <>❄️ <strong>Periodo invernale (15 novembre – 15 aprile):</strong> con le gomme estive il rischio di forature e incidenti raddoppia. Monta invernali o 4 stagioni.</>
            : <>☀️ <strong>Periodo estivo:</strong> le gomme invernali si consumano il 50% più in fretta. Estive o 4 stagioni sono la scelta giusta.</>}
          <div style={{ color: "#555", marginTop: 4 }}>
            Più un mezzo è usurato e più i pezzi sono vecchi, più capitano guasti al rientro dai servizi. Un mezzo guasto resta fermo finché non lo ripari.
            I mezzi guasti puoi anche venderli all&apos;asta così come sono: valgono meno e chi li compra li ripara.
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {([["mezzi", `🚑 Mezzi${brokenCount ? ` · ⚠️ ${brokenCount}` : ""}`], ["gomme", "🛞 Gomme"], ["segnalazioni", `📣 Segnalazioni${unseen ? ` · ${unseen} nuove` : ""}`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ ...btn, background: tab === k ? "#111" : "#fff", color: tab === k ? "#fff" : "#111", border: "1px solid #ddd" }}>{l}</button>
          ))}
        </div>

        {tab === "mezzi" && (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <select value={only} onChange={(e) => setOnly(e.target.value as "tutti" | "problemi")} style={{ padding: "6px 8px", borderRadius: 8, fontSize: 13 }}>
                <option value="tutti">Tutti i mezzi</option><option value="problemi">Solo con problemi o in scadenza</option>
              </select>
              {brokenCount > 0 && (
                <button disabled={busy} onClick={() => call("repair_all", {}, "🔧 Mezzi guasti in riparazione.", `Riparare tutti i mezzi guasti fermi in sede?\n\nCirca ${euro(brokenCost)}.`)}
                        style={{ ...btn, background: "#DC2626", opacity: busy ? 0.4 : 1 }}>
                  🔧 Ripara tutti i guasti ({brokenCount}) · {euro(brokenCost)}
                </button>
              )}
            </div>
            {groups.length === 0 && <div style={{ ...box, textAlign: "center", color: "#666" }}>Nessun mezzo da mostrare.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {groups.map(({ b, list }) => {
                const isOpen = !!open[b.id];
                const nProb = list.filter((v) => health(v).iss.length).length;
                const nNeed = land.filter((v) => v.base_id === b.id && health(v).problems).length;
                return (
                  <div key={b.id}>
                    <button onClick={() => setOpen((o) => ({ ...o, [b.id]: !o[b.id] }))}
                            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                                     background: "linear-gradient(135deg,#1E3A8A,#1E40AF)", color: "#fff", borderRadius: 12, padding: "10px 14px" }}>
                      <span style={{ fontSize: 18 }}>{b.is_headquarters ? "⭐" : "🏠"}</span>
                      <span style={{ flex: 1, fontWeight: 800 }}>{b.name}</span>
                      {nNeed > 0 && <span title={`${nNeed} mezzi hanno bisogno di interventi`} style={{ background: "#FACC15", color: "#111", borderRadius: 999, width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>!</span>}
                      {nProb > 0 && <span style={{ background: "#DC2626", borderRadius: 999, padding: "1px 8px", fontSize: 12, fontWeight: 800 }}>⚠️ {nProb}</span>}
                      <span style={{ background: "rgba(255,255,255,.25)", borderRadius: 999, padding: "1px 10px", fontSize: 13, fontWeight: 800 }}>{list.length}</span>
                      <span style={{ fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
                    </button>
                    {isOpen && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                        <div style={{ ...box, padding: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
                          <strong>🛞 Gomme a tutta la sede:</strong>
                          <select value={pickTire["__base_" + b.id] ?? ""} onChange={(e) => setPickTire((p) => ({ ...p, ["__base_" + b.id]: e.target.value }))}
                                  style={{ flex: 1, minWidth: 160, fontSize: 12, padding: "4px 6px", borderRadius: 8 }}>
                            <option value="">Scegli le gomme…</option>
                            {tires.map((t) => { const i = bulkInfo(t.id, b.id); return (
                              <option key={t.id} value={t.id}>{SEASON[t.season].icon} {t.brand} {t.name} · in magazzino {i.have}{i.missing ? ` · ne mancano ${i.missing}` : ""}</option>
                            ); })}
                          </select>
                          {pickTire["__base_" + b.id] && (() => { const i = bulkInfo(pickTire["__base_" + b.id], b.id); return (
                            <>
                              <span style={{ fontSize: 12, color: i.missing ? "#B45309" : "#15803D" }}>
                                Servono {i.need} treni · ne hai {i.have}{i.missing ? ` · ti mancano ${i.missing}` : " ✓"}
                              </span>
                              <button disabled={busy || !i.have || !i.free} onClick={() => bulkMount(pickTire["__base_" + b.id], b.id)}
                                      style={{ ...small, opacity: busy || !i.have || !i.free ? 0.4 : 1 }}>Monta a tutta la sede</button>
                              {i.missing > 0 && <button onClick={() => { setQty((q) => ({ ...q, [pickTire["__base_" + b.id]]: i.missing })); setTab("gomme"); }}
                                                        style={{ ...small, background: "#0369A1" }}>Compra i {i.missing} mancanti</button>}
                            </>
                          ); })()}
                        </div>
                        {list.map((v) => {
                          const h = health(v);
                          const exp = openV === v.id;
                          const free = v.status === "disponibile";
                          return (
                            <div key={v.id} style={{ ...box, padding: 12, border: h.iss.length ? "2px solid #DC2626" : undefined }}>
                              <button onClick={() => setOpenV(exp ? null : v.id)}
                                      style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, border: "none", background: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                                {h.problems && <span title={h.reasons.join(", ")} style={{ background: h.iss.length ? "#DC2626" : "#FACC15", color: h.iss.length ? "#fff" : "#111", borderRadius: 999, width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, flexShrink: 0 }}>!</span>}
                                <strong style={{ fontSize: 15 }}>{v.call_sign}</strong>
                                <span style={{ fontSize: 12, color: "#666", flex: 1 }}>{models[v.model_id]?.name} · {kmFmt(v.odometer_km)}</span>
                                <span style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                                  {h.iss.length > 0 && "⚠️ "}
                                  {h.t && <span style={{ color: lifeColor(h.tr) }}>{SEASON[h.t.season].icon} {Math.round(h.tr * 100)}% </span>}
                                  {h.due.length > 0 && <span style={{ color: "#B45309" }}>🔩{h.due.length} </span>}
                                  {Number(v.body_damage) > 0 && <span style={{ color: "#B45309" }}>🚗{Math.round(v.body_damage)}% </span>}
                                  {exp ? "▲" : "▼"}
                                </span>
                              </button>
                              {h.problems && <div style={{ fontSize: 12, color: h.iss.length ? "#991B1B" : "#92400E", marginTop: 4 }}>❗ Da sistemare: {h.reasons.join(" · ")}</div>}
                              {!free && <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{v.status === "manutenzione" ? `🔧 In officina${v.maintenance_until ? ` fino alle ${new Date(v.maintenance_until).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : ""}` : v.status === "in_servizio" ? "🚨 In servizio: i lavori si fanno quando rientra" : "Non disponibile"}</div>}
                              {h.iss.map((i) => (
                                <div key={i.id} style={{ marginTop: 8, background: "#FEE2E2", color: "#991B1B", borderRadius: 8, padding: "6px 8px", fontSize: 13 }}>
                                  {KIND_ICON[i.kind] ?? "⚠️"} <strong>{i.title}</strong> · il mezzo è fermo
                                </div>
                              ))}
                              {h.iss.length > 0 && free && (
                                <button disabled={busy} onClick={() => call("repair_vehicle", { p_vehicle: v.id }, `🔧 ${v.call_sign} in riparazione.`)}
                                        style={{ ...btn, width: "100%", marginTop: 6, background: "#DC2626", opacity: busy ? 0.4 : 1 }}>
                                  🔧 Ripara · {euro(h.iss.reduce((t, i) => t + i.cost, 0))} · {Math.max(...h.iss.map((i) => i.minutes))} min
                                </button>
                              )}
                              {exp && (
                                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: 13 }}>🛞 Gomme</div>
                                    {h.t ? (
                                      <>
                                        <div style={{ fontSize: 12, color: "#555" }}>{SEASON[h.t.season].icon} {h.t.brand} {h.t.name} · aderenza {"★".repeat(h.t.grip)}</div>
                                        <Bar label="Consumo" pct={h.tr * 100} text={`${kmFmt(v.tire_wear_km)} / ${kmFmt(h.t.life_km)}`} color={lifeColor(h.tr)} />
                                        {h.wrongSeason && <div style={{ fontSize: 12, color: "#B45309", marginTop: 4 }}>⚠️ Gomme {h.t.season === "estiva" ? "estive in inverno: più forature" : "invernali in estate: si consumano prima"}</div>}
                                      </>
                                    ) : <div style={{ fontSize: 12 }}>Nessuna gomma</div>}
                                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                                      <select value={pickTire[v.id] ?? ""} onChange={(e) => setPickTire((p) => ({ ...p, [v.id]: e.target.value }))}
                                              style={{ flex: 1, minWidth: 0, fontSize: 12, padding: "4px 6px", borderRadius: 8 }}>
                                        <option value="">Monta dal magazzino…</option>
                                        {tires.filter((t) => (stock[t.id] ?? 0) > 0).map((t) => (
                                          <option key={t.id} value={t.id}>{SEASON[t.season].icon} {t.brand} {t.name} ({stock[t.id]})</option>
                                        ))}
                                      </select>
                                      <button disabled={busy || !free || !pickTire[v.id]}
                                              onClick={() => call("mount_tires", { p_vehicle: v.id, p_model: pickTire[v.id] }, `🛞 Cambio gomme su ${v.call_sign} (15 minuti).`)}
                                              style={{ ...small, opacity: busy || !free || !pickTire[v.id] ? 0.4 : 1 }}>Monta · 120 €</button>
                                    </div>
                                    {Object.values(stock).every((q) => !q) && <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Magazzino vuoto: compra le gomme nella scheda 🛞 Gomme.</div>}
                                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 12 }}>🚗 Carrozzeria</div>
                                    <Bar label="Danni" pct={Number(v.body_damage)} text={`${Math.round(v.body_damage)}%`} color={Number(v.body_damage) >= 30 ? "#DC2626" : Number(v.body_damage) > 0 ? "#EAB308" : "#16A34A"} />
                                    {Number(v.body_damage) > 0 && (() => {
                                      const c = Math.max(reports.filter((r) => r.vehicle_id === v.id && !r.fixed_at).reduce((t, r) => t + r.cost, 0), Math.round(Number(v.body_damage) * 100));
                                      return (
                                        <button disabled={busy || !free} onClick={() => call("repair_body", { p_vehicle: v.id }, `🚗 ${v.call_sign} dal carrozziere.`)}
                                                style={{ ...small, marginTop: 6, background: "#B45309", opacity: busy || !free ? 0.4 : 1 }}>
                                          Sistema la carrozzeria · {euro(c)}
                                        </button>
                                      );
                                    })()}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: 13 }}>🔩 Pezzi</div>
                                    {partsOf(v.id).map((p) => {
                                      const pt = ptByCode[p.part_code]; if (!pt) return null;
                                      const used = v.odometer_km - p.installed_km; const r = used / pt.life_km;
                                      return (
                                        <div key={p.part_code} style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <Bar label={pt.name} pct={r * 100} text={`${kmFmt(Math.max(0, used))} / ${kmFmt(pt.life_km)}`} color={lifeColor(r)} />
                                          </div>
                                          <button disabled={busy || !free} title={`Sostituisci · ${pt.minutes} minuti`}
                                                  onClick={() => call("replace_part", { p_vehicle: v.id, p_part: pt.code }, `🔩 ${pt.name} nuovo su ${v.call_sign} (${pt.minutes} minuti).`,
                                                                      `Sostituire ${pt.name} su ${v.call_sign}?\n\n${euro(pt.cost)} · ${pt.minutes} minuti in officina.`)}
                                                  style={{ ...small, padding: "3px 8px", background: r >= 0.8 ? "#B45309" : "#555", opacity: busy || !free ? 0.4 : 1 }}>
                                            {euro(pt.cost)}
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "gomme" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {(Object.keys(SEASON) as Tire["season"][]).map((s) => (
              <div key={s} style={box}>
                <h3 style={{ margin: "0 0 8px", color: SEASON[s].color }}>{SEASON[s].icon} {SEASON[s].label}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                  {tires.filter((t) => t.season === s).map((t) => {
                    const q = qty[t.id] ?? 1;
                    return (
                      <div key={t.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                        <div style={{ fontWeight: 800 }}>{t.brand}</div>
                        <div style={{ fontSize: 13 }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                          Durata {kmFmt(t.life_km)} · aderenza {"★".repeat(t.grip)}{"☆".repeat(5 - t.grip)}
                        </div>
                        <div style={{ fontSize: 12, color: "#555" }}>In magazzino: <strong>{stock[t.id] ?? 0}</strong> treni</div>
                        {(() => { const bb = bulkBase[t.id] ?? ""; const i = bulkInfo(t.id, bb); return (
                          <div style={{ marginTop: 6, padding: 6, background: "#f6f6f4", borderRadius: 8 }}>
                            <select value={bb} onChange={(e) => setBulkBase((x) => ({ ...x, [t.id]: e.target.value }))}
                                    style={{ width: "100%", fontSize: 12, padding: "3px 6px", borderRadius: 8 }}>
                              <option value="">Tutte le sedi</option>
                              {bases.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                            <div style={{ fontSize: 11, color: i.missing ? "#B45309" : "#15803D", marginTop: 3 }}>
                              {i.need === 0 ? "Le hanno già tutti ✓" : `Servono ${i.need} treni · ${i.missing ? `ti mancano ${i.missing}` : "li hai tutti ✓"}`}
                            </div>
                            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                              {i.missing > 0 && <button onClick={() => setQty((x) => ({ ...x, [t.id]: Math.min(50, i.missing) }))} style={{ ...small, flex: 1, background: "#555" }}>Quantità mancante</button>}
                              <button disabled={busy || !i.have || !i.free} onClick={() => bulkMount(t.id, bb)}
                                      style={{ ...small, flex: 1, opacity: busy || !i.have || !i.free ? 0.4 : 1 }}>Monta a tutti</button>
                            </div>
                          </div>
                        ); })()}
                        <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                          <input type="number" min={1} max={50} value={q} onChange={(e) => setQty((x) => ({ ...x, [t.id]: Number(e.target.value) }))}
                                 style={{ width: 54, padding: "4px 6px", borderRadius: 8, border: "1px solid #ccc" }} />
                          <button disabled={busy || t.price * q > org.funds}
                                  onClick={() => call("buy_tires", { p_model: t.id, p_sets: q }, `🛞 ${q} treni ${t.brand} ${t.name} in magazzino.`)}
                                  style={{ ...small, flex: 1, background: SEASON[s].color, opacity: busy || t.price * q > org.funds ? 0.4 : 1 }}>
                            Compra · {euro(t.price * q)}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 12, color: "#666" }}>Prezzi per treno da 4 gomme. Il montaggio costa 120 € e il mezzo resta in officina 15 minuti.</div>
          </div>
        )}

        {tab === "segnalazioni" && (
          <div style={box}>
            <h3 style={{ margin: "0 0 8px" }}>📣 Segnalazioni dei volontari</h3>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>I danni alla carrozzeria che gli equipaggi ti segnalano al rientro. Gli autisti con poca guida fanno più danni.</div>
            {reports.length === 0 && <div style={{ color: "#666" }}>Nessuna segnalazione. 👍</div>}
            {reports.map((r) => {
              const v = vehicles.find((x) => x.id === r.vehicle_id);
              return (
                <div key={r.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px solid #eee", opacity: r.fixed_at ? 0.55 : 1 }}>
                  <span style={{ fontSize: 20 }}>{r.fixed_at ? "✅" : "🚗"}</span>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                    <div><strong>{r.volunteer_name ?? "Equipaggio"}</strong>: «{r.damage}» su <strong>{v?.call_sign ?? "mezzo venduto"}</strong>
                      {!r.seen_at && <span style={{ marginLeft: 6, background: "#DC2626", color: "#fff", borderRadius: 999, padding: "0 6px", fontSize: 11 }}>NUOVA</span>}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      {new Date(r.created_at).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      {" · "}danno {r.damage_pct}% · {r.fixed_at ? "riparato" : `riparazione circa ${euro(r.cost)}`}
                    </div>
                  </div>
                  {!r.fixed_at && v && v.status === "disponibile" && (
                    <button disabled={busy} onClick={() => call("repair_body", { p_vehicle: v.id }, `🚗 ${v.call_sign} dal carrozziere.`)}
                            style={{ ...small, background: "#B45309", opacity: busy ? 0.4 : 1 }}>Ripara</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
