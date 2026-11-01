import { avatarSvg } from "@/components/avatar";

export type Card = {
  id: string; state: "attiva" | "riposo" | "in_servizio" | "scaduta"; rest_until: string | null;
  expires_at: string | null; services_completed: number; energy: number;
  volunteer_id: string; first_name: string; last_name: string; nickname: string | null;
  role: "autista" | "soccorritore_base" | "soccorritore_avanzato" | "caposervizio";
  rarity: "comune" | "epica" | "leggendaria"; gender: string | null; avatar_url: string | null;
  stat_guida: number; stat_soccorso: number; stat_resilienza: number; pros: string[]; cons: string[];
  avanzato?: boolean; lent_to?: string | null; lent_from?: string | null;
};

export const ROLE: Record<Card["role"], { label: string; icon: string }> = {
  autista: { label: "Autista", icon: "🚑" },
  soccorritore_base: { label: "Soccorritore", icon: "🩹" },
  soccorritore_avanzato: { label: "Soccorritore avanzato", icon: "💉" },
  caposervizio: { label: "Caposervizio", icon: "⭐" },
};
// Etichetta del ruolo: un autista può essere anche avanzato
export function roleLabel(c: Pick<Card, "role" | "avanzato">) {
  return c.role === "autista" && c.avanzato ? "Autista avanzato" : ROLE[c.role].label;
}
export const RARITY: Record<Card["rarity"], { label: string; border: string; glow: string; text: string }> = {
  comune: { label: "Comune", border: "#9CA3AF", glow: "none", text: "#4B5563" },
  epica: { label: "Epica", border: "#8B5CF6", glow: "0 0 14px rgba(139,92,246,.45)", text: "#6D28D9" },
  leggendaria: { label: "Leggendaria", border: "#F59E0B", glow: "0 0 18px rgba(245,158,11,.6)", text: "#B45309" },
};

function stateLabel(c: Card) {
  if (c.state === "scaduta") return { text: "Contratto scaduto", color: "#6B7280" };
  if (c.state === "in_servizio") return { text: "In servizio", color: "#2563EB" };
  if (c.state === "riposo" && c.rest_until && new Date(c.rest_until) > new Date())
    return { text: `Riposo fino alle ${new Date(c.rest_until).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`, color: "#A16207" };
  return { text: "Pronto", color: "#16A34A" };
}

function daysLeft(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "scaduto";
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d} g ${h} h` : `${h} h`;
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
      <span style={{ width: 62, color: "#555" }}>{label}</span>
      <div style={{ flex: 1, height: 5, background: "#eee", borderRadius: 3 }}>
        <div style={{ width: `${v}%`, height: 5, borderRadius: 3, background: v >= 80 ? "#F59E0B" : v >= 60 ? "#8B5CF6" : "#9CA3AF" }} />
      </div>
      <strong style={{ width: 22, textAlign: "right" }}>{v}</strong>
    </div>
  );
}

export default function VolunteerCard({ c, compact = false }: { c: Card; compact?: boolean }) {
  const r = RARITY[c.rarity];
  const st = stateLabel(c);
  const expired = c.state === "scaduta";
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: `3px solid ${r.border}`, boxShadow: r.glow,
                  padding: 12, opacity: expired ? 0.55 : 1, fontFamily: "system-ui, sans-serif", position: "relative" }}>
      <div style={{ position: "absolute", top: 8, right: 10, fontSize: 10, fontWeight: 800, letterSpacing: ".06em",
                    color: r.text, textTransform: "uppercase" }}>{r.label}</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {c.avatar_url
          ? <img src={c.avatar_url} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover" }} />
          : <span style={{ lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: avatarSvg(c.volunteer_id, c.gender, c.rarity, 64) }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.15 }}>{c.first_name} {c.last_name}</div>
          {c.nickname && <div style={{ fontSize: 12, color: "#666", fontStyle: "italic" }}>“{c.nickname}”</div>}
          <div style={{ fontSize: 12, marginTop: 2 }}>{ROLE[c.role].icon} {roleLabel(c)}</div>
          {c.lent_to && <div style={{ fontSize: 11, color: "#B45309", fontWeight: 700 }}>🤝 Prestato a {c.lent_to}</div>}
          {c.lent_from && <div style={{ fontSize: 11, color: "#15803D", fontWeight: 700 }}>🤝 In prestito da {c.lent_from}</div>}
        </div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 3 }}>
        {c.role === "autista" && <Stat label="Guida" v={c.stat_guida} />}
        <Stat label="Soccorso" v={c.stat_soccorso} />
        <Stat label="Resilienza" v={c.stat_resilienza} />
      </div>

      {!compact && (
        <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.4 }}>
          {c.pros.map((p) => <div key={p} style={{ color: "#166534" }}>＋ {p}</div>)}
          {c.cons.map((p) => <div key={p} style={{ color: "#B91C1C" }}>－ {p}</div>)}
        </div>
      )}

      {!expired && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555" }}>
            <span>Energia</span><strong>{Math.round(c.energy)}%</strong>
          </div>
          <div style={{ height: 7, background: "#eee", borderRadius: 4 }}>
            <div style={{ width: `${c.energy}%`, height: 7, borderRadius: 4,
                          background: c.energy >= 60 ? "#16A34A" : c.energy >= 30 ? "#EAB308" : "#DC2626" }} />
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11 }}>
        <span style={{ color: st.color, fontWeight: 700 }}>● {st.text}</span>
        {!expired && c.expires_at && <span style={{ color: "#666" }}>Contratto: {daysLeft(c.expires_at)}</span>}
      </div>
    </div>
  );
}
