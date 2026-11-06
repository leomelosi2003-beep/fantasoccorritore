/** @type {import('next').NextConfig} */
const target = process.env.SUPABASE_PROXY_TARGET; // solo sul server locale
const nextConfig = {
  reactStrictMode: true,
  // versione della build, per far ricaricare da sole le pagine aperte quando esce un aggiornamento
  env: { NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.BUILD_SHA ?? "dev" },
  async rewrites() {
    return target ? [{ source: "/sb/:path*", destination: `${target}/:path*` }] : [];
  },
};
export default nextConfig;
