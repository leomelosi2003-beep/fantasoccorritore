"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type News = { at: string; icon: string; title: string; body: string };

const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 760, margin: "0 auto", padding: 16 };

function when(iso: string) {
  const d = new Date(iso), now = new Date();
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} min fa`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} ore fa`;
  return d.toLocaleDateString("it-IT", { weekday: "long", hour: "2-digit", minute: "2-digit" });
}

export default function Notizie() {
  const router = useRouter();
  const [list, setList] = useState<News[] | null>(null);

  useEffect(() => {
    const load = () => supabase.rpc("news_feed").then(({ data }) => setList((data as News[]) ?? []));
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <main style={shell}>
      <div style={{ background: "linear-gradient(135deg,#374151,#111827)", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <button onClick={() => router.push("/")} style={{ padding: "8px 12px", borderRadius: 10, border: "none",
                  background: "rgba(255,255,255,.15)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>← Mappa</button>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>📰 Notizie dal territorio</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Cosa è successo nelle ultime 48 ore</div>
          </div>
        </div>
      </div>
      <div style={wrap}>
        {list === null && <div style={{ color: "#777" }}>Caricamento…</div>}
        {list?.length === 0 && <div style={{ color: "#777" }}>Giornata tranquilla: nessuna notizia per ora.</div>}
        {list?.map((n, i) => (
          <article key={i} style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", padding: 14,
                                    marginBottom: 10, display: "flex", gap: 12 }}>
            <div style={{ fontSize: 28, lineHeight: 1 }}>{n.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800 }}>{n.title}</div>
              <div style={{ fontSize: 14, color: "#444", marginTop: 2 }}>{n.body}</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{when(n.at)}</div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
