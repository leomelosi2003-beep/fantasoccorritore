"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 760, margin: "0 auto", padding: 16 };
const card: CSSProperties = { background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", padding: 16, marginBottom: 14 };

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
      <div style={{ background: "linear-gradient(135deg,#166534,#14532D)", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={() => router.push("/")} style={{ padding: "8px 12px", borderRadius: 10, border: "none",
                  background: "rgba(0,0,0,.25)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>← Mappa</button>
          <div style={{ fontWeight: 800, fontSize: 18 }}>📊 Entrate e uscite</div>
        </div>
      </div>

      <div style={wrap}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
          {PERIODS.map((p) => (
            <button key={p.h} onClick={() => { setHours(p.h); setRows(null); }}
                    style={{ padding: "9px 12px", borderRadius: 999, border: "none", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 700,
                             fontSize: 14, background: hours === p.h ? "#111" : "#fff", color: hours === p.h ? "#fff" : "#111",
                             boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>{p.label}</button>
          ))}
        </div>

        <div style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: "#666" }}>Entrate</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#15803D" }}>+{income.toLocaleString("it-IT")} €</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#666" }}>Uscite</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#DC2626" }}>−{expense.toLocaleString("it-IT")} €</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#666" }}>Risultato</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: net >= 0 ? "#15803D" : "#DC2626" }}>
              {net >= 0 ? "📈 Sopra di " : "📉 Sotto di "}{Math.abs(net).toLocaleString("it-IT")} €
            </div>
          </div>
        </div>

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

        {ptax && (
          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>⚖️ Tasse progressive</div>
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
          </div>
        )}

        {tax && (
          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>🏛️ Tassa dell&apos;alleanza</div>
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
          </div>
        )}

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
    </main>
  );
}
