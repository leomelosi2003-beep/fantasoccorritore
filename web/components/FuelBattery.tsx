// Indicatore del carburante a forma di batteria: verde sopra il 50%, giallo sopra il 20%, rosso sotto (vuoto = mezzi fermi).
export function fuelColor(pct: number) {
  return pct <= 0 ? "#9CA3AF" : pct < 20 ? "#DC2626" : pct < 50 ? "#EAB308" : "#16A34A";
}

export default function FuelBattery({ pct, width = 34, label, title }: {
  pct: number; width?: number; label?: string; title?: string;
}) {
  const p = Math.max(0, Math.min(100, pct));
  const h = Math.round(width * 0.5);
  const color = fuelColor(p);
  return (
    <span title={title} style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
      <span style={{ position: "relative", display: "inline-block", width, height: h, border: `2px solid ${p < 20 ? color : "#374151"}`,
                     borderRadius: 4, background: "#fff", boxSizing: "border-box", padding: 1 }}>
        <span style={{ display: "block", height: "100%", width: `${p}%`, background: color, borderRadius: 2,
                       transition: "width .4s, background .4s" }} />
        <span style={{ position: "absolute", right: -5, top: "50%", transform: "translateY(-50%)", width: 3, height: h * 0.45,
                       background: p < 20 ? color : "#374151", borderRadius: "0 2px 2px 0" }} />
        {p < 20 && (
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                         fontSize: h * 0.7, lineHeight: 1 }}>⛽</span>
        )}
      </span>
      {label && <span style={{ fontSize: 12, fontWeight: 700, color: p < 20 ? color : "inherit" }}>{label}</span>}
    </span>
  );
}
