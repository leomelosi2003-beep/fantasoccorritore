"use client";
// Presidi: magazzino dell'associazione + presidi montati su ogni mezzo (togli, monta, sposta, aggiorna).
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import EquipmentIcon from "@/components/EquipmentIcon";
import EquipBuySheet from "@/components/EquipBuySheet";

type Eq = { code: string; slot: string; name: string; cost: number; category: string; description: string | null; sort: number; image_url: string | null };
type V = { id: string; call_sign: string; status: string; equipment: string[] | null; base_id: string | null; base_name: string | null;
           mine: boolean; boat: boolean; aib: boolean; ordinaria: boolean; maxi?: boolean };

const SLOT_NAMES: Record<string, string> = {
  barella: "Barella", borsoni: "Borsoni", monitor: "Monitor / DAE", massaggiatore: "Massaggiatore",
  collari: "Collari", cucchiaio: "Barella a cucchiaio", ked: "KED", materasso: "Materasso a depressione",
  spinale: "Tavola spinale", spinale_ped: "Tavola spinale pediatrica", steccobende: "Steccobende",
  maxi_pma: "🆘 Modulo PMA", maxi_logistica: "🆘 Modulo logistica", maxi_cinofila: "🆘 Modulo ricerca/cinofila", maxi_droni: "🆘 Modulo droni", maxi_pompa: "🆘 Modulo pompa idrovora",
  maxi_fluviale: "🆘 Modulo soccorso fluviale", maxi_taglio: "🆘 Modulo taglio", maxi_radio: "🆘 Modulo sala radio",
  maxi_accoglienza: "🆘 Modulo accoglienza", maxi_cucina: "🆘 Modulo cucina da campo", maxi_nbcr: "🆘 Modulo NBCR",
};
const euro = (n: number) => n.toLocaleString("it-IT") + " €";
const CATS: [string, string][] = [["monitor", "❤️ Monitor e DAE"], ["barella", "🛏️ Barelle"], ["massaggiatore", "💪 Massaggiatori"],
  ["immobilizzazione", "🦴 Immobilizzazione"], ["borsoni", "🎒 Borsoni"], ["maxi", "🆘 Moduli maxi"]];
const btn: CSSProperties = { border: "none", borderRadius: 8, padding: "6px 10px", fontWeight: 700, cursor: "pointer", fontSize: 13 };
const ERR: Record<string, string> = {
  VEHICLE_BUSY: "Il mezzo è in servizio: aspetta che rientri.", NO_STOCK: "Non ce l'hai in magazzino: compralo prima.",
  INSUFFICIENT_FUNDS: "Soldi insufficienti.", ALREADY_INSTALLED: "È già montato su questo mezzo.",
  NO_EQUIPMENT_ON_THIS_VEHICLE: "Questo mezzo non porta questi presidi.",
  MAXI_MODULE_ONLY: "I moduli maxi vanno solo sul camion o sul furgone per le maxi emergenze.",
  MAXI_SLOTS_FULL: "Il mezzo è pieno: il camion porta 3 moduli, il furgone 2. Togline uno prima.", NOT_INSTALLED: "Non è montato su questo mezzo.",
};
const errText = (m: string) => Object.entries(ERR).find(([k]) => m.includes(k))?.[1] ?? m;

export default function PresidiPanel({ funds, onChange }: { funds: number; onChange?: () => void }) {
  const [eq, setEq] = useState<Eq[]>([]);
  const [veh, setVeh] = useState<V[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [openV, setOpenV] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Eq | null>(null);
  const [cat, setCat] = useState<string>("tutti");
  const [moveTo, setMoveTo] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const [e, f, s] = await Promise.all([
      supabase.from("equipment").select("code,slot,name,cost,category,description,sort,image_url").order("slot").order("sort"),
      supabase.from("my_fleet").select("id,call_sign,status,equipment,base_id,base_name,mine,boat,aib,ordinaria,maxi").order("call_sign"),
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

      {/* catalogo: tocca un presidio per comprarlo e montarlo su più mezzi insieme */}
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontWeight: 800, color: "#13294B", flex: 1 }}>🛒 Compra e monta · 📦 in magazzino: {stockTotal} pezzi</span>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 8 }}>
          {[["tutti", "Tutti"], ...CATS].map(([k, l]) => (
            <button key={k} onClick={() => setCat(k)}
                    style={{ ...btn, whiteSpace: "nowrap", borderRadius: 999, border: cat === k ? "2px solid #EA6A1F" : "1px solid #CBD5E1", background: cat === k ? "#FFF7ED" : "#fff", color: "#13294B" }}>{l}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {eq.filter((e) => cat === "tutti" || e.category === cat).map((e) => {
            const fit = veh.filter((v) => !!v.maxi === e.slot.startsWith("maxi_")); const on = fit.filter((v) => (v.equipment ?? []).includes(e.code)).length; const st = stock[e.code] ?? 0;
            return (
              <button key={e.code} onClick={() => { setMsg(null); setSheet(e); }}
                      style={{ position: "relative", border: "1px solid #E2E8F0", borderRadius: 12, background: "#fff", padding: 10, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, textAlign: "center" }}>
                {st > 0 && <span style={{ position: "absolute", top: 6, right: 6, background: "#13294B", color: "#fff", borderRadius: 999, padding: "1px 7px", fontSize: 11, fontWeight: 800 }}>📦 {st}</span>}
                <EquipmentIcon code={e.code} url={e.image_url} size={52} />
                <div style={{ fontWeight: 800, fontSize: 13, color: "#13294B", lineHeight: 1.2 }}>{e.name}</div>
                <div style={{ fontSize: 11, color: "#64748B" }}>{SLOT_NAMES[e.slot] ?? e.slot}</div>
                {fit.length > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: on ? "#15803D" : "#94A3B8" }}>su {on}/{fit.length} mezzi</div>}
                <div style={{ marginTop: 3, width: "100%", borderRadius: 8, padding: "6px 0", fontWeight: 800, fontSize: 12.5, color: "#fff", background: "linear-gradient(135deg,#F59E0B,#EA6A1F)" }}>{euro(e.cost)}</div>
              </button>
            );
          })}
        </div>
      </div>
      {sheet && (
        <EquipBuySheet item={sheet} all={eq} vehicles={veh} stock={stock[sheet.code] ?? 0} funds={funds}
                       onClose={() => setSheet(null)}
                       onDone={async (text, ok) => { setSheet(null); setMsg({ ok, text: ok ? text : errText(text) }); await load(); onChange?.(); }} />
      )}

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
                    {slots.filter((slot) => slot.startsWith("maxi_") === !!v.maxi).map((slot) => {
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
                                {veh.filter((x) => x.id !== v.id && !!x.maxi === !!v.maxi && !(x.equipment ?? []).includes(cur)).map((x) => <option key={x.id} value={x.id}>{x.call_sign}</option>)}
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
