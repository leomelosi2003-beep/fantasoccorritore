"use client";
// Parti comuni a tutte le pagine: barra in basso sul telefono e tasto "?" con la spiegazione della pagina.
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { helpFor } from "@/lib/help";

const NAV: [string, string, string][] = [
  ["🗺️", "Mappa", "/"], ["🚑", "Garage", "/garage"], ["👥", "Squadra", "/squadra"], ["🔧", "Officina", "/officina"],
];
const NO_CHROME = ["/login", "/onboarding", "/reset", "/maxi", "/admin"];

export default function AppChrome() {
  const path = usePathname() ?? "/";
  const router = useRouter();
  const [logged, setLogged] = useState(false);
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLogged(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setLogged(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const hidden = NO_CHROME.some((p) => path === p || path.startsWith(p + "/"));
  const showNav = logged && !hidden;
  useEffect(() => {
    document.body.classList.toggle("fs-has-nav", showNav);
    return () => document.body.classList.remove("fs-has-nav");
  }, [showNav]);

  // la prima volta che si apre una pagina il tasto "?" lampeggia per farsi notare
  useEffect(() => {
    setOpen(false);
    try {
      const k = "fs_help_seen";
      const seen: string[] = JSON.parse(localStorage.getItem(k) ?? "[]");
      setFresh(!seen.includes(path));
    } catch { setFresh(false); }
  }, [path]);
  function openHelp() {
    setOpen(true); setFresh(false);
    try { const k = "fs_help_seen"; const seen: string[] = JSON.parse(localStorage.getItem(k) ?? "[]"); if (!seen.includes(path)) localStorage.setItem(k, JSON.stringify([...seen, path])); } catch {}
  }

  const help = helpFor(path);
  if (hidden) return null;
  return (
    <>
      {help && (
        <button className={`fs-help-fab${fresh ? " pulse" : ""}`} onClick={openHelp} aria-label="Come funziona questa pagina" title="Come funziona">?</button>
      )}
      {open && help && (
        <div className="fs-help-bg" onClick={() => setOpen(false)}>
          <div className="fs-help" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="fs-help-head">
              <img src="/logo-192.jpg" alt="" />
              <div><h2>{help.title}</h2><p>{help.sub}</p></div>
              <button className="fs-help-x" onClick={() => setOpen(false)} aria-label="Chiudi">✕</button>
            </div>
            <div className="fs-help-body">
              {help.steps.map(([ico, txt], i) => (
                <div key={i} className="fs-help-step"><span className="n">{ico}</span><span>{txt}</span></div>
              ))}
              {help.links && (
                <div className="fs-help-links">
                  {help.links.map(([label, href]) => (
                    <a key={href} href={href} onClick={(e) => { e.preventDefault(); setOpen(false); router.push(href); }}>{label}</a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showNav && (
        <nav className="fs-nav" aria-label="Sezioni principali">
          {NAV.map(([ico, label, href]) => (
            <a key={href} href={href} className={path === href ? "on" : ""} onClick={(e) => { e.preventDefault(); router.push(href); }}>
              <span className="ico">{ico}</span>{label}
            </a>
          ))}
          <button onClick={() => { if (path === "/") window.dispatchEvent(new Event("fs-open-menu")); else router.push("/?menu=1"); }}>
            <span className="ico">☰</span>Altro
          </button>
        </nav>
      )}
    </>
  );
}
