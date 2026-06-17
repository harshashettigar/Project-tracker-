\# Decisions

\- Standalone app; no integration with any other system.

\- Stack: React+Vite / Node+Express / PostgreSQL + managed auth.

\- No AI and no in-app spreadsheet in v1 (deferred).

\- Roles: admin/manager/member/viewer. Statuses: draft/in\_progress/on\_hold/completed/at\_risk.

\- Sub-projects one level, no roll-up. Update authorship: owner + admin only.

\- Updates append-only; composer pre-fills previous text; View shows latest + one prior; History starts after the latest.

\- Phase 0: migrations live in `supabase/migrations/` (Supabase CLI requirement), not `db/`; `docs/schema.sql` is the human-readable mirror.

\- Phase 0: `users` table is readable by any authenticated user (internal staff directory needed for owner names/filters); write is admin-only. All other access enforced by RLS per the §17–18 model.

\- Phase 0: target DB/auth is a hosted Supabase project; RLS keys off `auth.uid()` = `users.id`.

\- Phase 0: office network blocks Postgres ports (5432/6543) and the direct DB host is IPv6-only; DB tooling runs over HTTPS via the Supabase Management API (`server/scripts/run-sql-api.mjs`, needs `SUPABASE_ACCESS_TOKEN`). Direct-port runner (`run-sql.mjs`, `DATABASE_URL`) kept for reachable networks.

\- Phase 0: demo accounts seeded with password `DemoPass!234` (override via `SEED_DEMO_PASSWORD`); rotate before real use.

\- Phase 1: inactive-account refusal (§8.3) is enforced server-side, not in the UI. The client gates sign-in on `GET /api/me`, which reads the caller's own `users` row (as the user, so RLS applies) and returns 403 `inactive` when `status <> 'active'`; the client then signs the session out.

\- Phase 1: no URL router in v1 yet — App routes on auth state (recovery → set-password, no session → login, active profile → shell). A router can come when deep links/sub-project URLs are needed.

\- Phase 1: invite-to-set-password and forgot-password reset share one Set password screen, entered via the Supabase recovery/invite hash or the `PASSWORD_RECOVERY` event.

\- Phase 1: client and server share the single repo-root `.env`; Vite reads it via `envDir: '..'` (no second `.env` under `client/`).

\- Phase 2: derived target date (§12.2) is computed server-side from RLS-scoped milestones + direct tasks, NOT from the `project_target_dates` view — the view bypasses RLS (security_invoker off), so computing from child tables keeps the data layer the boundary. (Backlog: add `security_invoker=on` to the view in Phase 9 hardening so it's safe to expose directly.)

\- Phase 2: viewer "cannot create" (§18) is enforced at the API (`POST /api/projects` 403s viewers) in addition to RLS. NOTE: the current projects INSERT policy allows any authenticated user to insert a project they own — it does not check role — so a viewer is blocked only by the API guard today. Backlog (Phase 9): tighten the RLS insert policy to exclude viewers.

\- Phase 2: project list shows only top-level projects (`parent_project_id IS NULL`) per §9.2; sub-projects are reached via their parent (Phase 6). This is why per-role counts are one lower than Phase-0's raw project counts (3 seeded = 2 top-level + 1 sub).

\- Phase 2: owner picker in the create modal is shown only to admins (who may set any owner); non-admins always own their own new projects (matches RLS). The "new project opens immediately in Edit mode" part of §9.4 is deferred until the detail screen exists (Phase 3/4); for now create confirms via toast and refreshes the list.

\- Phase 3: still no URL router — `AuthedApp` holds in-memory route state (`list` | `detail{id}`) and threads a `navigate()` to screens. Sub-projects and the breadcrumb work via this; deep-linkable URLs deferred (revisit when sharing links matters).

\- Phase 3: `GET /api/projects/:id` returns the whole detail tree (project + milestones-with-tasks + project-level tasks + each task's update thread newest-first + files + sub-projects) in one call; RLS scopes every child read, and an invisible/missing project yields 404. The detail target date reuses the shared `deriveTargets()` helper (also used by the list).

\- Phase 3: the task-update-thread (§13) is a single reusable component used for milestone tasks and project-level tasks alike. History begins at the second-most-recent entry (latest shown highlighted above, not repeated); the one-line predecessor context is hidden while history is expanded.

\- Phase 3: from the list, BOTH the eye and pencil row actions open the detail (View mode) for now; the in-detail View/Edit toggle's Edit option is a Phase-4 placeholder (toast). Pencil will deep-open Edit mode once Phase 4 lands.

\- Phase 4: list pencil now deep-opens Edit mode (`route.mode='edit'`); eye opens View. The §9.4 "new project opens immediately in Edit mode" behaviour is now wired (create → navigate into the project's Edit view).

\- Phase 4: edit writes act AS THE USER so RLS (`can_edit_project`, append-only `task_updates` insert) is the real boundary; the API adds explicit owner/admin checks (`canEditProject()`) only to return clean 403s. Target date is never written — derived only (§12.2).

\- Phase 4: §12.1 required-fields are enforced in three places — in-context UI markers/validation, the API (project-level task & milestone target required, re-checked on PATCH against the merged row), and the DB CHECK as backstop.

\- Phase 4: owner reassignment is admin-only (API guard + RLS WITH CHECK); non-admin owners see their own name read-only in the summary editor.

\- Phase 4: reorder (milestones/tasks) renumbers the whole sibling list's `sort_order` to array position via per-item PATCHes, then reloads — robust even when seed rows share sort_order 0. Edits/adds/removes persist immediately and refetch the detail tree; the summary band uses an explicit "Save changes".

\- Phase 5: virus-scan (§15.2) is a PLUGGABLE hook (`server/src/scan.js`), stubbed (no-op pass) in v1 to keep the app standalone — no third-party scan integration. `SCAN_ENABLED=true` fails closed until a real (self-hosted) scanner is wired. Decision over the external-API option because CLAUDE.md mandates "no integration with any other system." `scanned_at` is stamped on store.

\- Phase 5: uploads/downloads flow THROUGH the Express API, not client→Storage direct. The server validates type (extension + declared MIME + magic bytes, all must agree) and size (≤25 MB), scans, then stores to a PRIVATE `attachments` bucket via the service role. Downloads are short-lived (120s) signed URLs. Keeps the server/DB the security boundary and the bucket private.

\- Phase 5: in-app viewer (§15.1) renders PDF (iframe) and PNG/JPG (img) from the signed URL; DOCX/XLSX can't render in-app, so they fall back to download-and-open with brief messaging.

\- Phase 5: storage bucket is created by `server/scripts/setup-storage.mjs` (`npm run setup:storage`) over HTTPS — one-off, idempotent. Bucket name overridable via `ATTACHMENTS_BUCKET` (default `attachments`). Added `multer` (memory storage) for multipart parsing.

\- Phase 5: this slice implements PROJECT-level attachments (the "Additional Files" strip). Per §15 the schema also allows milestone/task-scoped files (`attachments.milestone_id`/`task_id`); attaching at those levels is deferred (not required for v1 review flow).

