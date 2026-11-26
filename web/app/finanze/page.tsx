"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";

type Row = { reason: string; income: number; expense: number; moves: number };
type Move = { id: number; amount: number; balance: number; reason: string; created_at: string };
type Tax = { tax_hour: number; wealth: number; members: number };
type PTax = { wealth: number; funds: number; wealth_tax_hour: number; income_rate: number; fund: number };

const PERIODS = [
  { h: 1, label: "Ultima ora" },
  { h: 24, label: "Oggi (24 ore)" },
  { h: 168, label: "7 giorni" },
  { h: 720, label: "30 giorni" },
];
const ICON: Record<string, string> = {
  "Servizi": "🚑", "Acquisto ambulanze": "🛒", "Presidi": "🧰", "Potenziamenti": "⚡", "Officina": "🔧", "Officina (automatica)": "🔧",
  "Sedi": "🏠", "Gasolio": "⛽", "Elettricità": "🔌", "Volontari": "👥", "Ricarica volontari": "🔋", "Ricarica volontari (automatica)": "🔋",
  "Formazione": "🎓", "Modalità automatica": "🤖", "Alleanza": "🤝", "Tassa alleanza": "🏛️", "Beneficenza alleanza": "💝", "Tassa patrimoniale": "⚖️", "Tassa progressiva sui servizi": "⚖️", "Fondo di solidarietà": "🤲", "Altro": "💶",
};

const euro = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("it-IT")} €`;
const shell: CSSProperties = { minHeight: "100vh", background: "#EEF3FA", fontFamily: "Inter, system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 760, margin: "0 auto", padding: 16 };
const card: CSSProperties = { background: "#fff", borderRadius: 20, boxShadow: "0 1px 2px rgba(15,23,42,.05), 0 10px 28px rgba(15,23,42,.08)", border: "1px solid #E9EEF6", padding: 16, marginBottom: 14 };

export default function Finanze() {
  const router = useRouter();
  const [hours, setHours] = useState(24);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [tax, setTax] = useState<Tax | null>(null);
  const [ptax, setPtax] = useState<PTax | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const [s, m, t, p] = await Promise.all([
        supabase.rpc("my_ledger_summary", { p_hours: hours }),
        supabase.from("org_ledger").select("id,amount,balance,reason,created_at").order("id", { ascending: false }).limit(40),
        supabase.rpc("alliance_tax_preview"),
        supabase.rpc("my_tax_preview"),
      ]);
      if (!alive) return;
      setRows((s.data as Row[]) ?? []);
      setMoves((m.data as Move[]) ?? []);
      setTax(((t.data as Tax[]) ?? [])[0] ?? null);
      setPtax(((p.data as PTax[]) ?? [])[0] ?? null);
    };
    load();
    const id = setInterval(load, 15_000);
    return () => { alive = false; clearInterval(id); };
  }, [hours, router]);

  const income = (rows ?? []).reduce((t, r) => t + Number(r.income), 0);
  const expense = (rows ?? []).reduce((t, r) => t + Number(r.expense), 0);
  const net = income - expense;
  const max = Math.max(1, ...(rows ?? []).map((r) => Math.max(Number(r.income), Number(r.expense))));

  return (
    <main style={shell}>
      <PageHeader icon="📊" title="Entrate e uscite" tone="green"
        sub="Da dove arrivano e dove vanno i tuoi soldi"
        links={[{ href: "/fatturato", label: "🏢 Fatturato sedi" }, { href: "/statistiche", label: "📈 Statistiche" }]}
        tabs={PERIODS.map((p) => ({ key: String(p.h), label: p.label }))} tab={String(hours)}
        onTab={(k) => { setHours(Number(k)); setRows(null); }} />

      <div style={wrap}>


        <div className="fs-kpis">
          <div className="fs-kpi" style={{ ["--k" as string]: "#16A34A" }}><span>💚 Entrate</span><b style={{ color: "#15803D" }}>+{income.toLocaleString("it-IT")} €</b></div>
          <div className="fs-kpi" style={{ ["--k" as string]: "#DC2626" }}><span>❤️ Uscite</span><b style={{ color: "#DC2626" }}>−{expense.toLocaleString("it-IT")} €</b></div>
          <div className="fs-kpi" style={{ ["--k" as string]: net >= 0 ? "#16A34A" : "#DC2626" }}><span>{net >= 0 ? "📈 Sei sopra di" : "📉 Sei sotto di"}</span>
            <b style={{ color: net >= 0 ? "#15803D" : "#DC2626" }}>{Math.abs(net).toLocaleString("it-IT")} €</b></div>
        </div>
        <div className="fs-2col">

        <div style={card}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Per voce</div>
          {rows === null && <div style={{ color: "#888", fontSize: 14 }}>Caricamento…</div>}
          {rows && rows.length === 0 && <div style={{ color: "#888", fontSize: 14 }}>Nessun movimento in questo periodo (il registro parte da oggi).</div>}
          {rows?.map((r) => (
            <div key={r.reason} style={{ padding: "8px 0", borderTop: "1px solid #f0f0f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
                <span><span style={{ marginRight: 6 }}>{ICON[r.reason] ?? "💶"}</span><strong>{r.reason}</strong>
                  <span style={{ color: "#888", fontSize: 12 }}> · {r.moves} movimenti</span></span>
                <span style={{ fontWeight: 800, whiteSpace: "nowrap", color: r.income - r.expense >= 0 ? "#15803D" : "#DC2626" }}>
                  {euro(Number(r.income) - Number(r.expense))}
                </span>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                {Number(r.income) > 0 && <div style={{ height: 6, borderRadius: 3, background: "#16A34A", width: `${(Number(r.income) / max) * 100}%` }} />}
                {Number(r.expense) > 0 && <div style={{ height: 6, borderRadius: 3, background: "#DC2626", width: `${(Number(r.expense) / max) * 100}%` }} />}
              </div>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Ultimi movimenti</div>
          {moves.length === 0 && <div style={{ color: "#888", fontSize: 14 }}>Ancora nessun movimento.</div>}
          {moves.map((m, i) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: i ? "1px solid #f0f0f0" : "none", fontSize: 13 }}>
              <span>{ICON[m.reason] ?? "💶"}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                {m.reason}
                <span style={{ color: "#888" }}> · {new Date(m.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              </span>
              <strong style={{ color: m.amount >= 0 ? "#15803D" : "#DC2626", whiteSpace: "nowrap" }}>{m.amount >= 0 ? "+" : ""}{euro(Number(m.amount))}</strong>
              <span style={{ color: "#888", whiteSpace: "nowrap", minWidth: 90, textAlign: "right" }}>{Number(m.balance).toLocaleString("it-IT")} €</span>
            </div>
          ))}
        </div>
        </div>
        {ptax && (
          <details style={card}>
            <summary style={{ fontWeight: 800, cursor: "pointer" }}>⚖️ Tasse progressive: quanto paghi</summary>
            <div style={{ fontSize: 13, color: "#555" }}>
              Per tenere il gioco equilibrato chi ha più soldi paga di più. Tutto finisce nel <strong>fondo di solidarietà</strong>,
              che ogni ora viene diviso tra le associazioni piccole (patrimonio sotto i 2 milioni) attive negli ultimi 3 giorni.
            </div>
            <table style={{ width: "100%", fontSize: 13, margin: "8px 0", borderCollapse: "collapse" }}>
              <thead><tr style={{ textAlign: "left", color: "#666" }}><th>Soldi in cassa / patrimonio</th><th>Sui servizi</th><th>Patrimoniale all&apos;ora</th></tr></thead>
              <tbody>
                <tr><td>fino a 1 milione</td><td>0%</td><td>0%</td></tr>
                <tr><td>1 – 5 milioni</td><td>15%</td><td>0,2% della parte oltre 1 mln</td></tr>
                <tr><td>5 – 20 milioni</td><td>35%</td><td>0,5% della parte oltre 5 mln</td></tr>
                <tr><td>oltre 20 milioni</td><td>55%</td><td>1% della parte oltre 20 mln</td></tr>
              </tbody>
            </table>
            <div style={{ fontSize: 14 }}>
              Patrimonio: <strong>{Number(ptax.wealth).toLocaleString("it-IT")} €</strong> · sui servizi trattieni il{" "}
              <strong style={{ color: Number(ptax.income_rate) > 0 ? "#DC2626" : "#166534" }}>{Math.round(Number(ptax.income_rate) * 100)}%</strong>
              {" "}· patrimoniale <strong style={{ color: Number(ptax.wealth_tax_hour) > 0 ? "#DC2626" : "#166534" }}>{Number(ptax.wealth_tax_hour).toLocaleString("it-IT")} € all&apos;ora</strong>
              <br /><span style={{ color: "#666" }}>Nel fondo di solidarietà ora: {Number(ptax.fund).toLocaleString("it-IT")} €</span>
            </div>
          </details>
        )}

        {tax && (
          <details style={card}>
            <summary style={{ fontWeight: 800, cursor: "pointer" }}>🏛️ Tassa dell&apos;alleanza</summary>
            <div style={{ fontSize: 13, color: "#555" }}>
              Le associazioni con un patrimonio sopra 1 milione pagano ogni ora lo 0,1% della parte che supera il milione.
              I soldi vanno in beneficenza, divisi in parti uguali tra gli altri membri dell&apos;alleanza.
            </div>
            <div style={{ marginTop: 8, fontSize: 14 }}>
              Patrimonio: <strong>{Number(tax.wealth).toLocaleString("it-IT")} €</strong> ·{" "}
              {tax.members === 0 ? "non sei in un'alleanza con altri membri: niente tassa"
                : Number(tax.tax_hour) > 0 ? <>paghi circa <strong style={{ color: "#DC2626" }}>{Number(tax.tax_hour).toLocaleString("it-IT")} € all&apos;ora</strong> a {tax.members} {tax.members === 1 ? "associazione" : "associazioni"}</>
                : "sotto il milione: niente tassa"}
            </div>
          </details>
        )}

      </div>
    </main>
  );
}
