// Finestra di conferma con lo stile del gioco, al posto di quella grigia del browser.
// Uso: if (!(await gameConfirm("Comprare il pacchetto per 4.500 €?"))) return;
// La prima riga del testo diventa il titolo, il resto la descrizione.
export function gameConfirm(text: string, opts: { ok?: string; cancel?: string; danger?: boolean } = {}): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  const dark = document.documentElement.classList.contains("dark");
  const [title, ...rest] = text.split("\n");
  const body = rest.join("\n").trim();
  const danger = opts.danger ?? /elimin|vend|ritir|scioglie|annull|licenz|rimuov/i.test(text);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return new Promise((resolve) => {
    const bg = document.createElement("div");
    bg.setAttribute("role", "dialog");
    bg.setAttribute("aria-modal", "true");
    bg.style.cssText = "position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,.55);display:flex;align-items:center;" +
      "justify-content:center;padding:16px;font-family:system-ui,-apple-system,sans-serif;animation:fsc-in .12s ease-out";
    const card = dark ? "#1b1f27" : "#fff", ink = dark ? "#eceef3" : "#111", sub = dark ? "#b4bac6" : "#555";
    const okBg = danger ? "#DC2626" : "#16A34A";
    bg.innerHTML = `
      <style>@keyframes fsc-in{from{opacity:0}to{opacity:1}}@keyframes fsc-pop{from{transform:scale(.94)}to{transform:none}}</style>
      <div style="width:min(420px,100%);background:${card};color:${ink};border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.45);
                  overflow:hidden;animation:fsc-pop .14s ease-out">
        <div style="height:6px;background:${okBg}"></div>
        <div style="padding:18px 18px 4px">
          <div style="font-weight:800;font-size:17px;line-height:1.35">${esc(title)}</div>
          ${body ? `<div style="margin-top:8px;font-size:14px;line-height:1.5;color:${sub};white-space:pre-line">${esc(body)}</div>` : ""}
        </div>
        <div style="display:flex;gap:8px;padding:16px 18px 18px">
          <button data-v="0" style="flex:1;padding:12px;border-radius:12px;border:none;cursor:pointer;font-weight:700;font-size:15px;
                  background:${dark ? "#2a303c" : "#eee"};color:${ink}">${esc(opts.cancel ?? "Annulla")}</button>
          <button data-v="1" style="flex:1;padding:12px;border-radius:12px;border:none;cursor:pointer;font-weight:800;font-size:15px;
                  background:${okBg};color:#fff">${esc(opts.ok ?? "Conferma")}</button>
        </div>
      </div>`;
    const done = (v: boolean) => { document.removeEventListener("keydown", onKey); bg.remove(); resolve(v); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") done(false); if (e.key === "Enter") done(true); };
    bg.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t === bg) return done(false);
      const v = t.closest("button")?.getAttribute("data-v");
      if (v != null) done(v === "1");
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(bg);
    (bg.querySelector('button[data-v="1"]') as HTMLButtonElement | null)?.focus();
  });
}
