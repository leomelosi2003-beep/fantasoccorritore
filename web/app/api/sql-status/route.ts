// Esito degli script SQL automatici (server/sql-auto). Mostra l'output completo solo per i file "*.mostra.sql";
// per gli altri solo esito e righe di errore.
import { readdir, readFile } from "fs/promises";

export const dynamic = "force-dynamic";
const DIR = "/opt/fantasoccorritore/sql-status";

export async function GET() {
  let files: string[] = [];
  try { files = (await readdir(DIR)).filter((f) => f.endsWith(".json")); } catch { return Response.json([]); }
  const list = await Promise.all(files.map(async (f) => {
    try {
      const j = JSON.parse(await readFile(`${DIR}/${f}`, "utf8")) as { file: string; rc: number; out: string; at: string };
      const show = j.file.includes(".mostra.");
      return { file: j.file, rc: j.rc, at: j.at,
               out: show ? j.out : j.out.split("\n").filter((l) => /ERROR|ERRORE|NOTICE|WARNING|ESITO/i.test(l)).join("\n").slice(0, 4000) };
    } catch { return null; }
  }));
  return Response.json(list.filter(Boolean).sort((a, b) => (a!.file < b!.file ? 1 : -1)).slice(0, 20),
                       { headers: { "Cache-Control": "no-store" } });
}
