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

\- Phase 6: sub-project link/unlink is just `PATCH /api/projects/:id { parent_project_id }` (null = unlink → back to top-level); "add new sub-project" is `POST /api/projects` with `parent_project_id`. No new endpoints. The one-level rule + capability are checked in the API (`validateParentLink`: caller can edit the parent, parent is top-level, child has no children, no self-parent) for clean messages, with the existing depth trigger as the DB backstop.

\- Phase 6: linking requires edit rights on BOTH the parent and the child (you can only nest projects you control, or admin). Unlink needs edit rights on the child only. "Remove" in the UI = unlink (detach), never delete the child project.

\- Phase 6: the link-existing candidate list comes from `GET /api/projects` (top-level, visible) filtered client-side to projects the caller owns (or admin) and excluding self + current children. Add/link controls are hidden when the project is itself a sub-project (one level); the DB trigger backstops it.

\- Phase 7: admin user routes are a separate admin-gated group (`requireAdmin`): `GET /api/admin/users` (with mapped counts), `POST /api/admin/users` (invite), `PATCH /api/admin/users/:id` (edit + deactivate/reactivate). `GET /api/users` stays as the non-admin directory for pickers. Mapped counts come from `user_visibility` (admin-readable).

\- Phase 7: invite-on-create uses Supabase `auth.admin.inviteUserByEmail` (service role) then inserts the matching `public.users` row; if the row insert fails the auth identity is rolled back (`deleteUser`) so a retry isn't blocked. Redirect target is `APP_URL/#type=invite` → the existing SetPassword screen. NOTE: GoTrue rejects some addresses (e.g. `example.com`); tested with a real-domain plus-address.

\- Phase 7: email is the identity — editable only at create, READ-ONLY on edit (changing it would mean re-issuing the auth identity; out of v1 scope). Self-deactivate guard (§16.4) is enforced in the API (id === caller && status=inactive → 400) and disabled in the UI. Status changes write AS THE USER so `users_admin_write` RLS is the final gate.

\- Phase 7: account-menu "Admin" entry is wired via an `onAdmin` prop on `AppShell` (shown enabled only to admins); routing adds an in-memory `admin` route in `AuthedApp`. The "Mapped" count links to a Phase-8 placeholder (toast) for now.

\- Phase 8: mapping routes are admin-gated: `GET /api/admin/mappings` (returns users with owned-project counts + all grants; client resolves names/counts), `POST /api/admin/mappings` (grant — self-map → 400 with the §17.3 message, duplicate is an idempotent no-op), `DELETE /api/admin/mappings/:id` (revoke). In `user_visibility`, viewer = the user, owner = the mapped "employee"; `created_by` = the acting admin.

\- Phase 8: grants/revokes write to `user_visibility` only — visibility itself is already enforced by the existing project-list RLS (`can_see_project_owner` reads the table), so no policy change was needed. Verified end-to-end: granting viewer→member made the viewer actually see member's project.

\- Phase 8: Admin area is now two tabs (`AdminTabs`: Users | Mappings) over an in-memory `admin` route with an optional `tab` (default users) and `focusUserId`. The Users-tab "Mapped" count deep-links into the Mappings tab preselecting that user.

\- Phase 9: migration `20260617091000_hardening.sql` (a) adds `can_create_projects()` and rewrites the projects INSERT policy to `is_admin() OR (owner = auth.uid() AND can_create_projects())` so VIEWERS are denied create at the DB (verified: viewer direct insert → 42501; member still allowed); (b) sets `security_invoker = on` on `project_target_dates` so the view honours the caller's RLS (verified: viewer sees 0 rows, service sees 3). Mirrored into `docs/schema.sql`.

\- Phase 9: §20.2 auditability — admin actions now write to `audit_log` via the service role (`audit()` helper, best-effort, never blocks the action): `user.create`/`user.update`/`user.deactivate`/`user.reactivate`, `mapping.add`/`mapping.remove`, each with actor + timestamp. (Project/milestone/task edits are not audited in v1 — §20.2 scopes auditability to access/membership/mapping changes; task-update history is the per-task append-only trail.)

\- Phase 9: §20 review findings — invite-only/no-signup ✓; hashed passwords (provider) ✓; permissions matrix + visibility enforced server + DB ✓ (incl. the viewer-create fix above); sessions/auto-refresh + sign-out clears state + inactive can't sign in ✓; file allow-list/size/scan/private-bucket+signed-URL ✓; user text escaped on render (React default; no `dangerouslySetInnerHTML`/`innerHTML` anywhere) ✓; task updates append-only (no UPDATE/DELETE policy) ✓; dates dd/mm/yyyy ✓ (₹ currency N/A — no money fields in v1). Deferred: real virus scanner (stub hook), broader keyboard/focus polish, deep-link URLs.


\- Post-v1 (2026-06-17): latest task update is editable in place to fix a wrongly-typed entry — a deliberate amendment to the §13 append-only rule, scoped to the NEWEST update only. Prior updates stay immutable (history can't be rewritten). New endpoint `PATCH /api/updates/:id` (owner/admin, body-only); RLS policy `task_updates_update_latest` pins the edit to the latest row via the `is_latest_task_update()` SECURITY DEFINER helper (a direct task_updates subquery in the policy causes "infinite recursion detected in policy"). Migration `20260617100000_editable_latest_update.sql`. UI: "Edit latest update" button on each task in Edit mode, reusing the update composer pre-filled with the latest text.

\- Post-v1 (2026-06-17): fixed stuck "Saving…"/"Save"/"Posting…" buttons in the detail editors — `setBusy(false)` ran only on error, never on success (the code assumed reload would unmount the editor, but reload refreshes in place). Moved the reset into `finally` in SummaryEditor, MilestoneEditor, TaskEditor, UpdateComposer.

\- Production deploy (2026-06-18): hosted on the standard split stack — frontend on **Vercel** (`https://project-tracker-2b5a.vercel.app`, root dir `client`), backend on **Railway** (`https://project-tracker-production-6516.up.railway.app`, root dir `server`, `npm start`), DB/Auth/Storage on the existing Supabase project. Both auto-deploy on push to `main`. Reused the existing Supabase project as prod (migrations/RLS/storage already applied); DB reset to a single admin login (`harsha.s@manipalgroup.info`).

\- Production deploy: split origins required code changes the dev Vite proxy had masked. (1) API base URL made configurable — `API_BASE` = `VITE_API_BASE_URL` || (PROD ? hardcoded Railway URL : '') in `client/src/lib/api.js`; dev stays relative + proxied. (2) `AuthProvider.loadProfile` used a raw relative `fetch('/api/me')` that bypassed `API_BASE` — routed through it (the real cause of "login fails" in prod). (3) `cache: 'no-store'` added to `/api/me` and the api helper — a `304 Not Modified` revalidation was surfacing as non-2xx and bouncing the user back to login. CORS on the server locked to the frontend origin via `CORS_ORIGIN`; `APP_URL` + Supabase Auth Site/Redirect URLs point at the Vercel domain. Env split: Railway holds `SUPABASE_*` incl. service-role; Vercel holds only `VITE_*` (anon key) — service-role never reaches the browser.

\- Design-alignment pass (2026-06-19): brought the live UI closer to the reference mockup (`docs/design/Project management tool design/Project Tracker.dc.html`). (1) **Self-hosted IBM Plex Sans** via `@fontsource/ibm-plex-sans` (latin 400/500/600/700, imported in `client/src/main.jsx`) instead of relying on a system/local copy or a runtime CDN — the office network blocks CDNs and Windows clients lack the font, so the prior CSS-only font name fell back to Segoe UI. Mono was intentionally not adopted (the app uses no monospace family). (2) **Files + Sub-projects** restyled to the design's two-card grid (`.detail-cards-grid`): file rows with per-type coloured icon squares + `TYPE · size · by`; sub-project rows with folder icon + owner sub-line + status chip via a shared `SubProjectRow.jsx`; `GET /api/projects/:id` now returns `owner_name` for sub-projects. (3) **List width** raised to 1320px via a `wide` prop on `AppShell` (detail/admin stay ~1100px), and the project table switched to fixed columns `54/1fr/120/120/140/180/92` matching the reference grid. (4) **New project** button restyled white-on-navy with an SVG plus (`.topbar-cta`); the generic accent-blue `.primary-button` is unchanged for buttons on white surfaces. No PRD/behaviour change — visual only, plus the additive `owner_name` field.

\- Project members (2026-06-19): added a many-to-many `project_members` so a project can have **members** in addition to its single owner. A member can **view** the project (it appears in their list and they can open it) and **fully edit** it — fields, milestones, tasks, files, **and post task updates**. Owner, admin, or any existing member may add/remove members. This intentionally **broadens the v1 access model**: PRD §17–18 scoped edit to owner-or-admin and §13 scoped task updates to owner/admin only — members now have both (product decision, this session). Enforced in the DB/RLS (still the security boundary): new SECURITY DEFINER helpers `is_project_member()` and `can_see_project()`; `can_edit_project()` extended with membership (so every child-row write policy and the `task_updates` INSERT policy grant members automatically); SELECT policies on `projects` + child rows and the `projects` UPDATE policy broadened to include members. Owner reassignment stays admin-only (UI) and project delete stays owner/admin. Migration `20260619120000_project_members.sql`; additive and backward-compatible (a project with no members behaves exactly as before). Verified end-to-end via the admin account (add/list/remove + view/edit gating); a true non-owner member login was not exercised (only the admin account exists in the reset prod DB).

\- Default-password auth + password management (2026-06-19): email/SMTP isn't configured yet, so the email invite-to-set-password and reset-by-email flows can't run. Interim trade-off (explicitly accepted as not ideal): new users are created with a **shared default password `Manipal@123`** (auth user `email_confirm:true`, no email), surfaced to the admin to pass on; `DEFAULT_USER_PASSWORD` env can override. Admins get a **"Reset password"** action (`POST /api/admin/users/:id/reset-password`, service-role `updateUserById` with `email_confirm:true`, audited `user.reset_password`) that resets a user to the default. A one-off `server/scripts/reset-all-passwords.mjs` set the default for the existing user base (run 2026-06-19). Note: accounts created via the OLD invite flow were email-unconfirmed and couldn't sign in despite a valid password ("Email not confirmed"); the reset path now sets `email_confirm:true` to fix them. Added **self-service change password** (account menu → modal): `AuthProvider.changePassword` re-authenticates with the current password (Supabase `updateUser` doesn't verify the old one) then sets the new (min 8 chars). **Follow-up:** once SMTP is configured, restore email invites + reset and drop the shared default. — Also fixed a regression from the 2026-06-19 design pass: the project-list fixed column widths (`table-layout:fixed` + nth-child) were on the shared `.project-table` class and squished the admin Users/Mappings tables; scoped them to `.project-list-table`, and made the admin Users identity a two-line cell (name over email).

\- Milestone/task descriptions (2026-06-21): added an **optional free-text `description`** to both `milestones` and `tasks` (migration `20260621090000_entity_descriptions.sql`; nullable, DB CHECK caps length at 2000 — the DB stays the boundary). Surfaced in the UI only when present: an "i" icon next to the milestone/task name that reveals the text in an **`InfoPopover`** (opens on hover, click/tap, and keyboard focus; closes on Esc/outside-click — chosen over a hover-only tooltip so it works on mobile + keyboard and handles long, wrapped text). Empty descriptions render no icon, so they cost no space. Editable via an optional textarea in the milestone/task add forms and editors; server trims and treats empty as NULL (so a description can be cleared). Additive and backward-compatible (existing rows are NULL). No RLS change — both tables are already gated by `can_edit_project`/`can_see_project`.

\- Archive (2026-06-24): projects, milestones and tasks gain a nullable `archived_at` timestamp (migration `20260624090000_archive.sql`) — a separate, reversible, non-destructive lifecycle flag, **orthogonal to `status`** (NOT a new status enum). Archived items are hidden from the active views and gathered into a dedicated "Archived" place: a top-bar **Active/Archived tab** on the project list, and an **"Archived" section** at the bottom of the project detail (milestones + tasks, each with Restore). **Archived items are excluded from the derived target date (§12.2)** — in both the list's `deriveTargets` and the detail's in-memory compute. Archiving a project/milestone hides its whole subtree, but each row keeps its own flag (restore returns children as they were); an archived task under an active milestone is listed on its own, while tasks under an archived milestone travel with it. Permission = edit (owner/admin/members; viewers can't), enforced server-side via the existing PATCH policies — no RLS rewrite (archived_at is set/cleared through `can_edit_project`; archived rows stay selectable by anyone who can already see them, and the API decides default visibility). Server: PATCH project/milestone/task accept `{ archived: bool }`; `GET /api/projects?archived=1` returns the archived set; detail returns `archived_at`. Additive/backward-compatible (existing rows NULL = active). Verified end-to-end in dev across all three levels.

\- Post-v1 (2026-07-14): review-focused detail view. (a) Milestones are collapsible in View mode (collapsed by default → header + "N tasks · M updated" badge; expand for the task table); Edit mode stays fully expanded. (b) A "Show only tasks updated in this period" switch narrows the view to tasks with an update inside the active review window (and their parent milestones), auto-expanding the matches; disabled under period "All" (where "updated in the period" is undefined). It reuses the same `inRange()` predicate as the update highlight, so filter and highlight always agree. (c) Milestone blocks get a single accent band (tinted header + left border) to separate them from the project-tasks/archived blocks. Entirely client-side (ProjectDetail.jsx + styles.css) — no API/DB change; the data already carries update timestamps.

\- Post-v1 (2026-07-14): the "Only updated" review switch is now a universal TOP-BAR control beside the date selector (not a per-page control). Its state lives in `PeriodContext` (global + sticky in localStorage), like the review period itself; new `OnlyUpdatedToggle` rendered in `AppShell`. Disabled under period "All". Like the date selector, it is present on every authenticated screen but only *acts* on the period-aware project detail view (the list is not period-aware). Auto-expand of milestones is driven by the DATE SELECTOR, not the switch: whenever a window is active, milestones with an in-period update expand by default (switch off) so a reviewer sees them immediately; the switch additionally hides the untouched ones. Client-only.
