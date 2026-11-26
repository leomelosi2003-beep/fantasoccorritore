"use client";
// Tutte le associazioni del gioco, come profili: tocca una scheda per aprire il profilo completo.
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import FactionEmblem, { type FactionStyle } from "@/components/FactionEmblem";
import { AllyChip, loadOrgAlliances, type AllyBadge } from "@/components/AllianceExtras";
import { typeColors } from "@/lib/profileStyle";
import PageHeader from "@/components/PageHeader";

type Row = { id: string; name: string; type: string; logo_url: string | null; banner_url: string | null; bio: string | null;
  reputation: number; bases: number; vehicles: number; volunteers: number; legends: number };
const shell: CSSProperties = { minHeight: "100vh", background: "#f4f4f1", fontFamily: "system-ui, -apple-system, sans-serif" };

export default function Profili() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [ally, setAlly] = useState<Record<string, AllyBadge>>({});
  const [myId, setMyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const { data: o } = await supabase.from("organizations").select("id").eq("owner_id", session.user.id).maybeSingle();
      setMyId((o as { id: string } | null)?.id ?? null);
      const [{ data }, al] = await Promise.all([supabase.rpc("orgs_directory"), loadOrgAlliances()]);
      setRows((data as Row[]) ?? []); setAlly(al);
    })();
  }, [router]);
  const list = useMemo(() => rows.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  return (
    <main style={shell}>
      <PageHeader icon="🪪" title="Profili delle associazioni" tone="navy" sub="Cerca un'associazione e guarda stemma, sedi e risultati"
        links={myId ? [{ href: `/profili/${myId}`, label: "👤 Il mio profilo", hot: true }] : []} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 14 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Cerca un'associazione…"
               style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 15, boxSizing: "border-box", marginBottom: 12 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {list.map((r) => { const c = typeColors(r.type); return (
            <a key={r.id} href={`/profili/${r.id}`} style={{ textDecoration: "none", color: "inherit", background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.08)", border: r.id === myId ? `2px solid ${c.main}` : "2px solid transparent" }}>
              <div style={{ height: 78, background: r.banner_url ? `center/cover url("${r.banner_url}")` : `linear-gradient(120deg, ${c.main}, ${c.main} 60%, ${c.acc})` }} />
              <div style={{ padding: "0 12px 12px", marginTop: -30 }}>
                <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
                  <div style={{ background: "#fff", borderRadius: "50%", padding: 3, boxShadow: "0 2px 8px rgba(0,0,0,.2)" }}><FactionEmblem type={r.type as FactionStyle} size={56} logo={r.logo_url} /></div>
                  {ally[r.id] && <AllyChip a={ally[r.id]} size={18} />}
                </div>
                <div style={{ fontWeight: 800, fontSize: 16, marginTop: 6, color: "#13294B" }}>{r.name}</div>
                {r.bio && <div style={{ fontSize: 12.5, color: "#475569", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.bio}</div>}
                <div style={{ display: "flex", gap: 10, fontSize: 12.5, color: "#334155", marginTop: 8, flexWrap: "wrap" }}>
                  <span>🏠 {r.bases}</span><span>🚑 {r.vehicles}</span><span>👥 {r.volunteers}</span>{r.legends > 0 && <span>🌟 {r.legends}</span>}<span>⭐ {Math.round(r.reputation)}</span>
                </div>
              </div>
            </a>); })}
        </div>
      </div>
    </main>
  );
}
