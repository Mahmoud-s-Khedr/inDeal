# inDeal - V1 Backend

inDeal is a B2B backend focused on v1 scope: auth, company portfolio, deals, company-to-company chat, file uploads, and support contact info.

## Tech Stack

- Backend: Node.js + Express
- Database: PostgreSQL (`pg` + Prisma ORM)
- Queue/Cache: Valkey + BullMQ
- Realtime: Socket.IO (B2B chat only)
- Storage: Cloudflare R2 (S3-compatible)
- Email: Resend

## Project Structure

- `src/modules/*`: feature-first domains (`auth`, `company`, `deal`, `chat`, `file`, `support`, `system`, `health`, `user`)
- `src/app`: HTTP app bootstrap and route composition
- `src/core`: framework-agnostic HTTP/core primitives (errors, middleware, response helpers)
- `src/infrastructure`: env/config, db/redis/queue/storage/mailer, workers, realtime bootstrap
- `src/shared`: cross-module utilities/constants with ownership index in `src/shared/OWNERSHIP.md`

## API Base

- Base path: `/api/v1`
- Swagger UI (local default): `/api/v1/docs`
- OpenAPI JSON (local default): `/api/v1/docs.json`

## V1 Endpoint Areas

- `auth`: register, login, logout, forgot/reset password, email verification
- `companies`: profile/settings, gallery, documents, contributions, reviews, search
- `deals`: CRUD + deal requests lifecycle
- `search`: unified auth-aware search feed (`GET /api/v1/search`)
- `chats`: B2B chat rooms/messages/read receipts
- `files`: signed upload URL
- `support`: support info + email redirect payload
- `system`, `health`

## Removed From V1

These endpoints were removed and now return `404`:

- `/api/v1/admin/*`
- `/api/v1/ads/*`
- `/api/v1/notifications/*`
- `/api/v1/users/me/devices*`
- `/api/v1/support/tickets*`
- `/api/v1/support/chat*`
- `/api/v1/auth/admin/login`

## Local Development

1. Install dependencies

```bash
npm install
```

2. Start infra

```bash
docker compose up --build -d
```

If port 5432 is already in use on your machine, the compose DB service uses host port `5433` by default.
Override it with `HOST_DB_PORT=<port>` when needed.

3. Apply Prisma schema

```bash
npm run prisma:generate
npm run prisma:db:push
```

4. Run API

```bash
npm run dev
```

## Swagger Docs

- Docs are enabled by default in non-production environments.
- In production, set `SWAGGER_ENABLED=true` to expose docs.
- Optional: set `API_BASE_URL` to control the server URL shown in the spec.

## Database Notes

- Legacy SQL schema/migration files under `AI_DOCS/` were removed.
- Prisma schema is now the source of truth for schema synchronization.
