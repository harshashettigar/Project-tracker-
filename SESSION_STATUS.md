# SESSION_STATUS.md — Project Tracker

> **Read this first, write it last.** It is the handoff between sessions.
> Keep it short. Move durable facts to `CLAUDE.md`; keep only what's moving here.

**Last updated:** 2026-06-17 (Phase 9 complete — v1 build order finished, merged to `main`)
**Current phase:** v1 build order complete. No phase in flight.

---

## State in one line

All nine build-order phases (0–9) are done and merged to `main`. Phase 9 hardening
applied two DB security fixes and added admin audit logging, verified against the
hosted Supabase project. The v1 scope per the PRD is functionally complete.

## Done (Phase 9 — Hardening)

- **RLS: viewers can't create projects** — migration `20260617091000_hardening.sql`
  adds `can_create_projects()` and rewrites the `projects` INSERT policy so a
  viewer is denied at the DB (not just the API). Verified: viewer direct insert →
  `42501`; member still allowed.
- **Derived-target view RLS-safe** — `project_target_dates` is now
  `security_invoker = on`. Verified: a viewer sees 0 rows, the service role sees 3.
  Mirrored into `docs/schema.sql`.
- **Audit trail (§20.2)** — admin actions write to `audit_log` via the service
  role (`audit()` helper): `user.create/update/deactivate/reactivate`,
  `mapping.add/remove`, each with actor + timestamp. Verified end-to-end.
- **§20 review pass** — findings recorded in `docs/decisions.md` (auth, permissions,
  sessions, files, text-escaping, append-only updates, dd/mm/yyyy all confirmed;
  deferrals noted). Applied via `run-sql-api.mjs` over HTTPS. Merged
  `feature/hardening` → `main`.

## What v1 includes (phases 0–9, all merged)

0 scaffolding (schema+RLS+seed) · 1 auth & shell · 2 project list · 3 detail view ·
4 detail edit · 5 files · 6 sub-projects · 7 admin users · 8 admin mappings ·
9 hardening. All verified via API + in-browser; seed data intact throughout.

## Next slice (do this session)

_None queued._ v1 build order is complete. Candidate follow-ups if work continues
(all currently in Backlog, none are v1-blocking):
- Final cross-cutting acceptance pass against PRD §22 (release scope) and the
  Appendix B acceptance scenarios, if those are in `docs/`.
- Pick up a Backlog item below, or start a deferred/future-version item (PRD §23)
  only with explicit sign-off — those are out of v1.

## Backlog (deferred; not in v1 scope unless re-prioritised)

- **Files:** wire a real (self-hosted) virus scanner behind `SCAN_ENABLED`
  (currently a stub hook that fails closed); milestone/task-scoped attachments
  (schema supports them; v1 does project-level only).
- **Admin users:** email change on edit (auth identity re-issue) — v1 read-only.
- **A11y polish:** broader keyboard nav + visible focus states (§20.4).
- **Routing:** deep-linkable URLs (real router) — v1 uses in-memory routing.
- **Audit:** surface `audit_log` in an admin UI (currently write + admin-read RLS
  only); audit project/milestone/task edits if desired (v1 scopes §20.2 to
  access/membership/mapping changes + the per-task update history).

## Blockers / open

- None. Standing note: office network blocks Postgres ports — DB tooling runs over
  HTTPS via the Management API (`server/scripts/run-sql-api.mjs`, needs
  `SUPABASE_ACCESS_TOKEN`). Supabase Storage + admin (incl. auth invite) APIs work
  over HTTPS. GoTrue rejects some email domains (e.g. `example.com`).
- Dev gotcha: `node src/index.js` can leave a process on :4000 that survives
  TaskStop on Windows; if a fresh start logs `EADDRINUSE`, free the port
  (`Stop-Process` on the PID from `Get-NetTCPConnection -LocalPort 4000`).

## Branch state

- Active branch: `main` (Phase 9 merged; nothing in flight).
- Unmerged work: none.

## Useful facts for next session

- Demo password for all four seeded accounts: `DemoPass!234`. Emails: admin
  `appuser1.msc@manipalsplchem.com`, `manager.demo@…`, `member.demo@…`,
  `viewer.demo@…` (all `@manipalsplchem.com`, all `active`).
- Migrations in `supabase/migrations/` are authoritative (now 5 files, latest
  `20260617091000_hardening.sql`); `docs/schema.sql` is the human-readable mirror.
  Add a NEW migration for further DB changes; apply with
  `cd server && node scripts/run-sql-api.mjs <file.sql>` (HTTPS).
- Seed: 4 users (one per role), 1 mapping (Manager→Member), 2 top-level projects
  (Plant Safety Audit — Member; ERP Rollout — Manager) + 1 sub-project (Audit —
  Unit B), 2 milestones, 3 tasks, 2 task updates, 0 attachments.
- Run locally: API `cd server && node src/index.js` (:4000); client preview via
  `.claude/launch.json` (server `client`, :5173). Storage: `npm run setup:storage`.
  First-time DB setup: `setup:auth` then seed; `setup:storage` for the bucket.
- Full API surface (all via `requireActiveUser`; project writes also
  `canEditProject`; admin routes via `requireAdmin`): `GET /api/me`; `GET /api/users`;
  projects `GET/POST /api/projects`, `GET/PATCH /api/projects/:id`; milestones
  `POST /api/projects/:id/milestones`, `PATCH|DELETE /api/milestones/:id`; tasks
  `POST /api/projects/:id/tasks`, `PATCH|DELETE /api/tasks/:id`; updates
  `POST /api/tasks/:id/updates`; files `POST /api/projects/:id/files`,
  `GET /api/files/:id/url`, `DELETE /api/files/:id`; admin users
  `GET/POST /api/admin/users`, `PATCH /api/admin/users/:id`; admin mappings
  `GET /api/admin/mappings`, `POST /api/admin/mappings`, `DELETE /api/admin/mappings/:id`.
- Client: in-memory routing (`screens/AuthedApp.jsx`: list|detail|admin{tab}).
  Screens: ProjectList, ProjectDetail (view/edit), AdminUsers, AdminMappings.
  Components: AppShell, edit/*, Files*/FileViewerModal, TaskUpdateThread,
  StatusChip, RoleChip/UserStatusChip, Avatar, AdminTabs, *Modal. `lib/api.js` +
  `lib/format.js`. Client reads repo-root `.env` via Vite `envDir: '..'`.
- DB security helpers (SECURITY DEFINER, in the RLS + hardening migrations):
  `is_admin()`, `can_see_project_owner()`, `can_edit_project()`,
  `can_create_projects()`. Reuse these.
- `.env` (gitignored): Supabase URL + anon + service-role + access token,
  `APP_URL`, optional `ATTACHMENTS_BUCKET`.

---

## Session log (newest first)

- **2026-06-17** — Built Phase 9 (Hardening): migration `…091000_hardening.sql`
  (viewer-exclude on projects INSERT via `can_create_projects()`; `security_invoker`
  on `project_target_dates`), applied over HTTPS and verified at the DB; added
  admin `audit_log` writes (`audit()` helper) for user + mapping changes; §20
  review pass recorded. Merged `feature/hardening` → `main`. **v1 build order
  complete.** Blockers: none.
- **2026-06-17** — Built Phase 8 (Admin Mappings): admin-gated
  `GET/POST/DELETE /api/admin/mappings`; picker + panel (summary, add/remove,
  self-map blocked, idempotent) + overview; Users/Mappings tabs. Verified
  visibility changes on grant/revoke. Merged `feature/admin-mappings`.
- **2026-06-17** — Built Phase 7 (Admin Users): admin user CRUD +
  invite-to-set-password + deactivate/reactivate w/ self-guard; Users tab UI;
  account-menu Admin wiring. Verified. Merged `feature/admin-users`.
- **2026-06-17** — Built Phase 6 (Sub-projects): add/link/unlink via
  PATCH/POST `parent_project_id` (+ depth trigger). Verified. Merged
  `feature/sub-projects`.
- **2026-06-17** — Built Phase 5 (Files): private bucket + setup:storage;
  server-mediated upload (type/size/scan-hook); signed-URL in-app viewer +
  download fallback. Verified. Merged `feature/files`.
- **2026-06-17** — Built Phase 4 (Detail Edit): write endpoints + §12.1/§19.1
  validation; editable summary, milestone/task CRUD + reorder, update composer.
  Verified. Merged `feature/detail-edit`.
- **2026-06-17** — Built Phase 3 (Detail View): detail tree endpoint, task-update
  thread (§13), routing w/ breadcrumb, AUTO target, status filter. Verified.
  Merged `feature/detail-view`.
- **2026-06-17** — Built Phase 2 (Project list): RLS-scoped list, derived target,
  filters/search, empty states, create modal. Verified. Merged
  `feature/project-list`.
- **2026-06-17** — Built Phase 1 (Auth & shell): login + §8.3 states, session,
  set-password, app shell, server-side inactive gate. Verified. Merged
  `feature/auth-shell`.
- **2026-06-17** — Built Phase 0 scaffolding. Schema + RLS + seed over the
  Management API. Verified. Merged `feature/phase-0-scaffolding`.
- **2026-06-16** — Kickoff. PRD v1 finalised; CLAUDE.md and SESSION_STATUS.md created. No code yet.

<!--
Append one line per session, e.g.:
- YYYY-MM-DD — Built <slice>. Merged feature/<slice> to main. Next: <slice>. Blockers: <none/...>.
-->
