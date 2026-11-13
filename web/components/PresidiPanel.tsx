"use client";
// Presidi: magazzino dell'associazione + presidi montati su ogni mezzo (togli, monta, sposta, aggiorna).
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";

type Eq = { code: string; slot: string; name: string; cost: number; category: string; description: string | null; sort: number };
type V = { id: string; call_sign: string; status: string; equipment: string[] | null; base_id: string | null; base_name: string | null;
           mine: boolean; boat: boolean; aib: boolean; ordinaria: boolean };

const SLOT_NAMES: Record<string, string> = {
  barella: "Barella", borsoni: "Borsoni", monitor: "Monitor / DAE", massaggiatore: "Massaggiatore",
  collari: "Collari", cucchiaio: "Barella a cucchiaio", ked: "KED", materasso: "Materasso a depressione",
  spinale: "Tavola spinale", spinale_ped: "Tavola spinale pediatrica", steccobende: "Steccobende",
};
const euro = (n: number) => n.toLocaleString("it-IT") + " €";
const btn: CSSProperties = { border: "none", borderRadius: 8, padding: "6px 10px", fontWeight: 700, cursor: "pointer", fontSize: 13 };
const ERR: Record<string, string> = {
  VEHICLE_BUSY: "Il mezzo è in servizio: aspetta che rientri.", NO_STOCK: "Non ce l'hai in magazzino: compralo prima.",
  INSUFFICIENT_FUNDS: "Soldi insufficienti.", ALREADY_INSTALLED: "È già montato su questo mezzo.",
  NO_EQUIPMENT_ON_THIS_VEHICLE: "Questo mezzo non porta presidi.", NOT_INSTALLED: "Non è montato su questo mezzo.",
};
const errText = (m: string) => Object.entries(ERR).find(([k]) => m.includes(k))?.[1] ?? m;

export default function PresidiPanel({ funds, onChange }: { funds: number; onChange?: () => void }) {
  const [eq, setEq] = useState<Eq[]>([]);
  const [veh, setVeh] = useState<V[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [openV, setOpenV] = useState<string | null>(null);
  const [buyQty, setBuyQty] = useState<Record<string, number>>({});
  const [moveTo, setMoveTo] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const [e, f, s] = await Promise.all([
      supabase.from("equipment").select("code,slot,name,cost,category,description,sort").order("slot").order("sort"),
      supabase.from("my_fleet").select("id,call_sign,status,equipment,base_id,base_name,mine,boat,aib,ordinaria").order("call_sign"),
      supabase.from("org_equipment_stock").select("code,qty"),
    ]);
    setEq((e.data as Eq[]) ?? []);
    setVeh(((f.data as V[]) ?? []).filter((v) => v.mine && !v.boat && !v.aib));
    setStock(Object.fromEntries(((s.data as { code: string; qty: number }[]) ?? []).map((r) => [r.code, r.qty])));
  }, []);
  useEffect(() => { load(); }, [load]);

  const byCode = useMemo(() => Object.fromEntries(eq.map((e) => [e.code, e])), [eq]);
  const slots = useMemo(() => [...new Set(eq.map((e) => e.slot))], [eq]);
  const groups = useMemo(() => {
    const g: Record<string, { name: string; list: V[] }> = {};
    for (const v of veh) { const k = v.base_id ?? "-"; (g[k] ??= { name: v.base_name ?? "Senza sede", list: [] }).list.push(v); }
    return Object.entries(g).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [veh]);
  const stockTotal = (Object.values(stock) as number[]).reduce((a, b) => a + b, 0);

  async function run(fn: string, args: Record<string, unknown>, ok: string) {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setMsg({ ok: false, text: errText(error.message) }); return; }
    setMsg({ ok: true, text: ok });
    await load(); onChange?.();
  }

  return (
    <div>
      {msg && <div style={{ padding: 10, borderRadius: 10, marginBottom: 10, background: msg.ok ? "#DCFCE7" : "#FEE2E2", color: msg.ok ? "#166534" : "#991B1B", fontWeight: 600 }}>{msg.text}</div>}
      <p style={{ color: "#555", fontSize: 13, margin: "0 0 10px" }}>
        I presidi tolti da un mezzo vanno in <strong>magazzino</strong> e puoi montarli su un altro. Montando un presidio nuovo al posto di un altro (es. un monitor migliore), quello vecchio torna in magazzino. Il mezzo deve essere in sede per togliere o spostare.
      </p>

      <details style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: 10, marginBottom: 12 }}>
        <summary style={{ fontWeight: 800, cursor: "pointer" }}>📦 Magazzino presidi · {stockTotal} pezzi</summary>
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          {eq.map((e) => (
            <div key={e.code} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderBottom: "1px solid #f1f1f1", paddingBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 700 }}>{e.name}</div>
                <div style={{ fontSize: 12, color: "#666" }}>{SLOT_NAMES[e.slot] ?? e.slot} · {euro(e.cost)}{e.description ? ` · ${e.description}` : ""}</div>
              </div>
              <span style={{ fontWeight: 800, minWidth: 60 }}>in magazzino: {stock[e.code] ?? 0}</span>
              <input type="number" min={1} max={200} value={buyQty[e.code] ?? 1}
                     onChange={(ev) => setBuyQty((q) => ({ ...q, [e.code]: Math.max(1, Math.min(200, Number(ev.target.value) || 1)) }))}
                     style={{ width: 56, padding: 4, borderRadius: 6, border: "1px solid #ccc" }} />
              <button disabled={busy || e.cost * (buyQty[e.code] ?? 1) > funds}
                      onClick={() => run("equip_buy", { p_code: e.code, p_qty: buyQty[e.code] ?? 1 }, `📦 Comprati ${buyQty[e.code] ?? 1} × ${e.name}.`)}
                      style={{ ...btn, background: "#111", color: "#fff", opacity: e.cost * (buyQty[e.code] ?? 1) > funds ? 0.4 : 1 }}>
                Compra · {euro(e.cost * (buyQty[e.code] ?? 1))}
              </button>
            </div>
          ))}
        </div>
      </details>

      {groups.map(([bid, g]) => (
        <div key={bid} style={{ marginBottom: 8 }}>
          <button onClick={() => setOpen((o) => ({ ...o, [bid]: !o[bid] }))}
                  style={{ ...btn, width: "100%", textAlign: "left", background: "#1E3A8A", color: "#fff", padding: "10px 12px", fontSize: 14 }}>
            {open[bid] ? "▾" : "▸"} {g.name} · {g.list.length} mezzi
          </button>
          {open[bid] && g.list.map((v) => {
            const mounted = (v.equipment ?? []).filter((c) => byCode[c]);
            const inBase = v.status === "disponibile" || v.status === "manutenzione";
            return (
              <div key={v.id} style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 10, padding: 10, marginTop: 6 }}>
                <div onClick={() => setOpenV(openV === v.id ? null : v.id)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{openV === v.id ? "▾" : "▸"} {v.call_sign}</strong>
                  <span style={{ fontSize: 12, color: inBase ? "#166534" : "#B45309" }}>{inBase ? "in sede" : "in servizio"} · {mounted.length} presidi</span>
                </div>
                {openV === v.id && (
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {slots.map((slot) => {
                      const cur = mounted.find((c) => byCode[c]?.slot === slot);
                      const alts = eq.filter((e) => e.slot === slot && e.code !== cur);
                      const key = v.id + slot;
                      return (
                        <div key={slot} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13, borderBottom: "1px solid #f4f4f4", paddingBottom: 6 }}>
                          <span style={{ minWidth: 150, color: "#666" }}>{SLOT_NAMES[slot] ?? slot}</span>
                          <span style={{ fontWeight: 700, minWidth: 150 }}>{cur ? byCode[cur].name : "—"}</span>
                          {cur && (
                            <>
                              <button disabled={busy || !inBase} onClick={() => run("equip_remove", { p_vehicle: v.id, p_code: cur }, `↩️ ${byCode[cur].name} tolto da ${v.call_sign}: è in magazzino.`)}
                                      style={{ ...btn, background: "#fff", border: "1px solid #ccc", opacity: inBase ? 1 : 0.4 }}>Togli</button>
                              <select value={moveTo[key] ?? ""} onChange={(ev) => setMoveTo((m) => ({ ...m, [key]: ev.target.value }))}
                                      style={{ padding: 4, borderRadius: 6, border: "1px solid #ccc", maxWidth: 160 }}>
                                <option value="">Sposta su…</option>
                                {veh.filter((x) => x.id !== v.id && !(x.equipment ?? []).includes(cur)).map((x) => <option key={x.id} value={x.id}>{x.call_sign}</option>)}
                              </select>
                              {moveTo[key] && (
                                <button disabled={busy || !inBase} onClick={() => run("equip_move", { p_from: v.id, p_to: moveTo[key], p_code: cur },
                                          `🔀 ${byCode[cur].name} spostato da ${v.call_sign} a ${veh.find((x) => x.id === moveTo[key])?.call_sign}.`)}
                                        style={{ ...btn, background: "#2563EB", color: "#fff" }}>Sposta</button>
                              )}
                            </>
                          )}
                          {alts.map((a) => (
                            <span key={a.code} style={{ display: "inline-flex", gap: 4 }}>
                              {(stock[a.code] ?? 0) > 0 ? (
                                <button disabled={busy} onClick={() => run("equip_mount", { p_vehicle: v.id, p_code: a.code, p_buy: false }, `🔧 ${a.name} montato su ${v.call_sign} (dal magazzino).`)}
                                        style={{ ...btn, background: "#DCFCE7", color: "#166534" }}>
                                  {cur ? "⬆️ " : "+ "}{a.name} (magazzino: {stock[a.code]})
                                </button>
                              ) : (
                                <button disabled={busy || a.cost > funds} onClick={() => run("equip_mount", { p_vehicle: v.id, p_code: a.code, p_buy: true }, `🛒 ${a.name} comprato e montato su ${v.call_sign}.`)}
                                        style={{ ...btn, background: "#F1F5F9", color: "#111", opacity: a.cost > funds ? 0.4 : 1 }}>
                                  {cur ? "⬆️ " : "+ "}{a.name} · {euro(a.cost)}
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
