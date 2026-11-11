/** @type {import('next').NextConfig} */
const target = process.env.SUPABASE_PROXY_TARGET; // solo sul server locale
// Dall'11/11/2026 il gioco ufficiale e' di nuovo su Vercel + Supabase cloud: nessun rimando.
// (Per rimandare a un altro indirizzo, metterlo qui; null = nessun rimando.)
const OFFICIAL_URL = null;
const nextConfig = {
  async redirects() {
    return process.env.VERCEL === "1" && OFFICIAL_URL
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
