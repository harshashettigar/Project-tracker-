# SESSION_STATUS.md — Project Tracker

> **Read this first, write it last.** It is the handoff between sessions.
> Keep it short. Move durable facts to `CLAUDE.md`; keep only what's moving here.

**Last updated:** 2026-06-17 (Phase 7 complete, merged to `main`)
**Current phase:** Phase 8 — Admin: Visibility mappings (next)

---

## State in one line

Phase 7 (Admin — User management) is done and verified against the hosted
Supabase project: the admin-only Users tab lists/filters users, invites new ones
(invite-to-set-password), edits role/status, and deactivates/reactivates with the
self-guard. Next is Phase 8 — the Mappings tab (the visibility access model).

## Done

- **Admin Users tab** (PRD §16): admin-only, reached from the account menu (the
  "Admin" entry is now wired). Full-width table (Name+avatar, Email, Role chip,
  Status chip, Mapped count, Edit/Deactivate), search + role filter + status
  multi-select + "Add user"; empty / no-match states.
- **Invite on create** (§16.3): Supabase `inviteUserByEmail` (service role) →
  insert `public.users` row (rolls back the auth identity if the row insert
  fails). Modal note + "Send invite"/"Save changes"; validation verbatim
  (name required, valid email, unique → 409). Email read-only on edit.
- **Deactivate/reactivate** (§16.4): confirm + status flip; deactivated users
  can't sign in (Phase-1 gate). Self-deactivate blocked in API + UI.
- **Server** (admin-gated via `requireAdmin`): `GET /api/admin/users` (with mapped
  counts from `user_visibility`), `POST /api/admin/users`, `PATCH
  /api/admin/users/:id`. `GET /api/users` stays as the non-admin directory.
- **Chips**: `RoleChip` (§7.3 violet/blue/grey/slate) + `UserStatusChip`
  (green/grey). Account menu `onAdmin` wiring; `admin` route in `AuthedApp`.
- Verified via API (list + mapped counts; non-admin 403; self-deactivate 400;
  bad/duplicate email; edit; a real invite on a plus-address then fully cleaned
  up) and in-browser (nav, table+chips, self-guard disabled, add-modal note +
  validation, edit email read-only, deactivate→reactivate round-trip). DB left
  with exactly the 4 seeded users, all active. Merged `feature/admin-users` → `main`.

## Next slice (do this session)

**Phase 8 — Admin: Visibility mappings** (PRD §17, with §18). The second Admin
tab — the heart of access control. A mapping grants one user (viewer) visibility
into all projects owned by a set of other users (owners), **in addition to their
own**; many-to-many; admins see everything regardless. Build: the user picker
(left, searchable, with each user's mapped count), the mapping panel (plain-
language summary sentence e.g. "Amit can view projects owned by: …"; "Mapped
employees" as removable rows; "+ Add employee" search-and-select excluding
already-mapped and self), and the overview/audit table (§17.4). Validation
(§17.3): self-map blocked ("A user can't be mapped to view their own projects."),
empty state, duplicate add is a no-op (idempotent). Wire the Users-tab "Mapped"
count link to open that user's mapping panel.

**Definition of done:** an admin can grant/revoke mappings (writes to
`user_visibility`), the plain-language summary and overview are correct, self-map
is blocked, duplicates are idempotent, and the changes actually affect visibility
(the existing project-list RLS already reads `user_visibility`). Admin-only,
enforced server/DB-side. Matches PRD §17.

## Backlog (out of scope for the current slice)

- **Phase 9 hardening:** tighten the `projects` INSERT RLS policy to exclude the
  viewer role (today viewers are blocked from create only by the API guard).
- **Phase 9 hardening:** set `security_invoker = on` on `project_target_dates`.
- **Files:** real virus scanner (behind `SCAN_ENABLED`); milestone/task-scoped
  attachments (schema supports them; v1 does project-level only).
- **Admin users:** email change on edit (identity re-issue) — deferred; v1 read-only.
- Deep-linkable URLs (real router) — deferred; in-memory routing for now.

## Blockers / open

- None. Standing note: office network blocks Postgres ports — DB tooling runs over
  HTTPS via the Management API (`server/scripts/run-sql-api.mjs`, needs
  `SUPABASE_ACCESS_TOKEN`). Supabase Storage + admin (incl. auth invite) APIs work
  over HTTPS. GoTrue rejects some email domains (e.g. `example.com`) — use a real
  domain (plus-addressing) when testing invites.
- Dev gotcha: `node src/index.js` can leave a process on :4000 that survives
  TaskStop on Windows; if a fresh start logs `EADDRINUSE`, free the port
  (`Stop-Process` on the PID from `Get-NetTCPConnection -LocalPort 4000`).

## Branch state

- Active branch: `main` (Phase 7 merged; nothing in flight).
- Unmerged work: none.

## Useful facts for next session

- Demo password for all four seeded accounts: `DemoPass!234`. Emails: admin
  `appuser1.msc@manipalsplchem.com`, `manager.demo@…`, `member.demo@…`,
  `viewer.demo@…` (all `@manipalsplchem.com`, all `active`).
- For Phase 8: `user_visibility(id, viewer_user_id, owner_user_id, created_by,
  created_at)` with UNIQUE(viewer,owner) + CHECK(viewer<>owner). RLS:
  `user_visibility_admin_all` (admins only, all ops). Seed has ONE mapping:
  **Demo Manager → Demo Member** (manager views member's projects), which is why
  the manager sees Plant Safety Audit. Add a mapping = insert a row (dup =
  idempotent no-op via the unique constraint); revoke = delete. `created_by` =
  the admin's id. RLS-safe to write AS THE USER (admin); or service client.
- Run locally: API `cd server && node src/index.js` (:4000); client preview via
  `.claude/launch.json` (server `client`, :5173). Storage: `npm run setup:storage`.
- API surface (all via `requireActiveUser`; writes also `canEditProject`; admin
  routes via `requireAdmin`): auth `GET /api/me`; `GET /api/users`; projects
  `GET/POST /api/projects`, `GET/PATCH /api/projects/:id` (PATCH takes
  `parent_project_id`); milestones `POST /api/projects/:id/milestones`,
  `PATCH|DELETE /api/milestones/:id`; tasks `POST /api/projects/:id/tasks`,
  `PATCH|DELETE /api/tasks/:id`; updates `POST /api/tasks/:id/updates`; files
  `POST /api/projects/:id/files`, `GET /api/files/:id/url`, `DELETE /api/files/:id`;
  admin `GET /api/admin/users`, `POST /api/admin/users`, `PATCH /api/admin/users/:id`.
  Phase 8 adds admin mapping routes (list/grant/revoke on `user_visibility`).
- Client: in-memory routing (`screens/AuthedApp.jsx`: routes list|detail|admin);
  `AdminUsers` screen + `AdminUserModal` + `RoleChip`/`UserStatusChip`; reuse
  these table/filter/modal/chip patterns for the Mappings tab. The Admin area is
  one screen now — Phase 8 should add a Users/Mappings tab switch (§16.1). Account
  menu `onAdmin` is wired through `AppShell`. Client reads repo-root `.env` via
  Vite `envDir: '..'`.
- `.env` (gitignored): Supabase URL + anon + service-role + access token,
  `APP_URL` (invite/reset redirect), optional `ATTACHMENTS_BUCKET`.
- Apply SQL: `cd server && node scripts/run-sql-api.mjs <file.sql>`.

---

## Session log (newest first)

- **2026-06-17** — Built Phase 7 (Admin Users): admin-gated `GET/POST/PATCH
  /api/admin/users` (mapped counts, invite-to-set-password, edit, deactivate with
  self-guard); Users tab UI (table, filters, modal, role/status chips), account-menu
  Admin wiring + `admin` route. Verified via API (incl. a real invite + cleanup)
  and in-browser. Merged `feature/admin-users` → `main`. Next: Phase 8 Mappings.
- **2026-06-17** — Built Phase 6 (Sub-projects): Edit-mode add/link/unlink via
  PATCH/POST `parent_project_id` (+ `validateParentLink` and the depth trigger),
  `SubProjectsEditor`. Verified via API + in-browser. Merged
  `feature/sub-projects` → `main`. Next: Phase 7 Admin Users.
- **2026-06-17** — Built Phase 5 (Files): private `attachments` bucket +
  `setup:storage`; server-mediated upload with type(magic)/size/scan-hook checks;
  signed-URL view + in-app PDF/image viewer with download fallback; attach/remove
  in Edit. Verified. Merged `feature/files` → `main`. Next: Phase 6.
- **2026-06-17** — Built Phase 4 (Detail Edit): write endpoints + §12.1/§19.1
  validation; editable summary, milestone/task CRUD + reorder, append-only update
  composer. Verified. Merged `feature/detail-edit` → `main`.
- **2026-06-17** — Built Phase 3 (Detail View): detail tree endpoint, reusable
  task-update thread (§13), routing w/ breadcrumb, AUTO target, detail status
  filter. Verified. Merged `feature/detail-view` → `main`.
- **2026-06-17** — Built Phase 2 (Project list): RLS-scoped list, derived target,
  filters/search, empty states, create modal. Verified. Merged
  `feature/project-list` → `main`.
- **2026-06-17** — Built Phase 1 (Auth & shell): login + §8.3 states, session,
  set-password, app shell, server-side inactive gate. Verified. Merged
  `feature/auth-shell` → `main`.
- **2026-06-17** — Built Phase 0 scaffolding. Schema + RLS + seed over the
  Management API. Verified. Merged `feature/phase-0-scaffolding` → `main`.
- **2026-06-16** — Kickoff. PRD v1 finalised; CLAUDE.md and SESSION_STATUS.md created. No code yet.

<!--
Append one line per session, e.g.:
- YYYY-MM-DD — Built <slice>. Merged feature/<slice> to main. Next: <slice>. Blockers: <none/...>.
-->
