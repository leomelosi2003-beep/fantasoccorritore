// Notifiche del browser (senza installare nulla): arrivano solo mentre il gioco è aperto in una scheda,
// e solo quando la scheda non è quella in primo piano. Si attivano/spengono dal menu.
export function notifySupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}
export function notifyOn(): boolean {
  if (!notifySupported()) return false;
  try { return localStorage.getItem("fs_notify") === "1" && Notification.permission === "granted"; } catch { return false; }
}
export async function setNotifyOn(v: boolean): Promise<boolean> {
  if (!notifySupported()) return false;
  if (v && Notification.permission !== "granted") {
    const p = await Notification.requestPermission();
    if (p !== "granted") return false;
  }
  try { localStorage.setItem("fs_notify", v ? "1" : "0"); } catch {}
  return v;
}
export function notify(title: string, body: string, tag?: string) {
  if (!notifyOn() || document.visibilityState === "visible") return;
  try {
    const n = new Notification(title, { body, tag, icon: "/icon.jpg" });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* alcuni browser mobili non permettono new Notification */ }
}
