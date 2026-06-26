# SESSION_STATUS.md — Project Tracker

> **Read this first, write it last.** It is the handoff between sessions.
> Keep it short. Move durable facts to `CLAUDE.md`; keep only what's moving here.

**Last updated:** 2026-06-24 (task ordering: append-on-create + instant reorder)
**Current phase:** v1 + post-v1 live in production; dev runs on a separate Supabase project. Pushed + deployed: login redesign, milestone/task descriptions, perceived-performance pass, dropdown-chevron polish, review-period filter, responsive/mobile pass. A **task-ordering change** (append new tasks to end + optimistic reorder) is committed to `main` locally but **NOT pushed yet** (no DB migration; has a server change → Railway redeploy on push). No phase in flight.

---

## State in one line

All nine build-order phases (0–9) are done and merged to `main`, and the app is now
**live in production**: frontend on Vercel, backend on Railway, DB/Auth/Storage on
the existing Supabase project. Both hosts auto-deploy on push to `main`.

## Production (live)

- **Frontend (Vercel):** https://project-tracker-2b5a.vercel.app — root dir `client`,
  env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (NOT the service-role key).
- **Backend (Railway):** https://project-tracker-production-6516.up.railway.app —
  root dir `server`, `npm start`, env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGIN` + `APP_URL` (= the Vercel URL). `PORT`
  is injected by Railway.
- **Supabase:** the existing project (ref `mhrwhmhsnhvujckqjdhn`) — reused as prod;
  Auth Site URL + Redirect URLs set to the Vercel domain.
- **Login:** single admin `harsha.s@manipalgroup.info` (DB was reset to one user).
- **Deploy flow:** push to `main` → Vercel + Railway both rebuild automatically.
- **Watch-outs:** Supabase free tier pauses after ~1 week idle (un-pause in dashboard);
  Railway URL is hardcoded as `PROD_API_BASE` in `client/src/lib/api.js` (or override
  via `VITE_API_BASE_URL`); in-app user invites need custom SMTP configured in Supabase.

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

- `main`: pushed state (2026-06-24) is through the responsive/mobile pass (all
  live in prod). A **task-ordering change** (append-on-create + optimistic reorder)
  is committed to `main` locally but **NOT pushed** — has a server change, so
  `git push` triggers both Railway (API) and Vercel (client) redeploys; no DB
  migration. Nothing in flight.
- Merged & done: `feature/project-members`, `feature/auth-and-admin-fixes`,
  `feature/task-priority`, `feature/env-split`, `feature/entity-descriptions`,
  `feature/perceived-perf`, `feature/responsive-mobile` (+ review-period filter,
  committed directly to `main`).
- **Two Supabase projects now (see CLAUDE.md "Two environments"):**
  - **dev** `jtgwywgamgkazmzotspf` — `.env.development`; fully bootstrapped
    2026-06-20 (8 migrations + setup:auth + setup:storage + seed). Local
    `npm run dev` / scripts default here.
  - **prod** `mhrwhmhsnhvujckqjdhn` — `.env.production`; the live site. Touch only
    with `--prod`. (Optional: set `NODE_ENV=production` in Railway so its log
    banner reads "production" — cosmetic.)

## Useful facts for next session

- **DEV project login** (project `jtgwywgamgkazmzotspf`): the 4 seeded demo
  accounts, password `DemoPass!234` — admin `appuser1.msc@manipalsplchem.com`,
  `manager.demo@…`, `member.demo@…`, `viewer.demo@…`. **PROD login** (project
  `mhrwhmhsnhvujckqjdhn`) is the real users, password `Manipal@123` (admin
  `harsha.s@manipalgroup.info`). Don't mix them up.
- Migrations in `supabase/migrations/` are authoritative (now 8 files, latest
  `20260620090000_task_priority.sql`); `docs/schema.sql` is the human-readable
  mirror. Add a NEW migration for further DB changes; apply to **dev** with
  `cd server && node scripts/run-sql-api.mjs <file.sql>`, then to **prod** with
  `node scripts/run-sql-api.mjs --prod <file.sql>` (HTTPS). Watch the `[env]` banner.
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

- **2026-06-24** — **Task ordering** (server + client; no DB migration — `sort_order`
  column already existed), committed to `main`, **NOT pushed yet**. (1) **Append on
  create:** new tasks now land at the END of their group — `POST /api/projects/:id/
  tasks` computes `sort_order = max(group)+1` (group = project-level or under a
  milestone) instead of defaulting to 0. (2) **Instant reorder:** the ▲▼ buttons
  were slow because each click fired N PATCHes (renumber every sibling, each
  re-running auth + canEditProject) AND awaited a full project `reload()` (big GET)
  before the UI moved. Now reorder is **optimistic** — `useCachedQuery` gained a
  `mutate()` that updates local state + cache instantly; only the rows whose
  position actually changed are PATCHed, in the BACKGROUND (no reload; resync only
  on error). Detail now also returns `sort_order` on milestones + tasks so the
  diff is minimal from first load. `ProjectDetail` reorder handlers split into
  `moveMilestone` / `moveMilestoneTask(milestoneId,…)` / `moveProjectTask`;
  `MilestoneEditor` passes `milestone.id`. Verified in dev: reorder flips instantly
  and persists across reload; new task appends last. Files: `server/src/index.js`,
  `lib/useCachedQuery.js`, `screens/ProjectDetail.jsx`, `components/edit/
  MilestoneEditor.jsx`. **To deploy:** `git push` (Vercel + Railway auto-deploy;
  no migration).
- **2026-06-24** — **Responsive / mobile pass** (client-only CSS + data-labels),
  pushed + deployed. Scoped to the read + quick-update paths (full editing stays
  desktop-optimised, by decision). (1) **Top bar** wraps below 900px — the
  review-period control stops being absolutely-centred (a regression from the
  period filter) and drops to its own centred row; brand wordmark hides ≤520px
  (logo stays as home link). (2) **Project list → stacked cards ≤720px**: each row
  becomes a labelled card (data-labels on the `td`s + CSS; Sl hidden, name as
  title, view/edit at the bottom). (3) **Task tables → cards ≤720px** likewise,
  each task grouped with its update thread. (4) Tighter gutters, search goes
  full-width, `summary`/cards-grid wrap. Tablets (721–900) keep the tables.
  Verified via preview_resize at 375 / 768 / 1280: cards on phones with **no
  horizontal page scroll**, tables intact + actions visible on tablet, and the
  period control **perfectly centred again on desktop**. Files: `styles.css`
  (responsive block at end), `ProjectList.jsx` + `ProjectDetail.jsx` (data-labels).
  Branch `feature/responsive-mobile`.
- **2026-06-24** — **Review-period filter** (client-only), pushed + deployed. For
  weekly-review
  meetings: a centred top-bar segmented control **All · This week · Custom date**
  changes how task updates are highlighted in the **View** detail. It's a HIGHLIGHT
  window, not a hide-filter: a task with ≥1 update in the window shows an amber
  block with **all** its in-window updates stacked (label "Updates this period" for
  >1, dated newest-first); older updates drop to "Previous update"; a task with no
  in-window update stays visible but un-highlighted (plain "Latest update"). `All`
  = today's behaviour (single latest highlighted). A "N tasks updated · M updates"
  summary shows under the status filter when a window is active. The selection is
  **global + sticky** — lifted into a `PeriodProvider` above the screens and
  persisted to localStorage (`pt.reviewPeriod`), so switching projects / refreshing
  doesn't reset it; `All` is the reset. "This week" = Monday 00:00 local → now.
  New: `client/src/period/PeriodContext.jsx` (provider + `computeRange`/`inRange`),
  `client/src/components/PeriodControl.jsx`; wired into `AppShell` (top bar),
  `AuthedApp` (provider), `TaskUpdateThread` (range-aware), `ProjectDetail`
  (summary + threads range). The control shows on the list screen too but is inert
  there for now (decided). Verified in dev preview across All/This week/Custom,
  multi-update stacking, untouched-stays-plain, summary, and persistence across nav
  + full reload. Committed directly to `main` (a here-string mangled the feature-
  branch commit, so it landed on `main`; same result). (Left 2 test updates on the
  dev "Collect SOP documents" task — task_updates are append-only, no UI delete;
  dev-only, harmless.)
- **2026-06-21** — **Dropdown chevron polish** (client-only), pushed + deployed.
  Native select arrows sat flush to the right edge; replaced with a custom SVG
  chevron inset 0.7rem with reserved `padding-right`, applied to all styled
  selects (filter, modal, edit grid, add forms, member/sub-project pickers).
  Commit `1d537f4` (`styles.css`). Verified in preview.
- **2026-06-21** — **Perceived-performance pass** (client-only), merged to `main`
  and **pushed + deployed** (no DB/backend change — Vercel rebuild). Goal: make
  navigation feel instant instead of blanking to "Loading…" for 2–3s on every
  page switch. (1) **Stale-while-revalidate cache** — new `client/src/lib/cache.js`
  (in-memory store keyed e.g. `projects`, `users`, `project:<id>`; de-dupes
  concurrent fetches) + `useCachedQuery` hook (`client/src/lib/useCachedQuery.js`):
  a revisit renders cached data immediately, then refreshes in the background; only
  a cold key shows a loader. `reload()` force-revalidates (editors call it after
  mutations). Cleared on sign-out (`AuthProvider.signOut` → `clearCache()`).
  (2) **No-blank** — `ProjectList`/`ProjectDetail` no longer null-out data on
  navigation; stale content stays on screen during revalidation. (3) **Hover/focus
  prefetch** — list rows call `prefetch('project:<id>', …)` on mouseenter/focus so
  the click is usually warm. (4) **Skeletons** — `client/src/components/Skeleton.jsx`
  (list-table + detail shapes, shimmer CSS, respects `prefers-reduced-motion`)
  replace the "Loading…" text on cold loads only. Verified in dev preview: cold
  load → skeleton (caught at 2 frames); cached revisit → instant, no skeleton, no
  blank; list cached/instant; save→reload round-trip still works (status change
  persisted + reverted, no errors). Branch `feature/perceived-perf`. NOTE: this is
  perceived speed only — the real cold-start latency (Railway/Supabase free tier
  sleeping) is unaddressed; a keep-warm ping or paid tier is the actual fix
  (offered, not done).
- **2026-06-21** — Two changes, merged to `main` and **pushed + deployed** (prod
  DB migration applied with `--prod` first, then `git push` → Vercel + Railway
  auto-deploy; commits `61728f1..d7aad4e`). (1) **Login screen
  redesign** to match the reference mockup (`docs/design/.../Project Tracker.dc.html`):
  navy gradient header band with the MSC logo (`/logo.png`, "PT" text fallback) +
  "Project Tracker"/"Manipal Specialty Chemicals", subtitle, error box with icon,
  uppercase field labels + placeholders, eye-icon password toggle, right-aligned
  Forgot password, full-width button with spinner. PRD §8.3 logic + verbatim
  messages unchanged; dropped the mockup's demo-password hint line.
  (`client/src/screens/Login.jsx` + `styles.css`). (2) **Optional descriptions on
  milestones + tasks**: nullable `description` (migration
  `20260621090000_entity_descriptions.sql`, DB CHECK ≤2000 chars), **applied to DEV
  only**. Shown only when present via an "i" `InfoPopover` (hover + click/tap +
  keyboard focus, Esc/outside-click to close) next to the name. Optional textarea
  in the milestone/task add forms + editors; empty → NULL so it can be cleared.
  Server returns it in the detail tree and validates on POST/PATCH; additive, no
  RLS change. Verified end-to-end in the dev preview (add → icon + popover with
  preserved line breaks; clear → icon gone; no console errors). The prod migration
  was applied with `--prod` before pushing (expand-first; additive column is safe
  ahead of the code). Branch `feature/entity-descriptions`.
- **2026-06-20** — **Dev/prod env split**, merged to `main` and **pushed**
  (auto-deploys; prod hosts keep using their dashboard env, so no runtime change).
  `server/src/env.js` is now the single mode-aware loader: defaults to
  development, loads `.env.production` only on `--prod`/`NODE_ENV=production`,
  legacy `.env` as fallback; prints an `[env]` banner naming env + project. Wired
  server + all scripts through it (`run-sql*` strip `--prod` from file args);
  added `setup:auth:prod`/`setup:storage:prod`; `.gitignore` covers the new files;
  `.env.example` rewritten; two-project workflow documented in CLAUDE.md + README.
  **Stood up a dedicated DEV Supabase project** `jtgwywgamgkazmzotspf`: applied all
  8 migrations + `setup:auth` + `setup:storage` + `seed.sql`, all confirmed
  hitting dev via the banner. Verified: dev server boots on dev, demo admin login
  works, `/api/projects` returns the seeded projects. Local dev now isolated from
  prod. Branch `feature/env-split`. Optional follow-up: set `NODE_ENV=production`
  in Railway for an accurate prod banner.
- **2026-06-20** — **Task priority (Low/Mid/High)**, merged to `main` and
  **pushed** (auto-deploys). Each task gains a `priority` (default `mid` =
  "normal"); existing tasks defaulted to `mid` by the migration. Migration
  `20260620090000_task_priority.sql` (task_priority enum + tasks.priority)
  applied to the shared Supabase. Server: detail returns `priority`,
  add/update task accept+validate it. Client: `PRIORITIES` vocab + `PriorityChip`
  (Low green / Mid slate / High red); priority select in AddTaskForm + TaskEditor;
  Priority column in the View task table. Backend round-trip verified
  (create high → read → update low → delete). Branch `feature/task-priority`.
  NOTE: the priority migration was applied directly to the LIVE/shared Supabase
  (single DB for dev+prod) — reinforces the queued `.env` split below.
- **2026-06-19** — **Auth: default password + reset/change + admin table fix**
  (now integrated on `feature/project-members`; NOT deployed). No SMTP yet, so:
  new users are created with default **`Manipal@123`** (no email invite); admins
  get a per-user **Reset password** action; users get a **Change password** item
  in the account menu (verifies current password). The **existing user base was
  set to `Manipal@123`** (and email-confirmed) via
  `server/scripts/reset-all-passwords.mjs` (run against prod) — includes the
  admin's own login. Fix: invite-era accounts (amit.s, dharmaraj.p) were
  email-unconfirmed and couldn't log in despite a valid password; the reset path
  now sets `email_confirm:true`. Also fixed the admin Users/Mappings **table
  alignment** regression (fixed column widths were on the shared `.project-table`;
  scoped to `.project-list-table`) and made the Users identity a two-line
  name/email cell. Verified end-to-end. **Follow-up:** restore email invites once SMTP works.
- **2026-06-19** — **Project members** (post-v1 feature; integrated on
  `feature/project-members`, NOT deployed). A project can have members (not just
  one owner) who can view + fully edit it (fields, milestones, tasks, files, task
  updates); owner/admin/member manage the list. Migration
  `20260619120000_project_members.sql` **is already applied to the (shared prod)
  Supabase** — additive & invisible until the code deploys. Server:
  `canEditProject()` includes membership, detail returns `members`, list returns
  per-row `can_edit`, `POST/DELETE /api/projects/:id/members`. Client: edit gate +
  list edit-icon honour membership; new `MembersSection.jsx` (Edit mode → Members
  card). Broadens PRD §13/§17-18 — see decisions.md. Verified end-to-end as admin
  + a real link/unlink member-row check. **To deploy:** merge
  `feature/project-members` → `main` + push.
- **2026-06-19** — Design-alignment pass against the reference mockup
  (`docs/design/.../Project Tracker.dc.html`), merged to `main` and **pushed**
  (auto-deploys to Vercel + Railway). (1) **Self-hosted IBM Plex Sans** via
  `@fontsource/ibm-plex-sans` (latin 400/500/600/700) imported in `main.jsx` —
  no runtime CDN; the app previously only *named* the font in CSS and fell back
  to Segoe UI on machines without it. (2) **Files + Sub-projects** now render as
  two side-by-side cards (`.detail-cards-grid`): file rows with coloured
  type-icon squares + `TYPE · size · by`; sub-project rows with folder icon,
  owner sub-line and status chip via a shared `SubProjectRow.jsx`. Server
  (`/api/projects/:id`) now returns `owner_name` for sub-projects. (3) **List
  screen** widened to 1320px (new `wide` prop on `AppShell`; detail/admin stay
  1100px) and the project table uses fixed columns `54/1fr/120/120/140/180/92`
  matching the reference grid. (4) **New project** button restyled white-on-navy
  with an SVG plus (`.topbar-cta`), scoped to the top bar. Verified end-to-end in
  the local preview while logged in (incl. a link/unlink round-trip to confirm
  the sub-project owner row, then restored). Branch `feature/self-host-fonts`.
- **2026-06-18** — Fixes, merged to `main` and **pushed** (`b8d06d9..7ab5f9a`,
  auto-deploys): (1) Add-update composer now closes after Post update
  (`TaskEditor.postUpdate` was missing `setComposing(false)`). (2) File viewer
  (`FileViewerModal`) gained a Full-screen toggle (100vw/100vh, scroll locked,
  Esc to close) and a Download button (Supabase `?download=` param so the
  cross-origin signed URL actually saves). (3) Fixed image cropping in full
  screen — flex `min-height:0`/`max-height:100%` so `object-fit:contain`
  letterboxes the whole image. Verified in the preview.
- **2026-06-18** — UI polish, all merged to `main` and **pushed** (auto-deploys to
  Vercel + Railway): project-list name is now a clickable link → View mode;
  Objective moved inside the white summary card; task updates redesigned as
  labeled LATEST/PREVIOUS boxes with full wrapped text; top bar shows
  MANIPAL logo (`client/public/logo.png`, on a white chip) + "Project Tracker"
  brand (home link) + project name; removed the "Projects (N)" list heading.
  Verified in the local preview. Pushed `93eb86a..99a2fae`.
- **2026-06-18** — Detail-page design fixes to match the reference mockup
  (`ProjectDetail.jsx`, `AppShell.jsx`, `TaskUpdateThread.jsx`, `styles.css`):
  (1) Objective moved inside the white summary card (divided from the facts).
  (2) Task updates redesigned as labeled LATEST/PREVIOUS boxes with full
  wrapped bodies — the old one-line nowrap predecessor was forcing the task
  table wide and getting clipped by the milestone card's `overflow:hidden`.
  (3) Top bar now shows logo + "Project Tracker" brand (home link) + project
  name; logo loads from `/logo.png` with a "PT" text fallback — **drop the real
  logo at `client/public/logo.png`** (no asset in repo yet). Verified in the
  preview. Merged `feature/detail-design-fixes` → `main`. Not yet pushed.
- **2026-06-18** — Made the project-list name clickable: it now renders as a
  link-styled button firing the existing `onOpen` handler, opening the project
  detail in View mode (the 👁 icon did this before). Client-only change
  (`ProjectList.jsx` + `.project-name-link` in `styles.css`). Verified in the
  local preview (logged in, clicked "AI Tools" → View detail). Merged
  `feature/clickable-project-name` → `main`. Not yet pushed (no auto-deploy until
  push). Blockers: none.
- **2026-06-18** — **Deployed to production** (Vercel + Railway + Supabase; auto-deploy
  on push to `main`). Reset the DB to a single admin login. Fixed three split-origin
  bugs the dev Vite proxy had masked: configurable `API_BASE` (+ prod default), the
  `AuthProvider` raw `fetch('/api/me')` now routes through `API_BASE`, and `cache:
  'no-store'` on API calls (a 304 was bouncing login). Locked CORS to the Vercel
  origin. All verified inside the deployed JS bundle. Merged to `main`. Blockers: none.
- **2026-06-17 (post-v1, perf)** — Reduced page latency on the two hot endpoints
  (server-side; client already parallelised). (1) Dropped the per-request
  `supabase.auth.getUser()` round-trip in `requireActiveUser` (~200ms each, on
  every call) — now decode the JWT `sub` locally and let the RLS profile read be
  the validity gate (PostgREST still verifies sig+expiry; expired → 401). (2)
  `GET /api/projects/:id`: users + parent lookups now run in the same parallel
  wave as milestones/tasks/files/subs, and the derived target is computed in
  memory from already-loaded rows (dropped the 2 `deriveTargets` queries) — ~6
  serial waves → 3. (3) `GET /api/projects`: users fetch parallel with
  `deriveTargets`. Verified in browser (data correct, no console errors).
  Investigated direct Postgres (DATABASE_URL): host is IPv6-only / `ENOTFOUND`
  even off the office network — not firewall-related; app speed is bounded by
  HTTPS round-trips to remote Supabase. Single-round-trip RPC option offered and
  declined for now (left as-is).
- **2026-06-17 (post-v1)** — Two fixes on `feature/update-edit`, merged to `main`.
  (1) Stuck save buttons: `setBusy(false)` only ran on error in SummaryEditor,
  MilestoneEditor, TaskEditor, UpdateComposer — moved to `finally`. (2) Editable
  latest task update (user-approved amendment to §13 append-only, latest entry
  only): migration `20260617100000_editable_latest_update.sql` (RLS
  `task_updates_update_latest` + `is_latest_task_update()` definer helper, applied
  over HTTPS), `PATCH /api/updates/:id`, "Edit latest update" UI. Verified in
  browser: in-place overwrite (entry count unchanged), non-latest edit → 403,
  prior history immutable. Decisions + schema mirror updated.
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
