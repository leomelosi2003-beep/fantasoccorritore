// Avatar illustrati dei volontari, generati dall'id (sempre uguali per la stessa carta).
const SKIN = ["#F5D0B5", "#E8B48F", "#C68C63", "#8D5A3B", "#F1C7A1"];
const HAIR = ["#2B1B12", "#5A3A22", "#A0522D", "#D9A441", "#1F1F1F", "#7A7A7A", "#B5651D"];
const BG: Record<string, string[]> = {
  comune: ["#E5E7EB", "#D1D5DB"],
  epica: ["#DDD6FE", "#A78BFA"],
  leggendaria: ["#FDE68A", "#F59E0B"],
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

export function avatarSvg(seed: string, gender: string | null, rarity: string, size = 96): string {
  const h = hash(seed);
  const skin = SKIN[h % SKIN.length];
  const hair = HAIR[(h >> 3) % HAIR.length];
  const [bg1, bg2] = BG[rarity] ?? BG.comune;
  const female = gender === "f";
  const glasses = (h >> 7) % 5 === 0;
  const beard = !female && (h >> 9) % 4 === 0;
  const smile = (h >> 11) % 3;
  const id = `g${h % 100000}`;

  const hairBack = female
    ? `<path d="M26 44 C24 22 76 22 74 44 L76 74 C66 80 34 80 24 74 Z" fill="${hair}"/>`
    : "";
  const hairTop = female
    ? `<path d="M30 40 C30 24 70 24 70 40 C64 32 52 30 44 34 C38 36 34 38 30 40 Z" fill="${hair}"/>`
    : (h >> 5) % 3 === 0
      ? `<path d="M31 38 C31 24 69 24 69 38 L66 34 L60 37 L54 33 L48 37 L42 33 L36 37 Z" fill="${hair}"/>`
      : `<path d="M30 40 C29 24 71 24 70 40 C64 33 40 31 30 40 Z" fill="${hair}"/>`;
  const mouth = smile === 0
    ? `<path d="M44 58 Q50 63 56 58" fill="none" stroke="#7A3E2B" stroke-width="2.2" stroke-linecap="round"/>`
    : smile === 1
      ? `<path d="M44 57 Q50 64 56 57 Z" fill="#7A3E2B"/>`
      : `<path d="M45 59 H55" stroke="#7A3E2B" stroke-width="2.2" stroke-linecap="round"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
  <rect width="100" height="100" rx="18" fill="url(#${id})"/>
  ${hairBack}
  <path d="M14 100 C16 80 30 72 50 72 C70 72 84 80 86 100 Z" fill="#F97316"/>
  <path d="M18 92 H82" stroke="#E5E7EB" stroke-width="4" opacity=".9"/>
  <path d="M44 72 L50 84 L56 72" fill="#1F2937"/>
  <rect x="44" y="62" width="12" height="12" fill="${skin}"/>
  <ellipse cx="50" cy="46" rx="19" ry="21" fill="${skin}"/>
  ${hairTop}
  <circle cx="43" cy="47" r="2.3" fill="#1F2937"/><circle cx="57" cy="47" r="2.3" fill="#1F2937"/>
  ${glasses ? `<g fill="none" stroke="#1F2937" stroke-width="1.6"><circle cx="43" cy="47" r="6"/><circle cx="57" cy="47" r="6"/><path d="M49 47 H51"/></g>` : ""}
  ${beard ? `<path d="M33 52 C34 68 66 68 67 52 C62 62 38 62 33 52 Z" fill="${hair}" opacity=".9"/>` : ""}
  ${mouth}
  </svg>`;
}
