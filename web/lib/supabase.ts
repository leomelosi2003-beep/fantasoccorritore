import { createClient } from "@supabase/supabase-js";

// Solo chiave ANON nel frontend: la sicurezza la fanno RLS e le RPC.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
