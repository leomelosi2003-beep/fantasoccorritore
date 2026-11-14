"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import MaxiScene, { VIEWS, type SceneData, type SceneVehicle } from "@/components/MaxiScene";

const DEMO: Record<string, string> = {
  deragliamento: "Deragliamento di un treno", crollo: "Crollo di una palazzina", fabbrica: "Esplosione in una fabbrica",
  tamponamento: "Maxi tamponamento in autostrada", "centro-commerciale": "Incendio in un centro commerciale",
  concerto: "Cedimento durante un concerto", gas: "Fuga di gas in un quartiere", alluvione: "Alluvione lampo",
  autobus: "Scontro tra due autobus", terremoto: "Scossa di terremoto",
};

// scena di prova: 12 mezzi che arrivano a scaglioni, ricomincia ogni 2 minuti
function demoData(s: string): SceneData {
  const t0 = Date.now() - (Date.now() % 120000);
  const sigle = ["CVL 12", "PA 7", "PMA CVL", "MISE 21", "CRI 4", "CVL 31", "SVS 9", "PA 15", "CRI 22", "CVL 5", "MISE 3", "AUTOMED 1", "MOTO 2"];
  const vehicles: SceneVehicle[] = sigle.map((c, i) => ({
    id: "demo" + i, call_sign: c, org_name: i % 3 === 0 ? "La tua associazione" : "Altra associazione", mine: i % 3 === 0,
    status: "in_viaggio", assigned_at: new Date(t0 + i * 7000).toISOString(), arrives_at: new Date(t0 + i * 7000 + 25000 + (i % 4) * 6000).toISOString(),
    base_lat: 43.55 + Math.sin(i * 1.7) * 0.2, base_lng: 10.32 + Math.cos(i * 1.7) * 0.2, automedica: c.startsWith("AUTOMED"), moto: c.startsWith("MOTO"), pma: c.startsWith("PMA"),
  })).filter((v) => Date.parse(v.assigned_at) <= Date.now());
  return { id: "demo-" + s, title: DEMO[s] ?? DEMO.deragliamento, lat: 43.55, lng: 10.32, created_at: new Date(t0).toISOString(),
           ends_at: new Date(t0 + 2 * 3600 * 1000).toISOString(), vehicles };
}

export default function MaxiPage() {
  return <Suspense fallback={null}><MaxiInner /></Suspense>;
}

function MaxiInner() {
  const { id } = useParams<{ id: string }>();
  const q = useSearchParams();
  const router = useRouter();
  const demo = id === "demo";
  const [data, setData] = useState<SceneData | null>(demo ? demoData(q.get("s") ?? "deragliamento") : null);
  const [offset, setOffset] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState(0);
  const [viewKey, setViewKey] = useState(0);

  useEffect(() => {
    if (demo) {
      const s = q.get("s") ?? "deragliamento";
      setData(demoData(s));
      const t = setInterval(() => setData(demoData(s)), 2000);
      return () => clearInterval(t);
    }
    let alive = true;
    const load = async () => {
      const { data: d, error } = await supabase.rpc("maxi_scene", { p_mission: id });
      if (!alive) return;
      if (error || !d) { setErr("Scena non disponibile."); return; }
      const sd = d as SceneData & { now: string };
      setOffset(Date.parse(sd.now) - Date.now());
      setData(sd);
    };
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [id, demo, q]);

  return (
    <main style={{ position: "fixed", inset: 0, background: "#050B18" }}>
      {data && <MaxiScene data={data} serverOffset={offset} view={view} viewKey={viewKey} />}
      <div style={{ position: "absolute", top: 54, right: 12, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
        {VIEWS.map((v, i) => (
          <button key={v.name} onClick={() => { setView(i); setViewKey((k) => k + 1); }}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.25)", fontSize: 12, cursor: "pointer", fontWeight: 700,
                           background: view === i ? "#FF5A36" : "rgba(5,11,24,.7)", color: "#fff" }}>📷 {v.name}</button>
        ))}
        <div style={{ color: "rgba(255,255,255,.55)", fontSize: 11, textAlign: "right", maxWidth: 150, fontFamily: "ui-monospace,monospace" }}>
          Trascina per girare · rotellina o due dita per lo zoom
        </div>
      </div>
      {!data && <div style={{ color: "#94A3B8", padding: 20, fontFamily: "ui-monospace,monospace" }}>{err ?? "Collegamento con la scena…"}</div>}
      <button onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
              style={{ position: "absolute", top: 12, right: 12, padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.3)",
                       background: "rgba(5,11,24,.7)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>✕ Chiudi</button>
      {demo && (
        <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, display: "flex", gap: 6, overflowX: "auto" }}>
          {Object.entries(DEMO).map(([k, n]) => (
            <button key={k} onClick={() => router.replace(`/maxi/demo?s=${k}`)}
                    style={{ flexShrink: 0, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,.25)", fontSize: 12, cursor: "pointer",
                             background: (q.get("s") ?? "deragliamento") === k ? "#FF5A36" : "rgba(5,11,24,.7)", color: "#fff", fontWeight: 700 }}>{n}</button>
          ))}
        </div>
      )}
    </main>
  );
}
