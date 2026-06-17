# SESSION_STATUS.md — Project Tracker

> **Read this first, write it last.** It is the handoff between sessions.
> Keep it short. Move durable facts to `CLAUDE.md`; keep only what's moving here.

**Last updated:** 2026-06-17 (Phase 6 complete, merged to `main`)
**Current phase:** Phase 7 — Admin: User management (next)

---

## State in one line

Phase 6 (Sub-projects) is done and verified against the hosted Supabase project:
in Edit mode an owner/admin can add a new sub-project, link an existing one, or
unlink, with the one-level rule and capability enforced server/DB-side. Next is
Phase 7 — the Admin Users tab.

## Done

- **Sub-projects** (PRD §14): Edit-mode "Sub Projects" editor (`SubProjectsEditor`)
  to **add new**, **link existing**, and **unlink** (detach → back to top-level;
  never deletes the child). View strip + breadcrumb were already built (Phase 3).
- **Server**: no new endpoints — link/unlink is `PATCH /api/projects/:id
  { parent_project_id }` (null = unlink); add-new is `POST /api/projects` with
  `parent_project_id`. `validateParentLink()` gives clean errors (caller can edit
  parent, parent is top-level, child has no children, no self-parent); the depth
  trigger is the DB backstop. Linking needs edit rights on parent AND child.
- **One level only**: add/link controls hidden when the project is itself a
  sub-project; nesting under a sub-project or making a parent-with-children a
  child are all rejected.
- Verified via API (add/link/unlink; one-level both directions incl. a seed check;
  self-parent; viewer 403; top-level list excludes children) and in-browser
  (editor renders existing child + unlink + add-new; link-existing dropdown hidden
  when no candidates; add-new appears in the strip; one-level note on a
  sub-project). Throwaway data deleted, seed intact. Merged
  `feature/sub-projects` → `main`.

## Next slice (do this session)

**Phase 7 — Admin: User management** (PRD §16, with §19.1 validation & §8.3
inactive rule). Admin-only area reached from the account menu (the menu already
has a disabled "Admin" item for admins — wire it up). Build the **Users tab**: a
full-width table (Name, Email, Role chip, Status chip, Mapped count, Actions),
search + role filter + status multi-select + "Add user"; the add/edit modal
(Full name, Email, Role, Status) with **invite-on-create** ("An invite to set a
password will be sent to this email." → "Send invite"; edit → "Save changes");
deactivate/reactivate with confirm and the **self-deactivate guard**; validation
(§16.3/§19.1: name required, email valid + unique). First-run empty state (§19.2).

**Definition of done:** an admin can list/search/filter users, invite a new user
(sets up the auth invite + the `public.users` row), edit role/status, deactivate
(→ can't sign in, per the Phase-1 gate) and reactivate, cannot deactivate self;
non-admins can't reach any of it (server/DB-side). Matches PRD §16. The "Mapped"
count links toward Mappings (Phase 8) — stub the link.

## Backlog (out of scope for the current slice)

- **Phase 9 hardening:** tighten the `projects` INSERT RLS policy to exclude the
  viewer role (today viewers are blocked from create only by the API guard).
- **Phase 9 hardening:** set `security_invoker = on` on `project_target_dates`.
- **Files:** real virus scanner (wire behind `SCAN_ENABLED`); milestone/task-scoped
  attachments (schema supports them; v1 does project-level only).
- Deep-linkable URLs (real router) — deferred; in-memory routing for now.

## Blockers / open

- None. Standing note: office network blocks Postgres ports — DB tooling runs over
  HTTPS via the Management API (`server/scripts/run-sql-api.mjs`, needs
  `SUPABASE_ACCESS_TOKEN`). Supabase Storage + admin (incl. auth invite) APIs also
  work over HTTPS — relevant for Phase 7 invite emails.
- Dev gotcha: `node src/index.js` can leave a process on :4000 that survives
  TaskStop on Windows; if a fresh start logs `EADDRINUSE`, free the port
  (`Stop-Process` on the PID from `Get-NetTCPConnection -LocalPort 4000`).

## Branch state

- Active branch: `main` (Phase 6 merged; nothing in flight).
- Unmerged work: none.

## Useful facts for next session

- Demo password for all four seeded accounts: `DemoPass!234`. Emails: admin
  `appuser1.msc@manipalsplchem.com`, `manager.demo@…`, `member.demo@…`,
  `viewer.demo@…` (all `@manipalsplchem.com`, all `active`).
- For Phase 7: users live in `public.users` (id → `auth.users.id`), columns
  full_name, email (unique), role, status, invited_at. RLS: any authenticated user
  can READ users (directory); **only admins may WRITE** (`users_admin_write`). The
  invite-to-set-password flow is the Supabase admin API — see how Phase 0's
  `server/scripts/setup-auth-users.mjs` calls `auth.admin.createUser`; the runtime
  invite should use `auth.admin.inviteUserByEmail` (service role, server-side).
  Inactive accounts already can't sign in (Phase-1 `GET /api/me` gate).
  "Mapped" count = rows in `user_visibility` where viewer = that user (Phase 8).
- Run locally: API `cd server && node src/index.js` (:4000); client preview via
  `.claude/launch.json` (server `client`, :5173). Storage: `npm run setup:storage`.
- API surface: auth `GET /api/me`; `GET /api/users`; projects `GET/POST /api/projects`,
  `GET/PATCH /api/projects/:id` (PATCH now also takes `parent_project_id` for
  link/unlink); milestones `POST /api/projects/:id/milestones`, `PATCH|DELETE
  /api/milestones/:id`; tasks `POST /api/projects/:id/tasks`, `PATCH|DELETE
  /api/tasks/:id`; updates `POST /api/tasks/:id/updates`; files
  `POST /api/projects/:id/files`, `GET /api/files/:id/url`, `DELETE /api/files/:id`.
  All via `requireActiveUser()`; writes also call `canEditProject()`. Phase 7 adds
  admin-only user routes — gate on `profile.role === 'admin'` AND use the service
  client for the auth invite (RLS covers the `public.users` writes).
- Client: in-memory routing (`screens/AuthedApp.jsx`); `ProjectDetail` branches
  view/edit; edit components in `components/edit/` (now incl. `SubProjectsEditor`);
  `FilesSection`/`FileViewerModal`; reusable `TaskUpdateThread`, `StatusChip`,
  `Avatar`; `lib/api.js` + `lib/format.js`. The account menu (`AppShell`) has a
  disabled "Admin" item for admins — Phase 7 wires it to an Admin route. Reuse the
  table/filter/modal patterns from `ProjectList`/`NewProjectModal`. Client reads
  repo-root `.env` via Vite `envDir: '..'`.
- `.env` (gitignored): Supabase URL + anon + service-role + access token.
  `ATTACHMENTS_BUCKET` overrides the bucket name (default `attachments`).
- Apply SQL: `cd server && node scripts/run-sql-api.mjs <file.sql>`.

---

## Session log (newest first)

- **2026-06-17** — Built Phase 6 (Sub-projects): Edit-mode add/link/unlink via
  PATCH/POST `parent_project_id` (+ `validateParentLink` and the depth trigger),
  `SubProjectsEditor`. Verified via API (one-level both ways, self-parent, viewer
  403, top-level exclusion) and in-browser. Merged `feature/sub-projects` → `main`.
  Next: Phase 7 Admin Users. Blockers: none.
- **2026-06-17** — Built Phase 5 (Files): private `attachments` bucket +
  `setup:storage`; server-mediated upload with type(magic)/size/scan-hook checks;
  signed-URL view + in-app PDF/image viewer with download fallback; attach/remove
  in Edit. Scan is a stubbed pluggable hook. Verified via API + in-browser. Merged
  `feature/files` → `main`. Next: Phase 6 Sub-projects.
- **2026-06-17** — Built Phase 4 (Project Detail, Edit mode): write endpoints with
  RLS + canEditProject 403s and §12.1/§19.1 validation; editable summary,
  milestone/task CRUD + reorder, append-only update composer; list pencil +
  new-project open Edit mode. Verified. Merged `feature/detail-edit` → `main`.
- **2026-06-17** — Built Phase 3 (Project Detail, View mode): detail tree endpoint,
  reusable task-update thread (§13), list↔detail routing w/ breadcrumb, AUTO target,
  detail status filter. Verified. Merged `feature/detail-view` → `main`.
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
