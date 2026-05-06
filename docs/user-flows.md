# inDeal V1 User Flows (Client -> Backend)

Source of truth used for this document:

- HTTP contracts: `src/core/contracts/http/registry.js` (`getAllHttpContracts`)
- Socket contracts: `src/core/contracts/socket/events.js`
- Route wiring: `src/app/routing/v1.js`
- Socket handlers: `src/infrastructure/sockets/chat.handler.js`

Base URL: `/api/v1`

## 1) API Review Matrix (Code-Driven)

### 1.1 Coverage and Consistency Checks

- Swagger coverage: `node scripts/verify-swagger-coverage.js` -> passed (`71/71` discovered operations documented).
- HTTP contract coverage: `node scripts/verify-http-contract-coverage.js` -> passed (`71` operations with required metadata).
- Socket contract coverage: `node scripts/verify-socket-contract-coverage.js` -> **failed** with missing receive contract for `disconnect`.

### 1.2 Inventory Summary

- HTTP operations: `71`
- Socket events in contract registry: `11`
- Module groups reviewed: `auth`, `users`, `companies`, `files`, `deals`, `chats`, `search`, `system`, `health`

### 1.3 HTTP Module Matrix

| Module    | Prefix       | Auth Pattern                                      | Operations |
| --------- | ------------ | ------------------------------------------------- | ---------: |
| auth      | `/auth`      | mixed public + protected (`logout`, `resubmit`)   |         11 |
| users     | `/users`     | protected (`/me` profile area)                    |          5 |
| companies | `/companies` | mixed public + protected (`/me` area protected)   |         31 |
| files     | `/files`     | mixed (`upload-url` protected, `GET /:id` public) |          2 |
| deals     | `/deals`     | mixed (public search/read, protected mutations)   |         13 |
| chats     | `/chats`     | all protected                                     |          7 |
| search    | `/search`    | optional auth (`optionalAuth`)                    |          1 |
| system    | `/system`    | public                                            |          2 |
| health    | `/health`    | public                                            |          1 |

### 1.4 Socket Event Matrix

| Event              | Direction | Auth     | Notes                                         |
| ------------------ | --------- | -------- | --------------------------------------------- |
| `chat:message`     | receive   | required | client sends room message payload             |
| `chat:message`     | send      | required | server broadcasts persisted message           |
| `chat:read`        | receive   | required | client marks room/message as read             |
| `chat:read`        | send      | required | server broadcasts read receipt + unread count |
| `chat:typing`      | receive   | required | client typing indicator                       |
| `chat:typing`      | send      | required | server broadcasts typing indicator            |
| `chat:ready`       | send      | required | server initial room join result               |
| `chat:error`       | send      | required | server validation/business error event        |
| `chat:room:new`    | send      | required | server notifies room created                  |
| `notification:new` | send      | required | generic notification event                    |

### 1.5 Deprecated/Removed Surface (README-aligned)

These are intentionally removed in V1 and should be treated as `404`:

- `/api/v1/admin/*`
- `/api/v1/ads/*`
- `/api/v1/notifications/*`
- `/api/v1/users/me/devices*`
- `/api/v1/auth/admin/login`

---

## 2) Task-Oriented User Flows

Flow template:

- Goal
- Preconditions
- HTTP sequence
- Socket sequence (if applicable)
- Failure and client handling

## Flow A: Registration -> Verify Email -> Login -> Logout

Goal: create account and establish authenticated session.

Preconditions:

- User is not authenticated.
- Client can receive verification email out-of-band.

HTTP sequence:

1. `POST /auth/register/upload-url` (optional if profile/registration files are needed).
   - Example request:

   ```json
   { "fileName": "tax-card.pdf", "mimeType": "application/pdf" }
   ```

   - Expected response shape: signed upload URL + storage path metadata.

2. Upload binary directly to storage using signed URL from step 1.
3. `POST /auth/register`
   - Example request (minimal):

   ```json
   {
     "firstName": "Ali",
     "lastName": "Hassan",
     "email": "ali@example.com",
     "password": "StrongPass123!",
     "companyName": "Acme LLC"
   }
   ```

   - Expected response shape: created user/company + auth/session token info.

4. `POST /auth/verify-email`
   - Example request:

   ```json
   { "email": "ali@example.com", "otp": "123456" }
   ```

   - Expected response shape: email verification success.

5. `POST /auth/login`
   - Example request:

   ```json
   { "email": "ali@example.com", "password": "StrongPass123!" }
   ```

   - Expected response shape: auth token/cookie and user context.

6. `POST /auth/logout` (authenticated).

Socket sequence:

- None required.

Failure/client handling:

- Validation errors (`400`): highlight exact fields.
- Invalid/expired OTP: allow `POST /auth/resend-verification`.
- Unverified account on login: direct to verify screen.

## Flow B: Forgot Password -> OTP Verify -> Reset Password

Goal: recover account access without active session.

Preconditions:

- User knows account email.

HTTP sequence:

1. `POST /auth/forgot-password`
   ```json
   { "email": "ali@example.com" }
   ```
2. `POST /auth/verify-otp`
   ```json
   { "email": "ali@example.com", "otp": "123456" }
   ```
3. `POST /auth/reset-password`
   ```json
   {
     "email": "ali@example.com",
     "otp": "123456",
     "newPassword": "NewStrongPass123!"
   }
   ```
4. Optional retry path: `POST /auth/resend-forgot-password-otp`.

Socket sequence:

- None.

Failure/client handling:

- OTP mismatch/expiry: force resend path.
- Password policy failure: inline policy hints before submit.

## Flow C: Company Profile Completion -> Review/Resubmission Lifecycle

Goal: keep company profile and portfolio data up-to-date.

Preconditions:

- Authenticated user with company context.

HTTP sequence:

1. `GET /companies/me` to fetch current profile/status.
2. `PUT /companies/me` to update company metadata.
3. Manage gallery:
   - `GET /companies/me/gallery`
   - `POST /companies/me/gallery`
   - `PUT /companies/me/gallery/:galleryItemId`
   - `DELETE /companies/me/gallery/:galleryItemId`
4. Manage documents:
   - `GET /companies/me/documents`
   - `POST /companies/me/documents`
   - `PUT /companies/me/documents/:documentId`
   - `DELETE /companies/me/documents/:documentId`
5. Manage registration documents:
   - `GET /companies/me/registration-documents`
   - `PUT /companies/me/registration-documents/:registrationDocumentId`
   - `DELETE /companies/me/registration-documents/:registrationDocumentId`
6. Manage contributions + media:
   - `GET/POST/PUT/DELETE /companies/me/contributions...`
   - `GET/POST/PUT/DELETE /companies/me/contributions/:contributionId/media...`
   - `PUT /companies/me/contributions/:contributionId/media/reorder`
     Socket sequence:

- None required for core lifecycle.

Failure/client handling:

- Auth errors (`401/403`): refresh auth and redirect to login if needed.
- Entity not found (`404`) on update/delete: refresh list and reconcile stale UI state.

## Flow D: File Upload Lifecycle (Reusable)

Goal: attach files to profile/deals/chat messages.

Preconditions:

- For general uploads: authenticated user (`POST /files/upload-url` is protected).
- For registration-phase uploads: use auth registration upload URL endpoint.

HTTP sequence:

1. Create signed URL:
   - `POST /files/upload-url` (authenticated), or
   - `POST /auth/register/upload-url` (registration phase).
2. Upload binary directly to storage using returned signed URL.
3. Persist returned `fileId`/path reference in target API request (deal attachments, company docs, chat `attachmentFileId`, etc).
4. Resolve file for rendering with `GET /files/:id` when needed.

Socket sequence:

- Optional in chat flow when attachment is sent through `chat:message`.

Failure/client handling:

- Signed URL expiry: regenerate URL and retry upload.
- Ownership constraints (chat attachment): if backend returns `403`, require uploading file using current user context.

## Flow E: Deals Lifecycle (Create/Search/View/Update/Archive)

Goal: publish and manage deals.

Preconditions:

- Create/update/archive requires authenticated user with company context.
- Create additionally requires active company status.

HTTP sequence:

1. Public discovery:
   - `GET /deals` with query filters.
   - `GET /deals/:id` for details.
2. Owner management (authenticated):
   - `GET /deals/me/deals`
   - `POST /deals`
     ```json
     {
       "dealName": "Steel Supply",
       "dealDescription": "Monthly supply",
       "dealType": "supply",
       "dealValue": 20000,
       "attachments": [{ "fileId": 123, "kind": "file", "sortOrder": 1 }]
     }
     ```
   - `PUT /deals/:id`
   - `DELETE /deals/:id` (archive behavior)

Socket sequence:

- None required for deal CRUD.

Failure/client handling:

- Open deal limit reached (`400`): show limit message and route user to close existing deals.
- Company inactive (`403`): block creation and prompt profile/status action.

## Flow F: Applications/Requests Lifecycle (Applicant + Owner)

Goal: submit offers/requests to deals and manage both "My Applications" and "My Requests" buckets.

Preconditions:

- Applicant authenticated and not the same company as deal owner.
- Target deal is valid and requestable.

HTTP sequence:

1. Applicant submits request:
   - Direct RFQ: `POST /deals/direct-requests`
   - In-supply deal application: `POST /deals/:id/requests`
   - Direct request example:
   ```json
   {
     "targetCompanyId": 45,
     "requestKind": "rfq",
     "requestType": "direct",
     "supplyDetails": {
       "productServiceName": "Steel coils",
       "category": "rawMaterial",
       "supplyType": "assembleToOrder"
     }
   }
   ```

   - In-supply request example:
   - `POST /deals/:id/requests`
   ```json
   {
     "requestKind": "rfq",
     "requestType": "inSupply",
     "supplyDetails": {
       "productServiceName": "Steel coils",
       "category": "rawMaterial",
       "supplyType": "assembleToOrder",
       "qualityLevel": "other",
       "qualityLevelOtherText": "Aerospace grade"
     },
     "attachments": [{ "fileId": 321, "sortOrder": 1 }]
   }
   ```

   - `requestType` accepts `direct` or `inSupply`.
   - Direct endpoint enforces `requestType=direct`.
   - Deal-scoped endpoint normalizes to `requestType=inSupply`.
2. Applicant tracks submitted offers (My Applications):
   - `GET /deals/me/applications`
   - Returns submitted offers only (`requestKind = demand`).
3. Applicant tracks requests (My Requests):
   - `GET /deals/me/requests`
   - Returns request records (`requestKind in [supply, rfq]`) plus direct requests (`requestType=direct`).
   - Optional filter: `requestType` (`direct` or `inSupply`).
4. Deal owner reviews incoming requests:
   - `GET /deals/:id/requests`
5. Deal owner updates status:
   - `PATCH /deals/:dealId/requests/:requestId/status`
6. Applicant lifecycle controls:
   - `PATCH /deals/requests/:requestId/pause`
   - `PATCH /deals/requests/:requestId/cancel`
   - `DELETE /deals/requests/:requestId` (legacy withdraw alias)

Socket sequence:

- None directly required by this module.

Failure/client handling:

- Authorization errors for wrong role/company (`403`): hide forbidden actions by role in UI.
- Invalid request status transition (`400`): refresh request state and re-render available actions.
- Validation failures (`400`) to surface explicitly:
  - `stockDeliveryTime` is no longer accepted in request payloads.
  - `colorFinish` is no longer accepted in request payloads.
  - `supplyType` must be one of `inStock`, `assembleToOrder`, `makeToOrder`, `engineerToOrder`.
  - `qualityLevelOtherText` is required when `qualityLevel = other` and forbidden otherwise.

## Flow G: Chat Enablement + Realtime Messaging

Goal: chat between companies after business context exists.

Preconditions:

- Authenticated user with valid company.
- Frontend should enforce business rule: chat entry point appears after a valid deal/request context exists.
- Backend technical constraint for room creation: target company must exist and be active.

HTTP sequence:

1. Discover/create room:
   - `GET /chats` to list rooms.
   - `POST /chats` to create or get room with target company.
   ```json
   { "targetCompanyId": 45 }
   ```
2. Room and history:
   - `GET /chats/:roomId`
   - `GET /chats/:roomId/messages`
3. REST fallback message path:
   - `POST /chats/:roomId/messages`
   ```json
   { "messageText": "Hello", "attachmentFileId": 123 }
   ```
4. Read state + archival:
   - `POST /chats/:roomId/read`
   - `PATCH /chats/:roomId/archive`

Socket sequence:

1. Connect Socket.IO with auth token in handshake.
2. Wait for server `chat:ready` event:
   ```json
   { "b2bRoomIds": [10, 11], "error": null }
   ```
3. Send message:
   - emit `chat:message`

   ```json
   { "roomId": 10, "messageText": "Hello", "attachmentFileId": 123 }
   ```

   - listen for `chat:message` broadcast.

4. Typing indicator:
   - emit `chat:typing` with `{ "roomId": 10, "isTyping": true }`
   - listen for `chat:typing`.
5. Read receipts:
   - emit `chat:read` with `{ "roomId": 10, "messageId": 999 }` (messageId optional)
   - listen for `chat:read`.
6. Listen for room creation and generic notifications:
   - `chat:room:new`
   - `notification:new`

Failure/client handling:

- Invalid socket payload -> `chat:error`; client should validate payload before emit.
- Room inactive/unauthorized (`400/403/404`): refresh rooms list and lock input.
- Attachment ownership check (`403`): prompt re-upload from current account.

## Flow H: Unified Search

Goal: global search experience with optional auth context.

Preconditions:

- None (auth optional).

HTTP sequence:

1. `GET /search` with query parameters.
   - Public users: receives public-safe search results.
   - Authenticated users: receives auth-aware results (via optional auth middleware context).

Socket sequence:

- None.

Failure/client handling:

- Validation errors on query params: normalize query-building client side.
- Empty results: render zero-state, not error-state.

---

## 3) Supporting/Utility APIs Outside Core Task Flows

These APIs are still part of the reviewed surface and should be documented in client SDK/router maps:

- `GET /health`
- `GET /system/config`
- `GET /system/stats`
- Public company discovery/read endpoints (`/companies/search`, `/companies/:id`, `/companies/:id/*`)
- User profile settings (`/users/me`, password/profile-image endpoints)

---

## 4) Maintenance: Keep This Document in Sync

When endpoints/events change:

1. Re-run:
   - `node scripts/verify-swagger-coverage.js`
   - `node scripts/verify-http-contract-coverage.js`
   - `node scripts/verify-socket-contract-coverage.js`
2. Rebuild inventory from:
   - `src/core/contracts/http/registry.js`
   - `src/core/contracts/socket/events.js`
3. Update affected flows in this file (preconditions, sequence, payload samples, failures).
4. Confirm removed/deprecated endpoints remain aligned with `README.md`.
5. Ensure each HTTP endpoint/socket event is either:
   - used in a flow, or
   - listed in "Supporting/Utility APIs".

Current known gap to resolve in codebase:

- Add/decide contract coverage for socket `disconnect` event to satisfy `scripts/verify-socket-contract-coverage.js`.
