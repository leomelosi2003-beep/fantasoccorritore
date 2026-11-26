// Icone disegnate del gioco (al posto delle emoji): riquadro colorato con disegno bianco e un tocco di colore.
// Leggere: SVG nella pagina, nessuna immagine da scaricare.
import type { ReactNode } from "react";

const W = "#fff";
const Y = "#FDE047"; // accento giallo
const R = "#EF4444"; // rosso
const S = "rgba(15,23,42,.18)"; // ombra

type Def = { bg: [string, string]; draw: ReactNode };

const ICONS: Record<string, Def> = {
  ambulance: { bg: ["#FB923C", "#EA580C"], draw: <>
    <rect x="17" y="10" width="8" height="4" rx="1.5" fill={Y} />
    <path d="M6 16h22v18H6z" fill={W} />
    <path d="M28 21h7l6 6v7H28z" fill={W} />
    <path d="M30 23h4.5l4 4H30z" fill="#BAE6FD" />
    <path d="M15 19.5h4v3.5h3.5v4H19v3.5h-4V27h-3.5v-4H15z" fill={R} />
    <circle cx="13" cy="35" r="4.2" fill="#1E293B" /><circle cx="13" cy="35" r="1.6" fill={W} />
    <circle cx="34" cy="35" r="4.2" fill="#1E293B" /><circle cx="34" cy="35" r="1.6" fill={W} />
  </> },
  team: { bg: ["#A78BFA", "#6D28D9"], draw: <>
    <circle cx="15" cy="17" r="5" fill="#DDD6FE" /><path d="M6 34c0-6 4-9 9-9s9 3 9 9z" fill="#DDD6FE" />
    <circle cx="33" cy="17" r="5" fill="#DDD6FE" /><path d="M24 34c0-6 4-9 9-9s9 3 9 9z" fill="#DDD6FE" />
    <circle cx="24" cy="15" r="6" fill={W} /><path d="M13 38c0-7 5-11 11-11s11 4 11 11z" fill={W} />
    <path d="M22 30h4v2.5h2.5v3H26V38h-4v-2.5h-2.5v-3H22z" fill={R} />
  </> },
  wrench: { bg: ["#64748B", "#1E293B"], draw: <>
    <circle cx="31" cy="31" r="8" fill={Y} /><circle cx="31" cy="31" r="3" fill="#1E293B" />
    {[0, 60, 120, 180, 240, 300].map((a) => <rect key={a} x="29.5" y="20" width="3" height="4" rx="1" fill={Y} transform={`rotate(${a} 31 31)`} />)}
    <path d="M10 33l14-14a7 7 0 0 1 9-9l-4 4 1 4 4 1 4-4a7 7 0 0 1-9 9L15 38a3.5 3.5 0 0 1-5-5z" fill={W} />
  </> },
  house: { bg: ["#60A5FA", "#1D4ED8"], draw: <>
    <path d="M24 7L5 22h5v18h28V22h5z" fill={W} />
    <path d="M24 7L5 22h5l14-11 14 11h5z" fill={R} />
    <rect x="20" y="29" width="8" height="11" rx="1.5" fill="#1E3A8A" />
    <path d="M22.5 18h3v2.5H28v3h-2.5V26h-3v-2.5H20v-3h2.5z" fill={R} />
  </> },
  robot: { bg: ["#2DD4BF", "#0F766E"], draw: <>
    <rect x="22.5" y="5" width="3" height="7" fill={W} /><circle cx="24" cy="5.5" r="3" fill={Y} />
    <rect x="9" y="12" width="30" height="22" rx="7" fill={W} />
    <rect x="13" y="17" width="22" height="11" rx="5" fill="#134E4A" />
    <circle cx="19" cy="22.5" r="2.6" fill="#5EEAD4" /><circle cx="29" cy="22.5" r="2.6" fill="#5EEAD4" />
    <rect x="5" y="19" width="4" height="9" rx="2" fill="#CCFBF1" /><rect x="39" y="19" width="4" height="9" rx="2" fill="#CCFBF1" />
    <rect x="16" y="36" width="16" height="6" rx="3" fill="#CCFBF1" />
  </> },
  brush: { bg: ["#F472B6", "#BE185D"], draw: <>
    <path d="M30 6l12 12-13 13-12-12z" fill={W} />
    <path d="M17 19l12 12-3 3-12-12z" fill="#FBCFE8" />
    <path d="M14 22l12 12c-2 4-6 7-12 7-3 0-6-1-8-3 3-1 4-3 4-6 0-5 2-8 4-10z" fill={Y} />
    <circle cx="36" cy="12" r="2" fill="#F9A8D4" />
  </> },
  target: { bg: ["#4ADE80", "#15803D"], draw: <>
    <circle cx="22" cy="26" r="16" fill={W} /><circle cx="22" cy="26" r="11" fill={R} />
    <circle cx="22" cy="26" r="6.5" fill={W} /><circle cx="22" cy="26" r="2.8" fill={R} />
    <path d="M22 26L38 10" stroke="#1E293B" strokeWidth="2.8" strokeLinecap="round" />
    <path d="M34 8l6 0 0 6-4 0 0-2z" fill={Y} />
  </> },
  transfer: { bg: ["#22D3EE", "#0E7490"], draw: <>
    <rect x="5" y="9" width="17" height="20" rx="3" fill={W} />
    <path d="M11.5 13h4v3.5H19v4h-3.5V24h-4v-3.5H8v-4h3.5z" fill={R} />
    <rect x="26" y="19" width="17" height="20" rx="3" fill={W} />
    <path d="M32.5 23h4v3.5H40v4h-3.5V34h-4v-3.5H29v-4h3.5z" fill={R} />
    <path d="M24 9h8l-3-3m3 3l-3 3" stroke={Y} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M24 39h-8l3 3m-3-3l3-3" stroke={Y} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </> },
  news: { bg: ["#F87171", "#B91C1C"], draw: <>
    <path d="M9 9h26v28a3 3 0 0 0 3 3H12a3 3 0 0 1-3-3z" fill={W} />
    <path d="M35 17h5v20a3 3 0 0 1-6 0V17z" fill="#FECACA" />
    <rect x="13" y="13" width="18" height="5" rx="1" fill="#1E293B" />
    <rect x="13" y="21" width="8" height="8" rx="1" fill={Y} />
    <rect x="23" y="21" width="8" height="2.2" rx="1" fill="#94A3B8" /><rect x="23" y="25" width="8" height="2.2" rx="1" fill="#94A3B8" />
    <rect x="13" y="31" width="18" height="2.2" rx="1" fill="#94A3B8" />
  </> },
  sparkle: { bg: ["#C084FC", "#7E22CE"], draw: <>
    <path d="M20 6c1.5 7 4 9.5 11 11-7 1.5-9.5 4-11 11-1.5-7-4-9.5-11-11 7-1.5 9.5-4 11-11z" fill={W} />
    <path d="M34 24c1 4.5 2.5 6 7 7-4.5 1-6 2.5-7 7-1-4.5-2.5-6-7-7 4.5-1 6-2.5 7-7z" fill={Y} />
    <circle cx="12" cy="36" r="3" fill="#E9D5FF" />
  </> },
  trophy: { bg: ["#FBBF24", "#B45309"], draw: <>
    <path d="M14 7h20v10a10 10 0 0 1-20 0z" fill={Y} />
    <path d="M14 10H7v3a7 7 0 0 0 7 7M34 10h7v3a7 7 0 0 1-7 7" stroke={W} strokeWidth="3" fill="none" />
    <rect x="21" y="26" width="6" height="7" fill={W} />
    <rect x="14" y="33" width="20" height="7" rx="2" fill={W} />
    <path d="M24 10l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="#B45309" />
  </> },
  idcard: { bg: ["#3B82F6", "#1E3A8A"], draw: <>
    <rect x="5" y="11" width="38" height="27" rx="4" fill={W} />
    <rect x="5" y="11" width="38" height="7" rx="3" fill={Y} />
    <circle cx="16" cy="26" r="4.5" fill="#93C5FD" /><path d="M9 35c0-4 3-6 7-6s7 2 7 6z" fill="#93C5FD" />
    <rect x="26" y="23" width="13" height="3" rx="1.5" fill="#94A3B8" /><rect x="26" y="29" width="9" height="3" rx="1.5" fill="#CBD5E1" />
  </> },
  medbag: { bg: ["#2DD4BF", "#0F766E"], draw: <>
    <path d="M18 11a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3h-3v-3h-6v3h-3z" fill={W} />
    <rect x="6" y="14" width="36" height="26" rx="5" fill={W} />
    <path d="M21 19h6v5h5v6h-5v5h-6v-5h-5v-6h5z" fill={R} />
  </> },
  tag: { bg: ["#FBBF24", "#B45309"], draw: <>
    <path d="M24 7h15a2 2 0 0 1 2 2v15L22 43 5 26z" fill={W} />
    <circle cx="33" cy="15" r="3.2" fill="#B45309" />
    <path d="M16 25l9 9" stroke={R} strokeWidth="3" strokeLinecap="round" /><path d="M21 21l7 7" stroke={Y} strokeWidth="3" strokeLinecap="round" />
  </> },
  briefcase: { bg: ["#818CF8", "#3730A3"], draw: <>
    <path d="M17 14v-3a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3h-3v-3h-8v3z" fill={W} />
    <rect x="5" y="14" width="38" height="25" rx="5" fill={W} />
    <rect x="5" y="22" width="38" height="4" fill="#C7D2FE" />
    <rect x="20" y="20" width="8" height="8" rx="2" fill={Y} />
  </> },
  shield: { bg: ["#4ADE80", "#15803D"], draw: <>
    <path d="M24 5l16 6v11c0 10-7 17-16 21C15 39 8 32 8 22V11z" fill={W} />
    <path d="M24 5l16 6v11c0 10-7 17-16 21z" fill="#DCFCE7" />
    <path d="M24 14l3 6.2 6.8 1-4.9 4.7 1.2 6.8L24 29.5l-6.1 3.2 1.2-6.8-4.9-4.7 6.8-1z" fill={Y} />
  </> },
  link: { bg: ["#22D3EE", "#0E7490"], draw: <>
    <rect x="5" y="16" width="22" height="16" rx="8" fill="none" stroke={W} strokeWidth="5" />
    <rect x="21" y="16" width="22" height="16" rx="8" fill="none" stroke={Y} strokeWidth="5" />
    <path d="M21 20.5v7" stroke={W} strokeWidth="5" strokeLinecap="round" />
  </> },
  megaphone: { bg: ["#FB7185", "#BE123C"], draw: <>
    <path d="M8 19h7l17-9v28l-17-9H8a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3z" fill={W} />
    <path d="M13 29l3 10h5l-3-10z" fill="#FECDD3" />
    <path d="M37 17c2.5 2 2.5 12 0 14M40 13c5 4 5 18 0 22" stroke={Y} strokeWidth="2.6" fill="none" strokeLinecap="round" />
  </> },
  search: { bg: ["#94A3B8", "#334155"], draw: <>
    <circle cx="20" cy="20" r="12" fill="#E0F2FE" stroke={W} strokeWidth="5" />
    <path d="M14 18a7 7 0 0 1 6-5" stroke={W} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <path d="M29 29l11 11" stroke={Y} strokeWidth="7" strokeLinecap="round" />
  </> },
  coins: { bg: ["#4ADE80", "#166534"], draw: <>
    <ellipse cx="18" cy="35" rx="12" ry="5" fill="#FDE68A" /><rect x="6" y="28" width="24" height="7" fill="#FDE68A" />
    <ellipse cx="18" cy="28" rx="12" ry="5" fill={Y} /><rect x="6" y="21" width="24" height="7" fill={Y} />
    <ellipse cx="18" cy="21" rx="12" ry="5" fill="#FEF9C3" />
    <path d="M36 32V12m-6 6l6-6 6 6" stroke={W} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </> },
  chart: { bg: ["#60A5FA", "#1E40AF"], draw: <>
    <rect x="6" y="8" width="36" height="32" rx="5" fill={W} />
    <rect x="11" y="27" width="5" height="8" rx="1.5" fill="#BFDBFE" /><rect x="19" y="22" width="5" height="13" rx="1.5" fill="#93C5FD" />
    <rect x="27" y="25" width="5" height="10" rx="1.5" fill="#BFDBFE" /><rect x="35" y="17" width="4" height="18" rx="1.5" fill="#93C5FD" />
    <path d="M11 22l8-7 8 4 10-8" stroke={R} strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </> },
  building: { bg: ["#3B82F6", "#172554"], draw: <>
    <rect x="9" y="8" width="20" height="33" rx="2" fill={W} /><rect x="29" y="18" width="11" height="23" rx="2" fill="#DBEAFE" />
    {[13, 21].map((x) => [12, 18, 24, 30].map((y) => <rect key={`${x}${y}`} x={x} y={y} width="4" height="3.5" rx=".8" fill="#60A5FA" />))}
    <rect x="32" y="22" width="5" height="3" rx=".8" fill="#60A5FA" /><rect x="32" y="28" width="5" height="3" rx=".8" fill="#60A5FA" />
    <rect x="16" y="35" width="6" height="6" fill={Y} />
  </> },
  gear: { bg: ["#A78BFA", "#4C1D95"], draw: <>
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <rect key={a} x="21" y="5" width="6" height="8" rx="1.5" fill={W} transform={`rotate(${a} 24 24)`} />)}
    <circle cx="24" cy="24" r="12" fill={W} /><circle cx="24" cy="24" r="5" fill={Y} />
  </> },
  map: { bg: ["#38BDF8", "#0369A1"], draw: <>
    <path d="M5 12l12-4 14 4 12-4v28l-12 4-14-4-12 4z" fill={W} />
    <path d="M17 8v28M31 12v28" stroke="#BAE6FD" strokeWidth="2" />
    <path d="M24 13a7 7 0 0 1 7 7c0 5-7 12-7 12s-7-7-7-12a7 7 0 0 1 7-7z" fill={R} /><circle cx="24" cy="20" r="2.6" fill={W} />
  </> },
  fuel: { bg: ["#38BDF8", "#0369A1"], draw: <>
    <rect x="8" y="8" width="20" height="33" rx="3" fill={W} /><rect x="12" y="12" width="12" height="8" rx="1.5" fill="#BAE6FD" />
    <path d="M28 16h4l4 4v14a3 3 0 0 1-6 0v-8h-2" stroke={Y} strokeWidth="3" fill="none" strokeLinejoin="round" />
    <path d="M18 25c3 4 4 6 0 9-4-3-3-5 0-9z" fill={R} />
  </> },
  heart: { bg: ["#F472B6", "#9D174D"], draw: <>
    <path d="M24 40S6 29 6 17a9 9 0 0 1 18-2 9 9 0 0 1 18 2c0 12-18 23-18 23z" fill={W} />
    <path d="M12 23h6l3-5 4 10 3-5h8" stroke={R} strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </> },
  book: { bg: ["#60A5FA", "#1D4ED8"], draw: <>
    <path d="M24 12c-5-4-12-4-18-2v28c6-2 13-2 18 2z" fill={W} /><path d="M24 12c5-4 12-4 18-2v28c-6-2-13-2-18 2z" fill="#DBEAFE" />
    <path d="M24 12v28" stroke="#93C5FD" strokeWidth="2" />
  </> },
};

// emoji usata finora → icona disegnata
const EMOJI: Record<string, string> = {
  "🚑": "ambulance", "👥": "team", "🔧": "wrench", "🏠": "house", "🤖": "robot", "🖌️": "brush", "🎯": "target", "🔁": "transfer",
  "📰": "news", "🆕": "sparkle", "🏆": "trophy", "🪪": "idcard", "🛒": "medbag", "🏷️": "tag", "💼": "briefcase", "🤝": "shield",
  "🔗": "link", "📢": "megaphone", "🔎": "search", "📊": "coins", "📈": "chart", "🏢": "building", "🛠️": "gear", "🗺️": "map",
  "⛽": "fuel", "📖": "book", "💝": "heart",
};
export const iconFor = (k: string) => (ICONS[k] ? k : EMOJI[k]) ?? null;

export default function AppIcon({ name, size = 44, radius }: { name: string; size?: number; radius?: number }) {
  const key = iconFor(name);
  if (!key) return <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>{name}</span>;
  const d = ICONS[key];
  const id = `ai-${key}`;
  return (
    <svg className="fs-appicon" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={d.bg[0]} /><stop offset="1" stopColor={d.bg[1]} /></linearGradient>
      </defs>
      <rect width="48" height="48" rx={radius ?? 14} fill={`url(#${id})`} />
      <rect width="48" height="24" rx={radius ?? 14} fill="#fff" opacity=".12" />
      <g style={{ filter: `drop-shadow(0 1.5px 0 ${S})` }}>{d.draw}</g>
    </svg>
  );
}
