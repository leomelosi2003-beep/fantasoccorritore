"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Vehicle = {
  id: string; call_sign: string; status: string; wear: number; lent_to: string | null; lent_from: string | null;
  maintenance_until: string | null; vehicle_image: string | null; base_name: string | null;
};
type Job = { vehicle_id: string; title: string; status: string; assigned_at: string; completes_at: string; route_ends_at: string };

// Conto alla rovescia mm:ss (o h:mm:ss)
function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0"), ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Elenco delle mie ambulanze con il tempo che manca per liberarsi
export default function FleetPanel({ jobs, now, refreshKey }: { jobs: Job[]; now: number; refreshKey: number }) {
  const [open, setOpen] = useState(false);
  const [fleet, setFleet] = useState<Vehicle[]>([]);

  useEffect(() => {
    supabase.from("my_fleet")
      .select("id,call_sign,status,wear,lent_to,lent_from,maintenance_until,vehicle_image,base_name")
      .order("call_sign")
      .then(({ data }) => setFleet((data as Vehicle[]) ?? []));
  }, [refreshKey]);

  // ultimo servizio di ogni mezzo
  const lastJob = new Map<string, Job>();
  for (const j of jobs) {
    const cur = lastJob.get(j.vehicle_id);
    if (!cur || j.assigned_at > cur.assigned_at) lastJob.set(j.vehicle_id, j);
  }

  const rows = fleet.map((v) => {
    const j = lastJob.get(v.id);
    const freeAt = j ? new Date(j.completes_at).getTime() : 0;
    const homeAt = j ? new Date(j.route_ends_at).getTime() : 0;
    if (v.lent_to) return { v, color: "#B45309", text: `🤝 Prestata a ${v.lent_to}`, timer: null as string | null, order: 3 };
    if (v.status === "manutenzione" && v.maintenance_until)
      return { v, color: "#6B7280", text: "🔧 In officina", timer: countdown(new Date(v.maintenance_until).getTime() - now), order: 2 };
    if (j && freeAt > now)
      return { v, color: "#DC2626", text: j.title.split(" — ")[0], timer: countdown(freeAt - now), order: 0 };
    if (j && homeAt > now)
      return { v, color: "#15803D", text: `✅ Libera · in rientro (${countdown(homeAt - now)})`, timer: null, order: 1 };
    if (v.wear >= 80) return { v, color: "#B45309", text: "⚠️ Da revisionare", timer: null, order: 2 };
    return { v, color: "#15803D", text: `✅ Libera in sede${v.base_name ? ` · ${v.base_name}` : ""}`, timer: null, order: 1 };
  }).sort((a, b) => a.order - b.order || (a.v.call_sign > b.v.call_sign ? 1 : -1));

  const busy = rows.filter((r) => r.order === 0).length;

  return (
    <div className="fs-fleet">
      <button className="fs-fleet-btn" onClick={() => setOpen(!open)}>
        🚑 Mezzi <strong>{rows.length - busy}</strong>/{rows.length} liberi {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="fs-fleet-list">
          {rows.length === 0 && <div style={{ padding: 12, color: "#666", fontSize: 14 }}>Nessuna ambulanza: comprala nel Garage.</div>}
          {rows.map(({ v, color, text, timer }) => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderTop: "1px solid #f0f0f0" }}>
              {v.vehicle_image
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={v.vehicle_image.replace(/\.png$/, "-map.png")} alt="" style={{ width: 46, height: "auto", flexShrink: 0 }} />
                : <span style={{ fontSize: 24 }}>🚑</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{v.call_sign}{v.lent_from && <span style={{ fontWeight: 400, fontSize: 11, color: "#15803D" }}> · da {v.lent_from}</span>}</div>
                <div style={{ fontSize: 12, color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{text}</div>
              </div>
              {timer && (
                <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 800, fontSize: 17, color, textAlign: "right" }}>
                  ⏱ {timer}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
