"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import FactionEmblem, { type FactionStyle } from "@/components/FactionEmblem";

type Msg = { id: number; channel: string; body: string; created_at: string; org_id: string; org_name: string;
  org_type: FactionStyle; logo_url: string | null };

function readSeen(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem("fs-chat-seen") ?? "{}"); } catch { return {}; }
}
function writeSeen(v: Record<string, number>) {
  try { localStorage.setItem("fs-chat-seen", JSON.stringify(v)); } catch { /* niente */ }
}

// Chat tra giocatori: canale generale e canale della propria alleanza. I messaggi durano 2 giorni.
export default function ChatPanel({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [alliance, setAlliance] = useState<{ id: string; name: string } | null>(null);
  const [channel, setChannel] = useState("generale");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [latest, setLatest] = useState<Record<string, number>>({});
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSeen(readSeen()); }, []);

  // la mia alleanza (per il canale privato)
  useEffect(() => {
    supabase.from("alliance_members").select("alliance_id, alliances(name)").eq("org_id", orgId).maybeSingle()
      .then(({ data }) => {
        const d = data as unknown as { alliance_id: string; alliances: { name: string } | null } | null;
        setAlliance(d ? { id: d.alliance_id, name: d.alliances?.name ?? "Alleanza" } : null);
      });
  }, [orgId, open]);

  const channels = ["generale", ...(alliance ? [`alleanza:${alliance.id}`] : [])];

  // ultimo messaggio di ogni canale, per il pallino dei non letti
  const checkLatest = useCallback(async () => {
    const out: Record<string, number> = {};
    for (const ch of channels) {
      const { data } = await supabase.from("chat_messages").select("id").eq("channel", ch).order("id", { ascending: false }).limit(1);
      out[ch] = (data as { id: number }[] | null)?.[0]?.id ?? 0;
    }
    setLatest(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alliance?.id]);

  const loadMsgs = useCallback(async () => {
    const { data } = await supabase.from("chat_feed").select("*").eq("channel", channel)
      .order("id", { ascending: false }).limit(80);
    const list = ((data as Msg[]) ?? []).reverse();
    setMsgs(list);
    const top = list.length ? list[list.length - 1].id : 0;
    setSeen((s) => { const n = { ...s, [channel]: Math.max(s[channel] ?? 0, top) }; writeSeen(n); return n; });
  }, [channel]);

  useEffect(() => {
    checkLatest();
    const t = setInterval(checkLatest, 20_000);
    return () => clearInterval(t);
  }, [checkLatest]);

  useEffect(() => {
    if (!open) return;
    loadMsgs();
    const t = setInterval(loadMsgs, 4_000);
    return () => clearInterval(t);
  }, [open, loadMsgs]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [msgs.length, open]);

  const unread = (ch: string) => (latest[ch] ?? 0) > (seen[ch] ?? 0);
  const anyUnread = channels.some((ch) => ch !== channel || !open ? unread(ch) : false);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setErr(null);
    const { error } = await supabase.rpc("send_chat", { p_channel: channel, p_body: body });
    if (error) { setErr(error.message.includes("TOO_FAST") ? "Piano! Aspetta un attimo prima di scrivere ancora." : "Messaggio non inviato."); return; }
    setText("");
    loadMsgs();
  }

  return (
    <>
      <button className="fs-chat-btn" onClick={() => setOpen(!open)} aria-label="Chat">
        💬{anyUnread && <b className="fs-chat-dot" />}
      </button>
      {open && (
        <div className="fs-chat">
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderBottom: "1px solid #eee" }}>
            {channels.map((ch) => (
              <button key={ch} onClick={() => setChannel(ch)}
                      style={{ border: "none", borderRadius: 999, padding: "6px 10px", fontWeight: 700, fontSize: 13, cursor: "pointer",
                               background: channel === ch ? "#111" : "#f1f1f1", color: channel === ch ? "#fff" : "#111", position: "relative" }}>
                {ch === "generale" ? "🌍 Generale" : `🤝 ${alliance?.name}`}
                {ch !== channel && unread(ch) && <b className="fs-chat-dot" style={{ top: -2, right: -2 }} />}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={() => setOpen(false)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer" }}>✕</button>
          </div>
          <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
            {msgs.length === 0 && <div style={{ color: "#888", fontSize: 13, textAlign: "center", marginTop: 20 }}>Nessun messaggio. Scrivi tu il primo!</div>}
            {msgs.map((m) => {
              const mine = m.org_id === orgId;
              return (
                <div key={m.id} style={{ display: "flex", gap: 6, flexDirection: mine ? "row-reverse" : "row", alignItems: "flex-end" }}>
                  <div style={{ flexShrink: 0 }}><FactionEmblem type={m.org_type} size={24} logo={m.logo_url} /></div>
                  <div style={{ maxWidth: "78%", background: mine ? "#DBEAFE" : "#f3f4f6", borderRadius: 12, padding: "6px 10px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#555" }}>
                      {m.org_name} · {new Date(m.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div style={{ fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {err && <div style={{ color: "#B91C1C", fontSize: 12, padding: "0 10px" }}>{err}</div>}
          <div style={{ display: "flex", gap: 6, padding: 8, borderTop: "1px solid #eee" }}>
            <input value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="Scrivi un messaggio…"
                   onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                   style={{ flex: 1, padding: 9, borderRadius: 10, border: "1px solid #ccc", fontSize: 15, minWidth: 0 }} />
            <button onClick={send} style={{ border: "none", background: "#111", color: "#fff", borderRadius: 10, padding: "0 14px",
                                            fontWeight: 700, cursor: "pointer" }}>Invia</button>
          </div>
          <div style={{ fontSize: 10, color: "#999", textAlign: "center", paddingBottom: 6 }}>I messaggi si cancellano dopo 2 giorni</div>
        </div>
      )}
    </>
  );
}
