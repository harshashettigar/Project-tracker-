# SESSION_STATUS.md — Project Tracker

> **Read this first, write it last.** It is the handoff between sessions.
> Keep it short. Move durable facts to `CLAUDE.md`; keep only what's moving here.

**Last updated:** 2026-06-17 (Phase 2 complete, merged to `main`)
**Current phase:** Phase 3 — Project Detail (View mode) (next)

---

## State in one line

Phase 2 (Project list) is done and verified in-browser against the hosted
Supabase project: the list shows the RLS-permitted top-level projects with
derived target dates, search/owner/status filters, empty states, and the
create-project modal. Next is Phase 3 — the read-only project detail screen.

## Done

- **Project list** (PRD §9): heading + count, table (Sl zero-padded, Name, Start,
  derived Target, Status chip, Responsible + avatar, View/Edit actions). Only
  top-level projects (§9.2).
- **Visibility is RLS-enforced** — `GET /api/projects` queries AS THE USER; per-role
  results verified (admin 2 / manager 2 / member 1 / viewer 0 top-level).
- **Derived target date** (§12.2) computed server-side from RLS-scoped milestones +
  direct tasks (not the bypassing view). Plant Safety Audit → 30/06/2026.
- **Filters/search** (§9.5): search + owner dropdown + status chips, AND-combined,
  client-side; "Clear all"; both empty states (§19.2: no projects / no matches).
- **Create project** (§9.4): light modal (name required per §19.1, objective, owner
  picker for admins, start date = today); creates a Draft; viewers blocked at the
  API (403) and the New-project button hidden for viewers.
- New shared bits: `lib/api.js` (token-bearing fetch), `lib/format.js` (dd/mm/yyyy,
  initials, status vocab), `StatusChip`, `Avatar`; `AppShell` is now a layout
  with a top-bar `actions` slot.
- Verified in-browser (admin + viewer) and via API (all 4 roles, create validation,
  viewer refusal). Test rows cleaned up. Merged `feature/project-list` → `main`.

## Next slice (do this session)

**Phase 3 — Project Detail (View mode)** (PRD §10, with §12–13). Read-only detail:
summary band (name, start, derived target with AUTO badge, status, owner),
objective with More› expander, detail status filter, milestone blocks with their
task tables, project-level task table, the latest-update-highlighted **task update
thread** (§13, build as a reusable component), Files + Sub-projects strips (links
only — full behaviour in Phases 5–6). Wire the list's eye action to open it.

**Definition of done:** opening a permitted project shows its milestones/tasks and
each task's latest update + one-line predecessor, History expands newest-first
after the latest, "No updates yet" when empty (§19.2), nothing editable, matches
PRD §10. Access still enforced server/DB-side.

## Backlog (out of scope for the current slice)

- **Phase 9 hardening:** tighten the `projects` INSERT RLS policy to exclude the
  viewer role (today viewers are blocked only by the API guard, not by RLS).
- **Phase 9 hardening:** set `security_invoker = on` on `project_target_dates` so
  the derived-target view is RLS-safe to query/expose directly.
- §9.4 "new project opens immediately in Edit mode" — wire once Detail/Edit exist
  (Phase 3/4); currently create confirms via toast + list refresh.

## Blockers / open

- None. Standing note: office network blocks Postgres ports — DB tooling runs over
  HTTPS via the Management API (`server/scripts/run-sql-api.mjs`, needs
  `SUPABASE_ACCESS_TOKEN`). See CLAUDE.md "Office-network gotcha".

## Branch state

- Active branch: `main` (Phase 2 merged; nothing in flight).
- Unmerged work: none.

## Useful facts for next session

- Demo password for all four seeded accounts: `DemoPass!234`. Emails: admin
  `appuser1.msc@manipalsplchem.com`, `manager.demo@…`, `member.demo@…`,
  `viewer.demo@…` (all `@manipalsplchem.com`, all `active`).
- Seed data shape: 2 top-level projects (ERP Rollout — Demo Manager, draft;
  Plant Safety Audit 2026 — Demo Member, in_progress, target 30/06/2026) + 1
  sub-project; 2 milestones, 3 tasks, 2 task updates. Use these to verify Phase 3.
- Run locally: API `cd server && node src/index.js` (:4000); client preview via
  `.claude/launch.json` (server name `client`, :5173, proxies `/api` → :4000).
- API so far: `GET /api/me`, `GET /api/users`, `GET /api/projects`,
  `POST /api/projects`. All gated by `requireActiveUser()` (server/src/index.js),
  which returns a user-scoped (RLS) client + the active profile. Reuse it for
  Phase 3 detail endpoints; query child tables as the user so RLS scopes reads.
- Client reads the **repo-root** `.env` via Vite `envDir: '..'`. Status vocabulary +
  date/initials helpers live in `client/src/lib/format.js` — reuse, don't redefine.
- `.env` (gitignored) holds Supabase URL + anon + service-role + access token.
- Apply SQL: `cd server && node scripts/run-sql-api.mjs <file.sql>`.

---

## Session log (newest first)

- **2026-06-17** — Built Phase 2 (Project list): RLS-scoped `GET /api/projects` with
  server-computed derived target dates, `GET /api/users`, `POST /api/projects`
  (name validation, viewer 403); list UI with filters/search, empty states, status
  chips, and the create modal. Verified in-browser (admin + viewer) and via API for
  all four roles. Merged `feature/project-list` → `main`. Next: Phase 3 Detail View.
  Blockers: none.
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
