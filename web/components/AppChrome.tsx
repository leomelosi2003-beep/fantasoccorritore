"use client";
// Parti comuni a tutte le pagine: barra in basso sul telefono e tasto "?" con la spiegazione della pagina.
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { helpFor } from "@/lib/help";
import { MODERN_CSS, MODERN_CSS_V2 } from "@/lib/modernTheme";

/** schermata d'ingresso: logo, sirene, ambulanza che attraversa; si salta toccando */
let splashDone = false;   // una sola volta per apertura del gioco
function Splash() {
  const [stage, setStage] = useState<"on" | "out" | "off">(() => (splashDone ? "off" : "on"));
  useEffect(() => {
    if (splashDone) return;
    splashDone = true;
    let lite = false;
    try { lite = localStorage.getItem("fs_perf") === "sempre"; } catch { /* */ }
    const a = setTimeout(() => setStage("out"), lite ? 900 : 2700), b = setTimeout(() => setStage("off"), lite ? 1300 : 3200);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  if (stage === "off") return null;
  const word = "Fanta", acc = "Soccorritore";
  return (
    <div className={`fs-splash${stage === "out" ? " out" : ""}`} onClick={() => { setStage("out"); setTimeout(() => setStage("off"), 450); }} role="presentation">
      <div className="glow b" /><div className="glow r" />
      <div className="box">
        <img className="logo" src="/logo-192.jpg" alt="FantaSoccorritore" />
        <div className="title">
          {word.split("").map((c, i) => <span key={i} style={{ animationDelay: `${300 + i * 45}ms` }}>{c}</span>)}
          {acc.split("").map((c, i) => <span key={"a" + i} className="acc" style={{ animationDelay: `${525 + i * 45}ms` }}>{c}</span>)}
        </div>
        <div className="sub">Centrale operativa · 118</div>
        <div className="road"><span className="amb">🚑</span></div>
        <div className="bar"><i /></div>
      </div>
      <div className="skip">Tocca per entrare</div>
    </div>
  );
}

const NAV: [string, string, string][] = [
  ["🗺️", "Mappa", "/"], ["🚑", "Garage", "/garage"], ["🏆", "Classifica", "/classifica"], ["🔧", "Officina", "/officina"], ["👥", "Squadra", "/squadra"],
];
function ToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 600);
    window.addEventListener("scroll", on, { passive: true }); on();
    return () => window.removeEventListener("scroll", on);
  }, []);
  return <button className={`fs-totop${show ? " show" : ""}`} aria-label="Torna su" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>↑</button>;
}

const NO_CHROME = ["/login", "/onboarding", "/reset", "/recupero", "/maxi", "/admin"];

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
  const noSplash = ["/maxi", "/recupero", "/reset"].some((p) => path === p || path.startsWith(p + "/"));
  if (hidden) return <><style dangerouslySetInnerHTML={{ __html: MODERN_CSS + MODERN_CSS_V2 }} />{!noSplash && <Splash />}</>;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: MODERN_CSS + MODERN_CSS_V2 }} />
      <Splash />
      {path !== "/" && <ToTop />}
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
        </nav>
      )}
    </>
  );
}
