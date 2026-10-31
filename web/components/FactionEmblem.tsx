// Stemmi originali: tre stili di colore, nessun nome o logo di associazioni reali.
// Il giocatore sceglie sempre il nome; lo stemma mostra le sue iniziali.
export type FactionStyle = "blu_giallo" | "arancio_nero" | "rosso_bianco";

export const FACTION_STYLES: { type: FactionStyle; colors: string[] }[] = [
  { type: "blu_giallo",   colors: ["#1E3A8A", "#FACC15"] },
  { type: "arancio_nero", colors: ["#F97316", "#111111", "#FFFFFF"] },
  { type: "rosso_bianco", colors: ["#DC2626", "#FFFFFF"] },
];

function initialsOf(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]!.toUpperCase()).join("") || "?";
}

export default function FactionEmblem({
  type, name = "", size = 96,
}: { type: FactionStyle; name?: string; size?: number }) {
  const ini = initialsOf(name);
  const fs = ini.length > 1 ? 26 : 34;
  const svg = { width: size, height: size, viewBox: "0 0 100 100", role: "img" as const, "aria-label": name || "Stemma" };

  if (type === "blu_giallo") {
    // Scudo blu con bordo e stella gialli
    return (
      <svg {...svg}>
        <path d="M50 4 L90 16 V48 C90 72 72 88 50 96 C28 88 10 72 10 48 V16 Z" fill="#1E3A8A" />
        <path d="M50 11 L83 21 V48 C83 67 69 81 50 88 C31 81 17 67 17 48 V21 Z"
              fill="none" stroke="#FACC15" strokeWidth="2.5" />
        <path d="M50 22 l2.4 4.9 5.4 0.8 -3.9 3.8 0.9 5.4 -4.8 -2.5 -4.8 2.5 0.9 -5.4 -3.9 -3.8 5.4 -0.8 z"
              fill="#FACC15" />
        <text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif"
              fontSize={fs} fontWeight="700" fill="#FACC15">{ini}</text>
      </svg>
    );
  }

  if (type === "arancio_nero") {
    // Badge rotondo arancio con anello nero e iniziali bianche
    return (
      <svg {...svg}>
        <circle cx="50" cy="50" r="47" fill="#111111" />
        <circle cx="50" cy="50" r="40" fill="#F97316" />
        <circle cx="50" cy="50" r="34" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
        <text x="50" y={ini.length > 1 ? 59 : 62} textAnchor="middle" fontFamily="Georgia, serif"
              fontSize={fs} fontWeight="700" fill="#FFFFFF" stroke="#111111" strokeWidth="1.2"
              paintOrder="stroke">{ini}</text>
      </svg>
    );
  }

  // rosso_bianco: disco bianco con anello rosso e cuore rosso
  return (
    <svg {...svg}>
      <circle cx="50" cy="50" r="47" fill="#FFFFFF" stroke="#DC2626" strokeWidth="4" />
      <path d="M50 84 C20 64 13 46 20 33 C27 20 44 20 50 33 C56 20 73 20 80 33 C87 46 80 64 50 84 Z"
            fill="#DC2626" />
      <text x="50" y="60" textAnchor="middle" fontFamily="Georgia, serif"
            fontSize={ini.length > 1 ? 22 : 28} fontWeight="700" fill="#FFFFFF">{ini}</text>
    </svg>
  );
}
