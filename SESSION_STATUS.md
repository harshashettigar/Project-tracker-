# SESSION_STATUS.md — Project Tracker

> **Read this first, write it last.** It is the handoff between sessions.
> Keep it short. Move durable facts to `CLAUDE.md`; keep only what's moving here.

**Last updated:** 2026-06-17 (Phase 8 complete, merged to `main`)
**Current phase:** Phase 9 — Hardening (final phase, next)

---

## State in one line

Phase 8 (Admin — Visibility mappings) is done and verified against the hosted
Supabase project: admins can grant/revoke who-sees-whose-projects, and a grant
actually changes RLS visibility. All nine build-order screens now exist; next is
Phase 9 — hardening (the small security/polish backlog below).

## Done

- **Admin Mappings tab** (PRD §17): user picker (searchable, with mapped counts),
  mapping panel (plain-language summary §17.2, removable mapped employees with
  project counts, "+ Add employee" search-and-select excluding self + already-
  mapped, self shown disabled "can't map to self"), and the overview/audit table
  (§17.4). Self-map blocked, empty-state message, idempotent duplicate add.
- **Admin area is two tabs** now (`AdminTabs`: Users | Mappings); the Users-tab
  "Mapped" count deep-links into Mappings preselecting that user.
- **Server** (admin-gated): `GET /api/admin/mappings` (users + owned-project counts
  + grants), `POST /api/admin/mappings` (grant; self-map 400; duplicate idempotent),
  `DELETE /api/admin/mappings/:id` (revoke). Writes only touch `user_visibility`;
  visibility is already enforced by the project-list RLS (`can_see_project_owner`).
- Verified via API (list + counts; non-admin 403; self-map 400; **grant made the
  viewer actually see the owner's project, revoke removed it**; idempotent re-add)
  and in-browser (tabs, picker counts, populated + empty summaries, add/remove
  round-trip, overview table, Mapped-count deep-link). DB left with only the seed
  mapping (Manager→Member). Merged `feature/admin-mappings` → `main`.

## Next slice (do this session)

**Phase 9 — Hardening** (PRD §20 + the accumulated backlog). No new screens —
tighten and polish. Priorities:
  1. **RLS: viewers can't create projects.** Today the `projects` INSERT policy is
     `owner = auth.uid() OR is_admin()` — it doesn't check role, so a viewer is
     blocked from creating only by the API guard. Add a role check to the policy
     (new migration; apply via `run-sql-api.mjs`). Re-verify viewer create → denied
     at the DB.
  2. **Derived-target view RLS-safe.** Set `security_invoker = on` on
     `project_target_dates` so it can't leak across RLS if ever queried directly.
  3. Sweep §20: confirm permissions matrix (§18) holds at the DB for every
     write path; check user-supplied text is escaped on render (React does this —
     spot-check the update/objective rendering); session expiry/sign-out clears
     state (Phase 1); file type/size/scan (Phase 5). Note anything deferred.

**Definition of done:** the two RLS fixes are applied to the hosted DB and
re-verified (viewer create denied at the DB; view safe); a short §20 pass is done
with findings recorded in decisions.md; no regressions in the smoke paths.

## Backlog (out of scope for the current slice)

- **Files:** real virus scanner (wire behind `SCAN_ENABLED`); milestone/task-scoped
  attachments (schema supports them; v1 does project-level only).
- **Admin users:** email change on edit (identity re-issue) — deferred; v1 read-only.
- Deep-linkable URLs (real router) — deferred; in-memory routing for now.

## Blockers / open

- None. Standing note: office network blocks Postgres ports — DB tooling runs over
  HTTPS via the Management API (`server/scripts/run-sql-api.mjs`, needs
  `SUPABASE_ACCESS_TOKEN`). Supabase Storage + admin (incl. auth invite) APIs work
  over HTTPS. GoTrue rejects some email domains (e.g. `example.com`).
- Dev gotcha: `node src/index.js` can leave a process on :4000 that survives
  TaskStop on Windows; if a fresh start logs `EADDRINUSE`, free the port
  (`Stop-Process` on the PID from `Get-NetTCPConnection -LocalPort 4000`).

## Branch state

- Active branch: `main` (Phase 8 merged; nothing in flight).
- Unmerged work: none.

## Useful facts for next session

- Demo password for all four seeded accounts: `DemoPass!234`. Emails: admin
  `appuser1.msc@manipalsplchem.com`, `manager.demo@…`, `member.demo@…`,
  `viewer.demo@…` (all `@manipalsplchem.com`, all `active`).
- RLS lives in `supabase/migrations/20260617090300_rls.sql`; the depth/updated_at
  triggers in `…090100_triggers.sql`; derived view in `…090200_derived_target.sql`.
  For Phase 9, add a NEW migration (don't edit applied ones) and apply with
  `cd server && node scripts/run-sql-api.mjs <file.sql>`. Mirror changes into
  `docs/schema.sql` (the human-readable mirror).
- `is_admin()` and `can_see_project_owner()`/`can_edit_project()` are SECURITY
  DEFINER helpers in the RLS migration — reuse them. Roles: `user_role` enum
  (admin/manager/member/viewer); a viewer-excluding insert check can read the
  caller's role via the `users` table (as `is_admin()` does).
- Seed: 4 users (one per role), 1 mapping (Manager→Member), 2 top-level projects
  (Plant Safety Audit — Member; ERP Rollout — Manager) + 1 sub-project (Audit —
  Unit B), 2 milestones, 3 tasks, 2 task updates, 0 attachments.
- Run locally: API `cd server && node src/index.js` (:4000); client preview via
  `.claude/launch.json` (server `client`, :5173). Storage: `npm run setup:storage`.
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
  Components: AppShell (title/actions/onAdmin), edit/* , Files*, TaskUpdateThread,
  StatusChip, RoleChip/UserStatusChip, Avatar, AdminTabs, *Modal. `lib/api.js` +
  `lib/format.js`. Client reads repo-root `.env` via Vite `envDir: '..'`.
- `.env` (gitignored): Supabase URL + anon + service-role + access token,
  `APP_URL`, optional `ATTACHMENTS_BUCKET`.

---

## Session log (newest first)

- **2026-06-17** — Built Phase 8 (Admin Mappings): admin-gated
  `GET/POST/DELETE /api/admin/mappings`; user picker + mapping panel (summary,
  add/remove, self-map blocked, idempotent) + overview table; Users/Mappings tabs.
  Verified visibility actually changes on grant/revoke. Merged
  `feature/admin-mappings` → `main`. Next: Phase 9 Hardening. Blockers: none.
- **2026-06-17** — Built Phase 7 (Admin Users): admin-gated user CRUD +
  invite-to-set-password + deactivate/reactivate w/ self-guard; Users tab UI;
  account-menu Admin wiring. Verified (incl. real invite + cleanup). Merged
  `feature/admin-users` → `main`. Next: Phase 8.
- **2026-06-17** — Built Phase 6 (Sub-projects): add/link/unlink via
  PATCH/POST `parent_project_id` (+ depth trigger), `SubProjectsEditor`. Verified.
  Merged `feature/sub-projects` → `main`.
- **2026-06-17** — Built Phase 5 (Files): private bucket + setup:storage;
  server-mediated upload (type/size/scan-hook); signed-URL in-app viewer +
  download fallback; attach/remove in Edit. Verified. Merged `feature/files`.
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
