import { createClient } from "@supabase/supabase-js";

// URL del progetto e chiave publishable: entrambi pubblici per design,
// la sicurezza la fanno le policy RLS e le funzioni RPC nel database.
// Sul server locale (PC di casa) le chiamate passano dal sito stesso, su /sb, e Next le gira a Supabase.
const ENV_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const URL = ENV_URL === "same-origin"
  ? (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000") + "/sb"
  : ENV_URL || "https://saagkulmwofgvlssiucw.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_g7clr76peeA2dkth4NzhJg_gDJODCZ2";

export const supabase = createClient(URL, KEY);
export const configError: string | null = null;

export type MissionPin = {
  id: string;
  code: "nessuno" | "verde" | "giallo" | "rosso";
  title: string;
  slots_total: number;
  slots_taken: number;
  reward_funds: number;
  expires_at: string;
  status: string;
  requires: string[];
  required_roles: Record<string, number>;
  min_certification: string;
  category?: string;
  description?: string | null;
  venue?: string | null;
  event_id?: string | null;
  event_ends_at?: string | null;
  contestable?: boolean;
  my_automedica_waiting?: boolean;
  won_by_automedica?: string | null;
  first_arrival?: string | null;
  my_vehicles?: number;
  transport?: string | null;
  lat: number;
  lng: number;
};

export type BasePin = {
  id: string;
  org_id: string;
  name: string;
  level: number;
  is_headquarters: boolean;
  online?: boolean;
  last_seen_at?: string | null;
  org_name: string;
  org_type: "blu_giallo" | "arancio_nero" | "rosso_bianco";
  logo_url?: string | null;
  alliance?: string | null;
  hq_name?: string | null;
  org_bases?: number;
  vehicles_here?: number;
  org_vehicles?: number;
  vehicle_capacity?: number;
  reputation?: number;
  lat: number;
  lng: number;
};

export type Organization = {
  id: string;
  name: string;
  type: "blu_giallo" | "arancio_nero" | "rosso_bianco";
  funds: number;
  reputation: number;
  logo_url?: string | null;
  auto_enabled?: boolean;
};

// Traduce i codici di errore del database in messaggi leggibili
export function friendlyError(msg: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "Email o password sbagliate.",
    "User already registered": "Esiste già un account con questa email.",
    "Email not confirmed": "Devi prima confermare l'email (controlla la posta).",
    "TOO_CLOSE_TO_OTHER_BASE": "Troppo vicina alla sede di un'altra associazione: serve almeno 500 m di distanza.",
    "INSUFFICIENT_FUNDS": "Fondi insufficienti.",
  };
  for (const k of Object.keys(map)) if (msg.includes(k)) return map[k];
  if (msg.includes("organizations_owner_id_key")) return "Hai già creato la tua associazione.";
  if (msg.includes("organizations_name_check")) return "Il nome deve avere tra 3 e 60 caratteri.";
  if (msg.toLowerCase().includes("password")) return "La password deve avere almeno 6 caratteri.";
  return msg;
}

// Livrea dell'ambulanza in base al tipo di associazione: Misericordia (blu), Croce Rossa (rosso),
// Pubblica Assistenza (arancione, immagine base). Le elettriche restano verdi.
export function livery(url: string | null | undefined, type?: string | null): string | null {
  if (!url) return null;
  if (/-e\.png$/.test(url)) return url;
  const suf = type === "blu_giallo" ? "-mis" : type === "rosso_bianco" ? "-cri" : "";
  return suf ? url.replace(/\.png$/, `${suf}.png`) : url;
}
