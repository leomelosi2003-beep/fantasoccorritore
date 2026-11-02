import { createClient } from "@supabase/supabase-js";

// URL del progetto e chiave publishable: entrambi pubblici per design,
// la sicurezza la fanno le policy RLS e le funzioni RPC nel database.
const URL = "https://saagkulmwofgvlssiucw.supabase.co";
const KEY = "sb_publishable_g7clr76peeA2dkth4NzhJg_gDJODCZ2";

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
  first_arrival?: string | null;
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
