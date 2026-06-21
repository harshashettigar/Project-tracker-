# Project Tracker

Standalone internal web app for running projects, milestones, tasks and their
update history, with central control of users and access. Replaces a multi-sheet
Excel workbook. See `docs/PRD.docx` for the full specification and `CLAUDE.md`
for durable project conventions.

> **Security model:** the database (PostgreSQL + Row-Level Security) and the API
> are the security boundary. The front end is never trusted. See PRD §3, §17–18.

## Stack

- **Client:** React + Vite single-page app (`client/`)
- **Server:** Node.js + Express stateless JSON API (`server/`)
- **Database & Auth:** hosted Supabase (PostgreSQL + managed auth)
- **Migrations:** Supabase CLI (`supabase/migrations/`)

## Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A hosted Supabase project (URL + anon key + service-role key)

## Configuration — two environments (dev / prod)

Development and production use **separate Supabase projects**, so day-to-day work
never touches live data. Create one env file per environment from the template
(both are git-ignored — never commit real secrets):

```
cp .env.example .env.development   # your DEV/staging Supabase project
cp .env.example .env.production    # the LIVE Supabase project
```

Fill each with that project's values (Project Settings → API). How they're chosen:

- **Default = development.** `npm run dev`, the local server, and all
  `server/scripts/*` read `.env.development`.
- **Production is explicit** — append `--prod`:
  `node scripts/run-sql-api.mjs --prod <file.sql>`, `npm run setup:auth:prod`,
  `npm run setup:storage:prod`. (`NODE_ENV=production`, e.g. on Railway, also
  selects it.)
- The Vite client auto-loads `.env.development` for `npm run dev` and
  `.env.production` for a production `vite build`.
- Every server boot / script prints a banner — `[env] development → … → supabase:
  <ref>` — so you can confirm which project you're about to touch.
- If neither file exists, a legacy single `.env` is used (transitional only).

> Production hosting (Vercel/Railway) gets its env from those dashboards, not from
> these files. Keep `.env.production` locally only to run admin/migration scripts
> against prod deliberately. **Apply migrations to dev first, verify, then prod with
> `--prod`.**

### Standing up a fresh dev project (one time)

1. Create a second Supabase project in the dashboard; put its URL + keys + a
   Personal Access Token in `.env.development`.
2. Apply all migrations (in order) — defaults to dev:
   `cd server && node scripts/run-sql-api.mjs ../supabase/migrations/*.sql`
   (list them in filename order; see the firewall section below).
3. `npm run setup:auth` and `npm run setup:storage` (both target dev by default).
4. Load `supabase/seed.sql` for sample data.

## Database setup

1. Link the CLI to your hosted project (one time):

   ```
   supabase link --project-ref <your-project-ref>
   ```

2. Apply migrations to the hosted database:

   ```
   supabase db push
   ```

3. **Create the demo users.** `public.users.id` references `auth.users(id)`, so
   the auth identities must exist first. A one-off script creates the four demo
   auth users (one per role) via the Supabase admin API and inserts the matching
   `public.users` rows — no manual dashboard steps:

   ```
   cd server && npm install && npm run setup:auth
   ```

   It uses `SUPABASE_SERVICE_ROLE_KEY` from `.env`. The demo password for all four
   accounts is `DemoPass!234` (override with `SEED_DEMO_PASSWORD`). The admin is
   `appuser1.msc@manipalsplchem.com`.

4. Load the sample-data seed (projects, milestones, tasks, update history). It
   resolves owners by email, so it lines up with the users created in step 3:

   ```
   psql "$DATABASE_URL" -f supabase/seed.sql
   ```

5. **Create the file-storage bucket** (Phase 5 / PRD §15). A one-off script
   creates the private `attachments` bucket over HTTPS (works behind the
   Postgres-port firewall). Idempotent:

   ```
   cd server && npm run setup:storage
   ```

   Attachments are private: the API validates type + size, runs the scan hook,
   stores via the service role, and serves files as short-lived signed URLs.

`docs/schema.sql` is a human-readable mirror of the migrations; the migrations in
`supabase/migrations/` are authoritative.

### If the Postgres ports are blocked (e.g. corporate firewall)

Some networks block outbound Postgres ports (5432/6543), so `supabase db push`
and `psql` time out, but HTTPS (443) to Supabase is open. In that case apply SQL
over HTTPS via the Supabase **Management API**, using a Personal Access Token
(Supabase dashboard → Account → Access Tokens) set as `SUPABASE_ACCESS_TOKEN` in
`.env`:

```
cd server && npm install
# 1. migrations (in order)
node scripts/run-sql-api.mjs \
  ../supabase/migrations/20260617090000_init_enums_tables.sql \
  ../supabase/migrations/20260617090100_triggers.sql \
  ../supabase/migrations/20260617090200_derived_target.sql \
  ../supabase/migrations/20260617090300_rls.sql
# 2. demo users (admin API, HTTPS)
npm run setup:auth
# 3. sample data
node scripts/run-sql-api.mjs ../supabase/seed.sql
```

When the Postgres ports are reachable, `scripts/run-sql.mjs` does the same over a
direct connection using `DATABASE_URL`.

## Run

In two terminals:

```
cd server && npm install && npm run dev      # API on http://localhost:4000
cd client && npm install && npm run dev       # SPA on http://localhost:5173
```

The Vite dev server proxies `/api` to the Express server. Health checks:

- `GET http://localhost:4000/api/health` — server liveness
- `GET http://localhost:4000/api/health/db` — database reachability (user count)

## Repo layout

```
client/                 React + Vite SPA
server/                 Express JSON API
supabase/
  migrations/           Schema migrations (authoritative)
  seed.sql              Dog-food seed data
  config.toml           Supabase CLI config
docs/
  PRD.docx              Specification (reference by section)
  schema.sql            Human-readable schema mirror
  decisions.md          One line per decision
CLAUDE.md               Durable project memory
SESSION_STATUS.md       Living session handoff
```
