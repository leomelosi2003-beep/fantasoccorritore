// Modalità leggera: se il sito va a scatti si spengono animazioni ed effetti pesanti.
// "auto" = la attiva da sola quando misura pochi fotogrammi al secondo; "on" = sempre; "off" = mai.
export type PerfMode = "auto" | "on" | "off";

// letto a ogni fotogramma dai mezzi in movimento (senza ridisegnare la pagina)
export const perf = { lite: false };

export function getPerfMode(): PerfMode {
  try { const v = localStorage.getItem("fs_perf"); return v === "on" || v === "off" ? v : "auto"; } catch { return "auto"; }
}
export function setPerfMode(m: PerfMode) {
  try { localStorage.setItem("fs_perf", m); if (m !== "auto") localStorage.removeItem("fs_perf_auto"); } catch {}
}
// l'attivazione automatica vale 24 ore: alla prossima apertura parte già leggero
export function autoLiteRemembered(): boolean {
  try { return Date.now() - Number(localStorage.getItem("fs_perf_auto") ?? 0) < 86_400_000; } catch { return false; }
}
export function rememberAutoLite() {
  try { localStorage.setItem("fs_perf_auto", String(Date.now())); } catch {}
}
export function applyLite(v: boolean) {
  perf.lite = v;
  if (typeof document !== "undefined") document.body.classList.toggle("fs-lite", v);
}

// Misura i fotogrammi al secondo a finestre di 2 s; chiama onSlow dopo 2 finestre lente di fila.
// Ignora i primi secondi (caricamento) e le finestre con la scheda nascosta.
export function watchFps(onSlow: () => void): () => void {
  let raf = 0, frames = 0, winStart = 0, slow = 0, stopped = false;
  const started = performance.now();
  const tick = (ts: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(tick);
    if (!winStart) { winStart = ts; frames = 0; return; }
    frames++;
    const dt = ts - winStart;
    if (dt < 2000) return;
    const fps = (frames * 1000) / dt;
    const valid = document.visibilityState === "visible" && document.hasFocus() && ts - started > 6000;
    if (valid) { slow = fps < 24 ? slow + 1 : 0; if (slow >= 2) { stopped = true; cancelAnimationFrame(raf); onSlow(); return; } }
    winStart = ts; frames = 0;
  };
  const onVis = () => { winStart = 0; };
  document.addEventListener("visibilitychange", onVis);
  raf = requestAnimationFrame(tick);
  return () => { stopped = true; cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", onVis); };
}
