# SESSION_STATUS.md — Project Tracker

> **Read this first, write it last.** It is the handoff between sessions.
> Keep it short. Move durable facts to `CLAUDE.md`; keep only what's moving here.

**Last updated:** 2026-06-17 (Phase 3 complete, merged to `main`)
**Current phase:** Phase 4 — Project Detail (Edit mode) (next)

---

## State in one line

Phase 3 (Project Detail — View mode) is done and verified in-browser against the
hosted Supabase project: the read-only detail screen, the reusable task-update
thread, sub-project navigation/breadcrumb, and the detail status filter all work.
Next is Phase 4 — making the same screen editable.

## Done

- **Detail View** (PRD §10): summary band (name, start, derived Target + AUTO
  badge, status chip, owner), objective with More› expander, detail status filter,
  milestone blocks (header + task table), project-level task table, file strip,
  sub-project links. Nothing editable (§10.4).
- **Task update thread** (§13) — one reusable component: latest highlighted
  (amber left border), one-line predecessor context, "History" expands newest-first
  from the second-most-recent (latest not repeated), "No updates yet" when empty.
  Reused for milestone tasks and project-level tasks.
- **`GET /api/projects/:id`**: full detail tree in one RLS-scoped call (milestones
  with tasks, project tasks, per-task updates newest-first, files, sub-projects);
  invisible/missing project → 404. Shared `deriveTargets()` helper for the target.
- **Navigation**: `AuthedApp` in-memory router (list ↔ detail); list eye/pencil
  open detail; sub-project links open the child in the same screen with a working
  breadcrumb (Projects › [parent ›] current). View/Edit toggle (Edit = Phase-4
  placeholder toast; hidden for viewers).
- Verified in-browser as the project owner (member): summary/AUTO, milestones,
  update thread incl. a temporary 2nd update to confirm History expand (then
  removed), sub-project forward+back nav, Edit-toggle toast, status filter hides
  non-matching. Verified via API: detail shape per role + viewer 404. Merged
  `feature/detail-view` → `main`.

## Next slice (do this session)

**Phase 4 — Project Detail (Edit mode)** (PRD §11, with §12.1 & §13 composer).
Make the same skeleton editable: summary band (name, start, status, owner —
target stays derived/read-only), objective; add/rename/redate/restatus/reorder/
remove milestones; add/edit/reorder/remove tasks under a milestone or directly
under the project with **context-dependent required fields** (§12.1: milestone
target required; task-under-milestone target optional; project-level task target
required); and the **update composer** (§11.4/§13) pre-filled with the previous
update's text, append-only, empty post blocked ("Write an update first." §19.1),
authorship limited to owner + admin (§18). Wire the list pencil + the detail
Edit toggle to open Edit mode.

**Definition of done:** an owner/admin can edit every editable region and post an
update (appended, never overwriting); a non-owner/viewer cannot (server/DB-side);
required-field rules enforced in-context per §12.1; derived target recomputes;
validation wording matches §19.1; matches PRD §11.

## Backlog (out of scope for the current slice)

- **Phase 9 hardening:** tighten the `projects` INSERT RLS policy to exclude the
  viewer role (today viewers are blocked from create only by the API guard).
- **Phase 9 hardening:** set `security_invoker = on` on `project_target_dates` so
  the derived-target view is RLS-safe to query/expose directly.
- Deep-linkable URLs (real router) — deferred; in-memory routing for now.
- §9.4 "new project opens immediately in Edit mode" — wire once Edit exists (Phase 4).

## Blockers / open

- None. Standing note: office network blocks Postgres ports — DB tooling runs over
  HTTPS via the Management API (`server/scripts/run-sql-api.mjs`, needs
  `SUPABASE_ACCESS_TOKEN`). See CLAUDE.md "Office-network gotcha".
- Dev gotcha: `node src/index.js` can leave a process on :4000 that survives
  TaskStop on Windows; if a fresh start logs `EADDRINUSE`, free the port
  (`Stop-Process` on the PID from `Get-NetTCPConnection -LocalPort 4000`).

## Branch state

- Active branch: `main` (Phase 3 merged; nothing in flight).
- Unmerged work: none.

## Useful facts for next session

- Demo password for all four seeded accounts: `DemoPass!234`. Emails: admin
  `appuser1.msc@manipalsplchem.com`, `manager.demo@…`, `member.demo@…`,
  `viewer.demo@…` (all `@manipalsplchem.com`, all `active`).
- Seed shape for testing Phase 4: project **Plant Safety Audit 2026** (owner Demo
  Member, in_progress, target 30/06/2026) has milestones "Documentation review"
  (2 tasks: Collect SOP documents=completed w/ 1 update, Gap analysis=in_progress
  w/ 1 update) and "On-site inspection" (0 tasks); project-level task "Kickoff
  sign-off" (completed, no updates); sub-project "Audit — Unit B". ERP Rollout
  (owner Demo Manager) is an empty Draft — good for testing first add.
- Run locally: API `cd server && node src/index.js` (:4000); client preview via
  `.claude/launch.json` (server `client`, :5173, proxies `/api` → :4000).
- API so far: `GET /api/me`, `GET /api/users`, `GET /api/projects`,
  `POST /api/projects`, `GET /api/projects/:id`. All gated by `requireActiveUser()`
  (server/src/index.js) → user-scoped (RLS) client + active profile. For Phase 4
  writes, keep acting as the user so RLS (`can_edit_project`, append-only
  `task_updates` insert policy) enforces capability; add a server role/owner check
  too for clear 403s.
- Client: in-memory routing in `screens/AuthedApp.jsx`; reusable bits in
  `components/` (StatusChip, Avatar, TaskUpdateThread, AppShell layout w/ `title`
  + `actions` slots) and `lib/` (api.js, format.js — dd/mm/yyyy, status vocab).
  Reuse, don't redefine. Client reads repo-root `.env` via Vite `envDir: '..'`.
- `.env` (gitignored) holds Supabase URL + anon + service-role + access token.
- Apply SQL: `cd server && node scripts/run-sql-api.mjs <file.sql>`.

---

## Session log (newest first)

- **2026-06-17** — Built Phase 3 (Project Detail, View mode): `GET /api/projects/:id`
  (full RLS-scoped detail tree), the reusable task-update thread (§13), in-memory
  list↔detail routing with sub-project breadcrumb, summary band w/ AUTO target,
  detail status filter. Verified in-browser (owner) and via API (per role + viewer
  404). Merged `feature/detail-view` → `main`. Next: Phase 4 Detail Edit. Blockers: none.
- **2026-06-17** — Built Phase 2 (Project list): RLS-scoped `GET /api/projects` with
  server-computed derived target dates, `GET /api/users`, `POST /api/projects`
  (name validation, viewer 403); list UI with filters/search, empty states, status
  chips, and the create modal. Verified in-browser (admin + viewer) and via API for
  all four roles. Merged `feature/project-list` → `main`. Next: Phase 3 Detail View.
- **2026-06-17** — Built Phase 1 (Auth & shell): login + all §8.3 states, Supabase
  session handling, shared set-password screen, navy app shell with account menu,
  and a server-side `GET /api/me` gate that refuses inactive accounts. Verified in
  the browser and via API. Merged `feature/auth-shell` → `main`. Next: Phase 2.
- **2026-06-17** — Built Phase 0 scaffolding. Schema + RLS + seed applied to the
  hosted Supabase project over the Management API (Postgres ports firewalled).
  Verified admin sign-in and per-role RLS visibility. Merged
  `feature/phase-0-scaffolding` → `main`. Next: Phase 1 Auth & shell. Blockers: none.
- **2026-06-16** — Kickoff. PRD v1 finalised; CLAUDE.md and SESSION_STATUS.md created. No code yet.

<!--
Append one line per session, e.g.:
- YYYY-MM-DD — Built <slice>. Merged feature/<slice> to main. Next: <slice>. Blockers: <none/...>.
-->
