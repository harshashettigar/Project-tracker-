# CLAUDE.md — Project Tracker

> Durable project memory. Read this every session. It holds the things that **do not change**.
> Anything that changes session-to-session lives in `SESSION_STATUS.md`, not here.
> The full specification is the PRD in `docs/` — **reference it by section number, never paste it.**

---

## What this is

Project Tracker is a **standalone** internal web app for running projects, milestones, tasks and
their update history, with central control of users and access. It replaces a multi-sheet Excel
workbook. It is self-contained: no integration with any other system, no AI service, no in-app
spreadsheet in v1.

## Stack (fixed for v1)

- **Client:** React + Vite (single-page app)
- **Server:** Node.js + Express (stateless JSON API)
- **Database:** PostgreSQL (managed) with row-level security
- **Auth:** managed auth provider on Postgres (Supabase-style) — sign-in, invite-to-set-password, password reset. App never sees/stores plaintext passwords.
- **Files:** object storage; validate type + size and virus-scan before persisting.

## Architecture principle (non-negotiable)

**The database and API are the security boundary. The front end is never trusted.**
Visibility and permissions are enforced server-side and via RLS. The API must never return a
project a user is not permitted to see, regardless of what the UI asks for.

## Repo layout

```
CLAUDE.md            <- this file (durable memory)
SESSION_STATUS.md    <- living handoff (read first, write last)
README.md            <- how to run it
docs/PRD.docx        <- the specification (reference by section)
docs/decisions.md    <- one line per decision
docs/schema.sql      <- PostgreSQL schema (PRD §21)
client/  server/  db/
.env.example         <- required env vars (never commit real .env)
```

## Canonical vocabulary — DO NOT invent new terms

- **Roles:** `admin`, `manager`, `member`, `viewer` (one per user)
- **Project/milestone/task status:** `draft`, `in_progress`, `on_hold`, `completed`, `at_risk`
- **User status:** `active`, `inactive`
- **File types:** `pdf`, `png`, `jpg`, `docx`, `xlsx` (~25 MB cap, scanned)

## Access model (PRD §17–18)

- A user always sees their **own** projects.
- A user also sees projects owned by anyone **mapped** to them (`user_visibility`, many-to-many).
- **Admins see everything.**
- Capability is by **role**; scope is by **mapping**. They are independent.
- **Edit / create / add tasks / attach files:** owner of the project, or admin.
- **Post task update:** project owner or admin only.
- **Manage users & mappings:** admin only.

## Key rules baked into the product

- **Derived target date:** a project's target date is NOT stored. It = the latest target across the
  project's milestones and its direct (no-milestone) tasks; `—/Not set` when none. (PRD §12.2)
- **Date rules:** milestone target = required; task-under-milestone target = optional;
  task-directly-under-project target = required (DB CHECK enforces it). (PRD §12.1)
- **Updates are append-only.** Posting a new one never overwrites; prior moves to history. (PRD §13)
- **Sub-projects:** one level only, no roll-up, reached only via parent + breadcrumb. (PRD §14)
- **View vs Edit:** same layout, one toggle; Viewer role sees View only. (PRD §10–11)
- **Dates dd/mm/yyyy, currency ₹.**

## How to work here

1. **Start:** read `SESSION_STATUS.md`, then this file, then the one PRD section in scope. Don't read the whole repo.
2. **Scope:** build exactly the one slice named in `SESSION_STATUS.md`. Extra ideas → its "backlog" list, not this session.
3. **Branch:** work on `feature/<slice>`; commit small with imperative messages.
4. **Done means:** matches the PRD section + its empty/error states; validation wording matches PRD §19.1; access enforced server/DB-side; canonical vocab used; branch merged to `main`; `SESSION_STATUS.md` updated.
5. **End:** merge `feature/<slice>` → `main`, rewrite `SESSION_STATUS.md`, append any decision to `docs/decisions.md`, commit.

## Git gotcha

Claude Code commits to a **feature branch**; the local dev server shows `main` until you **merge**.
"Change not showing up" usually means an unmerged branch. Always record branch state in `SESSION_STATUS.md`.

## Build order (phases — see PRD for detail)

0 Scaffolding (repo, stack, schema+RLS, seed) · 1 Auth & shell · 2 Project list · 3 Detail View ·
4 Detail Edit · 5 Files · 6 Sub-projects · 7 Admin Users · 8 Admin Mappings · 9 Hardening.

## Do NOT (v1)

- No AI / summaries. No in-app spreadsheet. (Deferred — PRD §23)
- No Gantt, dependencies, time tracking, external/public access.
- No new role/status/enum names. No arbitrary sub-project nesting.
- No security in the UI alone. No committing real `.env`.
