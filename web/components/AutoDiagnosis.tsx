"use client";
// Pagina Automatico: perché alcuni mezzi delle sedi in automatico restano fermi, con le soluzioni a un tocco.
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { gameConfirm } from "@/lib/confirm";

type Diag = { bases: number; reserve: number; codes: string[]; enabled: boolean; idle: number; idle_special: number; idle_ordinarie: number;
  idle_transfer: number; idle_blocked: number; drivers_free: number; drivers_total: number; rescuers_free: number; trainable: number;
  vehicles_total: number; course_cost: number };

export default function AutoDiagnosis({ reserve, codes, onReserve, onCodes }: {
  reserve: number; codes: string[]; onReserve: (n: number) => void; onCodes: (c: string[]) => void;
}) {
  const router = useRouter();
  const [d, setD] = useState<Diag | null>(null);
  const [n, setN] = useState(10);
  const [trained, setTrained] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => {
    supabase.rpc("auto_diagnosis").then(({ data }) => setD(data as Diag));
    supabase.rpc("trained_drivers_count").then(({ data }) => setTrained((data as number) ?? 0));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load, reserve, codes.join()]);
  if (!d) return null;

  const usable = Math.max(0, d.idle - d.idle_special - d.idle_blocked - (codes.includes("ordinari") ? 0 : d.idle_ordinarie));
  const reserved = Math.min(usable, reserve * d.bases);
  const noDriver = Math.max(0, usable - reserved - d.drivers_free);
  const missingDrivers = Math.max(0, d.vehicles_total - d.drivers_total);
  const euro = (x: number) => x.toLocaleString("it-IT") + " €";

  const rows: { icon: string; n: number; text: string; fix?: ReactNode }[] = [
    { icon: "🚗", n: noDriver, text: `ferme perché non ci sono autisti liberi (liberi adesso: ${d.drivers_free} su ${d.drivers_total})`,
      fix: <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {d.trainable > 0 && <button style={btn("#0F766E")} onClick={async () => {
          const k = Math.min(n, d.trainable);
          if (!(await gameConfirm(`Corso autisti\nForma ${k} soccorritori base come autisti per ${euro(k * d.course_cost)}.\nDa subito guidano le ambulanze (anche in automatico). Puoi sempre farli tornare soccorritori.`))) return;
          const { data, error } = await supabase.rpc("train_drivers", { p_n: k });
          setMsg(error ? { ok: false, text: error.message.includes("INSUFFICIENT") ? "Non hai abbastanza soldi." : error.message } : { ok: true, text: `🎓 ${data} nuovi autisti formati.` });
          load();
        }}>🎓 Forma {Math.min(n, d.trainable)} autisti · {euro(Math.min(n, d.trainable) * d.course_cost)}</button>}
        {d.trainable > 0 && <select value={n} onChange={(e) => setN(Number(e.target.value))} style={{ borderRadius: 8, padding: "4px 6px" }}>
          {[5, 10, 20, 30, 50].filter((x) => x <= Math.max(5, d.trainable)).map((x) => <option key={x} value={x}>{x}</option>)}
        </select>}
        <button style={btn("#EA6A1F")} onClick={() => router.push("/squadra")}>🃏 Pacchetto autisti</button>
      </span> },
    { icon: "🅿️", n: reserved, text: `tenute di riserva (${reserve} per sede × ${d.bases} sedi)`,
      fix: reserve > 0 ? <button style={btn("#475569")} onClick={() => onReserve(0)}>Nessuna riserva</button> : undefined },
    { icon: "🚐", n: codes.includes("ordinari") ? 0 : d.idle_ordinarie, text: "ordinarie: l'automatico non fa i servizi ordinari",
      fix: !codes.includes("ordinari") && d.idle_ordinarie > 0 ? <button style={btn("#3B82F6")} onClick={() => onCodes([...codes, "ordinari"])}>Attiva gli ordinari</button> : undefined },
    { icon: "🔧", n: d.idle_blocked, text: "bloccate: usura alta, guasto, revisione scaduta o senza gasolio",
      fix: d.idle_blocked > 0 ? <button style={btn("#7C3AED")} onClick={() => router.push("/officina")}>Vai in Officina</button> : undefined },
    { icon: "🔥", n: d.idle_special, text: "speciali (antincendio, maxi, barche): si mandano solo a mano" },
  ];
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: noDriver > 0 ? "2px solid #F59E0B" : "1px solid #E2E8F0" }}>
      <div style={{ fontWeight: 900, fontSize: 16, color: "#13294B" }}>🩺 Perché alcuni mezzi restano in sede</div>
      <div style={{ fontSize: 13, color: "#475569", margin: "2px 0 10px" }}>Nelle sedi in automatico adesso ci sono <b>{d.idle}</b> mezzi fermi. Ecco perché:</div>
      {rows.filter((r) => r.n > 0).map((r) => (
        <div key={r.icon} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px solid #F1F5F9", flexWrap: "wrap" }}>
          <div style={{ fontSize: 22, width: 30, textAlign: "center" }}>{r.icon}</div>
          <div style={{ flex: 1, minWidth: 180 }}><b style={{ fontSize: 18 }}>{r.n}</b> <span style={{ fontSize: 13.5 }}>{r.text}</span></div>
          {r.fix}
        </div>
      ))}
      {rows.every((r) => r.n === 0) && <div style={{ color: "#15803D", fontWeight: 700 }}>✅ Tutti i mezzi utilizzabili stanno lavorando (o stanno per partire).</div>}
      {missingDrivers > 0 && (
        <div style={{ fontSize: 12.5, color: "#92400E", background: "#FEF3C7", borderRadius: 10, padding: "8px 10px", marginTop: 8 }}>
          Hai {d.vehicles_total} mezzi ma solo {d.drivers_total} autisti: anche con tutti liberi, {missingDrivers} mezzi non potranno mai partire insieme.
          {d.trainable > 0 && ` Hai ${d.trainable} soccorritori base che puoi formare come autisti.`}
        </div>
      )}
      {trained > 0 && (
        <div style={{ fontSize: 12.5, color: "#475569", marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          🎓 Soccorritori formati come autisti: <b>{trained}</b>
          <button style={{ ...btn("#fff"), color: "#475569", border: "1px solid #CBD5E1" }} onClick={async () => {
            if (!(await gameConfirm("Far tornare soccorritori gli autisti formati?\nQuelli in servizio restano autisti fino al rientro."))) return;
            const { data } = await supabase.rpc("untrain_drivers_all"); setMsg({ ok: true, text: `${data ?? 0} autisti formati sono tornati soccorritori.` }); load();
          }}>Falli tornare soccorritori</button>
        </div>
      )}
      {msg && <div style={{ fontSize: 13, marginTop: 8, color: msg.ok ? "#15803D" : "#B91C1C" }}>{msg.text}</div>}
    </div>
  );
}
const btn = (bg: string): CSSProperties => ({ border: "none", borderRadius: 999, padding: "6px 12px", fontWeight: 800, fontSize: 12.5, background: bg, color: "#fff", cursor: "pointer" });
