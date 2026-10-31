"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase, friendlyError, type Organization } from "@/lib/supabase";
import { ModelImage, BuilderLogo } from "@/components/VehicleArt";
import FactionEmblem, { FACTION_STYLES } from "@/components/FactionEmblem";

type Model = { id: string; name: string; base_cost: number; speed_factor: number;
  base_reliability: number; base_durability: number; image_url: string | null; description: string | null };
type Builder = { id: string; name: string; cost: number; value_score: number; reliability: number;
  durability: number; certification: Cert; bonus: Record<string, number>; logo_url: string | null; description: string | null };
type Equip = { code: string; slot: Slot; name: string; cost: number; provides: string[];
  effects: { reward_mult?: number; on?: string; fatigue_mult?: number }; description: string | null; image_url: string | null; sort: number };
type Slot = "monitor" | "barella" | "massaggiatore" | "spinale" | "borsoni";
type Base = { id: string; name: string; vehicle_capacity: number; is_headquarters: boolean };
type Vehicle = { id: string; call_sign: string; base_id: string; model_id: string; builder_id: string;
  certification: Cert; reliability: number; durability: number; value_score: number; wear: number;
  status: "disponibile" | "in_servizio" | "manutenzione" | "fuori_servizio"; maintenance_until: string | null; equipment: string[] };
type Cert = "trasporto" | "base" | "avanzata_rianimazione";

const CERT: Record<Cert, { label: string; color: string }> = {
  trasporto: { label: "Trasporto", color: "#3B82F6" },
  base: { label: "Emergenza", color: "#EAB308" },
  avanzata_rianimazione: { label: "Rianimazione", color: "#DC2626" },
};
const STATUS: Record<Vehicle["status"], string> = {
  disponibile: "Disponibile", in_servizio: "In servizio", manutenzione: "In manutenzione", fuori_servizio: "Fuori servizio",
};
const SLOTS: { slot: Slot; title: string; required: boolean }[] = [
  { slot: "monitor", title: "Defibrillatore / cardiomonitor", required: true },
  { slot: "barella", title: "Barella", required: true },
  { slot: "massaggiatore", title: "Massaggiatore automatico", required: false },
  { slot: "spinale", title: "Tavola spinale", required: false },
  { slot: "borsoni", title: "Borsoni emergenza", required: false },
];
const CAN: Record<string, string> = { defib: "Codici rossi", ecg: "Servizi ECG", spinale: "Traumi", emergenza: "Emergenze 118" };
const euro = (n: number) => n.toLocaleString("it-IT") + " €";

const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 980, margin: "0 auto", padding: 16 };
const box: CSSProperties = { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)" };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 };
const btn: CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "none", background: "#111", color: "#fff",
  fontWeight: 600, cursor: "pointer", fontSize: 15 };

function Bar({ label, value, color = "#111" }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><span>{label}</span><span>{Math.round(value)}</span></div>
      <div style={{ height: 6, background: "#eee", borderRadius: 3 }}>
        <div style={{ width: `${Math.min(100, value)}%`, height: 6, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function Pill({ cert }: { cert: Cert }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, color: "#fff",
                        background: CERT[cert].color }}>{CERT[cert].label}</span>;
}

export default function Garage() {
  const router = useRouter();
  const [org, setOrg] = useState<Organization | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [equip, setEquip] = useState<Equip[]>([]);
  const [picked, setPicked] = useState<Partial<Record<Slot, string>>>({});
  const [shop, setShop] = useState(false);
  const [modelId, setModelId] = useState<string | null>(null);
  const [builderId, setBuilderId] = useState<string | null>(null);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [callSign, setCallSign] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); return; }
    const { data: o } = await supabase.from("organizations").select("id,name,type,funds,reputation")
      .eq("owner_id", session.user.id).maybeSingle();
    if (!o) { router.replace("/onboarding"); return; }
    setOrg(o as Organization);
    const [m, b, bs, v, e] = await Promise.all([
      supabase.from("vehicle_models").select("*").eq("is_active", true).order("base_cost"),
      supabase.from("builders").select("*").eq("is_active", true).order("cost"),
      supabase.from("bases").select("id,name,vehicle_capacity,is_headquarters").eq("org_id", o.id).order("built_at"),
      supabase.from("vehicles").select("*").eq("org_id", o.id).order("created_at"),
      supabase.from("equipment").select("*").order("slot").order("sort"),
    ]);
    setEquip((e.data as Equip[]) ?? []);
    setModels((m.data as Model[]) ?? []);
    setBuilders((b.data as Builder[]) ?? []);
    setBases((bs.data as Base[]) ?? []);
    setVehicles((v.data as Vehicle[]) ?? []);
    if (bs.data?.length) setBaseId((cur) => cur ?? (bs.data as Base[])[0].id);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const model = models.find((m) => m.id === modelId);
  const builder = builders.find((b) => b.id === builderId);
  const pickedCodes = Object.values(picked).filter(Boolean) as string[];
  const eqCost = equip.filter((e) => pickedCodes.includes(e.code)).reduce((t, e) => t + e.cost, 0);
  const total = (model?.base_cost ?? 0) + (builder?.cost ?? 0) + eqCost;
  const ready = !!model && !!builder && !!picked.monitor && !!picked.barella;
  const caps = Array.from(new Set(equip.filter((e) => pickedCodes.includes(e.code)).flatMap((e) => e.provides)));
  const eqName = (c: string) => equip.find((e) => e.code === c)?.name ?? c;
  const stripe = FACTION_STYLES.find((s) => s.type === org?.type)?.colors[0] ?? "#F97316";
  const byId = useMemo(() => ({
    model: Object.fromEntries(models.map((m) => [m.id, m])),
    builder: Object.fromEntries(builders.map((b) => [b.id, b])),
    base: Object.fromEntries(bases.map((b) => [b.id, b])),
  }), [models, builders, bases]);

  function openShop() {
    setShop(true); setMsg(null); setModelId(null); setBuilderId(null);
    setPicked({ monitor: "dae", barella: "barella_std", borsoni: "borsoni" });
    setCallSign(`Alfa ${vehicles.length + 1}`);
  }

  async function buy() {
    if (!ready || !model || !builder || !baseId) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("buy_vehicle", {
      p_model_id: model.id, p_builder_id: builder.id, p_base_id: baseId, p_call_sign: callSign,
      p_equipment: pickedCodes,
    });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: garageError(error.message) }); return; }
    setMsg({ ok: true, text: `${callSign} è in garage!` });
    setShop(false);
    load();
  }

  async function maintain(v: Vehicle) {
    setMsg(null);
    const { error } = await supabase.rpc("start_maintenance", { p_vehicle_id: v.id });
    if (error) { setMsg({ ok: false, text: garageError(error.message) }); return; }
    setMsg({ ok: true, text: `${v.call_sign} è in officina.` });
    load();
  }

  if (!org) return <main style={shell} />;

  return (
    <main style={shell}>
      {/* Testata */}
      <div style={{ background: "#111", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={() => router.push("/")} style={{ ...btn, background: "#333", padding: "8px 12px" }}>← Mappa</button>
          <FactionEmblem type={org.type} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Garage · {org.name}</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>{euro(org.funds)}</div>
          </div>
          {!shop && <button onClick={openShop} style={{ ...btn, background: "#F97316" }}>+ Nuovo mezzo</button>}
        </div>
      </div>

      <div style={wrap}>
        {msg && (
          <div style={{ ...box, marginBottom: 12, background: msg.ok ? "#effaf1" : "#fff1f1",
                        color: msg.ok ? "#166534" : "#a00" }}>{msg.text}</div>
        )}

        {/* Acquisto */}
        {shop && (
          <div style={{ ...box, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>Nuovo mezzo</h2>
              <button onClick={() => setShop(false)} style={{ ...btn, background: "#eee", color: "#111" }}>Annulla</button>
            </div>

            <h3 style={{ marginBottom: 8 }}>1. Modello</h3>
            <div style={grid}>
              {models.map((m) => (
                <button key={m.id} onClick={() => setModelId(m.id)}
                        style={{ ...box, textAlign: "left", cursor: "pointer",
                                 border: modelId === m.id ? "3px solid #111" : "1px solid #e5e5e0" }}>
                  <div style={{ textAlign: "center" }}><ModelImage name={m.name} url={m.image_url} stripe={stripe} /></div>
                  <div style={{ fontWeight: 700, marginTop: 6 }}>{m.name}</div>
                  <div style={{ fontSize: 13, color: "#666", minHeight: 34 }}>{m.description}</div>
                  <Bar label="Velocità" value={m.speed_factor * 80} color="#3B82F6" />
                  <Bar label="Affidabilità" value={m.base_reliability} color="#16A34A" />
                  <Bar label="Durata" value={m.base_durability} color="#9333EA" />
                  <div style={{ fontWeight: 700, marginTop: 8 }}>{euro(m.base_cost)}</div>
                </button>
              ))}
            </div>

            <h3 style={{ marginBottom: 8 }}>2. Allestitore</h3>
            <div style={grid}>
              {builders.map((b) => (
                <button key={b.id} onClick={() => setBuilderId(b.id)}
                        style={{ ...box, textAlign: "left", cursor: "pointer",
                                 border: builderId === b.id ? "3px solid #111" : "1px solid #e5e5e0" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <BuilderLogo name={b.name} url={b.logo_url} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{b.name}</div>
                      <Pill cert={b.certification} />
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "#666", marginTop: 8, minHeight: 34 }}>{b.description}</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    Affidabilità +{b.reliability} · Durata +{b.durability}
                    {b.bonus?.reward_mult ? ` · Ricompense +${Math.round(b.bonus.reward_mult * 100)}%` : ""}
                  </div>
                  <div style={{ fontWeight: 700, marginTop: 8 }}>{euro(b.cost)}</div>
                </button>
              ))}
            </div>

            <h3 style={{ marginBottom: 8 }}>3. Presidi</h3>
            {SLOTS.map(({ slot, title, required }) => {
              const opts = equip.filter((e) => e.slot === slot);
              return (
                <div key={slot} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                    {title} {required ? <span style={{ color: "#DC2626" }}>*</span> : <span style={{ color: "#888", fontWeight: 400 }}>(facoltativo)</span>}
                  </div>
                  <div style={grid}>
                    {!required && (
                      <button onClick={() => setPicked((p) => ({ ...p, [slot]: undefined }))}
                              style={{ ...box, padding: 12, textAlign: "left", cursor: "pointer",
                                       border: !picked[slot] ? "3px solid #111" : "1px solid #e5e5e0" }}>
                        <div style={{ fontWeight: 700 }}>Nessuno</div>
                        <div style={{ fontSize: 13, color: "#666" }}>0 €</div>
                      </button>
                    )}
                    {opts.map((e) => (
                      <button key={e.code} onClick={() => setPicked((p) => ({ ...p, [slot]: e.code }))}
                              style={{ ...box, padding: 12, textAlign: "left", cursor: "pointer",
                                       border: picked[slot] === e.code ? "3px solid #111" : "1px solid #e5e5e0" }}>
                        {e.image_url && <img src={e.image_url} alt="" style={{ height: 48, objectFit: "contain" }} />}
                        <div style={{ fontWeight: 700 }}>{e.name}</div>
                        <div style={{ fontSize: 13, color: "#666", margin: "4px 0" }}>{e.description}</div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{euro(e.cost)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: 14, background: "#f6f6f4", borderRadius: 10, padding: 10 }}>
              <strong>Questo mezzo potrà fare:</strong> Trasporti
              {caps.filter((c) => CAN[c]).map((c) => ` · ${CAN[c]}`).join("")}
              {!caps.includes("ecg") && caps.includes("emergenza") &&
                <div style={{ color: "#a16207", marginTop: 4 }}>Con il solo DAE non puoi fare i servizi ECG: serve un cardiomonitor.</div>}
            </div>

            <h3 style={{ marginBottom: 8 }}>4. Sigla e sede</h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input value={callSign} onChange={(e) => setCallSign(e.target.value)} maxLength={20} placeholder="Sigla (es. Alfa 1)"
                     style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", fontSize: 15, flex: "1 1 180px" }} />
              {bases.length > 1 && (
                <select value={baseId ?? ""} onChange={(e) => setBaseId(e.target.value)}
                        style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", fontSize: 15, flex: "1 1 180px" }}>
                  {bases.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16,
                          borderTop: "1px solid #eee", paddingTop: 12, gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 13, color: "#666" }}>Totale</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: total > org.funds ? "#DC2626" : "#111" }}>{euro(total)}</div>
              </div>
              <button onClick={buy} disabled={!ready || busy || total > org.funds}
                      style={{ ...btn, background: "#F97316", opacity: !ready || busy || total > org.funds ? 0.4 : 1 }}>
                {busy ? "Acquisto…" : total > org.funds ? "Fondi insufficienti" : "Compra"}
              </button>
            </div>
          </div>
        )}

        {/* I miei mezzi */}
        <h2>I tuoi mezzi</h2>
        {vehicles.length === 0 ? (
          <div style={{ ...box, textAlign: "center", color: "#666" }}>
            Il garage è vuoto. Compra il primo mezzo per iniziare a prendere servizi.
          </div>
        ) : (
          <div style={grid}>
            {vehicles.map((v) => {
              const m = byId.model[v.model_id];
              const b = byId.builder[v.builder_id];
              const cost = Math.round(v.wear * v.value_score * 2);
              return (
                <div key={v.id} style={box}>
                  <div style={{ textAlign: "center" }}><ModelImage name={m?.name ?? ""} url={m?.image_url} stripe={stripe} height={80} /></div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <strong style={{ fontSize: 17 }}>{v.call_sign}</strong>
                    <Pill cert={v.certification} />
                  </div>
                  <div style={{ fontSize: 13, color: "#666" }}>{m?.name} · {b?.name} · {byId.base[v.base_id]?.name}</div>
                  {v.equipment?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "6px 0" }}>
                      {v.equipment.map((c) => (
                        <span key={c} style={{ fontSize: 11, background: "#f0f0ec", borderRadius: 6, padding: "2px 6px" }}>{eqName(c)}</span>
                      ))}
                    </div>
                  )}
                  <Bar label="Affidabilità" value={v.reliability} color="#16A34A" />
                  <Bar label="Durata" value={v.durability} color="#9333EA" />
                  <Bar label="Usura" value={v.wear} color={v.wear >= 80 ? "#DC2626" : v.wear >= 50 ? "#EAB308" : "#999"} />
                  <div style={{ fontSize: 13, marginTop: 8 }}>
                    {STATUS[v.status]}
                    {v.status === "manutenzione" && v.maintenance_until &&
                      ` fino alle ${new Date(v.maintenance_until).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`}
                  </div>
                  {v.status === "disponibile" && v.wear > 0 && (
                    <button onClick={() => maintain(v)} disabled={cost > org.funds}
                            style={{ ...btn, width: "100%", marginTop: 8, background: v.wear >= 80 ? "#DC2626" : "#111",
                                     opacity: cost > org.funds ? 0.4 : 1 }}>
                      Manutenzione · {euro(cost)}
                    </button>
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

function garageError(m: string) {
  if (m.includes("BASE_FULL")) return "Il garage della sede è pieno: potenzia la sede o costruiscine un'altra.";
  if (m.includes("NEED_ONE_MONITOR")) return "Scegli un defibrillatore o un cardiomonitor.";
  if (m.includes("NEED_ONE_STRETCHER")) return "Scegli una barella.";
  if (m.includes("BAD_CALL_SIGN")) return "La sigla deve avere tra 2 e 20 caratteri.";
  if (m.includes("VEHICLE_BUSY")) return "Il mezzo è impegnato.";
  if (m.includes("buy_vehicle") || m.includes("function")) return "Il garage non è ancora attivo nel database.";
  return friendlyError(m);
}
