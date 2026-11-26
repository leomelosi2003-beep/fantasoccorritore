import type { CSSProperties } from "react";

// Stili condivisi delle pagine (login, onboarding, barra in alto)
export const page: CSSProperties = {
  minHeight: "100vh", background: "radial-gradient(900px 500px at 50% -150px, #DBEAFE, #F3F6FB 70%)", fontFamily: "Inter, system-ui, -apple-system, sans-serif",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box",
};
export const card: CSSProperties = {
  background: "#fff", borderRadius: 26, padding: 24, width: "100%", maxWidth: 420,
  boxShadow: "0 1px 2px rgba(15,23,42,.05), 0 20px 50px rgba(15,23,42,.12)", boxSizing: "border-box", border: "1px solid #EDF1F7",
};
export const input: CSSProperties = {
  width: "100%", padding: "13px 14px", fontSize: 16, borderRadius: 14, border: "1px solid #DCE4EF", background: "#F8FAFD",
  boxSizing: "border-box", marginBottom: 12,
};
export const button: CSSProperties = {
  width: "100%", padding: "13px 14px", fontSize: 16, fontWeight: 800, borderRadius: 14, border: "none",
  background: "linear-gradient(135deg, #3B82F6, #1E3A8A)", color: "#fff", cursor: "pointer", boxShadow: "0 10px 24px rgba(30,58,138,.28)",
};
export const link: CSSProperties = {
  background: "none", border: "none", color: "#1E3A8A", cursor: "pointer", fontSize: 14, padding: 0,
};
export const errorBox: CSSProperties = {
  background: "#fff1f1", color: "#a00", border: "1px solid #f2b8b8", borderRadius: 10,
  padding: "10px 12px", fontSize: 14, marginBottom: 12,
};
