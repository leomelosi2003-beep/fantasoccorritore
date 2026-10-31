// Gira su Render come Cron Job ogni lunedì.
// Chiede a Claude un lotto di nuove carte volontario e le inserisce nel catalogo.
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROMPT = `Genera 20 volontari soccorritori italiani (toscani) per un gioco.
Rispondi SOLO con un array JSON, senza testo prima o dopo. Ogni elemento:
{"first_name":"","last_name":"","nickname":"",
 "role":"autista|soccorritore_base|soccorritore_avanzato|caposervizio",
 "rarity":"comune|epica|leggendaria",
 "stat_guida":1-100,"stat_soccorso":1-100,"stat_resilienza":1-100,
 "pros":["..."],"cons":["..."],
 "trait_mods":{"night_fatigue":-0.3..0.3,"rosso_fatigue":-0.3..0.3}}
Distribuzione: 15 comuni, 4 epiche, 1 leggendaria. Le epiche e la leggendaria
hanno statistiche più alte. Tratti realistici e un po' ironici.`;

async function main() {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: PROMPT }],
    }),
  });
  if (!res.ok) { console.error(await res.text()); process.exit(1); }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "[]";
  const json = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
  const cards = JSON.parse(json);

  const clamp = (n: number) => Math.max(1, Math.min(100, Math.round(n)));
  const rows = cards.map((c: any) => ({
    ...c,
    stat_guida: clamp(c.stat_guida),
    stat_soccorso: clamp(c.stat_soccorso),
    stat_resilienza: clamp(c.stat_resilienza),
    source: "ai",
  }));

  const { error } = await supabase.from("volunteers").insert(rows);
  if (error) { console.error(error); process.exit(1); }
  console.log(`Inserite ${rows.length} carte`);
}

main();
