// Run one or more .sql files against DATABASE_URL, in the order given.
// Each file is executed as a single batch (the migration files manage their own
// begin/commit). Usage:
//   node scripts/run-sql.mjs ../supabase/migrations/0001.sql ../supabase/seed.sql

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { dbConfig, dbTarget } from './db.mjs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/run-sql.mjs <file.sql> [more.sql ...]');
  process.exit(1);
}

const client = new pg.Client(dbConfig());

async function main() {
  console.log(`Connecting to ${dbTarget()}`);
  await client.connect();
  for (const f of files) {
    const path = resolve(process.cwd(), f);
    const sql = readFileSync(path, 'utf8');
    process.stdout.write(`  applying ${f} … `);
    await client.query(sql);
    console.log('ok');
  }
  console.log('All files applied.');
}

main()
  .catch((err) => {
    console.error('\nSQL run failed:', err.message || err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
