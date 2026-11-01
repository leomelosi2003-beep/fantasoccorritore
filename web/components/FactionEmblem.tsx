// Stemmi delle tre fazioni: tre stili di colore. Il nome dell'associazione lo sceglie il giocatore.
export type FactionStyle = "blu_giallo" | "arancio_nero" | "rosso_bianco";

export const FACTION_STYLES: { type: FactionStyle; colors: string[] }[] = [
  { type: "blu_giallo",   colors: ["#1E3A8A", "#FACC15"] },
  { type: "arancio_nero", colors: ["#F97316", "#111111", "#FFFFFF"] },
  { type: "rosso_bianco", colors: ["#DC2626", "#FFFFFF"] },
];

// Stessi stemmi come stringa SVG, per le icone dei marker della mappa (Leaflet vuole HTML)
const INNER: Record<FactionStyle, string> = {
  blu_giallo:
    '<path d="M50 4 L90 16 V48 C90 72 72 88 50 96 C28 88 10 72 10 48 V16 Z" fill="#1E3A8A"/>' +
    '<path d="M50 11 L83 21 V48 C83 67 69 81 50 88 C31 81 17 67 17 48 V21 Z" fill="none" stroke="#FACC15" stroke-width="2.5"/>' +
    '<text x="50" y="66" text-anchor="middle" font-family="Georgia, serif" font-size="44" font-weight="700" fill="#FACC15">M</text>',
  arancio_nero:
    '<circle cx="50" cy="50" r="47" fill="#111111"/><circle cx="50" cy="50" r="40" fill="#F97316"/>' +
    '<circle cx="50" cy="50" r="34" fill="none" stroke="#FFFFFF" stroke-width="1.5"/>' +
    '<text x="50" y="59" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-weight="700" fill="#FFFFFF" stroke="#111111" stroke-width="1.2" paint-order="stroke">P.A.</text>',
  rosso_bianco:
    '<rect x="38" y="14" width="24" height="72" fill="#DC2626"/><rect x="14" y="38" width="72" height="24" fill="#DC2626"/>',
};

export function emblemSvg(type: FactionStyle, size: number, logo?: string | null): string {
  if (logo) return `<img src="${logo.replace(/"/g, "")}" width="${size}" height="${size}" style="border-radius:50%;object-fit:cover;display:block" alt=""/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${INNER[type]}</svg>`;
}

export default function FactionEmblem({
  type, size = 96, logo,
}: { type: FactionStyle; size?: number; logo?: string | null }) {
  // Logo caricato dal giocatore
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }} />;
  }
  const svg = { width: size, height: size, viewBox: "0 0 100 100", role: "img" as const };

  if (type === "blu_giallo") {
    // Scudo blu con bordo giallo e "M"
    return (
      <svg {...svg} aria-label="M">
        <path d="M50 4 L90 16 V48 C90 72 72 88 50 96 C28 88 10 72 10 48 V16 Z" fill="#1E3A8A" />
        <path d="M50 11 L83 21 V48 C83 67 69 81 50 88 C31 81 17 67 17 48 V21 Z"
              fill="none" stroke="#FACC15" strokeWidth="2.5" />
        <text x="50" y="66" textAnchor="middle" fontFamily="Georgia, serif"
              fontSize="44" fontWeight="700" fill="#FACC15">M</text>
      </svg>
    );
  }

  if (type === "arancio_nero") {
    // Badge rotondo arancio con anello nero e "P.A."
    return (
      <svg {...svg} aria-label="P.A.">
        <circle cx="50" cy="50" r="47" fill="#111111" />
        <circle cx="50" cy="50" r="40" fill="#F97316" />
        <circle cx="50" cy="50" r="34" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
        <text x="50" y="59" textAnchor="middle" fontFamily="Georgia, serif"
              fontSize="26" fontWeight="700" fill="#FFFFFF" stroke="#111111" strokeWidth="1.2"
              paintOrder="stroke">P.A.</text>
      </svg>
    );
  }

  // rosso_bianco: croce rossa su fondo bianco, senza cerchio intorno
  return (
    <svg {...svg} aria-label="Croce rossa">
      <rect x="38" y="14" width="24" height="72" fill="#DC2626" />
      <rect x="14" y="38" width="72" height="24" fill="#DC2626" />
    </svg>
  );
}
