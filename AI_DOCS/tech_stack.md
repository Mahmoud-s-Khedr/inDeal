# inDeal V1 Tech Stack

## Core Backend

- Node.js
- Express.js

## Data Layer

- PostgreSQL
- `pg` (raw SQL)

## Async/Queue

- Valkey
- BullMQ
- ioredis

## Realtime

- Socket.IO
- `@socket.io/redis-adapter` (optional horizontal scaling)

## Storage

- Cloudflare R2
- AWS SDK for S3-compatible access

## Email

- Resend

## Security & Validation

- Zod
- bcryptjs
- JWT
- Helmet

## Notes for V1

- Firebase/FCM push notifications are not part of v1.
- Admin control-plane APIs are not part of v1.
- Ads, notification center/device tokens, and support ticket/live-chat modules are not part of v1.
