"use client";
// Personalizzazione di una sede: garage, migliorie a livelli e colore.
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase, friendlyError } from "@/lib/supabase";
import { gameConfirm } from "@/lib/confirm";

type Cat = { kind: string; level: number; name: string; icon: string; cost: number; income_h: number; effect: string };
type B = { id: string; name: string; level: number; vehicle_capacity: number; color: string | null };

const KINDS: [string, string, string][] = [
  ["solare", "Pannelli solari", "Producono energia: entrata fissa ogni ora."],
  ["caldaia", "Caldaia", "Risparmio ogni ora e volontari più riposati."],
  ["volontari", "Area volontari", "I volontari si riposano prima e rendono un po' di più."],
  ["officina", "Officina interna", "I mezzi di questa sede si usurano meno."],
  ["radio", "Centrale radio", "I servizi fatti dai mezzi di questa sede pagano di più."],
  ["bar", "Bar sociale", "Bar, eventi e raccolta fondi: entrata fissa ogni ora."],
];
const COLORS: [string, string, boolean][] = [
  ["#FFFFFF", "Bianco", true], ["#FEF3C7", "Crema", true], ["#FDE68A", "Giallo", true], ["#E0F2FE", "Azzurro", true],
  ["#DCFCE7", "Verde chiaro", true], ["#F97316", "Arancione", false], ["#DC2626", "Rosso", false], ["#16A34A", "Verde", false],
  ["#1E3A8A", "Blu", false], ["#374151", "Grigio scuro", false],
];
const UPGRADE: Record<number, number> = { 1: 8000, 2: 14000, 3: 22000, 4: 32000, 5: 45000, 6: 60000, 7: 80000, 8: 100000, 9: 125000 };
const euro = (n: number) => n.toLocaleString("it-IT") + " €";
const btn: CSSProperties = { border: "none", borderRadius: 8, padding: "7px 10px", fontWeight: 700, cursor: "pointer", fontSize: 13, color: "#fff", background: "#111" };
const ERR = (m: string) => m.includes("INSUFFICIENT_FUNDS") ? "Non hai abbastanza soldi." : m.includes("MAX_LEVEL") ? "È già al livello massimo." : friendlyError(m);

export default function BasePerksPanel({ base, funds, onChange }: { base: B; funds: number; onChange: () => void }) {
  const [cat, setCat] = useState<Cat[]>([]);
  const [lv, setLv] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([
      supabase.from("base_perk_catalog").select("*").order("kind").order("level"),
      supabase.from("base_perks").select("kind,level").eq("base_id", base.id),
    ]);
    setCat((c.data as Cat[]) ?? []);
    setLv(Object.fromEntries(((p.data as { kind: string; level: number }[]) ?? []).map((r) => [r.kind, r.level])));
  }, [base.id]);
  useEffect(() => { load(); }, [load]);

  const income = useMemo(() => cat.filter((c) => (lv[c.kind] ?? 0) === c.level).reduce((t, c) => t + c.income_h, 0)
    + (COLORS.find(([c]) => c === base.color)?.[2] ? 600 : 0), [cat, lv, base.color]);

  async function run(fn: string, args: Record<string, unknown>, confirm: string, ok: string) {
    if (!(await gameConfirm(confirm))) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setMsg({ ok: false, text: ERR(error.message) }); return; }
    setMsg({ ok: true, text: ok });
    await load(); onChange();
  }

  const maxLevel = 10;
  return (
    <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: 12, marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <strong>⚙️ Personalizza {base.name}</strong>
        <span style={{ fontSize: 13, fontWeight: 800, color: income ? "#15803D" : "#64748B" }}>💶 Entrate della sede: {euro(income)}/ora</span>
      </div>
      {msg && <div style={{ padding: 8, borderRadius: 8, marginBottom: 8, fontWeight: 600, background: msg.ok ? "#DCFCE7" : "#FEE2E2", color: msg.ok ? "#166534" : "#991B1B" }}>{msg.text}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
        {/* Garage: livelli già esistenti */}
        <div style={{ background: "#fff", borderRadius: 10, padding: 10, border: "1px solid #eee" }}>
          <div style={{ fontWeight: 800 }}>🅿️ Garage · {base.vehicle_capacity} posti</div>
          <div style={{ fontSize: 12, color: "#666", margin: "2px 0 6px" }}>Livello {base.level}/{maxLevel}: ogni livello aggiunge un posto per le ambulanze.</div>
          {base.level < maxLevel ? (
            <button disabled={busy || funds < UPGRADE[base.level]}
                    onClick={() => run("upgrade_base", { p_base: base.id }, `Ampliare il garage di ${base.name} a ${base.vehicle_capacity + 1} posti per ${euro(UPGRADE[base.level])}?`, `🅿️ Garage ampliato: ${base.vehicle_capacity + 1} posti.`)}
                    style={{ ...btn, background: "#15803D", opacity: funds < UPGRADE[base.level] ? 0.4 : 1 }}>+1 posto · {euro(UPGRADE[base.level])}</button>
          ) : <span style={{ fontSize: 12, fontWeight: 700, color: "#B45309" }}>⭐ Garage al massimo</span>}
        </div>

        {KINDS.map(([kind, label, info]) => {
          const cur = lv[kind] ?? 0;
          const now = cat.find((c) => c.kind === kind && c.level === cur);
          const next = cat.find((c) => c.kind === kind && c.level === cur + 1);
          const icon = cat.find((c) => c.kind === kind)?.icon ?? "⚙️";
          return (
            <div key={kind} style={{ background: "#fff", borderRadius: 10, padding: 10, border: "1px solid #eee" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                <span style={{ fontWeight: 800 }}>{icon} {label}</span>
                <span style={{ letterSpacing: 2, color: "#F59E0B" }}>{"●".repeat(cur)}<span style={{ color: "#CBD5E1" }}>{"●".repeat(3 - cur)}</span></span>
              </div>
              <div style={{ fontSize: 12, color: "#666", margin: "2px 0 6px" }}>{now ? <>Ora: <strong>{now.name}</strong> · {now.effect}</> : info}</div>
              {next ? (
                <button disabled={busy || funds < next.cost}
                        onClick={() => run("buy_base_perk", { p_base: base.id, p_kind: kind }, `${next.icon} ${next.name} per ${base.name}?\n\n${next.effect}\nCosto ${euro(next.cost)}.`, `${next.icon} ${next.name} installato a ${base.name}.`)}
                        style={{ ...btn, opacity: funds < next.cost ? 0.4 : 1 }}>
                  {cur ? "⬆️ " : "+ "}{next.name} · {euro(next.cost)}
                </button>
              ) : <span style={{ fontSize: 12, fontWeight: 700, color: "#B45309" }}>⭐ Livello massimo</span>}
              {next && <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>{next.effect}</div>}
            </div>
          );
        })}
      </div>

      <div style={{ background: "#fff", borderRadius: 10, padding: 10, border: "1px solid #eee", marginTop: 8 }}>
        <div style={{ fontWeight: 800 }}>🎨 Tinteggiatura · 25.000 €</div>
        <div style={{ fontSize: 12, color: "#666", margin: "2px 0 6px" }}>Il colore si vede sulla mappa. I colori chiari riflettono il sole: +600 €/ora di risparmio.</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {COLORS.map(([c, n, light]) => (
            <button key={c} title={`${n}${light ? " · risparmio +600 €/ora" : ""}`} disabled={busy || base.color === c || funds < 25000}
                    onClick={() => run("set_base_color", { p_base: base.id, p_color: c }, `Tinteggiare ${base.name} di ${n.toLowerCase()} per 25.000 €?${light ? "\n\nColore chiaro: +600 €/ora di risparmio." : ""}`, `🎨 ${base.name} ora è ${n.toLowerCase()}.`)}
                    style={{ width: 34, height: 34, borderRadius: 8, background: c, cursor: "pointer",
                             border: base.color === c ? "3px solid #111" : "1px solid #CBD5E1", position: "relative" }}>
              {light && <span style={{ position: "absolute", right: -4, top: -6, fontSize: 11 }}>☀️</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
