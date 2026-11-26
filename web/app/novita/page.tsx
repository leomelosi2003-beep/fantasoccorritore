"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { NOVITA, markNovitaSeen } from "@/lib/novita";
import PageHeader from "@/components/PageHeader";

const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };
const wrap: CSSProperties = { maxWidth: 760, margin: "0 auto", padding: 16 };

export default function Novita() {
  const [all, setAll] = useState(false);
  const router = useRouter();
  useEffect(() => { markNovitaSeen(); }, []);
  return (
    <main style={shell}>
      <PageHeader icon="🆕" title="Novità del gioco" tone="purple" sub="Cosa è stato aggiunto a ogni aggiornamento" />
      <div style={wrap}>
        {(() => {
          const shown = all ? NOVITA : NOVITA.slice(0, 6);
          const days: [string, typeof NOVITA][] = [];
          shown.forEach((n) => { const last = days[days.length - 1]; if (last && last[0] === n.date) last[1].push(n); else days.push([n.date, [n]]); });
          return (
            <div className="fs-tl">
              {days.map(([date, list]) => (
                <section key={date} className="fs-tl-day">
                  <div className="fs-tl-date">📅 {date}</div>
                  {list.map((n) => {
                    const first = n.id === NOVITA[0].id;
                    return (
                      <article key={n.id} className={`fs-tl-item${first ? " first" : ""}`}>
                        <div className="fs-tl-title">{first && <span className="fs-tl-new">ULTIMO</span>}{n.title}</div>
                        <ul>{n.items.map((t, k) => <li key={k}>{t}</li>)}</ul>
                      </article>
                    );
                  })}
                </section>
              ))}
              {!all && NOVITA.length > 6 && (
                <button className="fs-tl-more" onClick={() => setAll(true)}>Mostra gli aggiornamenti precedenti ({NOVITA.length - 6})</button>
              )}
            </div>
          );
        })()}
      </div>
    </main>
  );
}
