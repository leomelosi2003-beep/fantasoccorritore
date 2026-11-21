"use client";
// La pagina "Associazione" ora è dentro il profilo: qui si va direttamente al proprio profilo in modifica.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Associazione() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const { data } = await supabase.from("organizations").select("id").eq("owner_id", session.user.id).maybeSingle();
      if (!data) { router.replace("/onboarding"); return; }
      router.replace(`/profili/${(data as { id: string }).id}?modifica=1`);
    })();
  }, [router]);
  return <main style={{ padding: 20, fontFamily: "system-ui, sans-serif", color: "#64748B" }}>Apro il tuo profilo…</main>;
}
