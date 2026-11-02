"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Segnala che il giocatore è online (pallino verde sulla sede principale): ogni 60 s mentre la pagina è aperta
export default function Heartbeat() {
  useEffect(() => {
    const beat = async () => {
      if (document.visibilityState !== "visible") return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await supabase.rpc("heartbeat");
    };
    beat();
    const t = setInterval(beat, 60_000);
    document.addEventListener("visibilitychange", beat);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", beat); };
  }, []);
  return null;
}
