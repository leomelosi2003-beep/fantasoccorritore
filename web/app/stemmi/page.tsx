import FactionEmblem from "@/components/FactionEmblem";

const ITEMS = [
  { type: "pubblica_assistenza", label: "Pubblica Assistenza" },
  { type: "misericordia", label: "Misericordia" },
  { type: "croce_rossa", label: "Croce Rossa" },
  { type: "custom", label: "Personalizzata (es. \"Soccorso Labronico\")", name: "Soccorso Labronico" },
] as const;

export default function Stemmi() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, background: "#f6f6f4", minHeight: "100vh" }}>
      <h1 style={{ marginTop: 0 }}>Stemmi delle fazioni</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
        {ITEMS.map((it) => (
          <div key={it.type} style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center",
                                      boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
            <FactionEmblem type={it.type} size={120} name={"name" in it ? it.name : ""} />
            <div style={{ marginTop: 12, fontWeight: 600 }}>{it.label}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
