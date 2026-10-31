// Stemmi originali delle fazioni: nessun logo ufficiale riprodotto.
type Faction = "pubblica_assistenza" | "misericordia" | "croce_rossa" | "custom";

export default function FactionEmblem({
  type, size = 96, name = "",
}: { type: Faction; size?: number; name?: string }) {
  const common = { width: size, height: size, viewBox: "0 0 100 100", role: "img" as const };

  if (type === "pubblica_assistenza") {
    // Badge rotondo con monogramma "P.A."
    return (
      <svg {...common} aria-label="Pubblica Assistenza">
        <circle cx="50" cy="50" r="47" fill="#0B3C7D" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="#F5A623" strokeWidth="2.5" />
        <circle cx="50" cy="50" r="35.5" fill="none" stroke="#F5A623" strokeWidth="0.8" />
        <text x="50" y="58" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif"
              fontSize="28" fontWeight="700" fill="#FFFFFF" letterSpacing="1">P.A.</text>
        <path d="M30 68 Q50 76 70 68" fill="none" stroke="#F5A623" strokeWidth="2" strokeLinecap="round" />
        <circle cx="50" cy="24" r="2.5" fill="#F5A623" />
      </svg>
    );
  }

  if (type === "misericordia") {
    // Scudo scuro con croce latina dorata e due rami
    return (
      <svg {...common} aria-label="Misericordia">
        <path d="M50 4 L90 16 V48 C90 72 72 88 50 96 C28 88 10 72 10 48 V16 Z" fill="#1C1C1E" />
        <path d="M50 10 L84 20 V48 C84 68 69 82 50 89 C31 82 16 68 16 48 V20 Z"
              fill="none" stroke="#C9A646" strokeWidth="1.5" />
        <rect x="46" y="22" width="8" height="52" rx="1.5" fill="#C9A646" />
        <rect x="33" y="36" width="34" height="8" rx="1.5" fill="#C9A646" />
        <path d="M30 78 C24 68 24 58 28 50" fill="none" stroke="#C9A646" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M70 78 C76 68 76 58 72 50" fill="none" stroke="#C9A646" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "croce_rossa") {
    // Cuore con tracciato ECG (l'emblema della croce rossa è protetto per legge)
    return (
      <svg {...common} aria-label="Croce Rossa">
        <circle cx="50" cy="50" r="47" fill="#FFFFFF" stroke="#D7262E" strokeWidth="3" />
        <path d="M50 80 C22 62 16 46 22 34 C28 22 44 22 50 34 C56 22 72 22 78 34 C84 46 78 62 50 80 Z"
              fill="#D7262E" />
        <polyline points="20,50 36,50 41,40 47,62 53,36 58,50 80,50"
                  fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  }

  // Fazione personalizzata: scudo con le iniziali del nome scelto
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]!.toUpperCase()).join("") || "?";
  return (
    <svg {...common} aria-label={name || "Associazione"}>
      <path d="M50 4 L90 16 V48 C90 72 72 88 50 96 C28 88 10 72 10 48 V16 Z" fill="#14532D" />
      <path d="M50 10 L84 20 V48 C84 68 69 82 50 89 C31 82 16 68 16 48 V20 Z"
            fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.7" />
      <text x="50" y="60" textAnchor="middle" fontFamily="Georgia, serif"
            fontSize="30" fontWeight="700" fill="#FFFFFF">{initials}</text>
    </svg>
  );
}
