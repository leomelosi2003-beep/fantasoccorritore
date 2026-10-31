import FactionEmblem, { FACTION_STYLES } from "@/components/FactionEmblem";

export default function Stemmi() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, background: "#f6f6f4", minHeight: "100vh" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
        {FACTION_STYLES.map((s) => (
          <div key={s.type} style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center",
                                     boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
            <FactionEmblem type={s.type} size={120} />
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12 }}>
              {s.colors.map((c) => (
                <span key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c,
                                       border: "1px solid #ccc" }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
