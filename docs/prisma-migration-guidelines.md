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
