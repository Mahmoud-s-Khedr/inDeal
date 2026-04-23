# V1 User Flow (Client Interaction Contract)

This document is the source of truth for V1 client simulation behavior.

## Personas

- Guest user: unauthenticated visitor exploring public data and auth entry points.
- Company Admin A: newly registered company admin who publishes profile/deals.
- Company Admin B: newly registered company admin who applies to deals and chats.

## Happy Path (Primary)

1. Guest reads bootstrap endpoints:

- `GET /api/v1/health`
- `GET /api/v1/system/config`
- `GET /api/v1/companies/search`
- `GET /api/v1/deals`
- `GET /api/v1/support/info`
- `GET /api/v1/support/email-redirect`

2. Company Admin A registration and session:

- `POST /api/v1/auth/register/upload-url`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/users/me`
- `GET /api/v1/companies/me`

3. Company Admin B registration and session:

- same sequence as Admin A.

4. Company setup for each admin:

- `POST /api/v1/files/upload-url`
- `PUT /api/v1/companies/me`
- Gallery CRUD under `/api/v1/companies/me/gallery`
- Documents CRUD under `/api/v1/companies/me/documents`
- Contributions CRUD under `/api/v1/companies/me/contributions`
- Contribution media CRUD under `/api/v1/companies/me/contributions/:contributionId/media`

5. Deals lifecycle:

- Admin A creates deal: `POST /api/v1/deals` (`dealType: supply|demand`)
- Admin B discovers deal: `GET /api/v1/deals`, `GET /api/v1/deals/:id`
- Admin B submits request: `POST /api/v1/deals/:id/requests` (`requestKind` + structured payload)
- Admin A reviews requests: `GET /api/v1/deals/:id/requests`
- Admin A accepts request: `PATCH /api/v1/deals/:dealId/requests/:requestId/status`
- Both inspect personal lists: `/api/v1/deals/me/deals`, `/api/v1/deals/me/requests`

6. Reviews and chat:

- Admin B posts review to Admin A company using accepted deal ID:
  `POST /api/v1/companies/:id/reviews`
- Chat room setup and usage:
  `POST /api/v1/chats`, `GET /api/v1/chats`, `GET /api/v1/chats/:roomId`,
  `POST /api/v1/chats/:roomId/messages`, `GET /api/v1/chats/:roomId/messages`,
  `POST /api/v1/chats/:roomId/read`, `PATCH /api/v1/chats/:roomId/archive`

7. Password recovery flow (dev/test OTP support):

- `POST /api/v1/auth/forgot-password`
- client reads dev OTP from response (non-production only)
- `POST /api/v1/auth/verify-otp`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/login` with new password

## Mixed Coverage (Targeted Negative Cases)

- Unauthorized checks for protected endpoints should return `401`.
- Forbidden checks for cross-company protected resources should return `403`.
- Removed V1 namespaces should return `404`:
- `/api/v1/admin/*`
- `/api/v1/ads/*`
- `/api/v1/notifications/*`
- `/api/v1/support/tickets*`
- `/api/v1/support/chat*`
- `/api/v1/users/me/devices*`
- `/api/v1/auth/admin/login`
- `/api/v1/auth/resend-verification`
- `/api/v1/auth/verify-email`

## Expected State Transitions

- Registration creates verified user session token and associated company record.
- Deal request transitions: `pending -> paused|canceled|accepted|rejected`.
- Review creation requires accepted deal relationship.
- Chat room can be read/archived only by room participants.
- OTP debug payload must appear only in non-production when enabled by config.

## Simulation Output Contract

Each simulated step must include:

- `stepId`, `role`, `method`, `path`
- request payload/query
- `expectedStatus` and/or `expectedStatusFamily`
- actual status and assertion result
- parsed response payload

Summary must include:

- total steps
- passed/failed assertion counts
- status-family breakdown
