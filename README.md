# inDeal - V1 Backend

inDeal is a B2B backend focused on v1 scope: auth, company portfolio, deals, company-to-company chat, file uploads, and support contact info.

## Tech Stack

- Backend: Node.js + Express
- Database: PostgreSQL (`pg`, raw SQL)
- Queue/Cache: Valkey + BullMQ
- Realtime: Socket.IO (B2B chat only)
- Storage: Cloudflare R2 (S3-compatible)
- Email: Resend

## API Base

- Base path: `/api/v1`

## V1 Endpoint Areas

- `auth`: register, login, logout, forgot/reset password, OTP verification
- `companies`: profile/settings, gallery, documents, contributions, reviews, search
- `deals`: CRUD + deal requests lifecycle
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
- `/api/v1/auth/resend-verification`
- `/api/v1/auth/verify-email`

## Local Development

1. Install dependencies

```bash
npm install
```

2. Start infra

```bash
docker compose up --build -d
```

3. Apply schema/migrations

```bash
npm run db:schema
```

4. Run API

```bash
npm run dev
```

## Destructive V1 De-scope Migration

Use migration:

- `AI_DOCS/migrations/014_v1_descope_remove_non_target.sql`

Before running it, take a full DB backup snapshot.
