"use client";
// Livree personalizzate: per ogni mezzo che ha una livrea fatta nell'editor, l'immagine da usare (per tutti i giocatori).
// Le immagini finiscono in ".png" e hanno accanto la versione piccola "-map.png", come quelle ufficiali.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

let byVehicle: Record<string, string> = {};
let loadedAt = 0;
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();

export function loadVehicleLiveries(force = false): Promise<void> {
  if (!force && Date.now() - loadedAt < 120_000) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    try {
      const { data, error } = await supabase.rpc("vehicle_liveries");
      if (!error) {
        const m: Record<string, string> = {};
        for (const r of (data ?? []) as { vehicle_id: string; image_url: string }[]) if (r.image_url) m[r.vehicle_id] = r.image_url;
        byVehicle = m;
        loadedAt = Date.now();
        subs.forEach((f) => f());
      }
    } finally { loading = null; }
  })();
  return loading;
}

/** Immagine del mezzo: quella della livrea personalizzata se c'è, altrimenti quella ufficiale. */
export function vehicleImg(vehicleId: string | null | undefined, fallback: string | null): string | null {
  return (vehicleId && byVehicle[vehicleId]) || fallback;
}

/** Ricarica la pagina quando arrivano le livree (e le riaggiorna ogni 2 minuti). */
export function useLiveries(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((x) => x + 1);
    subs.add(f);
    loadVehicleLiveries();
    const t = setInterval(() => loadVehicleLiveries(), 120_000);
    return () => { subs.delete(f); clearInterval(t); };
  }, []);
  return n;
}
