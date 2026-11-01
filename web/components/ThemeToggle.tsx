"use client";

import { useEffect, useState } from "react";

export function isDark() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

// Tasto 🌙/☀️ per la modalità scura (salvata su questo dispositivo)
export default function ThemeToggle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(isDark()); }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("fs-theme", next ? "dark" : "light"); } catch { /* niente */ }
    setDark(next);
    window.dispatchEvent(new Event("fs-theme"));
  }

  return (
    <button onClick={toggle} className={className} style={style} title={dark ? "Modalità chiara" : "Modalità scura"}
            aria-label={dark ? "Modalità chiara" : "Modalità scura"}>
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
