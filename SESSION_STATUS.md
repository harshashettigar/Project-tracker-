# SESSION_STATUS.md — Project Tracker

> **Read this first, write it last.** It is the handoff between sessions.
> Keep it short. Move durable facts to `CLAUDE.md`; keep only what's moving here.

**Last updated:** 2026-06-17 (Phase 4 complete, merged to `main`)
**Current phase:** Phase 5 — File attachments & in-app viewing (next)

---

## State in one line

Phase 4 (Project Detail — Edit mode) is done and verified in-browser against the
hosted Supabase project: an owner/admin can edit the summary, add/edit/reorder/
remove milestones and tasks, and post append-only updates, with §12.1 required
fields enforced and capability gated server-side. Next is Phase 5 — file
attachments + the in-app viewer.

## Done

- **Detail Edit** (PRD §11): one screen, View↔Edit toggle (§10.4). Editable summary
  (name, start, status, owner [admin-only reassign] + objective; target stays
  derived/AUTO read-only). Milestones add/rename/retarget/restatus/reorder/remove;
  tasks (milestone & project-level) add/edit/reorder/remove; **update composer**
  (§11.4) pre-filled with prior text, append-only, empty blocked ("Write an update
  first."). Authorship owner+admin only.
- **§12.1 context-required dates** enforced in 3 layers: UI markers/inline
  validation (milestone target required, milestone-task target optional, project-
  level task target required), the API (re-checked on PATCH against the merged
  row), and the DB CHECK backstop.
- **Write endpoints** (all `requireActiveUser` + `canEditProject` → clean 403s, RLS
  the real boundary): `PATCH /api/projects/:id`, milestones `POST`/`PATCH /:id`/
  `DELETE /:id`, tasks `POST`/`PATCH /:id`/`DELETE /:id`, `POST /api/tasks/:id/updates`.
- **Navigation**: list pencil deep-opens Edit; **new project now opens directly in
  Edit mode** (§9.4 done). Reorder renumbers sibling `sort_order` then reloads.
- Verified via API (full lifecycle: create→patch→add milestone/tasks→post updates→
  reorder→delete; validation §19.1/§12.1; derived-target recompute; viewer & non-
  owner manager all 403). Verified in-browser as owner on a throwaway project
  (create→edit→add milestone→add milestone-task w/o target→post update→project-task
  target-required inline error→View render shows AUTO target recomputed). Throwaway
  deleted, seed intact. Merged `feature/detail-edit` → `main`.

## Next slice (do this session)

**Phase 5 — File attachments & in-app viewing** (PRD §15, with §11.2 attach/remove).
Attach files to a project (and where useful milestones/tasks) into object storage
with **type allow-list (pdf/png/jpg/docx/xlsx), ~25 MB cap, and virus scan before
persisting** (§15.2); show the "Additional Files" strip with type icon, name, size,
who attached; open PDFs/images in an **in-app modal viewer** with a download-and-
open fallback for unrenderable types (§15.1); wrong-type/oversize inline errors
(§19.1/§19.2). Wire attach/remove into Edit mode; keep the read-only strip in View.

**Definition of done:** an owner/admin can attach an allowed file and see it in the
strip; wrong type/oversize are rejected with the right messages; a stored file
opens in-app (PDF/image) or via download fallback; remove works; access enforced
server/DB-side (attachments RLS already mirrors project visibility/edit). Decide &
record the storage bucket + scan approach (see open question below).

## Backlog (out of scope for the current slice)

- **Phase 9 hardening:** tighten the `projects` INSERT RLS policy to exclude the
  viewer role (today viewers are blocked from create only by the API guard).
- **Phase 9 hardening:** set `security_invoker = on` on `project_target_dates` so
  the derived-target view is RLS-safe to query/expose directly.
- Deep-linkable URLs (real router) — deferred; in-memory routing for now.

## Blockers / open

- None blocking. **Open question for Phase 5:** which object-storage + virus-scan
  path on hosted Supabase given the office network (HTTPS-only)? Supabase Storage
  over HTTPS is reachable; the scan step (§15.2) needs a decision — e.g. an edge
  function / scan service, or quarantine-then-scan. Resolve at the start of Phase 5.
- Standing note: office network blocks Postgres ports — DB tooling runs over HTTPS
  via the Management API (`server/scripts/run-sql-api.mjs`, needs
  `SUPABASE_ACCESS_TOKEN`). See CLAUDE.md "Office-network gotcha".
- Dev gotcha: `node src/index.js` can leave a process on :4000 that survives
  TaskStop on Windows; if a fresh start logs `EADDRINUSE`, free the port
  (`Stop-Process` on the PID from `Get-NetTCPConnection -LocalPort 4000`).

## Branch state

- Active branch: `main` (Phase 4 merged; nothing in flight).
- Unmerged work: none.

## Useful facts for next session

- Demo password for all four seeded accounts: `DemoPass!234`. Emails: admin
  `appuser1.msc@manipalsplchem.com`, `manager.demo@…`, `member.demo@…`,
  `viewer.demo@…` (all `@manipalsplchem.com`, all `active`).
- Seed shape: **Plant Safety Audit 2026** (owner Demo Member) — milestones
  "Documentation review" (Collect SOP documents=completed, Gap analysis=in_progress,
  each 1 update) + "On-site inspection" (no tasks); project task "Kickoff sign-off";
  sub-project "Audit — Unit B". ERP Rollout (owner Demo Manager) is an empty Draft.
  `attachments` table exists but seed has 0 files — good for Phase 5 first-attach.
- Run locally: API `cd server && node src/index.js` (:4000); client preview via
  `.claude/launch.json` (server `client`, :5173, proxies `/api` → :4000).
- API surface: `GET /api/me`, `GET /api/users`, `GET /api/projects`,
  `POST /api/projects`, `GET /api/projects/:id`, `PATCH /api/projects/:id`,
  milestones `POST /api/projects/:id/milestones` + `PATCH|DELETE /api/milestones/:id`,
  tasks `POST /api/projects/:id/tasks` + `PATCH|DELETE /api/tasks/:id`,
  `POST /api/tasks/:id/updates`. All via `requireActiveUser()`; writes also call
  `canEditProject()` for clean 403s. For Phase 5 file routes, keep acting as the
  user; attachments RLS already mirrors project visibility (read) and edit (write).
- Client: in-memory routing (`screens/AuthedApp.jsx`, routes carry optional
  `mode`); detail screen `screens/ProjectDetail.jsx` branches view/edit; edit
  components in `components/edit/` (SummaryEditor, MilestoneEditor, TaskEditor,
  AddMilestoneForm, AddTaskForm, UpdateComposer); reusable `TaskUpdateThread`,
  `StatusChip`, `Avatar`; `lib/api.js` + `lib/format.js`. Reuse, don't redefine.
  Client reads repo-root `.env` via Vite `envDir: '..'`.
- `.env` (gitignored) holds Supabase URL + anon + service-role + access token.
- Apply SQL: `cd server && node scripts/run-sql-api.mjs <file.sql>`.

---

## Session log (newest first)

- **2026-06-17** — Built Phase 4 (Project Detail, Edit mode): write endpoints for
  project/milestone/task/update with RLS + canEditProject 403s and §12.1/§19.1
  validation; editable summary, milestone/task CRUD + reorder, append-only update
  composer; list pencil + new-project now open Edit mode. Verified via API
  (lifecycle + capability + validation) and in-browser as owner. Merged
  `feature/detail-edit` → `main`. Next: Phase 5 Files. Blockers: none (open Q:
  storage+scan path).
- **2026-06-17** — Built Phase 3 (Project Detail, View mode): `GET /api/projects/:id`
  (full RLS-scoped detail tree), the reusable task-update thread (§13), in-memory
  list↔detail routing with sub-project breadcrumb, summary band w/ AUTO target,
  detail status filter. Verified in-browser (owner) and via API (per role + viewer
  404). Merged `feature/detail-view` → `main`. Next: Phase 4 Detail Edit.
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
