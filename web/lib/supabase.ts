import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

// Se le variabili mancano mostriamo un messaggio chiaro invece di far crashare la pagina.
export const configError: string | null = !url
  ? "Manca NEXT_PUBLIC_SUPABASE_URL nelle Environment Variables di Vercel."
  : !url.startsWith("https://")
  ? "NEXT_PUBLIC_SUPABASE_URL deve iniziare con https:// (es. https://abcd.supabase.co)."
  : !key
  ? "Manca NEXT_PUBLIC_SUPABASE_ANON_KEY nelle Environment Variables di Vercel."
  : null;

// Solo chiave ANON nel frontend: la sicurezza la fanno RLS e le RPC.
export const supabase: SupabaseClient | null = configError ? null : createClient(url!, key!);

export type MissionPin = {
  id: string;
  code: "nessuno" | "verde" | "giallo" | "rosso";
  title: string;
  slots_total: number;
  slots_taken: number;
  reward_funds: number;
  expires_at: string;
  status: string;
  lat: number;
  lng: number;
};
