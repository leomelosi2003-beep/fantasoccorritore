// Immagini provvisorie per modelli e allestitori: verranno sostituite dalle icone vere
// (vehicle_models.image_url e builders.logo_url) appena caricate.

const MODEL_SHAPE: Record<string, { roof: number; nose: number; color: string }> = {
  "R-Masteron":   { roof: 30, nose: 34, color: "#e9eef3" },
  "F-Ducalis":    { roof: 26, nose: 40, color: "#f4f4f2" },
  "M-Sprinterix": { roof: 22, nose: 48, color: "#ffffff" },
  "V-Craftor":    { roof: 24, nose: 44, color: "#f7f7f7" },
};

export function ModelImage({ name, url, stripe = "#F97316", height = 90 }: {
  name: string; url?: string | null; stripe?: string; height?: number;
}) {
  if (url) return <img src={url} alt={name} style={{ height, maxWidth: "100%", objectFit: "contain" }} />;
  const s = MODEL_SHAPE[name] ?? { roof: 26, nose: 40, color: "#f4f4f2" };
  return (
    <svg viewBox="0 0 220 110" style={{ height, maxWidth: "100%" }} role="img" aria-label={name}>
      <ellipse cx="110" cy="104" rx="98" ry="5" fill="rgba(0,0,0,.15)" />
      <path d={`M8 ${s.roof} h130 v${92 - s.roof} H8 Z`} fill={s.color} stroke="#c9ccd1" />
      <path d={`M138 ${s.roof + 14} h${s.nose - 10} l${68 - s.nose} 26 v22 H138 Z`} fill={s.color} stroke="#c9ccd1" />
      <path d={`M146 ${s.roof + 20} h${s.nose - 18} l16 16 h-${s.nose - 2} Z`} fill="#9cc7ea" />
      <rect x="8" y="64" width="198" height="9" fill={stripe} />
      <rect x="30" y={s.roof - 7} width="40" height="7" rx="2" fill="#2563eb" />
      <rect x="76" y={s.roof - 7} width="40" height="7" rx="2" fill="#2563eb" />
      <circle cx="45" cy="92" r="13" fill="#222" /><circle cx="45" cy="92" r="5" fill="#999" />
      <circle cx="170" cy="92" r="13" fill="#222" /><circle cx="170" cy="92" r="5" fill="#999" />
    </svg>
  );
}

export function BuilderLogo({ name, url, size = 56 }: { name: string; url?: string | null; size?: number }) {
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, objectFit: "contain" }} />;
  const ini = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: 12, background: "#111", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: size * 0.36, fontFamily: "Georgia, serif" }}>{ini}</div>
  );
}
