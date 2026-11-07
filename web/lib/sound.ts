// Pochi effetti sonori sintetizzati (niente file audio). Si possono spegnere dal menu.
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

export function soundOn(): boolean {
  try { return localStorage.getItem("fs_sound") !== "0"; } catch { return true; }
}
export function setSoundOn(v: boolean) {
  try { localStorage.setItem("fs_sound", v ? "1" : "0"); } catch {}
}

function tone(c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, gain: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type; o.frequency.value = freq;
  o.connect(g); g.connect(c.destination);
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.03);
}

// Volutamente pochi: soldi incassati e mezzo in partenza.
export function playSound(name: "money" | "dispatch") {
  if (!soundOn()) return;
  const c = ac();
  if (!c) return;
  try {
    if (c.state === "suspended") c.resume();
    if (name === "money") {
      tone(c, 784, 0, 0.16, "triangle", 0.09);   // Sol
      tone(c, 1047, 0.07, 0.20, "triangle", 0.09); // Do
    } else {
      tone(c, 523, 0, 0.09, "square", 0.05);
      tone(c, 784, 0.08, 0.12, "square", 0.05);
    }
  } catch { /* ignora */ }
}
