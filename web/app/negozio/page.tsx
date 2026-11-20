"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase, friendlyError, type Organization } from "@/lib/supabase";
import FactionEmblem from "@/components/FactionEmblem";
import EquipmentIcon from "@/components/EquipmentIcon";
import EquipBuySheet, { type SheetVehicle } from "@/components/EquipBuySheet";

type Equip = { code: string; slot: string; category: string; name: string; cost: number; provides: string[];
  description: string | null; image_url: string | null; sort: number };

const CATEGORIES: { slot: string; title: string }[] = [
  { slot: "monitor", title: "Defibrillatori e cardiomonitor" },
  { slot: "barella", title: "Barelle" },
  { slot: "massaggiatore", title: "Massaggiatori automatici" },
  { slot: "immobilizzazione", title: "Immobilizzazione" },
  { slot: "borsoni", title: "Borsoni e zaini" },
  { slot: "maxi", title: "🆘 Moduli per le maxi emergenze (solo camion e furgone maxi)" },
];
const isMaxiEq = (e: Equip) => e.slot.startsWith("maxi_");
const euro = (n: number) => n.toLocaleString("it-IT") + " €";

const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 980, margin: "0 auto", padding: 16 };
const box: CSSProperties = { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)" };
const btn: CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "none", background: "#111", color: "#fff",
  fontWeight: 600, cursor: "pointer", fontSize: 15 };

export default function Negozio() {
  const router = useRouter();
  const [org, setOrg] = useState<Organization | null>(null);
  const [equip, setEquip] = useState<Equip[]>([]);
  const [vehicles, setVehicles] = useState<SheetVehicle[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Equip | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); return; }
    const { data: o } = await supabase.from("organizations").select("id,name,type,funds,reputation,logo_url")
      .eq("owner_id", session.user.id).maybeSingle();
    if (!o) { router.replace("/onboarding"); return; }
    setOrg(o as Organization);
    const [e, f, st] = await Promise.all([
      supabase.from("equipment").select("*").order("sort"),
      supabase.from("my_fleet").select("id,call_sign,status,equipment,base_id,base_name,mine,boat,aib,maxi,banned_equipment").order("call_sign"),
      supabase.from("org_equipment_stock").select("code,qty"),
    ]);
    setEquip((e.data as Equip[]) ?? []);
    setVehicles(((f.data as (SheetVehicle & { mine: boolean; boat: boolean; aib: boolean })[]) ?? []).filter((v) => v.mine && !v.boat && !v.aib));
    setStock(Object.fromEntries(((st.data as { code: string; qty: number }[]) ?? []).map((r) => [r.code, r.qty])));
  }, [router]);

  useEffect(() => { load(); }, [load]);

  if (!org) return <main style={shell} />;
  const fitting = (e: Equip) => vehicles.filter((v) => !!v.maxi === isMaxiEq(e));

  return (
    <main style={shell}>
      <div style={{ background: "#111", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={() => router.push("/")} style={{ ...btn, background: "#333", padding: "8px 12px" }}>← Mappa</button>
          <FactionEmblem type={org.type} size={32} logo={org.logo_url} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>Negozio presidi</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>{euro(org.funds)}</div>
          </div>
          <button onClick={() => router.push("/officina?tab=presidi")} style={{ ...btn, background: "#F97316", padding: "8px 12px" }}>🧰 I miei presidi</button>
        </div>
      </div>

      <div style={wrap}>
        {msg && (
          <div style={{ ...box, marginBottom: 12, background: msg.ok ? "#effaf1" : "#fff1f1", color: msg.ok ? "#166534" : "#a00", fontWeight: 600 }}>{msg.text}</div>
        )}
        <div style={{ ...box, marginBottom: 14, fontSize: 14, color: "#334155" }}>
          Tocca un presidio: scegli <b>su quali ambulanze montarlo</b> (anche tutta una sede insieme) e <b>quanti comprarne</b>. Quelli in più restano in magazzino per dopo.
        </div>

        {CATEGORIES.map(({ slot, title }) => {
          const items = equip.filter((e) => e.category === slot);
          if (!items.length) return null;
          return (
            <section key={slot} style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, margin: "8px 0 10px", color: "#13294B" }}>{title}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))", gap: 12 }}>
                {items.map((e) => {
                  const fit = fitting(e); const on = fit.filter((v) => (v.equipment ?? []).includes(e.code)).length; const st = stock[e.code] ?? 0;
                  return (
                    <button key={e.code} onClick={() => { setMsg(null); setSelected(e); }}
                            style={{ ...box, padding: 12, textAlign: "center", cursor: "pointer", border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, position: "relative" }}>
                      {st > 0 && <span style={{ position: "absolute", top: 8, right: 8, background: "#13294B", color: "#fff", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>📦 {st}</span>}
                      <EquipmentIcon code={e.code} url={e.image_url} size={64} />
                      <div style={{ fontWeight: 800, color: "#13294B", lineHeight: 1.2 }}>{e.name}</div>
                      <div style={{ fontSize: 12, color: "#64748B", minHeight: 32, lineHeight: 1.3 }}>{e.description}</div>
                      {fit.length > 0 && <div style={{ fontSize: 11.5, color: on ? "#15803D" : "#94A3B8", fontWeight: 700 }}>Montato su {on}/{fit.length} mezzi</div>}
                      <div style={{ marginTop: 4, width: "100%", borderRadius: 10, padding: "8px 0", fontWeight: 800, color: "#fff", background: "linear-gradient(135deg,#F59E0B,#EA6A1F)" }}>
                        {euro(e.cost)} · Compra
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {selected && (
        <EquipBuySheet item={selected} all={equip} vehicles={vehicles} stock={stock[selected.code] ?? 0} funds={org.funds}
                       onClose={() => setSelected(null)}
                       onDone={(text, ok) => { setSelected(null); setMsg({ ok, text: ok ? text : shopError(text) }); load(); }} />
      )}
    </main>
  );
}

function shopError(m: string) {
  if (m.includes("ALREADY_INSTALLED")) return "Questo presidio è già montato su quel mezzo.";
  if (m.includes("MAXI_SLOTS_FULL")) return "Il mezzo è pieno: il camion porta 3 moduli, il furgone 2. Togline uno in Officina → Presidi.";
  if (m.includes("MAXI_MODULE_ONLY")) return "I moduli maxi vanno solo sul camion o sul furgone per le maxi emergenze.";
  if (m.includes("INSUFFICIENT_FUNDS")) return "Soldi insufficienti.";
  if (m.includes("VEHICLE_BUSY")) return "Il mezzo è in servizio o in manutenzione: riprova quando torna disponibile.";
  return friendlyError(m);
}
