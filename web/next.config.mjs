/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // versione della build, per far ricaricare da sole le pagine aperte quando esce un aggiornamento
  env: { NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
};
export default nextConfig;
