const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const pg = require("pg");
const { execSync } = require("child_process");
const { parse: parseUrl } = require("url");

// Neon endpoints have both A (IPv4) and AAAA (IPv6) records.
// In environments where the IPv6 path is unreachable (many cloud/VPC setups),
// Node.js hangs on the IPv6 attempt until the TCP timeout fires.
//
// When pg.Pool receives a `connectionString`, it parses the host from it and
// individual `host` overrides are ignored — so the only reliable fix is to
// build the pool config from parsed URL params and set `host` to the resolved
// IPv4 address. The original hostname is preserved as `ssl.servername` so the
// TLS ClientHello includes the correct SNI for Neon's multi-tenant routing.
function resolveIPv4Sync(hostname) {
  try {
    const result = execSync(
      `dig +short A ${hostname} | grep -E '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$' | head -1`,
      { timeout: 5000 }
    ).toString().trim();
    return result || null;
  } catch {
    return null;
  }
}

function buildPoolConfig(connectionString) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const parsed = parseUrl(connectionString);
  const hostname = parsed.hostname;
  const ipv4 = hostname ? resolveIPv4Sync(hostname) : null;

  // Parse auth
  const auth = parsed.auth || "";
  const colonIdx = auth.indexOf(":");
  const user = colonIdx >= 0 ? auth.slice(0, colonIdx) : auth;
  const password = colonIdx >= 0 ? auth.slice(colonIdx + 1) : undefined;

  // Parse database name (strip leading slash)
  const database = (parsed.pathname || "/").slice(1);

  // Parse port
  const port = parsed.port ? parseInt(parsed.port, 10) : 5432;

  // Resolve connecting host: prefer IPv4 to avoid IPv6 hang
  const connectHost = (ipv4 && ipv4 !== hostname) ? ipv4 : hostname;

  const config = {
    host: connectHost,
    port,
    database,
    user,
    password,
    connectionTimeoutMillis: 15000, // Neon serverless cold-start can take up to ~10s
    idleTimeoutMillis: 60000,
    max: 5,
    ssl: {
      rejectUnauthorized: false,
      // Preserve original hostname as SNI so Neon routes to the correct tenant
      servername: hostname,
    },
  };

  return config;
}

const pool = new pg.Pool(buildPoolConfig(process.env.DATABASE_URL));
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
