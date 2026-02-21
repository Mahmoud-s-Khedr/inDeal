# Mobile + Frontend API Changes

Release date: 2026-02-21  
Audience: Web frontend and mobile app teams

## Client Action Checklist

1. Always read top-level `token` from successful authenticated API responses and replace stored access token.
2. If a successful response does not include `token`, keep the existing token.
3. Handle one-time post-release `401` for legacy sessions by forcing re-login.
4. Treat `POST /api/v1/auth/logout` as global logout (all web/mobile sessions revoked).
5. Update contribution forms:
   - `project` requires at least 1 contributor.
   - `partnership` requires either `partnerId` or `partnerName`.
6. Update company-doc UI assumptions:
   - Registration-submitted docs are hidden from public/general company-doc endpoints.
   - Registration documents are editable through dedicated registration-doc APIs.

## Breaking / Behavioral Changes (Read First)

## 1) Auth token lifecycle changed

- Access JWT default lifetime is now `5m`.
- Server-side Valkey session is now authoritative.
- Register/login/admin-login return JWT with claims including `jti` and session type.
- Protected endpoints rotate JWT and return it at top-level `token` on successful responses.
- No dedicated refresh endpoint exists.

## 2) Parallel request stability fix (critical backend adjustment)

- Session now tracks:
  - `activeJti`
  - `previousJti`
  - `previousJtiValidUntil`
- Previous token is accepted for a short leeway (`SESSION_ROTATE_LEEWAY_SECONDS`), so parallel in-flight requests do not randomly fail after rotation.

## 3) Existing logged-in users may see one-time 401 after deploy

- Cause: old tokens issued before this release do not include `jti`.
- Client behavior: on first 401 after upgrade, redirect once to login and resume normal flow.

## 4) Logout semantics

- New endpoint: `POST /api/v1/auth/logout`
- Protected route.
- Revokes all sessions for current user (web + mobile).

## 5) Company docs visibility and edit rules changed

- Registration-form docs are internal (`registration:*`).
- They are excluded from public/company-profile document lists.
- They cannot be edited/deleted via regular agent/admin company-doc CRUD endpoints.
- They can be edited/deleted via dedicated registration-doc APIs.

## 6) Contribution validation tightened

- `type=project` requires minimum one contributor.
- `type=partnership` requires `partnerId` or `partnerName` mapped to existing company and cannot be own company.
- Media/url update validation is stricter and type-aware.

## 7) New admin dashboard endpoint

- `GET /api/v1/admin/dashboard/cards`
- Returns counts for pending registrations, pending ads, and profile updates.

## 8) Validation normalization

- `companyIndustry` accepts case/format variants and maps to canonical enum value.

---

## Migration Guide

## Auth handling in clients

1. Send `Authorization: Bearer <token>` as before.
2. After every successful authenticated response:
   - if `response.token` exists, store/replace access token immediately.
3. On `401`:
   - if this is first request after app upgrade or cold start with old token, force login once.
   - otherwise follow normal unauthorized flow.

### Token rotation response contract

Successful authenticated response envelope:

```json
{
  "status": "success",
  "message": "Company profile fetched",
  "data": { "...": "..." },
  "token": "eyJ..."
}
```

Error responses do **not** include `token`.

## Logout flow

- Request:

```http
POST /api/v1/auth/logout
Authorization: Bearer <current-token>
```

- Response:

```json
{
  "status": "success",
  "message": "Logged out successfully",
  "data": {
    "message": "Logged out successfully"
  }
}
```

- Post-logout expectation: all existing tokens for this user become invalid on all devices.

## Contribution form updates

- For `type=project`, enforce at least 1 contributor client-side before submit.
- For `type=partnership`, submit `partnerId` or `partnerName` (one required), and show validation errors clearly.

Validation error example (`project`):

```json
{
  "status": "fail",
  "message": "Validation Error: body.contributors: contributors must contain at least one name when type is project"
}
```

Validation error example (`partnership` invalid partner):

```json
{
  "status": "fail",
  "message": "partnerId or partnerName is required when type is partnership"
}
```

## Company documents UI updates

- Document lists now exclude registration-form documents.
- Do not expose edit/delete actions for registration-submitted docs.
- Document payloads may include:
  - `issueDate`
  - `expiryDate`

Example list item (public/company documents):

```json
{
  "id": 12,
  "companyId": 3,
  "fileId": 99,
  "fileUrl": "https://...",
  "docType": "certificate",
  "title": "ISO 9001",
  "issuer": "TUV",
  "description": "Quality certification",
  "issueDate": "2025-01-10",
  "expiryDate": "2028-01-10",
  "uploadedAt": "2025-01-12T09:00:00.000Z"
}
```

---

## Detailed Endpoint Changes

## Auth

- `POST /api/v1/auth/register`
  - still returns token + user + company.
  - token now session-backed with short expiry.
- `POST /api/v1/auth/login`
  - same route; returns session-backed short-lived token.
- `POST /api/v1/auth/admin/login`
  - same behavior as login for admin role.
- `POST /api/v1/auth/logout` (new)
  - protected, revokes all user sessions.

Login response example:

```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "token": "eyJ...",
    "user": { "id": 5, "role": "agent" },
    "company": { "id": 8, "status": "underReview" }
  }
}
```

## Company / Documents

- `GET /api/v1/companies/me`
- `GET /api/v1/companies/:id`
- `GET /api/v1/companies/me/documents`
- `GET /api/v1/companies/me/registration-documents`
- `PUT /api/v1/companies/me/registration-documents/:registrationDocumentId`
- `DELETE /api/v1/companies/me/registration-documents/:registrationDocumentId`
- `GET /api/v1/admin/companies/:id/registration-documents`
- `PUT /api/v1/admin/companies/:id/registration-documents/:registrationDocumentId`
- `DELETE /api/v1/admin/companies/:id/registration-documents/:registrationDocumentId`
- Admin company doc listing routes
  - registration docs filtered out from public-facing document lists.
- Edit/delete doc routes reject registration docs.

## Contributions

- `POST /api/v1/companies/me/contributions`
  - `type=project` must have contributors length >= 1.
  - `type=partnership` partner must be valid existing company and not own company.
  - partnership accepts `partnerId` or `partnerName` (one required).
- `PUT /api/v1/companies/me/contributions/:contributionId`
  - stricter media-type/url/file consistency.
  - partnership/project constraints enforced on update paths too.

## Admin

- `GET /api/v1/admin/dashboard/cards` added.

Response shape:

```json
{
  "status": "success",
  "message": "Dashboard cards fetched",
  "data": {
    "cards": {
      "newRegistrationRequests": { "count": 0 },
      "pendingAdverts": { "count": 0 },
      "profileUpdates": { "count": 0 }
    },
    "generatedAt": "2026-02-21T12:00:00.000Z"
  }
}
```

---

## Error Handling Expectations

- `401` with auth routes typically means:
  - invalid/expired token and no valid server session, or
  - legacy pre-release token missing `jti`.
- For token rotation:
  - token may be rejected outside previous-jti leeway window if stale.
- `400` expected for new contribution/document business rule violations.

---

## Rollout Notes + Compatibility

1. Deploy backend first.
2. Frontend/mobile should ship token-rotation consumption as soon as possible.
3. During transition, one-time login may be required for already authenticated users.
4. Parallel requests are supported within configured jti leeway.

---

## Quick Changelog

| Area          | Change                                                            | Client impact                         |
| ------------- | ----------------------------------------------------------------- | ------------------------------------- |
| Auth          | JWT TTL -> 5m                                                     | Must update token frequently          |
| Auth          | Server-side session authoritative                                 | Token validity tied to Valkey session |
| Auth          | Token rotation in successful protected responses (`token`)        | Store replacement token each response |
| Auth          | New `POST /auth/logout`                                           | Global sign-out across devices        |
| Auth          | Previous-jti leeway                                               | Parallel request stability            |
| Company Docs  | Registration docs hidden from normal/public lists                 | UI list differences                   |
| Company Docs  | Registration docs edited via dedicated registration-doc endpoints | Route-level UI handling               |
| Contributions | Project contributor minimum + partnership partner validation      | Stronger form validation              |
| Admin         | New dashboard cards endpoint                                      | Optional dashboard integration        |
| Validation    | companyIndustry normalization                                     | More tolerant input formatting        |
