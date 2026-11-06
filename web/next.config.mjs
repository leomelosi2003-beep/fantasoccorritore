/** @type {import('next').NextConfig} */
const target = process.env.SUPABASE_PROXY_TARGET; // solo sul server locale
// Il gioco ufficiale gira sul PC di Leonardo: il sito su Vercel rimanda tutti li'.
// Per tornare a Vercel basta togliere questa riga (redirect temporaneo, i browser non lo memorizzano).
const OFFICIAL_URL = "https://desktop-f0qb534.tail9a3baf.ts.net";
const nextConfig = {
  async redirects() {
    return process.env.VERCEL === "1"
      ? [{ source: "/:path*", destination: `${OFFICIAL_URL}/:path*`, permanent: false }]
      : [];
  },
  reactStrictMode: true,
  // versione della build, per far ricaricare da sole le pagine aperte quando esce un aggiornamento
  env: { NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.BUILD_SHA ?? "dev" },
  async rewrites() {
    return target ? [{ source: "/sb/:path*", destination: `${target}/:path*` }] : [];
  },
};
export default nextConfig;
