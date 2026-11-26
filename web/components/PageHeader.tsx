"use client";
// Testata unica di tutte le pagine: indietro, icona, titolo, a cosa serve la pagina, soldi,
// collegamenti alle pagine vicine e schede. Resta in alto mentre si scorre.
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import AppIcon, { iconFor } from "@/components/AppIcon";

export type PHTab = { key: string; label: string; badge?: string | number | null };
export type PHLink = { href: string; label: string; badge?: string | number | null; hot?: boolean };

const TONES: Record<string, [string, string]> = {
  blue: ["#2563EB", "#1E3A8A"], navy: ["#1D4ED8", "#0B1B33"], green: ["#16A34A", "#14532D"], orange: ["#F97316", "#C2410C"],
  red: ["#E11D48", "#9F1239"], purple: ["#7C3AED", "#4C1D95"], teal: ["#0D9488", "#134E4A"], amber: ["#D97706", "#78350F"],
  cyan: ["#0891B2", "#164E63"], slate: ["#475569", "#0F172A"], pink: ["#DB2777", "#831843"],
};

export const PH_CSS = `
.fs-ph { position: sticky; top: 0; z-index: 60; color: #fff; border-radius: 0 0 24px 24px; overflow: hidden;
  box-shadow: 0 12px 30px rgba(15,23,42,.22); margin-bottom: 14px; isolation: isolate; }
.fs-ph::before { content: ""; position: absolute; inset: 0; z-index: -1;
  background: radial-gradient(circle at 88% -30%, rgba(255,255,255,.28), transparent 45%), radial-gradient(circle at 0% 120%, rgba(255,255,255,.12), transparent 40%); }
.fs-ph-in { max-width: 1100px; margin: 0 auto; padding: 10px 14px 12px; }
.fs-ph-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
.fs-ph-back { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; height: 38px; padding: 0 12px; border-radius: 12px;
  border: 1px solid rgba(255,255,255,.28) !important; background: rgba(255,255,255,.16) !important; color: #fff !important;
  font: inherit; font-weight: 700; font-size: 14px; cursor: pointer; backdrop-filter: blur(6px); box-shadow: none !important; }
.fs-ph-back b { font-size: 18px; line-height: 1; }
.fs-ph-ico { width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0; display: grid; place-items: center; font-size: 22px;
  background: rgba(255,255,255,.95); box-shadow: 0 6px 16px rgba(0,0,0,.18); }
.fs-ph-icon { flex-shrink: 0; border-radius: 14px; box-shadow: 0 0 0 2px rgba(255,255,255,.55), 0 8px 18px rgba(0,0,0,.22); line-height: 0; }
.fs-ph-t { flex: 1; min-width: 0; }
.fs-ph-t h1 { margin: 0; font-size: 19px; font-weight: 800; letter-spacing: -.02em; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fs-ph-t p { margin: 2px 0 0; font-size: 12.5px; opacity: .86; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.fs-ph-funds { flex-shrink: 0; padding: 7px 11px; border-radius: 12px; background: rgba(0,0,0,.22); font-weight: 800; font-size: 14px;
  font-variant-numeric: tabular-nums; white-space: nowrap; border: 1px solid rgba(255,255,255,.18); }
.fs-ph-links { display: flex; gap: 6px; margin-top: 10px; overflow-x: auto; scrollbar-width: none; }
.fs-ph-links::-webkit-scrollbar, .fs-ph-tabs::-webkit-scrollbar { display: none; }
.fs-ph-link { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 999px; font: inherit;
  font-size: 13px; font-weight: 700; color: #fff !important; cursor: pointer; white-space: nowrap;
  background: rgba(255,255,255,.14) !important; border: 1px solid rgba(255,255,255,.24) !important; box-shadow: none !important; }
.fs-ph-link.hot { background: #fff !important; color: #0B1B33 !important; }
.fs-ph-badge { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 99px; background: #FACC15; color: #422006; font-size: 11px;
  font-weight: 900; display: inline-grid; place-items: center; }
.fs-ph-tabs { display: flex; gap: 4px; margin-top: 10px; padding: 4px; border-radius: 16px; background: rgba(0,0,0,.2); overflow-x: auto; scrollbar-width: none; }
.fs-ph-tab { flex: 1 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 12px; border-radius: 12px;
  border: none !important; font: inherit; font-size: 13.5px; font-weight: 700; color: rgba(255,255,255,.85) !important; background: transparent !important;
  cursor: pointer; white-space: nowrap; box-shadow: none !important; }
.fs-ph-tab.on { background: #fff !important; color: #0B1B33 !important; box-shadow: 0 4px 12px rgba(0,0,0,.18) !important; }
.fs-ph-extra { margin-top: 10px; }
@media (max-width: 640px) {
  .fs-ph { border-radius: 0 0 20px 20px; }
  .fs-ph-back span { display: none; }
  .fs-ph-back { width: 38px; justify-content: center; padding: 0; }
  .fs-ph-ico { width: 36px; height: 36px; font-size: 19px; border-radius: 12px; }
  .fs-ph-icon svg { width: 38px; height: 38px; }
  .fs-ph-t h1 { font-size: 17px; }
  .fs-ph-t p { -webkit-line-clamp: 1; }
  .fs-ph-funds { font-size: 12.5px; padding: 6px 9px; }
  /* sul telefono niente scorrimento di lato: schede e scorciatoie stanno tutte nello schermo */
  .fs-ph-tabs { overflow: visible; gap: 3px; padding: 3px; }
  .fs-ph-tab { flex: 1 1 0; min-width: 0; white-space: normal; text-align: center; line-height: 1.15; font-size: 12.5px; padding: 7px 4px; flex-direction: column; gap: 2px; }
  .fs-ph-tab .fs-ph-badge { min-width: 16px; height: 16px; font-size: 10px; }
  .fs-ph-links { flex-wrap: wrap; overflow: visible; gap: 5px; margin-top: 8px; }
  .fs-ph-link { padding: 5px 9px; font-size: 12px; }
  .fs-ph-t h1 { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .fs-ph-t p { -webkit-line-clamp: 2; font-size: 12px; }
}
html.dark .fs-ph { box-shadow: 0 14px 34px rgba(0,0,0,.55); border-bottom: 1px solid rgba(148,163,184,.12); }
html.dark .fs-ph-ico { background: rgba(7,13,26,.55); }
html.dark .fs-ph-tab.on, html.dark .fs-ph-link.hot { background: #E6EDF7 !important; color: #0B1B33 !important; }
`;

export default function PageHeader({
  icon, title, sub, back = "/", backLabel = "Mappa", tone = "blue", funds, links, tabs, tab, onTab, right, children,
}: {
  icon: ReactNode; title: ReactNode; sub?: ReactNode; back?: string | null; backLabel?: string; tone?: keyof typeof TONES | string;
  funds?: number | null; links?: PHLink[]; tabs?: PHTab[]; tab?: string; onTab?: (k: string) => void; right?: ReactNode; children?: ReactNode;
}) {
  const router = useRouter();
  const [a, b] = TONES[tone] ?? TONES.blue;
  return (
    <header className="fs-ph" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
      <style dangerouslySetInnerHTML={{ __html: PH_CSS }} />
      <div className="fs-ph-in">
        <div className="fs-ph-row">
          {back !== null && (
            <button className="fs-ph-back" onClick={() => router.push(back)} aria-label={`Torna a ${backLabel}`}>
              <b>←</b><span>{backLabel}</span>
            </button>
          )}
          {typeof icon === "string" && iconFor(icon) ? <span className="fs-ph-icon"><AppIcon name={icon} size={46} /></span> : <div className="fs-ph-ico">{icon}</div>}
          <div className="fs-ph-t">
            <h1>{title}</h1>
            {sub && <p>{sub}</p>}
          </div>
          {right}
          {funds != null && <div className="fs-ph-funds">💶 {Math.round(Number(funds)).toLocaleString("it-IT")} €</div>}
        </div>
        {links && links.length > 0 && (
          <div className="fs-ph-links">
            {links.map((l) => (
              <button key={l.href} className={`fs-ph-link${l.hot ? " hot" : ""}`} onClick={() => router.push(l.href)}>
                {l.label}{l.badge ? <span className="fs-ph-badge">{l.badge}</span> : null}
              </button>
            ))}
          </div>
        )}
        {tabs && tabs.length > 0 && (
          <nav className="fs-ph-tabs" role="tablist">
            {tabs.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} className={`fs-ph-tab${tab === t.key ? " on" : ""}`}
                      onClick={() => { onTab?.(t.key); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                {t.label}{t.badge ? <span className="fs-ph-badge">{t.badge}</span> : null}
              </button>
            ))}
          </nav>
        )}
        {children && <div className="fs-ph-extra">{children}</div>}
      </div>
    </header>
  );
}
