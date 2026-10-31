import type { CSSProperties } from "react";

// Stili condivisi delle pagine (login, onboarding, barra in alto)
export const page: CSSProperties = {
  minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box",
};
export const card: CSSProperties = {
  background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420,
  boxShadow: "0 4px 20px rgba(0,0,0,.08)", boxSizing: "border-box",
};
export const input: CSSProperties = {
  width: "100%", padding: "12px 14px", fontSize: 16, borderRadius: 10, border: "1px solid #d4d4d0",
  boxSizing: "border-box", marginBottom: 12,
};
export const button: CSSProperties = {
  width: "100%", padding: "12px 14px", fontSize: 16, fontWeight: 600, borderRadius: 10, border: "none",
  background: "#111", color: "#fff", cursor: "pointer",
};
export const link: CSSProperties = {
  background: "none", border: "none", color: "#1E3A8A", cursor: "pointer", fontSize: 14, padding: 0,
};
export const errorBox: CSSProperties = {
  background: "#fff1f1", color: "#a00", border: "1px solid #f2b8b8", borderRadius: 10,
  padding: "10px 12px", fontSize: 14, marginBottom: 12,
};
