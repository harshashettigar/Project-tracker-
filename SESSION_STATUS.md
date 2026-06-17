# SESSION_STATUS.md — Project Tracker

> **Read this first, write it last.** It is the handoff between sessions.
> Keep it short. Move durable facts to `CLAUDE.md`; keep only what's moving here.

**Last updated:** 2026-06-17 (Phase 0 complete, merged to `main`)
**Current phase:** Phase 1 — Auth & shell (next)

---

## State in one line

Phase 0 scaffolding is done and verified against the hosted Supabase project:
schema + RLS + seed applied, all four demo users sign in, RLS visibility correct.
Next is Phase 1 — the login flow and authenticated app shell.

## Done

- Repo skeleton: `client/` (React+Vite), `server/` (Express), `supabase/`.
- Schema (PRD §21): 8 tables, enums, key CHECK/UNIQUE constraints, one-level
  sub-project trigger, derived target-date view, RLS on all tables.
- Seed: 4 users (one per role), 1 visibility mapping, 3 projects, 2 milestones,
  3 tasks, 2 task updates. Loaded and verified.
- Verified on hosted DB: admin sign-in works; RLS scoping correct per role
  (admin all / member own 2 / manager own+mapped 3 / viewer 0); derived target
  date correct (Plant Safety Audit 2026 → 30/06/2026).
- `docs/schema.sql` mirror verified against live DB. README run + DB-setup docs.
- Merged `feature/phase-0-scaffolding` → `main`.

## Next slice (do this session)

**Phase 1 — Auth & shell** (PRD §8: login/auth, account menu, sign-out, password
reset; invite-to-set-password). Build the login screen, session handling on the
client (Supabase auth), an authenticated app shell (header + account menu +
sign-out), route guarding for unauthenticated users, and the password-reset flow.
Viewer role still authenticates; capability gating comes with later screens.

**Definition of done:** an unauthenticated user is sent to login; a seeded user
can sign in and land on the shell; sign-out returns to login; password reset
sends/handles the email flow; matches PRD §8 + §19.1 validation wording.

## Backlog (out of scope for the current slice)

- _(empty)_

## Blockers / open

- None. NOTE: office network blocks Postgres ports — DB tooling runs over HTTPS
  via the Management API (`server/scripts/run-sql-api.mjs`, needs
  `SUPABASE_ACCESS_TOKEN` in `.env`). See CLAUDE.md "Office-network gotcha".

## Branch state

- Active branch: `main` (Phase 0 merged; nothing in flight).
- Unmerged work: none.

## Useful facts for next session

- Demo password for all four seeded accounts: `DemoPass!234`. Admin is
  `appuser1.msc@manipalsplchem.com`.
- `.env` (gitignored) holds Supabase URL + anon + service-role + access token.
- Apply SQL: `cd server && node scripts/run-sql-api.mjs <file.sql>`.

---

## Session log (newest first)

- **2026-06-17** — Built Phase 0 scaffolding. Schema + RLS + seed applied to the
  hosted Supabase project over the Management API (Postgres ports firewalled).
  Verified admin sign-in and per-role RLS visibility. Merged
  `feature/phase-0-scaffolding` → `main`. Next: Phase 1 Auth & shell. Blockers: none.
- **2026-06-16** — Kickoff. PRD v1 finalised; CLAUDE.md and SESSION_STATUS.md created. No code yet.

<!--
Append one line per session, e.g.:
- YYYY-MM-DD — Built <slice>. Merged feature/<slice> to main. Next: <slice>. Blockers: <none/...>.
-->
