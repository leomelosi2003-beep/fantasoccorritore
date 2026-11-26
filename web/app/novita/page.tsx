"use client";

import { useEffect, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { NOVITA, markNovitaSeen } from "@/lib/novita";
import PageHeader from "@/components/PageHeader";

const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 760, margin: "0 auto", padding: 16 };

export default function Novita() {
  const router = useRouter();
  useEffect(() => { markNovitaSeen(); }, []);
  return (
    <main style={shell}>
      <PageHeader icon="🆕" title="Novità del gioco" tone="purple" sub="Cosa è stato aggiunto a ogni aggiornamento" />
      <div style={wrap}>
        {NOVITA.map((n, i) => (
          <article key={n.id} style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)", padding: 16, marginBottom: 12,
                                       border: i === 0 ? "2px solid #7C3AED" : undefined }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              {i === 0 && <span style={{ background: "#7C3AED", color: "#fff", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 800 }}>ULTIMO</span>}
              <div style={{ fontWeight: 800, fontSize: 16, flex: 1 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{n.date}</div>
            </div>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#333", fontSize: 14, lineHeight: 1.5 }}>
              {n.items.map((t, k) => <li key={k} style={{ marginBottom: 4 }}>{t}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </main>
  );
}
