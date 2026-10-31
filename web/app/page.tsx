"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import LoginScreen from "@/components/LoginScreen";

// Leaflet usa window: va caricato solo nel browser
const GameMap = dynamic(() => import("@/components/GameMap"), { ssr: false });

// Home: chi non ha fatto l'accesso vede subito la pagina di accesso, gli altri la mappa.
export default function Home() {
  const [state, setState] = useState<"loading" | "guest" | "player">("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState(data.session ? "player" : "guest"));
  }, []);

  if (state === "loading") return <div style={{ minHeight: "100vh", background: "#05070f" }} />;
  if (state === "guest") return <LoginScreen />;
  return <GameMap />;
}
