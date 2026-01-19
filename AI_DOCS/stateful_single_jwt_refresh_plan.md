# Stateful “Single JWT” Refresh Plan (No Frontend Interaction)

Date: 2026-01-01

## Goal

Provide a **stateful** session mechanism using **one JWT** that effectively includes “refresh” capability, with **token processing handled by the backend** (i.e., the frontend does not explicitly call `/refresh` or manage token rotation).

> Important note: A classic design uses **two tokens** (access + refresh). You asked for **one token** only. The plan below achieves the same UX by using a **single signed JWT** with:
>
> - a server-side session record (stateful)
> - an “access window” and a longer “refresh window” embedded as claims
> - automatic rotation via `Set-Cookie` so the browser updates the token without frontend code.

## Non-goals (for now)

- Multi-device session management UI
- “Remember me” variations
- Full audit trail for sessions

---

## Proposed Design

### 1) Transport (required for “no frontend interaction”)

You asked to **return the token in the response body**.

That implies the client must:

- store the token somewhere (memory/local storage/native secure storage)
- send it on every request (usually `Authorization: Bearer <token>`)

Important constraint:

- If the backend **rotates** the JWT (issues a new one), the client must start using the new token.
- Without cookies, there is **no way** for the backend to “silently” update the client’s token with _zero_ client-side handling.

What we _can_ still achieve (typical compromise):

- **No explicit refresh endpoint call** from the frontend.
- Minimal generic client handling via a single HTTP interceptor:
  - read `token` (or `nextToken`) returned in responses
  - replace the stored token automatically

If you truly want _zero_ token updates on the client, then rotation must be disabled and the same token remains until `exp` (this reduces the security value of short access windows).

### 2) Token structure (single JWT)

We use a single JWT that is **valid for the whole refresh window** (its standard `exp`), and inside it we store a separate “access expiry” claim.

- JWT standard:
  - `sub`: user id (or `id` as currently used)
  - `jti`: session token id (unique random)
  - `iat`: issued at
  - `exp`: refresh expiry (longer)

- Custom claims:
  - `aexp`: access expiry timestamp (shorter)
  - `ver`: token version (optional)

Authorization rules:

- If `now <= aexp`: treat as normal access token.
- If `aexp < now <= exp`: treat as “refresh window”. Allow request **only if session is still valid server-side**, then rotate token (new `aexp`, new `iat`, new `jti`).
- If `now > exp`: reject (session expired).

### 3) Stateful server storage (Valkey) (required)

Use **Valkey (Redis)** to track active sessions and enable revocation.

We store a _server-side session record_ keyed by `jti` (the JWT id). This makes the JWT **stateful**.

#### Key design

1. Session record (authoritative)

- Key: `sess:jti:<jti>`
- Type: Hash
- Fields:
  - `userId`
  - `status` = `active|revoked|rotated`
  - `createdAt` (ISO)
  - `lastSeenAt` (ISO)
  - `refreshExp` (unix seconds)
  - `rotatedTo` (new jti, optional)
  - `ip` (optional)
  - `userAgent` (optional)
- TTL: set to refresh window duration (expires automatically)

2. Latest session pointer (optional but recommended for replay control)

- Key: `sess:user:<userId>:latest`
- Value: `<jti>`
- TTL: same refresh window duration

Validation rules:

- Session is valid only if:
  - `sess:jti:<jti>` exists
  - `status == active`
  - `refreshExp > now`
  - (optional) `sess:user:<userId>:latest == jti` (reject older tokens after rotation)

Rotation strategy:

- On rotation:
  - create new `sess:jti:<newJti>` as `active`
  - set old `sess:jti:<oldJti>.status = rotated` and `rotatedTo = newJti`
  - update `sess:user:<userId>:latest = newJti`

This gives you:

- server-side revocation (set `status=revoked`)
- replay detection / one-active-session-per-user (if you enable the “latest pointer” check)

### 4) Automatic rotation behavior

Rotate when:

- token is in refresh window (`now > aexp`), OR
- token is close to access expiry (e.g., within 5 minutes), to avoid requests arriving after `aexp`.

Rotation result:

- Return `nextToken` in the **response body** (or `X-Session-Token` response header).
- The current request continues successfully.
- Client interceptor updates stored token automatically.

### 5) Logout

Even without a dedicated frontend call, a logout endpoint is useful.

- `POST /api/v1/auth/logout`
  - marks the current `jti` revoked
  - clears cookie (`Set-Cookie` with expired date)

(If you truly want zero frontend changes, you can still support logout later; but session revocation is important.)

---

## Required Code Changes

### A) Config

Add env settings:

- `SESSION_ACCESS_TTL_MIN` (e.g., 15)
- `SESSION_REFRESH_TTL_DAYS` (e.g., 7 or 30)

Transport mode:

- `SESSION_TRANSPORT` = `body` (this plan)

(Optional) If you later switch to cookies:

- `SESSION_COOKIE_NAME`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`

### B) JWT utilities

Extend [src/utils/jwt.js](src/utils/jwt.js):

- `signSessionToken({ userId, sessionJti, accessExpiresAt, refreshExpiresAt })`
- `verifyToken(token)` (already exists)

### B2) Valkey session helpers

Add a small helper module (recommended):

- `src/services/session.service.js` (or `src/repositories/session.repository.js`)
  Responsibilities:
- `createSession(userId, meta) -> jti`
- `getSession(jti)`
- `touchSession(jti)` (update lastSeenAt)
- `revokeSession(jti)`
- `rotateSession(oldJti, userId, meta) -> newJti`
  Implementation uses the existing Valkey client in [src/config/redis.js](src/config/redis.js).

### C) Auth service changes

Update [src/services/auth.service.js](src/services/auth.service.js):

- On `register` and `login`:
  - create a Valkey session record with `jti`
  - issue session JWT
  - controller returns `{ token, user, ... }`

- On protected requests (optional rotation):
  - if token is rotated, attach `nextToken` so the controller/response wrapper includes it in the response body

### D) Auth middleware changes

Update [src/middlewares/authMiddleware.js](src/middlewares/authMiddleware.js):

- Read JWT from `Authorization: Bearer <token>` (and optionally cookie later)
- Verify signature
- Check session state in Valkey using `jti`
- If token needs rotation, attach `req.nextSessionToken` (or similar)

### E) Response middleware (body rotation)

Add a small middleware that runs after `protect`:

- if `req.nextSessionToken` exists:
  - expose it to the response layer (e.g., `res.locals.nextToken`)
  - controllers can include it in the response payload (`{ ..., nextToken }`)

---

## Database Migration

No DB migration needed (Valkey-only session storage).

If you want durability across restarts, ensure Valkey persistence is enabled (AOF/RDB) in your deployment.

---

## Security Considerations

- Returning token in the body typically means the client stores it (often in-memory). Avoid `localStorage` for browsers if possible.
- Replay control is possible via the `sess:user:<userId>:latest` pointer check.
- Valkey persistence: if Valkey is ephemeral and restarts, all sessions will be lost (all users must log in again). Decide if that’s acceptable.

---

## API changes summary

- No need for `/refresh` if we rotate automatically.
- Add `/logout` endpoint (recommended).

Response payload conventions (recommended):

- login/register: `{ token, user, ... }`
- other endpoints: may include `{ nextToken }` when rotation happens

---

## Open questions (need your choice)

1. Confirm the real constraint you want:

- **A)** “No explicit refresh endpoint” (OK with minimal interceptor updating token)
- **B)** “Zero token handling” (then we must avoid rotation and use a longer-lived token)

2. TTLs:
   - Access window (minutes)
   - Refresh window (days)
3. Rotation policy:
   - rotate only when `now > aexp`, or also when close to `aexp`?
4. Should we allow requests in refresh window without requiring a “refresh endpoint”? (This plan: yes)
