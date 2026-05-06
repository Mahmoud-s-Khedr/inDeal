# Prisma Migration Guidelines

Use Prisma ORM as the default data access layer. Keep raw SQL only when there is a clear, justified benefit.

## Allowed Raw SQL Cases

- Multi-table or CTE-heavy queries that are clearer or safer in SQL.
- Atomic DB-native operations that rely on PostgreSQL features (for example `jsonb` operators, window functions).
- Benchmarked hot paths where raw SQL is measurably faster.
- Caller-owned transaction flows that must run on the same PG client connection.

## Current Exception List (Stabilization Scope)

- `src/repositories/user.repository.js`
  - `createUser` (transaction-scoped raw SQL path)
  - `updateStatus` when `client` is provided (transaction-scoped raw SQL path)
  - password history methods when `client` is provided
- `src/repositories/file.repository.js`
  - `softDelete` (single-statement conditional update)
  - `updateMetadata` (atomic `jsonb` merge)
- `src/repositories/emailLog.repository.js`
  - `getStats` (single aggregate query path)

## Rule for New Exceptions

When adding raw SQL, include a short comment near the method explaining why Prisma is not used there.

## Migration Drift Recovery (Local Docker)

If Prisma reports `No pending migrations` but runtime/seed fails with missing tables (for example `P2021` on `public.users`), your local DB volume is likely out of sync with repo migration history.

Use this recovery flow:

1. Stop and remove local containers + volumes:
   - `docker compose down -v`
2. Rebuild and restart:
   - `docker compose up --build`
3. Confirm startup sequence:
   - `prisma migrate deploy` succeeds
   - `node scripts/verify-schema.js` passes
   - seeding succeeds

Notes:

- This reset is for local development only and deletes local data.
- Baseline migration is tracked in `prisma/migrations/20250101000000_baseline_init`.
