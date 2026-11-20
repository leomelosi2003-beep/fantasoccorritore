// Colori dei profili in base allo stile dell'associazione
export const TYPE_COLORS: Record<string, { main: string; acc: string; text: string; label: string }> = {
  blu_giallo: { main: "#1E3A8A", acc: "#FACC15", text: "#fff", label: "Blu e giallo" },
  arancio_nero: { main: "#F97316", acc: "#111111", text: "#fff", label: "Arancio e nero" },
  rosso_bianco: { main: "#DC2626", acc: "#FFFFFF", text: "#fff", label: "Rosso e bianco" },
};
export const typeColors = (t?: string | null) => TYPE_COLORS[t ?? ""] ?? TYPE_COLORS.arancio_nero;
export const KIND_LABEL: Record<string, string> = {
  ambulanze: "🚑 Ambulanze", automediche: "🚙 Automediche", moto: "🏍️ Moto", barche: "🚤 Barche", antincendio: "🔥 Antincendio",
  maxi: "🆘 Mezzi maxi", ordinarie: "🚗 Ordinarie", passi_lunghi: "🛣️ Passi lunghi",
};
export const ROLE_ONE: Record<string, string> = {
  autista: "Autista", soccorritore_base: "Soccorritore", soccorritore_avanzato: "Soccorritore avanzato", caposervizio: "Caposervizio",
  infermiere: "Infermiere", medico: "Medico", bagnino: "Bagnino", aib: "Antincendio",
};
export const ROLE_LABEL: Record<string, string> = {
  autista: "Autisti", soccorritore_base: "Soccorritori", soccorritore_avanzato: "Soccorritori avanzati", caposervizio: "Capiservizio",
  infermiere: "Infermieri", medico: "Medici", bagnino: "Bagnini", aib: "Antincendio",
};
