"use client";
// Finestra di acquisto di un presidio: scegli quante unità comprare e su quali ambulanze montarle (per sede).
// Compra con equip_buy (va in magazzino) e poi monta dal magazzino con equip_mount su ogni mezzo scelto.
import { useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import EquipmentIcon from "@/components/EquipmentIcon";

export type SheetEquip = { code: string; slot: string; name: string; cost: number; description: string | null; image_url?: string | null };
export type SheetVehicle = { id: string; call_sign: string; status: string; equipment: string[] | null; base_id: string | null;
  base_name: string | null; maxi?: boolean };

const euro = (n: number) => n.toLocaleString("it-IT") + " €";
const ERR: Record<string, string> = {
  VEHICLE_BUSY: "fuori servizio", ALREADY_INSTALLED: "ce l'ha già", MAXI_SLOTS_FULL: "moduli pieni",
  MAXI_MODULE_ONLY: "non adatto", NO_STOCK: "magazzino vuoto", INSUFFICIENT_FUNDS: "soldi finiti", NO_EQUIPMENT_ON_THIS_VEHICLE: "non adatto",
};
const errShort = (m: string) => Object.entries(ERR).find(([k]) => m.includes(k))?.[1] ?? "errore";
const STATUS: Record<string, [string, string]> = {
  disponibile: ["in sede", "#15803D"], in_servizio: ["in servizio", "#B45309"], manutenzione: ["in officina", "#7C3AED"], fuori_servizio: ["fuori servizio", "#B91C1C"],
};
const pill = (on: boolean): CSSProperties => ({ border: on ? "2px solid #EA6A1F" : "1px solid #CBD5E1", background: on ? "#FFF7ED" : "#fff", color: "#13294B",
  borderRadius: 999, padding: "5px 11px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" });

export default function EquipBuySheet({ item, all, vehicles, stock, funds, onClose, onDone }: {
  item: SheetEquip; all: SheetEquip[]; vehicles: SheetVehicle[]; stock: number; funds: number;
  onClose: () => void; onDone: (text: string, ok: boolean) => void;
}) {
  const isMaxi = item.slot.startsWith("maxi_");
  const fit = useMemo(() => vehicles.filter((v) => !!v.maxi === isMaxi), [vehicles, isMaxi]);
  const sameSlot = useMemo(() => new Map(all.filter((e) => e.slot === item.slot).map((e) => [e.code, e])), [all, item.slot]);
  const has = (v: SheetVehicle) => (v.equipment ?? []).includes(item.code);
  const canPick = (v: SheetVehicle) => !has(v) && v.status !== "fuori_servizio";
  const current = (v: SheetVehicle) => (v.equipment ?? []).map((c) => sameSlot.get(c)).find((e) => e && e.code !== item.code);

  const groups = useMemo(() => {
    const g = new Map<string, { name: string; list: SheetVehicle[] }>();
    for (const v of fit) { const k = v.base_id ?? "-"; if (!g.has(k)) g.set(k, { name: v.base_name ?? "Senza sede", list: [] }); g.get(k)!.list.push(v); }
    return [...g.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [fit]);

  const [sel, setSel] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState(0);            // pezzi in più da tenere in magazzino
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState("");

  const n = sel.size;
  const fromStock = Math.min(stock, n);
  const toBuy = Math.max(0, n - stock) + extra;
  const cost = toBuy * item.cost;
  const left = stock + toBuy - n;
  const tooMuch = cost > funds;

  const toggle = (id: string) => setSel((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });
  const setMany = (list: SheetVehicle[], on: boolean) => setSel((s) => { const x = new Set(s); for (const v of list) if (canPick(v)) { if (on) x.add(v.id); else x.delete(v.id); } return x; });
  const missing = fit.filter((v) => canPick(v) && !current(v));
  const upgradable = fit.filter((v) => canPick(v));

  async function go() {
    setBusy(true);
    if (toBuy > 0) {
      setProg("Acquisto…");
      const { error } = await supabase.rpc("equip_buy", { p_code: item.code, p_qty: toBuy });
      if (error) { setBusy(false); setProg(""); onDone(error.message.includes("INSUFFICIENT_FUNDS") ? "Soldi insufficienti." : error.message, false); return; }
    }
    let ok = 0; const bad: string[] = []; let i = 0;
    for (const id of sel) {
      i++; const v = fit.find((x) => x.id === id); setProg(`Monto su ${v?.call_sign ?? ""} (${i}/${n})…`);
      const { error } = await supabase.rpc("equip_mount", { p_vehicle: id, p_code: item.code, p_buy: false });
      if (error) bad.push(`${v?.call_sign}: ${errShort(error.message)}`); else ok++;
    }
    setBusy(false); setProg("");
    const parts = [];
    if (toBuy) parts.push(`🛒 Comprati ${toBuy} × ${item.name} (${euro(cost)})`);
    if (ok) parts.push(`🔧 montati su ${ok} ${ok === 1 ? "mezzo" : "mezzi"}`);
    if (!n && toBuy) parts.push("messi in magazzino");
    const text = parts.join(", ") + "." + (bad.length ? ` Non montati: ${bad.join("; ")} (restano in magazzino).` : "");
    onDone(text, bad.length === 0);
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 3000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
           style={{ background: "#fff", width: "100%", maxWidth: 640, maxHeight: "92vh", display: "flex", flexDirection: "column", borderRadius: "18px 18px 0 0", boxShadow: "0 -10px 40px rgba(0,0,0,.3)" }}>
        {/* intestazione */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #E2E8F0", background: "linear-gradient(135deg,#13294B,#1D3D6B)", color: "#fff", borderRadius: "18px 18px 0 0" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 4 }}><EquipmentIcon code={item.code} url={item.image_url ?? null} size={52} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{item.name}</div>
            <div style={{ fontSize: 12.5, opacity: 0.85 }}>{euro(item.cost)} l'uno · in magazzino: <b>{stock}</b></div>
            {item.description && <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{item.description}</div>}
          </div>
          <button onClick={onClose} style={{ border: "none", background: "rgba(255,255,255,.15)", color: "#fff", borderRadius: 999, width: 34, height: 34, fontSize: 16, cursor: "pointer" }}>✕</button>
        </div>

        {/* scelta dei mezzi */}
        <div style={{ overflowY: "auto", padding: "12px 16px", flex: 1 }}>
          <div style={{ fontWeight: 800, color: "#13294B", marginBottom: 6 }}>1. Su quali mezzi lo monto?</div>
          {fit.length === 0 ? (
            <div style={{ color: "#64748B", fontSize: 14 }}>{isMaxi ? "Non hai camion o furgoni maxi: comprali nel Garage." : "Non hai mezzi adatti."} Puoi comunque comprarlo e tenerlo in magazzino.</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                <button style={pill(false)} onClick={() => setMany(missing, true)}>✚ A chi non ha {isMaxi ? "moduli di questo tipo" : "questo presidio"} ({missing.length})</button>
                <button style={pill(false)} onClick={() => setMany(upgradable, true)}>⬆️ Tutti ({upgradable.length})</button>
                {n > 0 && <button style={pill(false)} onClick={() => setSel(new Set())}>Nessuno</button>}
              </div>
              {groups.map(([bid, g]) => {
                const pickable = g.list.filter(canPick); const allOn = pickable.length > 0 && pickable.every((v) => sel.has(v.id));
                return (
                  <div key={bid} style={{ border: "1px solid #E2E8F0", borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#EEF3F8", padding: "8px 10px" }}>
                      <span style={{ fontWeight: 800, color: "#13294B", flex: 1 }}>🏠 {g.name}</span>
                      {pickable.length > 0 && <button style={pill(allOn)} onClick={() => setMany(pickable, !allOn)}>{allOn ? "✓ Tutta la sede" : "Tutta la sede"}</button>}
                    </div>
                    {g.list.map((v) => {
                      const cur = current(v); const on = sel.has(v.id); const st = STATUS[v.status] ?? [v.status, "#64748B"];
                      return (
                        <label key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderTop: "1px solid #F1F5F9",
                                                    cursor: canPick(v) ? "pointer" : "default", background: on ? "#FFF7ED" : "#fff", opacity: canPick(v) ? 1 : 0.55 }}>
                          <input type="checkbox" checked={on} disabled={!canPick(v)} onChange={() => toggle(v.id)} style={{ width: 20, height: 20, accentColor: "#EA6A1F" }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 800, color: "#13294B" }}>{v.call_sign} <span style={{ fontSize: 11.5, fontWeight: 700, color: st[1] }}>· {st[0]}</span></div>
                            <div style={{ fontSize: 12, color: "#64748B" }}>
                              {has(v) ? "✅ Ce l'ha già" : cur ? <>Ora ha: <b>{cur.name}</b>{on ? " → torna in magazzino" : ""}</> : "Niente montato in questo posto"}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          <div style={{ fontWeight: 800, color: "#13294B", margin: "14px 0 6px" }}>2. Quanti ne compro?</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button disabled={toBuy <= Math.max(0, n - stock)} onClick={() => setExtra((x) => Math.max(0, x - 1))}
                    style={{ ...pill(false), width: 40, height: 40, fontSize: 20, padding: 0 }}>−</button>
            <div style={{ minWidth: 70, textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#13294B", lineHeight: 1 }}>{toBuy}</div>
              <div style={{ fontSize: 11, color: "#64748B" }}>da comprare</div>
            </div>
            <button onClick={() => setExtra((x) => x + 1)} style={{ ...pill(false), width: 40, height: 40, fontSize: 20, padding: 0 }}>+</button>
            {[5, 10].map((k) => <button key={k} style={pill(false)} onClick={() => setExtra((x) => x + k)}>+{k}</button>)}
          </div>
          <div style={{ fontSize: 12.5, color: "#475569", marginTop: 8, lineHeight: 1.5 }}>
            {n > 0 && <>Monto su <b>{n}</b> {n === 1 ? "mezzo" : "mezzi"}{fromStock > 0 ? <> ({fromStock} presi dal magazzino)</> : null}. </>}
            {left > 0 && <>In magazzino ne resteranno <b>{left}</b>. </>}
            {n === 0 && toBuy === 0 && "Spunta i mezzi oppure usa + per comprarne da tenere in magazzino."}
          </div>
        </div>

        {/* totale e conferma */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: "#64748B" }}>Totale</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: tooMuch ? "#B91C1C" : "#13294B" }}>{euro(cost)}</div>
            {tooMuch && <div style={{ fontSize: 11.5, color: "#B91C1C" }}>Hai {euro(funds)}</div>}
          </div>
          <button disabled={busy || tooMuch || (n === 0 && toBuy === 0)} onClick={go}
                  style={{ border: "none", borderRadius: 12, padding: "12px 18px", fontWeight: 800, fontSize: 15, color: "#fff", cursor: "pointer",
                           background: "linear-gradient(135deg,#F59E0B,#EA6A1F)", opacity: busy || tooMuch || (n === 0 && toBuy === 0) ? 0.45 : 1 }}>
            {busy ? prog || "…" : n > 0 && toBuy > 0 ? "Compra e monta" : n > 0 ? "Monta dal magazzino" : "Compra"}
          </button>
        </div>
      </div>
    </div>
  );
}
