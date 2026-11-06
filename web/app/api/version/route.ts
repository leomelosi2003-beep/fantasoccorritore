// Versione pubblicata: serve alle pagine aperte per accorgersi di un aggiornamento e ricaricarsi
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ v: process.env.NEXT_PUBLIC_BUILD_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" }, { headers: { "Cache-Control": "no-store" } });
}
