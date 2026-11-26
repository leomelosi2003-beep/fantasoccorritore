"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { AllyChip, useMyAllianceBadge } from "@/components/AllianceExtras";
import PresidiPanel from "@/components/PresidiPanel";
import { useRouter } from "next/navigation";
import { supabase, friendlyError } from "@/lib/supabase";
import { gameConfirm } from "@/lib/confirm";
import TutorialCoach from "@/components/TutorialCoach";
import PageHeader from "@/components/PageHeader";

type Org = { id: string; name: string; funds: number };
type Base = { id: string; name: string; is_headquarters: boolean };
type Model = { id: string; name: string; boat: boolean | null; electric: boolean | null };
type Vehicle = { fix_on_return?: boolean; id: string; call_sign: string; base_id: string; model_id: string; status: string; maintenance_until: string | null;
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
  const ally = useMyAllianceBadge(org?.id);
  const [bases, setBases] = useState<Base[]>([]);
  const [models, setModels] = useState<Record<string, Model>>({});
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tires, setTires] = useState<Tire[]>([]);
  const [ptypes, setPtypes] = useState<PartType[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<"mezzi" | "presidi" | "gomme" | "segnalazioni">("mezzi");
  useEffect(() => { const t = new URLSearchParams(window.location.search).get("tab"); if (t === "presidi" || t === "gomme" || t === "segnalazioni") setTab(t); }, []);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [openV, setOpenV] = useState<string | null>(null);
  const [only, setOnly] = useState<"tutti" | "problemi">("problemi");
  const [focus, setFocus] = useState<null | "guasti" | "revisioni" | "gomme" | "pezzi" | "carrozzeria">(null);
  const [progress, setProgress] = useState<string | null>(null);
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
      supabase.from("vehicles").select("id,call_sign,base_id,model_id,status,maintenance_until,odometer_km,tire_model_id,tire_wear_km,issue_open,body_damage,wear,service_km,fix_on_return")
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
    const tireBad = !t || tr >= 0.8 || wrongSeason;
    return { t, tr, due, wrongSeason, iss, problems, reasons, serviceDue, tireBad };
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

  function hasFocus(v: Vehicle) {
    const h = health(v);
    if (focus === "guasti") return h.iss.length > 0;
    if (focus === "revisioni") return h.serviceDue;
    if (focus === "gomme") return h.tireBad;
    if (focus === "pezzi") return h.due.length > 0;
    if (focus === "carrozzeria") return Number(v.body_damage) > 0;
    return true;
  }
  // gomma migliore che ho in magazzino adatta alla stagione
  function bestStockTire(left: Record<string, number>) {
    return tires.filter((t) => (left[t.id] ?? 0) > 0 && (winter ? t.season !== "estiva" : t.season !== "invernale"))
      .sort((a, b) => b.grip - a.grip || b.life_km - a.life_km)[0];
  }
  async function fixAll(list: Vehicle[]) {
    const todo = list.filter((v) => v.status === "disponibile" && health(v).problems);
    const away = list.filter((v) => v.status !== "disponibile" && health(v).problems && !v.fix_on_return);
    if (!todo.length) {
      if (!away.length) { setMsg({ ok: false, text: "Non c'è niente da sistemare." }); return; }
      const { error } = await supabase.rpc("set_fix_on_return", { p_vehicles: away.map((v) => v.id), p_on: true });
      setMsg(error ? { ok: false, text: shopError(error.message) } : { ok: true, text: `🔧 ${away.length} mezzi fuori sede o in officina: si sistemano da soli appena sono fermi in sede.` });
      load(); return;
    }
    const est = todo.reduce((t, v) => { const h = health(v);
      return t + h.iss.reduce((a, i) => a + i.cost, 0) + h.due.reduce((a, p) => a + (ptByCode[p.part_code]?.cost ?? 0), 0)
        + (Number(v.body_damage) > 0 ? Math.round(Number(v.body_damage) * 100) : 0) + (h.tireBad ? 120 : 0); }, 0);
    if (!(await gameConfirm(`Sistemare ${todo.length} mezzi?\n\nRiparo i guasti, faccio le revisioni scadute, cambio i pezzi consumati, monto le gomme adatte che hai in magazzino e sistemo la carrozzeria.\nSpesa circa ${euro(est)} (più le revisioni). I mezzi restano in officina qualche minuto.`))) return;
    setBusy(true); setMsg(null);
    const left = { ...stock }; let done = 0, jobs = 0, later = 0, noTires = 0; let lastErr = "";
    for (const [k, v] of todo.entries()) {
      setProgress(`🔧 ${k + 1}/${todo.length} · ${v.call_sign}`);
      const h = health(v);
      const steps: [string, Record<string, unknown>][] = [];
      if (h.iss.length) steps.push(["repair_vehicle", { p_vehicle: v.id }]);
      if (h.serviceDue) steps.push(["service_vehicle", { p_vehicle: v.id }]);
      for (const p of h.due) steps.push(["replace_part", { p_vehicle: v.id, p_part: p.part_code }]);
      if (h.tireBad) { const t = bestStockTire(left); if (t) { steps.push(["mount_tires", { p_vehicle: v.id, p_model: t.id }]); left[t.id] -= 1; } else noTires++; }
      if (Number(v.body_damage) > 0) steps.push(["repair_body", { p_vehicle: v.id }]);
      let ok = 0;
      for (const [fn, args] of steps) {
        const { error } = await supabase.rpc(fn, args);
        if (error) { if (/BUSY|manutenzione|fermo/i.test(error.message)) { later++; break; } lastErr = shopError(error.message); if (/INSUFFICIENT_FUNDS/.test(error.message)) break; continue; }
        ok++;
      }
      jobs += ok; if (ok) done++;
      if (/Soldi/.test(lastErr)) break;
    }
    // tutto quello che resta (lavori successivi, mezzi in servizio) lo finisce il server appena il mezzo è fermo in sede
    const rest = [...todo.filter((v) => { const h = health(v); return [h.iss.length > 0, h.serviceDue, h.due.length > 0, h.tireBad, Number(v.body_damage) > 0].filter(Boolean).length > 1; }), ...away];
    if (rest.length) await supabase.rpc("set_fix_on_return", { p_vehicles: rest.map((v) => v.id), p_on: true });
    setBusy(false); setProgress(null);
    setMsg({ ok: !lastErr || done > 0, text: `✅ ${jobs} lavori fatti su ${done} mezzi.`
      + (rest.length ? ` ${rest.length} mezzi (in servizio o con altri lavori) si finiscono da soli appena sono fermi in sede.` : "")
      + (noTires ? ` ${noTires} mezzi aspettano gomme: comprale nella scheda 🛞 Gomme.` : "")
      + (lastErr ? ` Ultimo problema: ${lastErr}` : "") });
    load();
  }

  if (!org) return <main style={shell} />;
  const brokenCount = land.filter((v) => v.issue_open).length;
  const brokenCost = issues.reduce((t, i) => t + i.cost, 0);

  const groups = bases.map((b) => ({ b, list: land.filter((v) => v.base_id === b.id && (focus ? hasFocus(v) : (only === "tutti" || health(v).problems))) }))
    .filter((g) => g.list.length);

  return (
    <main style={shell}>
      <TutorialCoach page="officina" />
      <PageHeader icon="🔧" title="Officina" tone="slate" funds={org.funds} back="/garage" backLabel="Garage"
        sub="Ripara guasti, fai revisioni, monta gomme e presidi"
        tabs={[{ key: "mezzi", label: "🚑 Mezzi", badge: brokenCount || null }, { key: "presidi", label: "🧰 Presidi" }, { key: "gomme", label: "🛞 Gomme" },
               { key: "segnalazioni", label: "📣 Segnalazioni", badge: unseen || null }]}
        tab={tab} onTab={(k) => setTab(k as typeof tab)}
        links={[{ href: "/garage", label: "🚑 Garage" }, { href: "/negozio", label: "🛒 Negozio presidi" }, { href: "/sedi", label: "🏠 Sedi" }]} />

      <div style={wrap}>
        {msg && <div style={{ ...box, marginBottom: 12, background: msg.ok ? "#effaf1" : "#fff1f1", color: msg.ok ? "#166534" : "#a00" }}>{msg.text}</div>}

        <div style={{ ...box, marginBottom: 12, padding: "8px 12px", background: winter ? "#EFF6FF" : "#FFF7ED", fontSize: 13, borderRadius: 999 }}>
          {winter ? "❄️ Inverno (15/11 – 15/4): monta gomme invernali o 4 stagioni." : "☀️ Estate: monta gomme estive o 4 stagioni."}
          <span style={{ color: "#666" }}> Mezzi usurati e pezzi vecchi si guastano più spesso.</span>
        </div>

        

        {tab === "mezzi" && (() => {
          const hs = land.map((v) => ({ v, h: health(v) }));
          const tiles: [NonNullable<typeof focus>, string, string, number, string][] = [
            ["guasti", "⚠️", "Guasti", hs.filter((x) => x.h.iss.length).length, "#DC2626"],
            ["revisioni", "📋", "Revisioni scadute", hs.filter((x) => x.h.serviceDue).length, "#7C3AED"],
            ["gomme", "🛞", "Gomme da cambiare", hs.filter((x) => x.h.tireBad).length, "#0369A1"],
            ["pezzi", "🔩", "Pezzi consumati", hs.filter((x) => x.h.due.length).length, "#B45309"],
            ["carrozzeria", "🚗", "Carrozzeria", hs.filter((x) => Number(x.v.body_damage) > 0).length, "#92400E"],
          ];
          const nProb = hs.filter((x) => x.h.problems).length;
          return (
          <>
            <div style={{ ...box, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{nProb ? `🔧 ${nProb} mezzi da sistemare` : "✅ Tutti i mezzi sono a posto"}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{nProb ? "Tocca un riquadro per vedere solo quei mezzi, oppure sistema tutto con un tasto." : "Niente da fare in officina per ora."}</div>
                </div>
                {nProb > 0 && (
                  <button disabled={busy} onClick={() => fixAll(land)}
                          style={{ ...btn, background: "#16A34A", padding: "12px 18px", fontSize: 15, opacity: busy ? 0.5 : 1 }}>
                    {progress ?? "✅ Sistema tutto"}
                  </button>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginTop: 10 }}>
                {tiles.map(([k, ico, label, n, color]) => (
                  <button key={k} onClick={() => { setFocus(focus === k ? null : k); if (focus !== k) setOpen(Object.fromEntries(bases.map((b) => [b.id, true]))); }}
                          style={{ border: focus === k ? `2px solid ${color}` : "1px solid #e5e5e5", background: n ? "#fff" : "#f8f8f8", borderRadius: 12,
                                   padding: "10px 8px", cursor: "pointer", textAlign: "left", opacity: n ? 1 : 0.55 }}>
                    <div style={{ fontSize: 20 }}>{ico} <span style={{ fontWeight: 900, color: n ? color : "#16A34A" }}>{n || "✓"}</span></div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#333" }}>{label}</div>
                  </button>
                ))}
              </div>
              {focus && <div style={{ marginTop: 8, fontSize: 13 }}>Filtro: <strong>{tiles.find((t) => t[0] === focus)?.[2]}</strong> · <button onClick={() => setFocus(null)} style={{ ...small, background: "#555" }}>Mostra tutti</button></div>}
            </div>
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
                                     background: "linear-gradient(135deg,#1D3D6B,#13294B)", color: "#fff", borderRadius: 12, padding: "10px 14px" }}>
                      <span style={{ fontSize: 18 }}>{b.is_headquarters ? "⭐" : "🏠"}</span>
                      <span style={{ flex: 1, fontWeight: 800 }}>{b.name}</span>
                      {ally && <AllyChip a={ally} size={20} dark />}
                      {nNeed > 0 && <span title={`${nNeed} mezzi hanno bisogno di interventi`} style={{ background: "#FACC15", color: "#111", borderRadius: 999, width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>!</span>}
                      {nProb > 0 && <span style={{ background: "#DC2626", borderRadius: 999, padding: "1px 8px", fontSize: 12, fontWeight: 800 }}>⚠️ {nProb}</span>}
                      <span style={{ background: "rgba(255,255,255,.25)", borderRadius: 999, padding: "1px 10px", fontSize: 13, fontWeight: 800 }}>{list.length}</span>
                      <span style={{ fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
                    </button>
                    {isOpen && (
                      <div className="fs-cards2" style={{ gap: 8, marginTop: 8 }}>
                        <div className="fs-span" style={{ ...box, padding: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
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
                              {!free && <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{v.status === "manutenzione" ? `🔧 In officina${v.maintenance_until ? ` fino alle ${new Date(v.maintenance_until).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : ""}` : v.status === "in_servizio" ? (v.fix_on_return ? "🚨 In servizio: si sistema da solo appena rientra" : "🚨 In servizio")  : "Non disponibile"}</div>}
                              {h.problems && !free && (
                                <button disabled={busy} onClick={async () => {
                                    const on = !v.fix_on_return;
                                    const { error } = await supabase.rpc("set_fix_on_return", { p_vehicles: [v.id], p_on: on });
                                    setMsg(error ? { ok: false, text: shopError(error.message) } : { ok: true, text: on ? `🔧 ${v.call_sign} si sistema da solo appena rientra in sede.` : `${v.call_sign}: lavori al rientro annullati.` });
                                    load(); }}
                                        style={{ ...btn, width: "100%", marginTop: 6, background: v.fix_on_return ? "#15803D" : "#0F766E", opacity: busy ? 0.4 : 1 }}>
                                  {v.fix_on_return ? "✅ Si sistema al rientro · tocca per annullare" : "🔧 Sistema appena rientra in sede"}
                                </button>
                              )}
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
          );
        })()}

        {tab === "presidi" && org && <PresidiPanel funds={org.funds} onChange={load} />}

        {tab === "gomme" && (() => {
          // stato delle gomme di ogni mezzo di terra
          const st = (v: Vehicle) => {
            const h = health(v);
            if (!h.t) return { k: "none", label: "Senza gomme", icon: "❌", color: "#B91C1C", bg: "#FEE2E2" };
            if (h.tr >= 1) return { k: "worn", label: "Finite", icon: "❌", color: "#B91C1C", bg: "#FEE2E2" };
            if (h.wrongSeason) return { k: "season", label: "Fuori stagione", icon: winter ? "❄️" : "☀️", color: "#B45309", bg: "#FEF3C7" };
            if (h.tr >= 0.8) return { k: "low", label: "Quasi finite", icon: "⚠️", color: "#B45309", bg: "#FEF3C7" };
            return { k: "ok", label: "A posto", icon: "✅", color: "#15803D", bg: "#DCFCE7" };
          };
          const all = land.map((v) => ({ v, s: st(v), h: health(v) }));
          const cnt = (k: string) => all.filter((x) => x.s.k === k).length;
          const okSeason = (t: Tire) => (winter ? t.season !== "estiva" : t.season !== "invernale");
          return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* 1) situazione */}
            <div style={box}>
              <h3 style={{ margin: "0 0 4px", color: "#13294B" }}>🛞 Situazione gomme della flotta</h3>
              <div style={{ fontSize: 13.5, color: "#475569", marginBottom: 10 }}>
                {winter ? "❄️ Adesso è inverno: servono gomme invernali o 4 stagioni." : "☀️ Adesso è estate: vanno bene estive o 4 stagioni."}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                {[["✅", "A posto", cnt("ok"), "#15803D", "#DCFCE7"], ["⚠️", "Quasi finite", cnt("low"), "#B45309", "#FEF3C7"],
                  [winter ? "❄️" : "☀️", "Fuori stagione", cnt("season"), "#B45309", "#FEF3C7"], ["❌", "Finite o senza", cnt("worn") + cnt("none"), "#B91C1C", "#FEE2E2"]].map(([i, l, n, c, bg]) => (
                  <div key={l as string} style={{ background: bg as string, borderRadius: 12, padding: "10px 12px" }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: c as string, lineHeight: 1 }}>{i} {n}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: c as string, marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 8 }}>{land.length} mezzi in tutto · {Object.values(stock).reduce((a, b) => a + b, 0)} treni in magazzino</div>
            </div>

            {/* 2) mezzo per mezzo, per sede */}
            <div style={box}>
              <h3 style={{ margin: "0 0 8px", color: "#13294B" }}>🚑 Cosa monta ogni mezzo</h3>
              {bases.map((b) => {
                const list = all.filter((x) => x.v.base_id === b.id);
                if (!list.length) return null;
                const okN = list.filter((x) => x.s.k === "ok").length;
                const key = "__tb_" + b.id; const isOpen = open[key] ?? okN < list.length;
                return (
                  <div key={b.id} style={{ border: "1px solid #E2E8F0", borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
                    <button onClick={() => setOpen((o) => ({ ...o, [key]: !isOpen }))}
                            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: "none", cursor: "pointer", textAlign: "left",
                                     background: "#EEF3F8", padding: "10px 12px", color: "#13294B" }}>
                      <span style={{ flex: 1, fontWeight: 800 }}>{b.is_headquarters ? "⭐" : "🏠"} {b.name}</span>
                      <span style={{ fontWeight: 800, fontSize: 13, borderRadius: 999, padding: "2px 10px", background: okN === list.length ? "#DCFCE7" : "#FEF3C7",
                                     color: okN === list.length ? "#15803D" : "#B45309" }}>{okN === list.length ? "✅ tutti a posto" : `${okN}/${list.length} a posto`}</span>
                      <span>{isOpen ? "▲" : "▼"}</span>
                    </button>
                    {isOpen && list.map(({ v, s: ss, h }) => (
                      <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderTop: "1px solid #F1F5F9", flexWrap: "wrap" }}>
                        <div style={{ minWidth: 110, fontWeight: 800, color: "#13294B" }}>{v.call_sign}</div>
                        <div style={{ flex: 1, minWidth: 160 }}>
                          {h.t ? <>
                            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{SEASON[h.t.season].icon} {h.t.brand} {h.t.name}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                              <div style={{ flex: 1, maxWidth: 160, height: 7, background: "#E2E8F0", borderRadius: 999, overflow: "hidden" }}>
                                <div style={{ width: `${Math.min(100, h.tr * 100)}%`, height: "100%", background: lifeColor(h.tr) }} />
                              </div>
                              <span style={{ fontSize: 11.5, color: "#64748B" }}>consumate {Math.min(100, Math.round(h.tr * 100))}%</span>
                            </div>
                          </> : <div style={{ fontSize: 13.5, color: "#B91C1C", fontWeight: 700 }}>Nessuna gomma montata</div>}
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 800, borderRadius: 999, padding: "3px 10px", background: ss.bg, color: ss.color, whiteSpace: "nowrap" }}>{ss.icon} {ss.label}</span>
                        {ss.k !== "ok" && (
                          <span style={{ display: "flex", gap: 4 }}>
                            <select value={pickTire[v.id] ?? ""} onChange={(e) => setPickTire((p) => ({ ...p, [v.id]: e.target.value }))}
                                    style={{ fontSize: 12.5, padding: "4px 6px", borderRadius: 8, maxWidth: 170 }}>
                              <option value="">Scegli dal magazzino…</option>
                              {tires.filter((t) => (stock[t.id] ?? 0) > 0).map((t) => (
                                <option key={t.id} value={t.id}>{SEASON[t.season].icon} {t.brand} {t.name} ({stock[t.id]}){okSeason(t) ? "" : " ⚠️ stagione"}</option>
                              ))}
                            </select>
                            <button disabled={busy || v.status !== "disponibile" || !pickTire[v.id]}
                                    onClick={() => call("mount_tires", { p_vehicle: v.id, p_model: pickTire[v.id] }, `🛞 Cambio gomme su ${v.call_sign} (15 minuti).`)}
                                    style={{ ...small, opacity: busy || v.status !== "disponibile" || !pickTire[v.id] ? 0.4 : 1 }}>Monta</button>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* 3) negozio */}
            {(Object.keys(SEASON) as Tire["season"][]).map((sea) => (
              <div key={sea} style={{ ...box, borderTop: `5px solid ${SEASON[sea].color}` }}>
                <h3 style={{ margin: "0 0 2px", color: SEASON[sea].color }}>{SEASON[sea].icon} Gomme {SEASON[sea].label.toLowerCase()}</h3>
                <div style={{ fontSize: 12.5, color: "#64748B", marginBottom: 10 }}>
                  {sea === "4stagioni" ? "Vanno bene tutto l'anno." : sea === "invernale" ? "Obbligatorie d'inverno, d'estate si consumano." : "Solo per l'estate."}
                  {(winter ? sea !== "estiva" : sea !== "invernale") && <b style={{ color: "#15803D" }}> ✓ Adatte adesso</b>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
                  {tires.filter((t) => t.season === sea).map((t) => {
                    const q = qty[t.id] ?? 1;
                    const on = land.filter((v) => v.tire_model_id === t.id);
                    const bb = bulkBase[t.id] ?? ""; const i = bulkInfo(t.id, bb);
                    const showList = open["__tl_" + t.id];
                    return (
                      <div key={t.id} style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <div>
                            <div style={{ fontWeight: 900, fontSize: 15.5, color: "#13294B" }}>{t.brand}</div>
                            <div style={{ fontSize: 13 }}>{t.name}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 900, fontSize: 17, color: "#13294B" }}>{euro(t.price)}</div>
                            <div style={{ fontSize: 11, color: "#64748B" }}>a treno (4 gomme)</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 10, fontSize: 12.5, color: "#334155", flexWrap: "wrap" }}>
                          <span>⏱️ dura {kmFmt(t.life_km)}</span><span title="Aderenza">🛣️ {"★".repeat(t.grip)}<span style={{ color: "#CBD5E1" }}>{"★".repeat(5 - t.grip)}</span></span>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12.5, fontWeight: 800, borderRadius: 999, padding: "3px 10px", background: "#EEF3F8", color: "#13294B" }}>📦 {stock[t.id] ?? 0} in magazzino</span>
                          <button onClick={() => setOpen((o) => ({ ...o, ["__tl_" + t.id]: !showList }))} disabled={!on.length}
                                  style={{ fontSize: 12.5, fontWeight: 800, borderRadius: 999, padding: "3px 10px", border: "none", cursor: on.length ? "pointer" : "default",
                                           background: on.length ? "#DCFCE7" : "#F1F5F9", color: on.length ? "#15803D" : "#94A3B8" }}>
                            🚑 montate su {on.length} {on.length === 1 ? "mezzo" : "mezzi"}{on.length ? (showList ? " ▲" : " ▼") : ""}
                          </button>
                        </div>
                        {showList && on.length > 0 && (
                          <div style={{ fontSize: 12.5, background: "#F8FAFC", borderRadius: 8, padding: "6px 8px", lineHeight: 1.6 }}>
                            {on.map((v) => { const ss = st(v); return <div key={v.id}>{ss.icon} <b>{v.call_sign}</b> · {bases.find((b) => b.id === v.base_id)?.name ?? ""}</div>; })}
                          </div>
                        )}
                        <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#13294B", marginBottom: 4 }}>Montale ai mezzi che non le hanno</div>
                          <select value={bb} onChange={(e) => setBulkBase((x) => ({ ...x, [t.id]: e.target.value }))}
                                  style={{ width: "100%", fontSize: 13, padding: "5px 6px", borderRadius: 8 }}>
                            <option value="">Tutte le sedi</option>
                            {bases.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: i.need === 0 ? "#15803D" : i.missing ? "#B45309" : "#15803D", marginTop: 4 }}>
                            {i.need === 0 ? "✅ Ce l'hanno già tutti" : `Mancano a ${i.need} mezzi · ${i.missing ? `ti servono altri ${i.missing} treni` : "hai abbastanza treni ✓"}`}
                          </div>
                          {i.need > 0 && (
                            <button disabled={busy || !i.have || !i.free} onClick={() => bulkMount(t.id, bb)}
                                    style={{ ...small, width: "100%", marginTop: 4, padding: "7px 10px", opacity: busy || !i.have || !i.free ? 0.4 : 1 }}>🔧 Monta a tutti ({Math.min(i.free, i.have)})</button>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <button onClick={() => setQty((x) => ({ ...x, [t.id]: Math.max(1, q - 1) }))} style={{ ...small, width: 34, height: 34, padding: 0, fontSize: 18, background: "#E2E8F0", color: "#13294B" }}>−</button>
                          <div style={{ minWidth: 36, textAlign: "center", fontWeight: 900, fontSize: 17 }}>{q}</div>
                          <button onClick={() => setQty((x) => ({ ...x, [t.id]: Math.min(50, q + 1) }))} style={{ ...small, width: 34, height: 34, padding: 0, fontSize: 18, background: "#E2E8F0", color: "#13294B" }}>+</button>
                          {i.missing > 0 && <button onClick={() => setQty((x) => ({ ...x, [t.id]: Math.min(50, i.missing) }))} style={{ ...small, background: "#64748B" }}>= {Math.min(50, i.missing)} che mancano</button>}
                        </div>
                        <button disabled={busy || t.price * q > org.funds}
                                onClick={() => call("buy_tires", { p_model: t.id, p_sets: q }, `🛞 ${q} treni ${t.brand} ${t.name} in magazzino.`)}
                                style={{ ...btn, padding: "10px 12px", fontSize: 14.5, background: SEASON[sea].color, opacity: busy || t.price * q > org.funds ? 0.4 : 1 }}>
                          🛒 Compra {q} {q === 1 ? "treno" : "treni"} · {euro(t.price * q)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 12, color: "#666" }}>Prezzi per treno da 4 gomme. Il montaggio costa 120 € e il mezzo resta in officina 15 minuti.</div>
          </div>
          );
        })()}

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
