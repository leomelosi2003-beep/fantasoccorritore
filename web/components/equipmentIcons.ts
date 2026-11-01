// Icone dei presidi (SVG originali, viewBox 0 0 64 64).
// Se in futuro equipment.image_url è valorizzato, si usa quell'immagine al posto di queste.
export const EQUIPMENT_ICONS: Record<string, string> = {
  dae: `
    <rect x="8" y="10" width="48" height="44" rx="8" fill="#16A34A"/>
    <rect x="8" y="10" width="48" height="10" rx="5" fill="#15803D"/>
    <rect x="26" y="5" width="12" height="7" rx="3" fill="#166534"/>
    <path d="M32 47 C18 38 15 31 18 26 C21 21 28 21 32 27 C36 21 43 21 46 26 C49 31 46 38 32 47 Z" fill="#fff"/>
    <path d="M34 26 L28 35 H32 L30 43 L37 33 H33 Z" fill="#FACC15" stroke="#16A34A" stroke-width="1"/>`,

  lt15: `
    <rect x="6" y="14" width="52" height="40" rx="6" fill="#374151"/>
    <rect x="22" y="8" width="20" height="8" rx="3" fill="none" stroke="#374151" stroke-width="4"/>
    <rect x="11" y="19" width="30" height="22" rx="2" fill="#0B1220"/>
    <polyline points="12,31 18,31 20,26 23,36 26,24 29,31 40,31" fill="none" stroke="#22C55E" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="49" cy="23" r="3.5" fill="#F59E0B"/><circle cx="49" cy="33" r="3.5" fill="#9CA3AF"/>
    <rect x="11" y="45" width="30" height="5" rx="2" fill="#4B5563"/>
    <text x="49" y="50" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="#fff">15</text>`,

  lt35: `
    <rect x="5" y="12" width="54" height="44" rx="7" fill="#1F2937"/>
    <rect x="21" y="6" width="22" height="8" rx="3" fill="none" stroke="#1F2937" stroke-width="4"/>
    <rect x="10" y="17" width="44" height="26" rx="3" fill="#0B1220"/>
    <polyline points="12,26 20,26 22,22 25,31 28,20 31,26 52,26" fill="none" stroke="#22C55E" stroke-width="1.8" stroke-linejoin="round"/>
    <polyline points="12,36 22,36 25,33 28,38 31,36 52,36" fill="none" stroke="#38BDF8" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M44 20 a3 3 0 0 1 6 0 M42 18 a6 6 0 0 1 10 0" fill="none" stroke="#38BDF8" stroke-width="1.4"/>
    <rect x="10" y="47" width="26" height="5" rx="2" fill="#374151"/>
    <text x="47" y="53" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="#fff">35</text>`,

  barella_std: `
    <rect x="6" y="24" width="52" height="8" rx="4" fill="#F97316"/>
    <rect x="6" y="20" width="12" height="6" rx="3" fill="#FDBA74"/>
    <rect x="4" y="32" width="56" height="4" rx="2" fill="#6B7280"/>
    <path d="M14 36 L24 50 M50 36 L40 50 M24 36 L14 50 M40 36 L50 50" stroke="#9CA3AF" stroke-width="3" stroke-linecap="round"/>
    <circle cx="14" cy="53" r="4" fill="#111"/><circle cx="24" cy="53" r="4" fill="#111"/>
    <circle cx="40" cy="53" r="4" fill="#111"/><circle cx="50" cy="53" r="4" fill="#111"/>`,

  barella_auto: `
    <rect x="6" y="22" width="48" height="8" rx="4" fill="#FACC15"/>
    <rect x="6" y="18" width="12" height="6" rx="3" fill="#FEF08A"/>
    <rect x="4" y="30" width="52" height="5" rx="2" fill="#111827"/>
    <rect x="22" y="35" width="16" height="10" rx="2" fill="#111827"/>
    <path d="M26 36 L33 36 L29 41 H34 L27 48" fill="none" stroke="#FACC15" stroke-width="2" stroke-linejoin="round"/>
    <path d="M14 35 L10 50 M46 35 L50 50" stroke="#374151" stroke-width="3" stroke-linecap="round"/>
    <circle cx="10" cy="53" r="4" fill="#111"/><circle cx="50" cy="53" r="4" fill="#111"/>
    <path d="M56 22 V8 M51 13 L56 8 L61 13" fill="none" stroke="#16A34A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,

  massaggiatore: `
    <path d="M10 54 V30 C10 16 20 8 32 8 C44 8 54 16 54 30 V54" fill="none" stroke="#1E3A8A" stroke-width="7" stroke-linecap="round"/>
    <rect x="24" y="12" width="16" height="16" rx="3" fill="#1E3A8A"/>
    <rect x="29" y="28" width="6" height="12" fill="#9CA3AF"/>
    <ellipse cx="32" cy="42" rx="9" ry="3.5" fill="#60A5FA"/>
    <rect x="4" y="52" width="56" height="6" rx="3" fill="#374151"/>
    <path d="M44 34 l4 0 M44 38 l6 0 M44 42 l4 0" stroke="#F97316" stroke-width="2" stroke-linecap="round"/>`,

  spinale: `
    <rect x="10" y="4" width="44" height="56" rx="14" fill="#F97316"/>
    <rect x="15" y="8" width="7" height="12" rx="3.5" fill="#fff" opacity=".9"/>
    <rect x="42" y="8" width="7" height="12" rx="3.5" fill="#fff" opacity=".9"/>
    <rect x="15" y="44" width="7" height="12" rx="3.5" fill="#fff" opacity=".9"/>
    <rect x="42" y="44" width="7" height="12" rx="3.5" fill="#fff" opacity=".9"/>
    <rect x="8" y="24" width="48" height="5" fill="#111827"/>
    <rect x="8" y="35" width="48" height="5" fill="#111827"/>
    <rect x="28" y="23" width="8" height="7" rx="1" fill="#9CA3AF"/><rect x="28" y="34" width="8" height="7" rx="1" fill="#9CA3AF"/>`,

  borsoni: `
    <path d="M22 14 C22 6 42 6 42 14" fill="none" stroke="#7C2D12" stroke-width="4"/>
    <rect x="8" y="14" width="48" height="42" rx="9" fill="#EA580C"/>
    <rect x="8" y="26" width="48" height="4" fill="#C2410C"/>
    <rect x="14" y="40" width="36" height="12" rx="4" fill="#C2410C"/>
    <rect x="28" y="16" width="8" height="22" rx="1.5" fill="#fff"/>
    <rect x="21" y="23" width="22" height="8" rx="1.5" fill="#fff"/>
    <rect x="8" y="48" width="48" height="3" fill="#FACC15"/>`,
};

export function equipmentIconSvg(code: string, size = 64): string {
  const inner = EQUIPMENT_ICONS[code] ??
    `<rect x="8" y="8" width="48" height="48" rx="10" fill="#9CA3AF"/><text x="32" y="40" text-anchor="middle" font-size="22" fill="#fff">?</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${inner}</svg>`;
}
