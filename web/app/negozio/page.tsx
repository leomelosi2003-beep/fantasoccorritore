"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase, friendlyError, type Organization } from "@/lib/supabase";
import FactionEmblem from "@/components/FactionEmblem";
import EquipmentIcon from "@/components/EquipmentIcon";

type Equip = { code: string; slot: string; category: string; name: string; cost: number; provides: string[];
  description: string | null; image_url: string | null; sort: number };
type Vehicle = { id: string; call_sign: string; status: string; equipment: string[] };

const CATEGORIES: { slot: string; title: string }[] = [
  { slot: "monitor", title: "Defibrillatori e cardiomonitor" },
  { slot: "barella", title: "Barelle" },
  { slot: "massaggiatore", title: "Massaggiatori automatici" },
  { slot: "immobilizzazione", title: "Immobilizzazione" },
  { slot: "borsoni", title: "Borsoni e zaini" },
];
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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<Equip | null>(null);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); return; }
    const { data: o } = await supabase.from("organizations").select("id,name,type,funds,reputation,logo_url")
      .eq("owner_id", session.user.id).maybeSingle();
    if (!o) { router.replace("/onboarding"); return; }
    setOrg(o as Organization);
    const [e, v] = await Promise.all([
      supabase.from("equipment").select("*").order("sort"),
      supabase.from("vehicles").select("id,call_sign,status,equipment").eq("org_id", o.id).order("created_at"),
    ]);
    setEquip((e.data as Equip[]) ?? []);
    setVehicles((v.data as Vehicle[]) ?? []);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  function open(e: Equip) {
    setSelected(e); setMsg(null);
    const first = vehicles.find((v) => !v.equipment.includes(e.code) && v.status === "disponibile");
    setVehicleId(first?.id ?? "");
  }

  async function buy() {
    if (!selected || !vehicleId) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("install_equipment", { p_vehicle_id: vehicleId, p_code: selected.code });
    setBusy(false);
    const v = vehicles.find((x) => x.id === vehicleId);
    if (error) { setMsg({ ok: false, text: shopError(error.message) }); return; }
    setMsg({ ok: true, text: `${selected.name} montato su ${v?.call_sign}.` });
    setSelected(null);
    load();
  }

  if (!org) return <main style={shell} />;

  const replaced = selected && vehicleId
    ? equip.find((e) => e.slot === selected.slot && e.code !== selected.code && vehicles.find((v) => v.id === vehicleId)?.equipment.includes(e.code))
    : undefined;

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
          <button onClick={() => router.push("/garage")} style={{ ...btn, background: "#F97316", padding: "8px 12px" }}>🚑 Garage</button>
        </div>
      </div>

      <div style={wrap}>
        {msg && (
          <div style={{ ...box, marginBottom: 12, background: msg.ok ? "#effaf1" : "#fff1f1",
                        color: msg.ok ? "#166534" : "#a00" }}>{msg.text}</div>
        )}
        {vehicles.length === 0 && (
          <div style={{ ...box, marginBottom: 12, color: "#666" }}>
            Per montare un presidio ti serve prima un mezzo: passa dal garage.
          </div>
        )}

        {CATEGORIES.map(({ slot, title }) => {
          const items = equip.filter((e) => e.category === slot);
          if (!items.length) return null;
          return (
            <section key={slot} style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, margin: "8px 0 10px" }}>{title}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {items.map((e) => (
                  <button key={e.code} onClick={() => open(e)}
                          style={{ ...box, textAlign: "center", cursor: "pointer",
                                   border: selected?.code === e.code ? "3px solid #111" : "1px solid #e5e5e0" }}>
                    <EquipmentIcon code={e.code} url={e.image_url} size={72} />
                    <div style={{ fontWeight: 700, marginTop: 6 }}>{e.name}</div>
                    <div style={{ fontSize: 13, color: "#666", margin: "4px 0 8px", minHeight: 34 }}>{e.description}</div>
                    <div style={{ fontWeight: 800 }}>{euro(e.cost)}</div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Pannello acquisto */}
      {selected && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#fff", zIndex: 10,
                      boxShadow: "0 -6px 24px rgba(0,0,0,.15)", borderRadius: "16px 16px 0 0" }}>
          <div style={{ ...wrap, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <EquipmentIcon code={selected.code} url={selected.image_url} size={48} />
            <div style={{ flex: "1 1 160px" }}>
              <div style={{ fontWeight: 700 }}>{selected.name}</div>
              <div style={{ fontSize: 13, color: "#666" }}>{euro(selected.cost)}</div>
            </div>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", fontSize: 15, flex: "1 1 180px" }}>
              <option value="">Scegli il mezzo…</option>
              {vehicles.map((v) => {
                const has = v.equipment.includes(selected.code);
                return (
                  <option key={v.id} value={v.id} disabled={has || v.status !== "disponibile"}>
                    {v.call_sign}{has ? " (già montato)" : v.status !== "disponibile" ? " (occupato)" : ""}
                  </option>
                );
              })}
            </select>
            <button onClick={() => setSelected(null)} style={{ ...btn, background: "#eee", color: "#111" }}>Annulla</button>
            <button onClick={buy} disabled={!vehicleId || busy || selected.cost > org.funds}
                    style={{ ...btn, background: "#F97316", opacity: !vehicleId || busy || selected.cost > org.funds ? 0.4 : 1 }}>
              {busy ? "Acquisto…" : selected.cost > org.funds ? "Fondi insufficienti" : "Compra e monta"}
            </button>
            {replaced && (
              <div style={{ flexBasis: "100%", fontSize: 13, color: "#a16207" }}>
                Sostituisce {replaced.name}, che verrà ritirato.
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function shopError(m: string) {
  if (m.includes("ALREADY_INSTALLED")) return "Questo presidio è già montato su quel mezzo.";
  if (m.includes("VEHICLE_BUSY")) return "Il mezzo è in servizio o in manutenzione: riprova quando torna disponibile.";
  return friendlyError(m);
}
