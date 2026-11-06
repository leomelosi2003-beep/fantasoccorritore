// Crea le chiavi segrete del Supabase locale e le scrive nel file .env di supabase/docker
import { randomBytes, createHmac } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const envPath = process.argv[2];
const siteUrl = process.argv[3] || "http://localhost:3000";
let env = readFileSync(envPath, "utf8");
if (env.includes("# fantasoccorritore-chiavi-generate")) { console.log("Chiavi gia' presenti, non le tocco."); process.exit(0); }

const hex = (n) => randomBytes(n).toString("hex");
const b64u = (b) => Buffer.from(b).toString("base64url");
const jwtSecret = hex(32);
const jwt = (role) => {
  const h = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const p = b64u(JSON.stringify({ role, iss: "supabase", iat: now, exp: now + 20 * 365 * 24 * 3600 }));
  const s = createHmac("sha256", jwtSecret).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
};
const fixed = {
  POSTGRES_PASSWORD: hex(16),
  JWT_SECRET: jwtSecret,
  ANON_KEY: jwt("anon"),
  SERVICE_ROLE_KEY: jwt("service_role"),
  DASHBOARD_USERNAME: "admin",
  DASHBOARD_PASSWORD: hex(8),
  SECRET_KEY_BASE: hex(32),
  VAULT_ENC_KEY: hex(16),
  PG_META_CRYPTO_KEY: hex(16),
  LOGFLARE_PUBLIC_ACCESS_TOKEN: hex(16),
  LOGFLARE_PRIVATE_ACCESS_TOKEN: hex(16),
  ENABLE_EMAIL_AUTOCONFIRM: "true",
  ENABLE_PHONE_AUTOCONFIRM: "true",
  SITE_URL: siteUrl,
  ADDITIONAL_REDIRECT_URLS: "",
};
const seen = new Set();
env = env.split(/\r?\n/).map((line) => {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) return line;
  if (m[1] in fixed) { seen.add(m[1]); return `${m[1]}=${fixed[m[1]]}`; }
  return line;
}).join("\n");
for (const [k, v] of Object.entries(fixed)) if (!seen.has(k)) env += `\n${k}=${v}`;
env += "\n# fantasoccorritore-chiavi-generate\n";
writeFileSync(envPath, env);
console.log("Chiavi create. Accesso al pannello (http://localhost:8000):");
console.log("  utente:   admin");
console.log("  password: " + fixed.DASHBOARD_PASSWORD);
