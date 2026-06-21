// Shared DB connection helper for the Phase 0 setup scripts.
//
// Parses DATABASE_URL WITHOUT a URL parser, because the password may legitimately
// contain characters (like '@') that would confuse one. We anchor on the fixed
// structure: postgresql://<user>:<password>@<host>:<port>/<database>. The host
// label cannot contain '@', so a greedy password capture up to the last '@'
// before the host is unambiguous. The secret is never logged.

import '../src/env.js'; // mode-aware env load (+ banner). Pass --prod to target prod.

export function dbConfig() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL is not set in .env');
  }
  const m = raw.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@:/]+):(\d+)\/(.+?)(\?.*)?$/);
  if (!m) {
    throw new Error('DATABASE_URL is not in the expected postgresql://user:pass@host:port/db form');
  }
  const [, user, password, host, port, database] = m;
  return {
    user,
    password,
    host,
    port: Number(port),
    database,
    // Supabase requires TLS; the managed cert chain is not in the local store.
    ssl: { rejectUnauthorized: false },
  };
}

// A redacted one-liner safe to print in logs.
export function dbTarget() {
  const c = dbConfig();
  return `${c.user}@${c.host}:${c.port}/${c.database}`;
}
