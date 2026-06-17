# SESSION_STATUS.md — Project Tracker

> **Read this first, write it last.** It is the handoff between sessions.
> Keep it short. Move durable facts to `CLAUDE.md`; keep only what's moving here.

**Last updated:** 2026-06-16 (project kickoff — no code yet)
**Current phase:** Phase 0 — Scaffolding

---

## State in one line

Project not started. Repo and stack not yet scaffolded. Next action is to stand up the skeleton
and the database schema so every later phase has a real user and real tables to build on.

## Done

- _Nothing built yet._
- PRD v1 approved (see `docs/PRD.docx`). Decisions logged in `docs/decisions.md`.

## Next slice (do this session)

**Phase 0 — Scaffolding.** Per PRD §3 (platform) and §21 (schema):

1. Initialise repo with the layout in `CLAUDE.md`; create `client/` (React+Vite), `server/` (Express), `db/`.
2. Add `.env.example` and `README.md` run instructions.
3. Provision PostgreSQL + the managed auth provider.
4. Write migrations for all 8 tables + enums + the two key constraints:
   - `tasks` CHECK: `milestone_id IS NOT NULL OR target_date IS NOT NULL`
   - `user_visibility` UNIQUE(viewer_user_id, owner_user_id) + CHECK(viewer ≠ owner)
5. Add row-level security policy on `projects` for the visibility model (PRD §21.3).
6. Seed a few users (one of each role) + 2–3 sample projects for dog-fooding.

**Definition of done:** migrations run clean; `docs/schema.sql` matches; seed data loads;
client and server both start from README; a seeded admin can authenticate. Merge to `main`.

## Backlog (out of scope for the current slice)

- _(empty)_

## Blockers / open

- None.

## Branch state

- Active branch: `main` (nothing in flight).
- Unmerged work: none.

---

## Session log (newest first)

- **2026-06-16** — Kickoff. PRD v1 finalised; CLAUDE.md and SESSION_STATUS.md created. No code yet. Next: Phase 0 scaffolding.

<!--
Append one line per session, e.g.:
- YYYY-MM-DD — Built <slice>. Merged feature/<slice> to main. Next: <slice>. Blockers: <none/...>.
-->
