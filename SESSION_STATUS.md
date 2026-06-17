# SESSION_STATUS.md — Project Tracker

> **Read this first, write it last.** It is the handoff between sessions.
> Keep it short. Move durable facts to `CLAUDE.md`; keep only what's moving here.

**Last updated:** 2026-06-17 (Phase 1 complete, merged to `main`)
**Current phase:** Phase 2 — Project list (next)

---

## State in one line

Phase 1 (Auth & shell) is done and verified in the browser against the hosted
Supabase project: login, all PRD §8.3 states, sign-out, reset toast, and the
inactive-account refusal (server-side) all work. Next is Phase 2 — the project
list (the home screen).

## Done

- **Login screen** (PRD §8.2/§8.3): centred card, email + password with show/hide,
  full-width Sign-in with loading state, Forgot-password link, invite-only footer,
  responsive. All six §8.3 states wired with **exact** wording.
- **AuthProvider** (`client/src/auth/`): Supabase session handling, auto-refresh,
  recovery/invite flow, and sign-in gating.
- **Inactive-account refusal is server-side** (PRD §3/§8.3): new `GET /api/me`
  reads the caller's own `users` row under RLS and returns 403 `inactive` when
  `status <> 'active'`; the client signs the session out and shows the §8.3 message.
- **App shell** (PRD §7.1): navy top bar, account menu (name/email, Sign out;
  Admin entry visible to admins only — disabled placeholder until Phase 7).
- **Set password** screen shared by invite + reset flows.
- Verified live in-browser with seeded accounts: empty-field msg, wrong-credentials
  msg, admin sign-in → shell, account menu, sign-out → login, reset toast; and via
  API: all 4 roles sign in, inactive viewer → 403 (then restored to active).
- Merged `feature/auth-shell` → `main`.

## Next slice (do this session)

**Phase 2 — Project list** (PRD §9). The home screen: filter/search row + the
project table (Sl, Project Name, Start Date, derived Target Date, Status chip,
Responsible) showing only the projects the user may see (own + mapped; admins all
— enforced by RLS), the New-project modal (§9.4), and the empty/empty-results
states (§19.2). Target date is read-only/derived (use `project_target_dates`).

**Definition of done:** the table lists exactly the permitted top-level projects
per role (verify against the seed: admin all / member own / manager own+mapped /
viewer per mapping), filters+search combine with AND, New project creates a Draft
and opens it, and it matches PRD §9 + §19.1 validation wording.

## Backlog (out of scope for the current slice)

- _(empty)_

## Blockers / open

- None. Standing note: office network blocks Postgres ports — DB tooling runs over
  HTTPS via the Management API (`server/scripts/run-sql-api.mjs`, needs
  `SUPABASE_ACCESS_TOKEN`). See CLAUDE.md "Office-network gotcha".

## Branch state

- Active branch: `main` (Phase 1 merged; nothing in flight).
- Unmerged work: none.

## Useful facts for next session

- Demo password for all four seeded accounts: `DemoPass!234`. Emails: admin
  `appuser1.msc@manipalsplchem.com`, `manager.demo@…`, `member.demo@…`,
  `viewer.demo@…` (all `@manipalsplchem.com`, all `active`).
- Run locally: API `cd server && node src/index.js` (:4000); client
  `npm run dev --prefix client` (:5173, proxies `/api` → :4000).
  Browser preview config in `.claude/launch.json` (server `client`).
- The client reads the **repo-root** `.env` via Vite `envDir: '..'` — there is no
  second `.env` under `client/`. VITE_SUPABASE_URL / ANON_KEY must be set there.
- Auth-state gate: `GET /api/me` is the server-side sign-in check; reuse it (or
  the loaded profile) for capability gating in later screens.
- `.env` (gitignored) holds Supabase URL + anon + service-role + access token.
- Apply SQL: `cd server && node scripts/run-sql-api.mjs <file.sql>`.

---

## Session log (newest first)

- **2026-06-17** — Built Phase 1 (Auth & shell): login + all §8.3 states, Supabase
  session handling, shared set-password screen, navy app shell with account menu,
  and a server-side `GET /api/me` gate that refuses inactive accounts. Verified in
  the browser and via API. Merged `feature/auth-shell` → `main`. Next: Phase 2
  Project list. Blockers: none.
- **2026-06-17** — Built Phase 0 scaffolding. Schema + RLS + seed applied to the
  hosted Supabase project over the Management API (Postgres ports firewalled).
  Verified admin sign-in and per-role RLS visibility. Merged
  `feature/phase-0-scaffolding` → `main`. Next: Phase 1 Auth & shell. Blockers: none.
- **2026-06-16** — Kickoff. PRD v1 finalised; CLAUDE.md and SESSION_STATUS.md created. No code yet.

<!--
Append one line per session, e.g.:
- YYYY-MM-DD — Built <slice>. Merged feature/<slice> to main. Next: <slice>. Blockers: <none/...>.
-->
