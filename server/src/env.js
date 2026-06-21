// Mode-aware environment loader — the single place env files are read.
//
// Why: dev and production use SEPARATE Supabase projects (see CLAUDE.md "Two
// environments"). To keep day-to-day work off the live database, everything
// defaults to the DEVELOPMENT env; hitting production must be deliberate.
//
//   mode = production  IF  --prod is passed, or APP_ENV/NODE_ENV = production
//          development otherwise (the default)
//
// It loads, in order of preference:
//   1. .env.<mode>            (repo root) — the per-environment file
//   2. .env                   (repo root) — legacy single-file fallback, so an
//                               older checkout keeps working until .env.<mode>
//                               exists. (On Railway/Vercel no file exists and the
//                               platform's own process env is used.)
//
// Importing this module has the side effect of loading the vars AND printing a
// one-line banner to stderr naming the env + Supabase project, so you always see
// which database you're about to touch. Import it before anything reads process.env.

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
const root = (file) => resolve(here, '../../', file);

const isProd =
  process.argv.includes('--prod') ||
  process.env.APP_ENV === 'production' ||
  process.env.NODE_ENV === 'production';

export const APP_ENV = isProd ? 'production' : 'development';

const modeFile = root(`.env.${APP_ENV}`);
const legacyFile = root('.env');

let loadedFrom;
if (existsSync(modeFile)) {
  dotenv.config({ path: modeFile });
  loadedFrom = `.env.${APP_ENV}`;
} else if (existsSync(legacyFile)) {
  dotenv.config({ path: legacyFile });
  loadedFrom = `.env (legacy fallback — create .env.${APP_ENV} to target a dedicated ${APP_ENV} project)`;
} else {
  loadedFrom = '(no env file found; using the platform process environment)';
}

const projectRef = (() => {
  try {
    return new URL(process.env.SUPABASE_URL).host.split('.')[0];
  } catch {
    return '?';
  }
})();

// stderr, not stdout — scripts (e.g. run-sql-api) parse stdout.
console.error(`[env] ${APP_ENV} → ${loadedFrom} → supabase: ${projectRef}`);
