# SESSION_STATUS.md — Project Tracker

> **Read this first, write it last.** It is the handoff between sessions.
> Keep it short. Move durable facts to `CLAUDE.md`; keep only what's moving here.

**Last updated:** 2026-06-17 (Phase 5 complete, merged to `main`)
**Current phase:** Phase 6 — Sub-projects (next)

---

## State in one line

Phase 5 (File attachments & in-app viewing) is done and verified against the
hosted Supabase project: a private `attachments` bucket, server-mediated upload
with type/size/scan checks, the in-app PDF/image viewer with download fallback,
and attach/remove in Edit mode. Next is Phase 6 — sub-projects (add/link/remove).

## Done

- **Storage**: private `attachments` bucket created via `npm run setup:storage`
  (HTTPS, idempotent). Uploads flow through the API; downloads via 120s signed URLs.
- **Upload** (`POST /api/projects/:id/files`, owner/admin): validates type
  (extension + MIME + magic bytes must agree), size (≤25 MB via multer), runs the
  **pluggable scan hook** (`server/src/scan.js`, stubbed pass in v1; fails closed if
  `SCAN_ENABLED` set without a real scanner), stores via service role, records the
  row as the user (RLS). Wrong-type/oversize/scan-fail → clear inline errors (§19.1).
- **View/remove**: `GET /api/files/:id/url` (signed URL; read scoped by project
  visibility), `DELETE /api/files/:id` (owner/admin; removes object + row).
- **UI**: "Additional Files" strip shows icon, name, size, who attached; click opens
  the **in-app viewer** (`FileViewerModal`) — PDF in an iframe, images in an img,
  DOCX/XLSX download-and-open fallback (§15.1). Edit mode adds an attach input
  (allow-list `accept`) + per-file remove, with client pre-checks.
- Verified via API (valid pdf/png 201; wrong-type, magic-mismatch, oversize → 400;
  viewer & non-owner manager → 403; signed URL; no-visibility → 404; delete leaves
  no orphaned objects) and in-browser (strip render, image viewer loads via signed
  URL, edit attach/remove controls). Throwaway data deleted, seed intact. Merged
  `feature/files` → `main`.

## Next slice (do this session)

**Phase 6 — Sub-projects** (PRD §14, with §11.2 add/link/remove). A sub-project is
a full project with `parent_project_id` set; **one level only** (a sub-project
can't have its own sub-projects — already enforced by the depth trigger), **no
roll-up**, reached only via the parent's "Sub Projects" strip + breadcrumb (not on
the top-level list — already filtered). This slice: in Edit mode, **add a new
sub-project** and/or **link an existing** one as a child, and **remove/unlink**;
keep the read-only strip + breadcrumb in View (already built in Phase 3).

**Definition of done:** an owner/admin can create/link a child project and see it
in the parent's strip; clicking opens it with the breadcrumb (already works);
remove/unlink works; the one-level rule and visibility are enforced server/DB-side;
sub-projects stay off the top-level list. Matches PRD §14.

## Backlog (out of scope for the current slice)

- **Phase 9 hardening:** tighten the `projects` INSERT RLS policy to exclude the
  viewer role (today viewers are blocked from create only by the API guard).
- **Phase 9 hardening:** set `security_invoker = on` on `project_target_dates`.
- **Files:** real virus scanner (wire a self-hosted scanner behind `SCAN_ENABLED`);
  milestone/task-scoped attachments (schema supports them; v1 does project-level only).
- Deep-linkable URLs (real router) — deferred; in-memory routing for now.

## Blockers / open

- None. Standing note: office network blocks Postgres ports — DB tooling runs over
  HTTPS via the Management API (`server/scripts/run-sql-api.mjs`, needs
  `SUPABASE_ACCESS_TOKEN`). Supabase Storage + admin APIs also work over HTTPS.
- Dev gotcha: `node src/index.js` can leave a process on :4000 that survives
  TaskStop on Windows; if a fresh start logs `EADDRINUSE`, free the port
  (`Stop-Process` on the PID from `Get-NetTCPConnection -LocalPort 4000`).

## Branch state

- Active branch: `main` (Phase 5 merged; nothing in flight).
- Unmerged work: none.

## Useful facts for next session

- Demo password for all four seeded accounts: `DemoPass!234`. Emails: admin
  `appuser1.msc@manipalsplchem.com`, `manager.demo@…`, `member.demo@…`,
  `viewer.demo@…` (all `@manipalsplchem.com`, all `active`).
- Seed shape: **Plant Safety Audit 2026** (owner Demo Member) already HAS a
  sub-project **"Audit — Unit B"** — good for testing Phase 6 link/remove + the
  one-level rule (try to give the sub-project its own child → must be blocked by
  the depth trigger). ERP Rollout (owner Demo Manager) is an empty Draft.
- One-level depth + visibility are DB-enforced: trigger
  `supabase/migrations/20260617090100_triggers.sql` (parent must have null parent);
  `projects` RLS scopes reads. For Phase 6, "link existing as child" = `PATCH`
  a project's `parent_project_id`; "add new sub-project" = create with the parent
  set; "unlink" = set `parent_project_id` to null. Reuse `canEditProject()` (the
  parent — and likely also the child — must be editable by the caller).
- Run locally: API `cd server && node src/index.js` (:4000); client preview via
  `.claude/launch.json` (server `client`, :5173, proxies `/api` → :4000). Storage
  bucket setup: `cd server && npm run setup:storage` (idempotent).
- API surface: auth `GET /api/me`; `GET /api/users`; projects `GET/POST /api/projects`,
  `GET/PATCH /api/projects/:id`; milestones `POST /api/projects/:id/milestones`,
  `PATCH|DELETE /api/milestones/:id`; tasks `POST /api/projects/:id/tasks`,
  `PATCH|DELETE /api/tasks/:id`; updates `POST /api/tasks/:id/updates`; files
  `POST /api/projects/:id/files`, `GET /api/files/:id/url`, `DELETE /api/files/:id`.
  All gated by `requireActiveUser()`; writes also call `canEditProject()`.
  NOTE: `PATCH /api/projects/:id` does NOT currently accept `parent_project_id` —
  Phase 6 will add it (with the one-level + edit-rights checks).
- Client: in-memory routing (`screens/AuthedApp.jsx`); `screens/ProjectDetail.jsx`
  branches view/edit; edit components in `components/edit/`; `FilesSection` +
  `FileViewerModal`; reusable `TaskUpdateThread`, `StatusChip`, `Avatar`;
  `lib/api.js` + `lib/format.js` (dd/mm/yyyy, status vocab, formatBytes). Reuse.
  Client reads repo-root `.env` via Vite `envDir: '..'`.
- `.env` (gitignored) holds Supabase URL + anon + service-role + access token.
  `ATTACHMENTS_BUCKET` overrides the bucket name (default `attachments`).
- Apply SQL: `cd server && node scripts/run-sql-api.mjs <file.sql>`.

---

## Session log (newest first)

- **2026-06-17** — Built Phase 5 (Files): private `attachments` bucket +
  `setup:storage`; server-mediated upload with type(magic)/size/scan-hook checks;
  signed-URL view + in-app PDF/image viewer with download fallback; attach/remove
  in Edit. Scan is a stubbed pluggable hook (standalone-app decision). Verified via
  API (validation + capability + signed URL + no orphans) and in-browser. Merged
  `feature/files` → `main`. Next: Phase 6 Sub-projects. Blockers: none.
- **2026-06-17** — Built Phase 4 (Project Detail, Edit mode): write endpoints for
  project/milestone/task/update with RLS + canEditProject 403s and §12.1/§19.1
  validation; editable summary, milestone/task CRUD + reorder, append-only update
  composer; list pencil + new-project now open Edit mode. Verified via API and
  in-browser. Merged `feature/detail-edit` → `main`. Next: Phase 5 Files.
- **2026-06-17** — Built Phase 3 (Project Detail, View mode): `GET /api/projects/:id`
  detail tree, reusable task-update thread (§13), list↔detail routing w/ sub-project
  breadcrumb, AUTO target, detail status filter. Verified. Merged
  `feature/detail-view` → `main`. Next: Phase 4 Detail Edit.
- **2026-06-17** — Built Phase 2 (Project list): RLS-scoped list, derived target,
  filters/search, empty states, create modal. Verified. Merged
  `feature/project-list` → `main`. Next: Phase 3 Detail View.
- **2026-06-17** — Built Phase 1 (Auth & shell): login + §8.3 states, session,
  set-password, app shell, server-side inactive gate. Verified. Merged
  `feature/auth-shell` → `main`. Next: Phase 2.
- **2026-06-17** — Built Phase 0 scaffolding. Schema + RLS + seed applied over the
  Management API. Verified admin sign-in + per-role RLS. Merged
  `feature/phase-0-scaffolding` → `main`. Next: Phase 1.
- **2026-06-16** — Kickoff. PRD v1 finalised; CLAUDE.md and SESSION_STATUS.md created. No code yet.

<!--
Append one line per session, e.g.:
- YYYY-MM-DD — Built <slice>. Merged feature/<slice> to main. Next: <slice>. Blockers: <none/...>.
-->
