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

