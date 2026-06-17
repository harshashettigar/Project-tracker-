// Run .sql files against the hosted database via the Supabase Management API
// over HTTPS (port 443). Used when the Postgres ports (5432/6543) are blocked by
// a network firewall but HTTPS to api.supabase.com is open.
//
// Needs SUPABASE_ACCESS_TOKEN (a Personal Access Token: Supabase dashboard →
// Account → Access Tokens). The project ref is derived from SUPABASE_URL.
//
// Usage:
//   node scripts/run-sql-api.mjs ../supabase/migrations/0001.sql ../supabase/seed.sql

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const token = process.env.SUPABASE_ACCESS_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL;
if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN in .env (Account → Access Tokens).');
  process.exit(1);
}
if (!supabaseUrl) {
  console.error('Missing SUPABASE_URL in .env.');
  process.exit(1);
}

const ref = new URL(supabaseUrl).host.split('.')[0];
const endpoint = `https://api.supabase.com/v1/projects/${ref}/database/query`;

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/run-sql-api.mjs <file.sql> [more.sql ...]');
  process.exit(1);
}

async function runSql(query) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log(`Running SQL via Management API on project ${ref}`);
  for (const f of files) {
    const sql = readFileSync(resolve(process.cwd(), f), 'utf8');
    process.stdout.write(`  applying ${f} … `);
    await runSql(sql);
    console.log('ok');
  }
  console.log('All files applied.');
}

main().catch((err) => {
  console.error('\nSQL run failed:', err.message || err);
  process.exit(1);
});
